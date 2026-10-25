import { Reveal, RevealItem } from '@/components/Reveal';
import { ButtonLink } from '@/components/ui/Button';
import { Halo } from '@/components/ui/Orbs';

export function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="relative isolate overflow-hidden px-4 py-28 text-center sm:py-36">
      <Halo className="left-1/2 top-1/2 h-[380px] w-[min(720px,110vw)] -translate-x-1/2 -translate-y-1/2" />
      <Reveal className="relative mx-auto max-w-2xl">
        <RevealItem>
          <h2 id="cta-title" className="font-label text-[clamp(36px,8vw,64px)] leading-[0.95] tracking-[0.04em] text-text-100">
            Sua cadeira está esperando.
          </h2>
        </RevealItem>
        <RevealItem>
          <p className="mx-auto mt-5 max-w-[40ch] text-[16px] text-text-100/75">
            Escolha o horário que cabe no seu dia. A confirmação chega na hora.
          </p>
        </RevealItem>
        <RevealItem className="mt-9">
          <ButtonLink to="/agendar" size="lg">
            Agendar horário
          </ButtonLink>
        </RevealItem>
      </Reveal>
    </section>
  );
}
