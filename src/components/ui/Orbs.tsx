import { cn } from '@/lib/cn';

/**
 * Slow-moving gold orbs behind glass surfaces. Glass only reads as glass when something moves
 * behind it; these are blurred radial gradients animated with transform only.
 */
export function Orbs({ className, intensity = 1 }: { className?: string; intensity?: number }) {
  const orbs = [
    { cls: 'left-[-20%] top-[-10%] size-[70vmax] md:size-[48vmax]', opacity: 0.22, dur: '38s', delay: '0s' },
    { cls: 'right-[-25%] top-[30%] size-[60vmax] md:size-[40vmax]', opacity: 0.16, dur: '46s', delay: '-12s' },
    { cls: 'left-[10%] bottom-[-30%] size-[55vmax] md:size-[36vmax]', opacity: 0.15, dur: '52s', delay: '-24s' },
  ];
  return (
    <div aria-hidden="true" className={cn('pointer-events-none fixed inset-0 -z-10 overflow-hidden', className)}>
      {orbs.map((o, i) => (
        <div
          key={i}
          className={cn('absolute rounded-full will-change-transform', o.cls)}
          style={{
            opacity: o.opacity * intensity,
            background: 'radial-gradient(closest-side, rgba(233,181,66,0.9), rgba(233,181,66,0.25) 45%, transparent 72%)',
            animation: `orb-drift ${o.dur} ease-in-out ${o.delay} infinite`,
          }}
        />
      ))}
    </div>
  );
}

/** Back-lit sign halo: the warm glow behind the logo on the shop wall. */
export function Halo({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none absolute rounded-[50%]', className)}
      style={{
        background:
          'radial-gradient(closest-side, rgba(242,199,92,0.55), rgba(233,181,66,0.22) 45%, rgba(233,181,66,0.06) 70%, transparent 100%)',
        filter: 'blur(28px)',
        animation: 'halo-pulse 4s ease-in-out infinite',
      }}
    />
  );
}
