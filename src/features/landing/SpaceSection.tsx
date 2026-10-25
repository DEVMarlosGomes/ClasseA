import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { WaveDivider } from '@/components/ui/Divider';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { cn } from '@/lib/cn';

interface Photo {
  name: string;
  width: number;
  alt: string;
  caption: string;
  gray: boolean;
  className: string;
  speed: number;
}

const PHOTOS: Photo[] = [
  {
    name: 'fachada',
    width: 1086,
    alt: 'Fachada preta da Classe A Barbearia com o letreiro dourado e a calçada portuguesa ondulada',
    caption: 'A fachada',
    gray: true,
    className: 'row-span-2',
    speed: -24,
  },
  {
    name: 'letreiro',
    width: 840,
    alt: 'Letreiro dourado retroiluminado na parede preta do salão',
    caption: 'O letreiro',
    gray: false,
    className: 'md:col-span-2',
    speed: 16,
  },
  {
    name: 'mural',
    width: 520,
    alt: 'Mural em preto e branco com ídolos brasileiros pintado na parede',
    caption: 'O mural',
    gray: true,
    className: 'col-span-2 md:col-span-1 md:row-span-2 md:col-start-4 md:row-start-1',
    speed: -16,
  },
  {
    name: 'cadeira',
    width: 620,
    alt: 'Cadeira de barbeiro branca sobre o piso de mármore',
    caption: 'A cadeira',
    gray: true,
    className: 'md:col-span-2',
    speed: 18,
  },
];

function GalleryPhoto({ photo }: { photo: Photo }) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : [photo.speed, -photo.speed]);
  const base = `/images/${photo.name}${photo.gray ? '-gray' : ''}`;
  const color = `/images/${photo.name}`;
  return (
    <figure ref={ref} className={cn('group relative overflow-hidden rounded-[20px] border border-gold-500/12', photo.className)}>
      <motion.div className="absolute -inset-y-10 inset-x-0" style={{ y }}>
        <picture className="block h-full">
          <source type="image/avif" srcSet={`${base}-${photo.width}.avif`} />
          <img
            src={`${base}-${photo.width}.webp`}
            alt={photo.alt}
            loading="lazy"
            decoding="async"
            width={photo.width}
            height={Math.round(photo.width * 1.3)}
            className="h-full w-full object-cover"
          />
        </picture>
        {photo.gray && (
          <picture className="absolute inset-0 opacity-0 transition-opacity duration-700 ease-brand group-hover:opacity-100">
            <source type="image/avif" srcSet={`${color}-${photo.width}.avif`} />
            <img src={`${color}-${photo.width}.webp`} alt="" loading="lazy" className="h-full w-full object-cover" />
          </picture>
        )}
      </motion.div>
      <figcaption className="font-label absolute bottom-3 left-3 rounded-full bg-ink-950/70 px-3 py-1 text-[12px] text-text-100">
        {photo.caption}
      </figcaption>
    </figure>
  );
}

export function SpaceSection() {
  return (
    <section id="espaco" aria-labelledby="espaco-title" className="scroll-mt-20">
      <WaveDivider />
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <SectionTitle id="espaco-title">O Espaço</SectionTitle>
        <p className="mx-auto mt-4 max-w-[52ch] text-center text-[16px] text-text-400">
          Painéis pretos, letreiro dourado aceso e piso de mármore: a Classe A por fora e por dentro.
        </p>
        <div className="mt-10 grid grid-flow-dense auto-rows-[170px] grid-cols-2 gap-3 sm:auto-rows-[220px] sm:gap-4 md:grid-cols-4 md:auto-rows-[250px]">
          {PHOTOS.map((p) => (
            <GalleryPhoto key={p.name} photo={p} />
          ))}
        </div>
      </div>
      <WaveDivider flip />
    </section>
  );
}
