import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { CookieChoices } from '@shared/types';
import { LEGAL_VERSIONS } from '@shared/defaults';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { Switch } from '@/components/ui/Switch';
import { loadFirestore } from '@/lib/firebase';
import { EASE } from '@/lib/motion';
import { useAuth } from '@/features/auth/AuthProvider';
import { applyConsent } from './analytics';
import { anonymousId, useConsent } from './store';

async function logConsent(choices: CookieChoices, uid: string | undefined) {
  try {
    const { db, addDoc, collection, serverTimestamp } = await loadFirestore();
    await addDoc(collection(db, 'consentLogs'), {
      ...(uid ? { uid } : { anonymousId: anonymousId() }),
      type: 'cookies',
      version: LEGAL_VERSIONS.cookies,
      choices,
      userAgent: navigator.userAgent.slice(0, 300),
      createdAt: serverTimestamp(),
    });
  } catch {
    // The choice is still honoured locally; logging is retried on the next decision.
  }
}

const CATEGORIES = [
  {
    key: 'necessary' as const,
    label: 'Necessários',
    description:
      'Mantêm seu login, guardam o agendamento em andamento e protegem o site contra robôs. Não podem ser desligados.',
  },
  {
    key: 'analytics' as const,
    label: 'Desempenho',
    description: 'Google Analytics, para entendermos quais páginas são usadas e melhorarmos o site. Sem dados pessoais.',
  },
  {
    key: 'marketing' as const,
    label: 'Marketing',
    description: 'Permitem medir anúncios em redes sociais. Hoje não usamos, mas você já pode deixar sua escolha.',
  },
];

export function ConsentBanner() {
  const { consent, preferencesOpen, decide, openPreferences, closePreferences } = useConsent();
  const { user } = useAuth();
  const [draft, setDraft] = useState({ analytics: false, marketing: false });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    applyConsent(consent?.choices ?? null);
  }, [consent]);

  useEffect(() => {
    // Let the hero paint first; the banner is not part of the LCP.
    const t = setTimeout(() => setMounted(true), 600);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (preferencesOpen) setDraft({ analytics: !!consent?.choices.analytics, marketing: !!consent?.choices.marketing });
  }, [preferencesOpen, consent]);

  const choose = (choices: { analytics: boolean; marketing: boolean }) => {
    decide(choices);
    void logConsent({ necessary: true, ...choices }, user?.uid);
  };

  return (
    <>
      <AnimatePresence>
        {mounted && !consent && !preferencesOpen && (
          <motion.section
            role="region"
            aria-label="Aviso de cookies"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ duration: 0.45, ease: EASE }}
            className="glass pb-safe fixed inset-x-2 bottom-2 z-[80] !bg-[rgba(12,12,12,0.9)] p-5 sm:inset-x-auto sm:bottom-6 sm:left-6 sm:max-w-[640px]"
          >
            <h2 className="font-label text-[18px] text-text-100">Sua privacidade</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-text-400">
              Usamos cookies necessários para o site funcionar. Com a sua permissão, também usamos cookies de
              desempenho para melhorar a experiência. Saiba mais na{' '}
              <Link to="/cookies" className="text-gold-400 underline">
                Política de Cookies
              </Link>
              .
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <Button variant="secondary" size="sm" onClick={() => choose({ analytics: true, marketing: true })}>
                Aceitar todos
              </Button>
              <Button variant="secondary" size="sm" onClick={() => choose({ analytics: false, marketing: false })}>
                Recusar não essenciais
              </Button>
              <Button variant="secondary" size="sm" onClick={openPreferences}>
                Personalizar
              </Button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <Sheet
        open={preferencesOpen}
        onOpenChange={(o) => (o ? openPreferences() : closePreferences())}
        title="Preferências de cookies"
        description="Escolha o que podemos usar. Você pode mudar isso quando quiser no rodapé ou no seu perfil."
        footer={
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="secondary" onClick={() => choose({ analytics: false, marketing: false })}>
              Recusar não essenciais
            </Button>
            <Button onClick={() => choose(draft)}>Salvar escolhas</Button>
          </div>
        }
      >
        <div className="divide-y divide-white/5">
          {CATEGORIES.map((c) => (
            <Switch
              key={c.key}
              className="py-4"
              label={c.label}
              description={c.description}
              checked={c.key === 'necessary' ? true : draft[c.key]}
              disabled={c.key === 'necessary'}
              onCheckedChange={(v) => c.key !== 'necessary' && setDraft((d) => ({ ...d, [c.key]: v }))}
            />
          ))}
        </div>
      </Sheet>
    </>
  );
}
