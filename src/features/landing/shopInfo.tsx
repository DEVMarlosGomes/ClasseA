import type { ShopSettings } from '@shared/types';
import { isPlaceholder } from '@shared/defaults';

export function formatAddress(s: ShopSettings): string {
  const a = s.address;
  return [a.street, a.district, `${a.city} - ${a.state}`, a.zip].filter((v) => !isPlaceholder(v)).join(', ');
}

export function mapsUrl(s: ShopSettings): string {
  if (s.address.mapsUrl) return s.address.mapsUrl;
  const q = s.address.mapsQuery || formatAddress(s);
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
}

/**
 * Renders business data still marked TODO(cliente). In development it shows a dashed marker so the
 * missing data is obvious; in production a placeholder renders nothing.
 */
export function PlaceholderText({ value, fallback = '' }: { value: string; fallback?: string }) {
  if (!isPlaceholder(value)) return <>{value}</>;
  if (import.meta.env.DEV) {
    return (
      <span
        className="rounded border border-dashed border-gold-700 px-1 text-[0.9em] text-gold-600"
        title="Dado a confirmar com a barbearia"
      >
        {value.replace('TODO(cliente) ', '')}
      </span>
    );
  }
  return <>{fallback}</>;
}
