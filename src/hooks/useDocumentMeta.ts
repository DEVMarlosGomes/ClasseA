import { useEffect } from 'react';

const SITE = 'Classe A Barbearia';
const DEFAULT_DESCRIPTION =
  'Corte, barba e acabamento com hora marcada. Escolha o barbeiro e o horário em menos de um minuto.';

function setMeta(selector: string, attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

/** Unique title, description, canonical and Open Graph tags per route. */
export function useDocumentMeta({
  title,
  description = DEFAULT_DESCRIPTION,
  noindex = false,
}: {
  title?: string;
  description?: string;
  noindex?: boolean;
}) {
  useEffect(() => {
    const full = title ? `${title} · ${SITE}` : `${SITE} · Agende seu horário`;
    document.title = full;
    setMeta('meta[name="description"]', 'name', 'description', description);
    setMeta('meta[property="og:title"]', 'property', 'og:title', full);
    setMeta('meta[property="og:description"]', 'property', 'og:description', description);
    setMeta('meta[name="robots"]', 'name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');
    const base = (import.meta.env.VITE_SITE_URL as string | undefined) ?? location.origin;
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = base.replace(/\/$/, '') + location.pathname;
    setMeta('meta[property="og:url"]', 'property', 'og:url', canonical.href);
  }, [title, description, noindex]);
}
