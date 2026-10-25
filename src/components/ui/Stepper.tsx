import { motion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import { EASE } from '@/lib/motion';

interface StepperProps {
  steps: string[];
  current: number;
  onBack?: () => void;
  backLabel?: string;
}

/** Wizard header: back button, step label and a gold progress bar. */
export function Stepper({ steps, current, onBack, backLabel = 'Voltar' }: StepperProps) {
  const progress = ((current + 1) / steps.length) * 100;
  return (
    <div className="w-full">
      <div className="flex h-12 items-center gap-2">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="-ml-2 grid size-11 place-items-center rounded-full text-text-100 hover:bg-white/5 hover:text-gold-400"
            aria-label={backLabel}
          >
            <ChevronLeft className="size-5" strokeWidth={1.75} />
          </button>
        ) : (
          <span className="size-11" aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-label text-[12px] text-text-400">
            Etapa <span className="tabular">{current + 1}</span> de <span className="tabular">{steps.length}</span>
          </p>
          <p className="font-label truncate text-[18px] text-text-100" aria-live="polite">
            {steps[current]}
          </p>
        </div>
      </div>
      <div
        className="mt-2 h-[3px] overflow-hidden rounded-full bg-ink-700"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuenow={current + 1}
        aria-label="Progresso do agendamento"
      >
        <motion.div
          className="gold-metal h-full origin-left rounded-full"
          initial={false}
          animate={{ scaleX: progress / 100 }}
          transition={{ duration: 0.45, ease: EASE }}
        />
      </div>
    </div>
  );
}
