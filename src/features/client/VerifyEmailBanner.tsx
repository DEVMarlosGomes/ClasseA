import { MailWarning } from 'lucide-react';
import { useState } from 'react';
import { toast } from '@/components/ui/Toast';
import { useAuth } from '@/features/auth/AuthProvider';

/** Stays until the e-mail is verified; paid bookings require it. */
export function VerifyEmailBanner() {
  const { user, sendVerification, refresh } = useAuth();
  const [sent, setSent] = useState(false);
  if (!user || user.emailVerified || user.providerData.some((p) => p.providerId === 'google.com')) return null;
  return (
    <div role="status" className="mb-6 flex flex-col gap-3 rounded-[16px] border border-gold-700/60 bg-gold-500/[0.07] p-4 sm:flex-row sm:items-center">
      <MailWarning className="size-5 shrink-0 text-gold-400" strokeWidth={1.5} aria-hidden="true" />
      <p className="flex-1 text-[14px] text-text-100">
        Confirme seu e-mail <strong>{user.email}</strong> para pagar online. O link está na sua caixa de entrada.
      </p>
      <div className="flex gap-2">
        <button
          className="font-label min-h-11 rounded-full px-4 text-[13px] text-gold-400 hover:bg-gold-500/10"
          onClick={async () => {
            await refresh();
            toast.info('Status atualizado.');
          }}
        >
          Já confirmei
        </button>
        <button
          disabled={sent}
          className="font-label min-h-11 rounded-full border border-gold-600 px-4 text-[13px] text-gold-400 hover:bg-gold-500/10 disabled:opacity-50"
          onClick={async () => {
            await sendVerification();
            setSent(true);
            toast.success('Enviamos um novo link.');
          }}
        >
          {sent ? 'Enviado' : 'Reenviar'}
        </button>
      </div>
    </div>
  );
}
