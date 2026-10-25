import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { EASE } from '@/lib/motion';

/**
 * Global loader: a straight razor opening. The blade swings out of the handle around the pivot
 * and its outline is drawn in, so it stays crisp at any size.
 */
export function RazorLoader({ className, label = 'Carregando' }: { className?: string; label?: string }) {
  const reduced = useReducedMotion();
  return (
    <div role="status" aria-live="polite" className={cn('flex flex-col items-center gap-3 text-gold-500', className)}>
      <svg viewBox="0 0 64 64" className="size-14 overflow-visible" aria-hidden="true">
        <motion.g
          style={{ transformOrigin: '34px 14px' }}
          initial={{ rotate: 0 }}
          animate={reduced ? { rotate: 34 } : { rotate: [0, 34, 34, 0] }}
          transition={
            reduced ? { duration: 0 } : { duration: 1.8, ease: EASE, repeat: Infinity, times: [0, 0.45, 0.75, 1] }
          }
        >
          <motion.path
            d="M34 14 L28 52 L22 50.5 L29.5 14 Z"
            fill="currentColor"
            fillOpacity=".16"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
            initial={{ pathLength: reduced ? 1 : 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.8, ease: EASE }}
          />
        </motion.g>
        <path
          d="M31 8.5c2.6-1.6 6 .2 6 3.2V50c0 2.4-1.6 4-3.6 4"
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <circle cx="34.5" cy="14" r="1.5" fill="var(--ink-950)" />
        <circle cx="34.5" cy="46" r="1.5" fill="var(--ink-950)" />
      </svg>
      <span className="font-label text-[12px] text-text-400">{label}</span>
    </div>
  );
}

export function FullPageLoader({ label }: { label?: string }) {
  return (
    <div className="grid min-h-[60svh] place-items-center">
      <RazorLoader label={label} />
    </div>
  );
}
