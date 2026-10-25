import { CalendarClock, CircleCheck, Scissors } from 'lucide-react';
import { Reveal, RevealItem } from '@/components/Reveal';
import { SectionTitle } from '@/components/ui/SectionTitle';

const STEPS = [
  { icon: Scissors, title: 'Escolha o serviço', text: 'Corte, barba, combo ou acabamento. Pode juntar mais de um.' },
  { icon: CalendarClock, title: 'Escolha barbeiro e horário', text: 'Veja só os horários realmente livres, atualizados na hora.' },
  { icon: CircleCheck, title: 'Confirme e pronto', text: 'Você recebe a confirmação e um lembrete antes do atendimento.' },
];

/** Three steps on one stitched line, like the gold stitching on the cap brim. */
export function HowItWorks() {
  return (
    <section aria-labelledby="como-title" className="px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-5xl">
        <SectionTitle id="como-title">Como funciona</SectionTitle>
        <Reveal as="ul" className="relative mt-12 grid gap-10 md:grid-cols-3 md:gap-6">
          <div aria-hidden="true" className="stitch absolute left-[16.6%] right-[16.6%] top-7 hidden md:block" />
          <div aria-hidden="true" className="absolute bottom-6 left-7 top-6 w-px border-l border-dashed border-gold-700/80 md:hidden" />
          {STEPS.map(({ icon: Icon, title, text }) => (
            <RevealItem as="li" key={title} className="relative flex gap-5 md:flex-col md:items-center md:text-center">
              <span className="relative grid size-14 shrink-0 place-items-center rounded-full border border-gold-600/60 bg-ink-950">
                <Icon className="size-6 text-gold-500" strokeWidth={1.25} aria-hidden="true" />
              </span>
              <div>
                <h3 className="font-label text-[20px] text-text-100 md:mt-5">{title}</h3>
                <p className="mt-2 max-w-[30ch] text-[15px] leading-relaxed text-text-400">{text}</p>
              </div>
            </RevealItem>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
