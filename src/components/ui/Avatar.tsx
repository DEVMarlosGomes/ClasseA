import { cn } from '@/lib/cn';

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

export function Avatar({
  name,
  src,
  size = 44,
  className,
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'font-label relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full border border-gold-700/60 bg-ink-700 text-gold-400',
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(12, Math.round(size * 0.34)) }}
      aria-hidden={src ? undefined : true}
    >
      {src ? <img src={src} alt={name} className="h-full w-full object-cover" loading="lazy" /> : initials(name)}
    </span>
  );
}
