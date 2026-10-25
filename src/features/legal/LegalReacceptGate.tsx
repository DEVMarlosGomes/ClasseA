import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { toast } from '@/components/ui/Toast';
import { call, errorMessage } from '@/lib/api';
import { useShopSettings } from '@/lib/catalog';
import { useAuth } from '@/features/auth/AuthProvider';

/** When Terms or Privacy get a new version, signed-in clients accept it again on their next visit. */
export default function LegalReacceptGate() {
  const { user, profile, roles } = useAuth();
  const { data: settings } = useShopSettings();
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const consents = profile?.consents;
  const current = settings?.currentLegalVersions;
  const outdated =
    !!user &&
    roles.includes('client') &&
    !!consents &&
    !!current &&
    (consents.termsVersion !== current.terms || consents.privacyVersion !== current.privacy);

  return (
    <Sheet
      open={outdated && !dismissed}
      onOpenChange={(o) => !o && setDismissed(true)}
      title="Atualizamos nossos documentos"
      description="Para continuar agendando, leia e aceite as novas versões."
      size="sm"
      footer={
        <Button
          block
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await call('acceptLegalVersions', {});
              toast.success('Obrigado! Aceite registrado.');
            } catch (e) {
              toast.error(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          Li e aceito
        </Button>
      }
    >
      <ul className="space-y-2 text-[16px]">
        {consents?.termsVersion !== current?.terms && (
          <li>
            <Link to="/termos" className="text-gold-400 underline" onClick={() => setDismissed(true)}>
              Termos de Uso, versão {current?.terms}
            </Link>
          </li>
        )}
        {consents?.privacyVersion !== current?.privacy && (
          <li>
            <Link to="/privacidade" className="text-gold-400 underline" onClick={() => setDismissed(true)}>
              Política de Privacidade, versão {current?.privacy}
            </Link>
          </li>
        )}
      </ul>
    </Sheet>
  );
}
