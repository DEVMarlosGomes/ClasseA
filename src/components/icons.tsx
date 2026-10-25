import type { SVGProps } from 'react';

/** Brand glyphs lucide does not ship, drawn on the same 24px grid and 1.5 stroke. */
export function InstagramIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true" {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function WhatsAppIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M3.5 20.5l1.2-4.1A8.5 8.5 0 1 1 8 19.6z" />
      <path
        d="M9 8.6c.2-.5.4-.6.8-.6h.5c.2 0 .4.1.5.4l.7 1.7c.1.2 0 .5-.1.6l-.5.6c-.1.2-.1.4 0 .5.6 1 1.4 1.8 2.4 2.4.2.1.4.1.5 0l.6-.5c.2-.1.4-.2.6-.1l1.7.7c.3.1.4.3.4.5v.5c0 .4-.1.6-.6.8-.6.3-1.6.4-2.8-.1a9.4 9.4 0 0 1-4.6-4.6c-.5-1.2-.4-2.2-.1-2.8z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}
