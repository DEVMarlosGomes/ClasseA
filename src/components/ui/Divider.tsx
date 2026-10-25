import { useId } from 'react';
import { cn } from '@/lib/cn';

/** Gold "stitching" divider from the cap brim. */
export function Divider({ className }: { className?: string }) {
  return <div role="separator" className={cn('stitch w-full', className)} />;
}

/** Portuguese wave pavement from the shop entrance: black and white waves at low opacity. */
export function WaveDivider({ className, flip }: { className?: string; flip?: boolean }) {
  const id = useId();
  return (
    <div
      aria-hidden="true"
      className={cn('relative h-14 w-full overflow-hidden opacity-[0.14] sm:h-20', flip && 'rotate-180', className)}
    >
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 1200 80">
        <defs>
          <pattern id={id} width="200" height="26" patternUnits="userSpaceOnUse">
            <path
              d="M0 13 C 25 0, 75 0, 100 13 S 175 26, 200 13 L200 26 L0 26 Z"
              fill="var(--text-100)"
            />
          </pattern>
        </defs>
        <rect width="1200" height="26" fill={`url(#${id})`} />
        <rect y="27" width="1200" height="26" fill={`url(#${id})`} transform="translate(-100 0)" />
        <rect y="54" width="1200" height="26" fill={`url(#${id})`} />
      </svg>
    </div>
  );
}
