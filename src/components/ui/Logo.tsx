import { cn } from '@/lib/cn';

/** The supplied logo, vectorised by scripts/build-assets.mjs. Never re-drawn or re-typeset. */
export function Logo({
  className,
  gold = false,
  priority = false,
}: {
  className?: string;
  gold?: boolean;
  priority?: boolean;
}) {
  return (
    <img
      src={gold ? '/brand/logo-gold.svg' : '/brand/logo.svg'}
      alt="Classe A Barbearia"
      width={3546}
      height={2268}
      decoding="async"
      fetchPriority={priority ? 'high' : undefined}
      className={cn('h-auto select-none', className)}
      draggable={false}
    />
  );
}

export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <img
      src="/brand/logo-mark-gold.svg"
      alt={title ?? ''}
      aria-hidden={title ? undefined : true}
      width={1374}
      height={1920}
      className={cn('h-auto select-none', className)}
      draggable={false}
    />
  );
}
