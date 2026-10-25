import type { CookieChoices } from '@shared/types';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let gaLoaded = false;

/**
 * Google Consent Mode v2 with everything denied by default. gtag.js is only fetched after the
 * visitor opts into the performance category, and only when a measurement ID is configured.
 */
export function applyConsent(choices: CookieChoices | null): void {
  const id = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as string | undefined;
  window.dataLayer = window.dataLayer ?? [];
  window.gtag =
    window.gtag ??
    function gtag(...args: unknown[]) {
      window.dataLayer!.push(args);
    };

  if (!gaLoaded) {
    window.gtag('consent', 'default', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied',
      wait_for_update: 500,
    });
  }

  if (!choices) return;
  window.gtag('consent', 'update', {
    analytics_storage: choices.analytics ? 'granted' : 'denied',
    ad_storage: choices.marketing ? 'granted' : 'denied',
    ad_user_data: choices.marketing ? 'granted' : 'denied',
    ad_personalization: choices.marketing ? 'granted' : 'denied',
  });

  if (choices.analytics && id && !gaLoaded) {
    gaLoaded = true;
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    s.dataset.consent = 'analytics';
    document.head.appendChild(s);
    window.gtag('js', new Date());
    // No personal data: IP-less, no user id, no ad signals.
    window.gtag('config', id, { anonymize_ip: true, allow_google_signals: false, send_page_view: true });
  }
}

export function isAnalyticsLoaded(): boolean {
  return gaLoaded;
}
