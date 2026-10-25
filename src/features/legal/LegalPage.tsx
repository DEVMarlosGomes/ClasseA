import { Link } from 'react-router';
import type { LegalDocType } from '@shared/types';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { SiteFooter } from '@/features/landing/SiteFooter';
import { SiteHeader } from '@/features/landing/SiteHeader';
import LegalDocBody from './LegalDocBody';
import { headingsOf, useLegalDoc } from './useLegalDoc';

const OTHERS: { type: LegalDocType; to: string; label: string }[] = [
  { type: 'privacy', to: '/privacidade', label: 'Política de Privacidade' },
  { type: 'terms', to: '/termos', label: 'Termos de Uso' },
  { type: 'cookies', to: '/cookies', label: 'Política de Cookies' },
];

export function LegalPage({ type, title, description }: { type: LegalDocType; title: string; description: string }) {
  useDocumentMeta({ title, description });
  const { data } = useLegalDoc(type);
  const toc = data ? headingsOf(data.markdown) : [];

  return (
    <>
      <SiteHeader solid />
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-28 sm:px-6 sm:pt-32">
        <div className="lg:grid lg:grid-cols-[240px_minmax(0,720px)] lg:gap-16">
          <aside className="hidden lg:block">
            <nav aria-label="Sumário" className="sticky top-28">
              <p className="font-label text-[12px] text-text-400">Sumário</p>
              <ol className="mt-3 space-y-1 border-l border-ink-600">
                {toc.map((h) => (
                  <li key={h.id}>
                    <a href={`#${h.id}`} className="-ml-px block border-l border-transparent py-1.5 pl-4 text-[14px] text-text-400 hover:border-gold-500 hover:text-text-100">
                      {h.text}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </aside>
          <div className="min-w-0">
            <h1 className="font-label text-[36px] leading-tight text-text-100 sm:text-[48px]">{title}</h1>
            <details className="mt-6 rounded-[14px] border border-ink-600 bg-ink-800/60 lg:hidden">
              <summary className="font-label flex min-h-12 cursor-pointer items-center px-4 text-[14px] text-text-100">Sumário</summary>
              <ol className="space-y-1 px-4 pb-4">
                {toc.map((h) => (
                  <li key={h.id}>
                    <a href={`#${h.id}`} className="block py-1.5 text-[14px] text-text-400 hover:text-gold-400">
                      {h.text}
                    </a>
                  </li>
                ))}
              </ol>
            </details>
            <div className="mt-8">
              <LegalDocBody type={type} />
            </div>
            <nav aria-label="Outros documentos" className="mt-14 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/5 pt-6 text-[14px]">
              {OTHERS.filter((o) => o.type !== type).map((o) => (
                <Link key={o.to} to={o.to} className="min-h-11 py-3 text-gold-400 underline">
                  {o.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
