import { AnimatePresence, motion } from 'framer-motion';
import { lazy, Suspense } from 'react';
import { Outlet, ScrollRestoration, useNavigation } from 'react-router';
import { Toaster } from '@/components/ui/Toast';
import { ConsentBanner } from '@/features/consent/ConsentBanner';

const LegalReacceptGate = lazy(() => import('@/features/legal/LegalReacceptGate'));

/** Thin gold progress line while a lazy route chunk loads. */
function RouteProgress() {
  const navigation = useNavigation();
  return (
    <AnimatePresence>
      {navigation.state === 'loading' && (
        <motion.div
          key="progress"
          className="gold-metal fixed inset-x-0 top-0 z-[100] h-[2px] origin-left"
          initial={{ scaleX: 0, opacity: 1 }}
          animate={{ scaleX: 0.8, transition: { duration: 2, ease: [0.22, 1, 0.36, 1] } }}
          exit={{ scaleX: 1, opacity: 0, transition: { duration: 0.25 } }}
        />
      )}
    </AnimatePresence>
  );
}

export function RootLayout() {
  return (
    <div className="noise min-h-svh">
      <RouteProgress />
      <Outlet />
      <ScrollRestoration />
      <ConsentBanner />
      <Suspense fallback={null}>
        <LegalReacceptGate />
      </Suspense>
      <Toaster />
    </div>
  );
}
