import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import type { ShopSettings } from '@shared/types';
import { isPlaceholder } from '@shared/defaults';
import { Orbs } from '@/components/ui/Orbs';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useShopSettings } from '@/lib/catalog';
import { BarbersSection } from './BarbersSection';
import { FinalCta } from './FinalCta';
import { Hero } from './Hero';
import { HowItWorks } from './HowItWorks';
import { LocationSection } from './LocationSection';
import { PlansSection } from './PlansSection';
import { ServicesSection } from './ServicesSection';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';
import { SpaceSection } from './SpaceSection';
import { StickyBookBar } from './StickyBookBar';

function useJsonLd(s: ShopSettings | undefined) {
  useEffect(() => {
    if (!s) return;
    const site = (import.meta.env.VITE_SITE_URL as string | undefined) ?? location.origin;
    const data = {
      '@context': 'https://schema.org',
      '@type': 'HairSalon',
      name: s.name,
      url: site,
      image: `${site}/brand/og-image.jpg`,
      logo: `${site}/brand/logo.svg`,
      telephone: `+${s.whatsapp}`,
      ...(isPlaceholder(s.address.street)
        ? {}
        : {
            address: {
              '@type': 'PostalAddress',
              streetAddress: s.address.street,
              addressLocality: s.address.city,
              addressRegion: s.address.state,
              postalCode: s.address.zip,
              addressCountry: 'BR',
            },
          }),
      openingHours: s.openingHours.filter((h) => h.hours !== 'Fechado').map((h) => `${h.days} ${h.hours}`),
      sameAs: [`https://instagram.com/${s.instagram}`],
    };
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.textContent = JSON.stringify(data);
    document.head.appendChild(el);
    return () => el.remove();
  }, [s]);
}

/** Optional social proof strip — only rendered when the admin fills real values in settings. */
function SocialProof({ items }: { items: ShopSettings['socialProof'] }) {
  const real = items.filter((i) => i.value && i.label);
  if (!real.length) return null;
  return (
    <section aria-label="Números da barbearia" className="border-y border-white/5 px-4 py-10">
      <ul className="mx-auto flex max-w-4xl flex-wrap justify-center gap-x-12 gap-y-6 text-center">
        {real.map((i) => (
          <li key={i.label}>
            <p className="tabular font-label text-[36px] text-gold-500">{i.value}</p>
            <p className="text-[14px] text-text-400">{i.label}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function LandingPage() {
  useDocumentMeta({});
  const { data: settings } = useShopSettings();
  useJsonLd(settings);
  const { hash } = useLocation();
  const heroSentinel = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLElement>(null);
  const [heroOut, setHeroOut] = useState(false);
  const [footerIn, setFooterIn] = useState(false);

  useEffect(() => {
    if (!hash) return;
    const t = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' }), 120);
    return () => clearTimeout(t);
  }, [hash]);

  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.target === heroSentinel.current) setHeroOut(!e.isIntersecting && e.boundingClientRect.top < 0);
        if (e.target === footerRef.current) setFooterIn(e.isIntersecting);
      }
    });
    if (heroSentinel.current) io.observe(heroSentinel.current);
    if (footerRef.current) io.observe(footerRef.current);
    return () => io.disconnect();
  }, [settings]);

  return (
    <>
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-gold-500 focus:px-4 focus:py-2 focus:text-ink-950">
        Pular para o conteúdo
      </a>
      <Orbs intensity={0.6} />
      <SiteHeader />
      <main id="conteudo">
        <Hero />
        <div ref={heroSentinel} aria-hidden="true" className="h-px" />
        {settings && <SocialProof items={settings.socialProof} />}
        <ServicesSection />
        <PlansSection />
        <BarbersSection />
        <SpaceSection />
        <HowItWorks />
        <LocationSection />
        <FinalCta />
      </main>
      <SiteFooter ref={footerRef} />
      <StickyBookBar visible={heroOut && !footerIn} />
    </>
  );
}
