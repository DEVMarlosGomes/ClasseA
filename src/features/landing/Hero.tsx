import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { ButtonLink, buttonClass } from '@/components/ui/Button';
import { Logo, LogoMark } from '@/components/ui/Logo';
import { Halo, Orbs } from '@/components/ui/Orbs';
import { EASE } from '@/lib/motion';
import { NextSlotChip } from './NextSlotChip';

/**
 * The one authored moment of the landing: the shop's back-lit sign lighting up on the black wall,
 * then a metallic glint crossing the lettering every 6 seconds.
 */
export function Hero() {
  const reduced = useReducedMotion();
  const { scrollY } = useScroll();
  const photoY = useTransform(scrollY, [0, 800], [0, reduced ? 0 : 120]);

  return (
    <section aria-labelledby="hero-title" className="relative isolate flex min-h-svh flex-col overflow-hidden">
      <motion.div className="absolute inset-0 -z-20" style={{ y: photoY }}>
        <picture>
          <source
            type="image/avif"
            srcSet="/images/interior-gray-640.avif 640w, /images/interior-gray-1086.avif 1086w"
            sizes="100vw"
          />
          <source
            type="image/webp"
            srcSet="/images/interior-gray-640.webp 640w, /images/interior-gray-1086.webp 1086w"
            sizes="100vw"
          />
          <img
            src="/images/interior-gray-1086.webp"
            alt=""
            width={1086}
            height={1448}
            fetchPriority="high"
            className="h-[115%] w-full object-cover object-[50%_30%]"
          />
        </picture>
      </motion.div>
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-ink-950/65" />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(120%_80%_at_50%_40%,transparent_0%,rgba(5,5,5,0.55)_60%,#050505_100%)]"
      />
      <Orbs className="!absolute" intensity={0.8} />

      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-5 pb-24 pt-24 text-center sm:pt-28">
        <div className="relative w-full max-w-[min(84vw,500px,calc(30svh*1.56))]">
          <Halo className="-inset-x-[18%] -inset-y-[30%]" />
          <motion.div
            initial={{ opacity: 0, scale: reduced ? 1 : 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: EASE }}
            className="relative"
          >
            <Logo priority className="relative w-full drop-shadow-[0_12px_40px_rgba(0,0,0,0.6)]" />
            {!reduced && <LogoGlint />}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: reduced ? 0 : 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE, delay: 0.25 }}
          className="mt-8 flex flex-col items-center"
        >
          <h1
            id="hero-title"
            className="font-label max-w-[20ch] text-[clamp(40px,8.5vw,68px)] leading-[0.95] tracking-[0.04em] text-text-100"
          >
            Seu estilo no padrão <span className="text-gold-500">Classe A.</span>
          </h1>
          <p className="mt-4 max-w-[44ch] text-[16px] leading-relaxed text-text-100/80 sm:text-[18px]">
            Corte, barba e acabamento com hora marcada. Escolha o barbeiro e o horário em menos de um minuto.
          </p>
          <div className="mt-7 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
            <ButtonLink to="/agendar" size="lg" className="w-full sm:w-auto">
              Agendar horário
            </ButtonLink>
            <a href="#planos" className={buttonClass('secondary', 'lg', 'w-full sm:w-auto')}>
              Conhecer os planos
            </a>
          </div>
          <NextSlotChip className="mt-6" />
        </motion.div>
      </div>

      <a
        href="#servicos"
        aria-label="Rolar para os serviços"
        className="absolute bottom-6 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-text-400 hover:text-gold-400"
      >
        <motion.span
          animate={reduced ? undefined : { y: [0, 6, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <LogoMark className="w-4 opacity-80" />
        </motion.span>
        <span className="font-label text-[12px]">Role</span>
      </a>
    </section>
  );
}

/** A metallic reflection swept across the logo, masked by the logo's own vector shape. */
function LogoGlint() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{
        WebkitMaskImage: 'url(/brand/logo-gold.svg)',
        maskImage: 'url(/brand/logo-gold.svg)',
        WebkitMaskSize: '100% 100%',
        maskSize: '100% 100%',
      }}
    >
      <motion.div
        className="absolute inset-y-0 w-1/3"
        style={{
          background:
            'linear-gradient(100deg, transparent 0%, rgba(255,246,214,0) 20%, rgba(255,246,214,0.85) 50%, rgba(255,246,214,0) 80%, transparent 100%)',
        }}
        initial={{ x: '-120%' }}
        animate={{ x: ['-120%', '420%'] }}
        transition={{ duration: 1.4, ease: EASE, repeat: Infinity, repeatDelay: 4.6, delay: 1.2 }}
      />
    </div>
  );
}
