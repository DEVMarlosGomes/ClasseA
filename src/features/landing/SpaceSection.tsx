import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { WaveDivider } from '@/components/ui/Divider';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { cn } from '@/lib/cn';

interface Photo {
  src: string;
  alt: string;
  caption: string;
  className: string;
  position?: string;
  speed: number;
}

const PHOTOS: Photo[] = [
  {
    src: '/images/work/interior-real.jpeg',
    alt: 'Interior real da Classe A Barbearia com cadeiras, espelhos e área de espera',
    caption: 'Nosso espaço',
    className: 'row-span-2',
    speed: -20,
  },
  {
    src: '/images/work/barba-modelada.jpeg',
    alt: 'Barba alinhada e modelada na Classe A Barbearia',
    caption: 'Barba alinhada',
    className: 'md:col-span-2',
    position: 'center 42%',
    speed: 14,
  },
  {
    src: '/images/work/degrade-classico.jpeg',
    alt: 'Corte masculino com degradê clássico e acabamento preciso',
    caption: 'Degradê clássico',
    className: 'col-span-2 md:col-span-1 md:row-span-2 md:col-start-4 md:row-start-1',
    position: 'center 35%',
    speed: -15,
  },
  {
    src: '/images/work/degrade-cacheado.jpeg',
    alt: 'Corte cacheado com degradê e risco lateral',
    caption: 'Textura e acabamento',
    className: 'md:col-span-2',
    position: 'center 42%',
    speed: 16,
  },
  {
    src: '/images/work/corte-crespo.jpeg',
    alt: 'Corte crespo com acabamento em degradê',
    caption: 'Corte crespo',
    className: '',
    position: 'center 38%',
    speed: -12,
  },
  {
    src: '/images/work/corte-infantil-risco.jpeg',
    alt: 'Corte infantil penteado com risco lateral',
    caption: 'Corte infantil',
    className: '',
    position: 'center 36%',
    speed: 12,
  },
];

function GalleryPhoto({ photo }: { photo: Photo }) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : [photo.speed, -photo.speed]);

  return (
    <figure
      ref={ref}
      className={cn(
        'group relative overflow-hidden rounded-[20px] border border-gold-500/12 bg-ink-800',
        photo.className,
      )}
    >
      <motion.div className="absolute -inset-y-8 inset-x-0" style={{ y }}>
        <img
          src={photo.src}
          alt={photo.alt}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover grayscale transition-[filter,transform] duration-700 ease-brand group-hover:scale-[1.025] group-hover:grayscale-0"
          style={{ objectPosition: photo.position ?? 'center' }}
        />
      </motion.div>
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-ink-950/90 to-transparent"
      />
      <figcaption className="font-label absolute bottom-3 left-3 rounded-full bg-ink-950/75 px-3 py-1 text-[12px] text-text-100">
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
        <SectionTitle id="espaco-title">Nosso trabalho</SectionTitle>
        <p className="mx-auto mt-4 max-w-[52ch] text-center text-[16px] text-text-400">
          Conheça o espaço e alguns dos cortes feitos pela equipe da Classe A.
        </p>
        <div className="mt-10 grid grid-flow-dense auto-rows-[170px] grid-cols-2 gap-3 sm:auto-rows-[220px] sm:gap-4 md:grid-cols-4 md:auto-rows-[250px]">
          {PHOTOS.map((photo) => (
            <GalleryPhoto key={photo.src} photo={photo} />
          ))}
        </div>
      </div>
      <WaveDivider flip />
    </section>
  );
}
