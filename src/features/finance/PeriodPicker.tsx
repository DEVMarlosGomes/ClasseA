import { ChevronLeft, ChevronRight } from 'lucide-react';
import { periodLabel, shiftPeriod } from '@shared/finance';

/** Biweekly period navigation (1–15 / 16–end). */
export function PeriodPicker({ period, onChange }: { period: string; onChange: (p: string) => void }) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Quinzena">
      <button onClick={() => onChange(shiftPeriod(period, -1))} aria-label="Quinzena anterior" className="grid size-11 place-items-center rounded-full text-text-400 hover:bg-white/5 hover:text-gold-400">
        <ChevronLeft className="size-5" />
      </button>
      <span className="tabular min-w-44 text-center text-[15px] text-text-100" aria-live="polite">
        {periodLabel(period)}
      </span>
      <button onClick={() => onChange(shiftPeriod(period, 1))} aria-label="Próxima quinzena" className="grid size-11 place-items-center rounded-full text-text-400 hover:bg-white/5 hover:text-gold-400">
        <ChevronRight className="size-5" />
      </button>
    </div>
  );
}
