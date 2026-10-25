/**
 * Sentry is loaded lazily and only when a DSN is configured. No personal data is sent:
 * default PII is off and user context is never set.
 */
export function initMonitoring(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn || import.meta.env.DEV) return;
  const start = () =>
    void import('@sentry/react').then((Sentry) =>
      Sentry.init({
        dsn,
        tracesSampleRate: 0.1,
        beforeSend(event) {
          // Strip query strings: they may carry booking deep links.
          if (event.request?.url) event.request.url = event.request.url.split('?')[0];
          return event;
        },
      }),
    );
  if ('requestIdleCallback' in window) window.requestIdleCallback(start);
  else setTimeout(start, 3000);
}
