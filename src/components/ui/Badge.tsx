import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'gold' | 'success' | 'danger' | 'neutral' | 'solid';

const tones: Record<Tone, string> = {
  gold: 'border-gold-700 text-gold-400 bg-gold-500/10',
  success: 'border-success/40 text-[#8fd6ad] bg-success/10',
  danger: 'border-danger/40 text-[#f4a49d] bg-danger/10',
  neutral: 'border-ink-600 text-text-400 bg-ink-800',
  solid: 'border-transparent gold-metal text-ink-950',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'font-label inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 text-[12px] tracking-[0.1em]',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
