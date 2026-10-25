import { useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';
import { dayChipLabel } from '@/lib/dates';

export interface DayOption {
  date: string; // yyyy-MM-dd
  available: boolean | null; // null = still loading
}

interface DayStripProps {
  days: DayOption[];
  selected: string | null;
  today: string;
  onSelect: (date: string) => void;
}

/** Horizontal strip of upcoming days; unavailable days are dimmed and not clickable. */
export function DayStrip({ days, selected, today, onSelect }: DayStripProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!selected) return;
    ref.current
      ?.querySelector<HTMLElement>(`[data-date="${selected}"]`)
      ?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [selected]);

  return (
    <div
      ref={ref}
      role="listbox"
      aria-label="Escolha o dia"
      className="no-scrollbar flex snap-x snap-mandatory scroll-px-1 gap-2 overflow-x-auto overscroll-x-contain p-1"
    >
      {days.map((d) => {
        const { top, bottom } = dayChipLabel(d.date, today);
        const isSelected = d.date === selected;
        const disabled = d.available === false;
        return (
          <button
            key={d.date}
            type="button"
            role="option"
            data-date={d.date}
            aria-selected={isSelected}
            aria-disabled={disabled}
            disabled={disabled}
            onClick={() => onSelect(d.date)}
            className={cn(
              'flex h-[72px] w-[64px] shrink-0 snap-start flex-col items-center justify-center rounded-[16px] border transition-colors duration-150',
              isSelected
                ? 'gold-metal border-transparent text-ink-950 shadow-[0_6px_20px_-6px_rgba(233,181,66,0.6)]'
                : 'border-ink-600 bg-ink-800/80 text-text-100 hover:border-gold-600',
              disabled && 'opacity-30',
              d.available === null && !isSelected && 'animate-pulse',
            )}
          >
            <span className={cn('font-label text-[12px]', isSelected ? 'text-ink-950/75' : 'text-text-400')}>
              {top}
            </span>
            <span className="tabular text-[20px] font-bold leading-tight">{bottom}</span>
          </button>
        );
      })}
    </div>
  );
}
