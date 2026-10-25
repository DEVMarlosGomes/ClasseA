import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/cn';
import { EASE } from '@/lib/motion';

export type SlotState = 'free' | 'selected' | 'busy' | 'blocked';

interface SlotPillProps {
  time: string;
  state: SlotState;
  onSelect?: () => void;
  /** Shared layoutId so the gold pill glides between options. */
  layoutGroup?: string;
}

export function SlotPill({ time, state, onSelect, layoutGroup = 'slot' }: SlotPillProps) {
  const disabled = state === 'busy' || state === 'blocked';
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      aria-pressed={state === 'selected'}
      aria-label={
        state === 'busy' ? `${time}, ocupado` : state === 'blocked' ? `${time}, indisponível` : `${time}, livre`
      }
      className={cn(
        'tabular relative isolate flex h-12 w-full items-center justify-center gap-1.5 rounded-[14px] border text-[16px] font-semibold transition-colors duration-150',
        state === 'free' && 'border-ink-600 bg-ink-800/80 text-text-100 hover:border-gold-600',
        state === 'selected' && 'border-transparent text-ink-950',
        state === 'busy' && 'border-ink-700 bg-ink-900 text-text-400/50 line-through',
        state === 'blocked' && 'hatch border-ink-700 text-text-400/60',
      )}
    >
      {state === 'selected' && (
        <motion.span
          layoutId={layoutGroup}
          transition={{ duration: 0.25, ease: EASE }}
          className="gold-metal absolute inset-0 -z-10 rounded-[14px] shadow-[0_6px_20px_-6px_rgba(233,181,66,0.6)]"
        />
      )}
      {state === 'blocked' && <Lock className="size-3.5" strokeWidth={1.75} aria-hidden="true" />}
      {time}
    </button>
  );
}
