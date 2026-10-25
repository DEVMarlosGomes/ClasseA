import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  icon?: ReactNode;
}

export function Chip({ selected, icon, className, children, ...rest }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        'inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-[14px] font-medium transition-colors duration-150',
        selected
          ? 'border-gold-500 bg-gold-500/15 text-gold-400'
          : 'border-ink-600 bg-ink-800/70 text-text-100 hover:border-gold-700',
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
