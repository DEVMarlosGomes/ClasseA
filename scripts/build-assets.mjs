// Builds brand and photo assets from assets-src/.
//  - logo.svg: vector trace of the supplied logo (gold layer over a black backing silhouette)
//  - logo-mark.svg: the razor "A" only
//  - favicon, PWA icons, OG image
//  - AVIF/WebP photo variants (colour + grayscale) for the landing page
// Run: npm run assets
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import potrace from 'potrace';

const SRC = 'assets-src';
const BRAND = 'public/brand';
const IMAGES = 'public/images';
const GOLD = '#E9B542';
const INK = '#050505';

// Bounds of the artwork inside logo.jpg (measured: gold pixels span 51,241 → 1202,966).
const LOGO_BOX = { left: 36, top: 226, width: 1182, height: 756 };
// The razor "A": everything left of the blade's outer edge (the "e" and the big swash) is masked out,
// leaving the swash stub that crosses the blade as the crossbar, like the mark on the cap.
const MARK_BOX = { left: 760, top: 226, width: 458, height: 640 };
const markKeep = (x, y) => x >= 60 + (620 - y) * (155 / 450);
const SCALE = 3;

function trace(buffer, params) {
  return new Promise((resolve, reject) => {
    const p = new potrace.Potrace();
    p.setParameters({ turdSize: 6, optTolerance: 0.25, alphaMax: 1, threshold: 128, ...params });
    p.loadImage(buffer, (err) => {
      if (err) reject(err);
      else resolve(p.getPathTag().match(/ d="([^"]+)"/)[1]);
    });
  });
}

/** Upscales a crop and returns its red channel (gold is bright red, black outlines are dark). */
async function redChannel(box) {
  const width = box.width * SCALE;
  const height = box.height * SCALE;
  const data = await sharp(`${SRC}/logo.jpg`)
    .extract(box)
    .resize(width, height, { kernel: 'lanczos3' })
    .extractChannel(0)
    .blur(0.8)
    .raw()
    .toBuffer();
  return { data, width, height };
}

/** Pixels not reachable from the border through dark pixels belong to the artwork silhouette. */
function silhouette({ data, width, height }, threshold = 110) {
  const outside = new Uint8Array(width * height);
  const stack = [];
  const push = (x, y) => {
    const i = y * width + x;
    if (!outside[i] && data[i] < threshold) {
      outside[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }
  while (stack.length) {
    const i = stack.pop();
    const x = i % width;
    const y = (i / width) | 0;
    if (x > 0) push(x - 1, y);
    if (x < width - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < height - 1) push(x, y + 1);
  }
  const out = Buffer.alloc(width * height);
  for (let i = 0; i < out.length; i++) out[i] = outside[i] ? 255 : 0;
  return out;
}

async function toPng(raw, width, height) {
  return sharp(raw, { raw: { width, height, channels: 1 } }).png().toBuffer();
}

/** Silhouette of the whole logo, sliced to `box`, so cropping never opens an outline to the outside. */
async function silhouetteFor(box) {
  const full = await redChannel(LOGO_BOX);
  const sil = silhouette(full);
  const width = box.width * SCALE;
  const height = box.height * SCALE;
  const dx = (box.left - LOGO_BOX.left) * SCALE;
  const dy = (box.top - LOGO_BOX.top) * SCALE;
  const out = Buffer.alloc(width * height, 255);
  for (let y = 0; y < height; y++) sil.copy(out, y * width, (y + dy) * full.width + dx, (y + dy) * full.width + dx + width);
  return out;
}

async function vectorize(box, name, keep) {
  const red = await redChannel(box);
  const back = await silhouetteFor(box);
  if (keep) {
    for (let y = 0; y < red.height; y++)
      for (let x = 0; x < red.width; x++)
        if (!keep(x / SCALE, y / SCALE)) {
          red.data[y * red.width + x] = 0;
          back[y * red.width + x] = 255;
        }
  }
  // potrace traces dark pixels, so invert the red channel for the gold layer.
  const inverted = Buffer.from(red.data.map((v) => 255 - v));
  const goldPath = await trace(await toPng(inverted, red.width, red.height), {});
  const backPath = await trace(await toPng(back, red.width, red.height), { turdSize: 40 });
  const vb = `0 0 ${red.width} ${red.height}`;
  const svg = (back) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="img" aria-label="Classe A Barbearia">` +
    (back ? `<path fill="${INK}" fill-rule="evenodd" d="${backPath}"/>` : '') +
    `<path fill="${GOLD}" fill-rule="evenodd" d="${goldPath}"/></svg>`;
  await writeFile(`${BRAND}/${name}.svg`, svg(true));
  await writeFile(`${BRAND}/${name}-gold.svg`, svg(false));
  return { width: red.width, height: red.height, svg: svg(true) };
}

async function icons(markSvg) {
  const mark = Buffer.from(markSvg);
  const square = async (size, pad, radius) => {
    const inner = Math.round(size * (1 - pad * 2));
    const glyph = await sharp(mark, { density: 600 }).resize(inner, inner, { fit: 'contain', background: '#0000' }).png().toBuffer();
    const bg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="100%" height="100%" rx="${radius}" fill="${INK}"/></svg>`,
    );
    return sharp(bg).composite([{ input: glyph, gravity: 'center' }]).png().toBuffer();
  };
  await writeFile(`${BRAND}/icon-192.png`, await square(192, 0.14, 0));
  await writeFile(`${BRAND}/icon-512.png`, await square(512, 0.14, 0));
  await writeFile(`${BRAND}/icon-maskable-512.png`, await square(512, 0.24, 0));
  await writeFile(`${BRAND}/apple-touch-icon.png`, await square(180, 0.14, 0));
  const glyph = markSvg.replace(/<svg[^>]*>/, '').replace('</svg>', '');
  const [, , w, h] = markSvg.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
  const s = Math.max(w, h) * 1.3;
  await writeFile(
    `${BRAND}/favicon.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-(s - w) / 2} ${-(s - h) / 2} ${s} ${s}"><rect x="${-(s - w) / 2}" y="${-(s - h) / 2}" width="${s}" height="${s}" rx="${s * 0.2}" fill="${INK}"/>${glyph}</svg>`,
  );
}

async function ogImage(logoSvg) {
  const logo = await sharp(Buffer.from(logoSvg), { density: 300 }).resize(900).png().toBuffer();
  const bg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><defs><radialGradient id="g" cx="50%" cy="48%" r="55%"><stop offset="0" stop-color="#E9B542" stop-opacity=".28"/><stop offset="1" stop-color="#050505" stop-opacity="0"/></radialGradient></defs><rect width="1200" height="630" fill="${INK}"/><rect width="1200" height="630" fill="url(#g)"/></svg>`,
  );
  await sharp(bg).composite([{ input: logo, gravity: 'center' }]).jpeg({ quality: 86 }).toFile(`${BRAND}/og-image.jpg`);
}

const PHOTOS = [
  { name: 'interior', widths: [640, 1086], gray: true },
  { name: 'fachada', widths: [640, 1086], gray: true },
  // Details cropped from the real interior photo for the gallery.
  { name: 'mural', from: 'interior', box: { left: 170, top: 300, width: 260, height: 720 }, widths: [520], gray: true },
  { name: 'letreiro', from: 'interior', box: { left: 520, top: 440, width: 420, height: 300 }, widths: [840], gray: false },
  { name: 'cadeira', from: 'interior', box: { left: 200, top: 940, width: 600, height: 508 }, widths: [620], gray: true },
];

async function photos() {
  for (const photo of PHOTOS) {
    const base = () => {
      const img = sharp(`${SRC}/${photo.from ?? photo.name}.jpg`);
      return photo.box ? img.extract(photo.box) : img;
    };
    for (const width of photo.widths) {
      for (const gray of photo.gray ? [false, true] : [false]) {
        const suffix = `${gray ? '-gray' : ''}-${width}`;
        const pipeline = () => {
          let img = base().resize({ width, withoutEnlargement: false });
          if (gray) img = img.grayscale().modulate({ brightness: 0.95 });
          return img;
        };
        await pipeline().avif({ quality: 52, effort: 6 }).toFile(`${IMAGES}/${photo.name}${suffix}.avif`);
        await pipeline().webp({ quality: 72 }).toFile(`${IMAGES}/${photo.name}${suffix}.webp`);
      }
    }
  }
}

await mkdir(BRAND, { recursive: true });
await mkdir(IMAGES, { recursive: true });
const logo = await vectorize(LOGO_BOX, 'logo');
const mark = await vectorize(MARK_BOX, 'logo-mark', markKeep);
await icons(mark.svg);
await ogImage(logo.svg);
if (!process.argv.includes('--brand-only')) await photos();
console.log('logo', logo.width, 'x', logo.height, '· mark', mark.width, 'x', mark.height);
