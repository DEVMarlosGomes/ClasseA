import { motion, useReducedMotion } from 'framer-motion';
import { useMemo } from 'react';
import { EASE } from '@/lib/motion';

/** Gold check drawn in, with a few discreet gold particles. */
export function SuccessCheck({ size = 96 }: { size?: number }) {
  const reduced = useReducedMotion();
  const particles = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const angle = (i / 12) * Math.PI * 2 + (i % 2) * 0.2;
        const dist = size * (0.62 + ((i * 37) % 10) / 40);
        return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, s: 3 + (i % 3) };
      }),
    [size],
  );
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      {!reduced &&
        particles.map((p, i) => (
          <motion.span
            key={i}
            aria-hidden="true"
            className="absolute rounded-full bg-gold-400"
            style={{ width: p.s, height: p.s }}
            initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
            animate={{ x: p.x, y: p.y, opacity: [0, 1, 0], scale: 1 }}
            transition={{ duration: 1.1, delay: 0.35 + i * 0.015, ease: EASE }}
          />
        ))}
      <svg viewBox="0 0 96 96" width={size} height={size} aria-hidden="true">
        <motion.circle
          cx="48"
          cy="48"
          r="44"
          fill="rgba(233,181,66,0.08)"
          stroke="var(--gold-500)"
          strokeWidth="2"
          initial={{ pathLength: reduced ? 1 : 0, opacity: reduced ? 0 : 1 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: EASE }}
        />
        <motion.path
          d="M30 49 L43 61 L67 36"
          fill="none"
          stroke="var(--gold-400)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: reduced ? 1 : 0, opacity: reduced ? 0 : 1 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.45, delay: reduced ? 0 : 0.4, ease: EASE }}
        />
      </svg>
    </div>
  );
}
