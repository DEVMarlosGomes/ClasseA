import { useEffect, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import type { Appointment } from '@shared/types';
import { ButtonLink, buttonClass } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { RazorLoader } from '@/components/ui/RazorLoader';
import { SuccessCheck } from '@/components/ui/SuccessCheck';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useLiveDoc } from '@/hooks/useFirestore';
import { call, errorMessage } from '@/lib/api';
import { longDate } from '@/lib/dates';
import { useAuthNow } from '@/features/auth/AuthProvider';

type Outcome = 'confirmed' | 'duplicate' | 'refund-pending' | 'not-paid' | 'amount-mismatch' | 'unknown-order';

/**
 * InfinitePay sends the client back here with order_nsu, transaction_nsu and slug. The server confirms
 * with InfinitePay itself (these parameters alone prove nothing) and the page follows the appointment live.
 */
export default function PaymentReturnPage() {
  useDocumentMeta({ title: 'Pagamento', noindex: true });
  const [params] = useSearchParams();
  const location = useLocation();
  const { ready, user } = useAuthNow();
  const orderNsu = params.get('order_nsu') ?? '';
  const transactionNsu = params.get('transaction_nsu') ?? '';
  const slug = params.get('slug') ?? '';
  const appt = useLiveDoc<Appointment>(user && orderNsu ? `appointments/${orderNsu}` : null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const asked = useRef(false);

  useEffect(() => {
    if (!user || asked.current || !orderNsu || !transactionNsu || !slug) return;
    asked.current = true;
    call<unknown, { outcome: Outcome }>('confirmOnlinePayment', { orderNsu, transactionNsu, slug })
      .then((r) => setOutcome(r.outcome))
      .catch((e) => setError(errorMessage(e)));
  }, [user, orderNsu, transactionNsu, slug]);

  const status = appt.data?.status;
  const a = appt.data;

  let body;
  if (!ready) body = <RazorLoader label="Carregando" className="py-10" />;
  else if (!user)
    body = (
      <Message title="Entre para ver seu pagamento" text="Use a mesma conta do agendamento.">
        <ButtonLink to={`/entrar?next=${encodeURIComponent(location.pathname + location.search)}`}>Entrar</ButtonLink>
      </Message>
    );
  else if (!orderNsu) body = <Message title="Link incompleto" text="Não encontramos os dados do pagamento." />;
  else if (status === 'confirmed' || status === 'completed')
    body = (
      <div className="flex flex-col items-center text-center">
        <SuccessCheck size={88} />
        <h1 className="font-label mt-5 text-[28px] text-text-100">Pagamento aprovado</h1>
        {a && (
          <p className="mt-2 text-[15px] text-text-400">
            {a.services.map((s) => s.name).join(' + ')} com {a.barberName} · {longDate(a.date)} às {a.start}
          </p>
        )}
        <ButtonLink to="/cliente/agendamentos" className="mt-6">
          Ver meus agendamentos
        </ButtonLink>
      </div>
    );
  else if (outcome === 'refund-pending' || status === 'payment_expired')
    body = (
      <Message
        title="A reserva expirou"
        text={
          outcome === 'refund-pending'
            ? 'Seu pagamento chegou depois do prazo e o horário já tinha sido liberado. A barbearia vai estornar o valor.'
            : 'O pagamento não foi concluído a tempo e o horário foi liberado.'
        }
      >
        <ButtonLink to="/agendar">Agendar de novo</ButtonLink>
      </Message>
    );
  else if (error) body = <Message title="Não conseguimos confirmar agora" text={error} />;
  else if (outcome === 'not-paid' || outcome === 'amount-mismatch')
    body = (
      <Message
        title="Pagamento ainda não confirmado"
        text="Se você já pagou, a confirmação pode levar alguns instantes e chega sozinha. Se não, conclua o pagamento antes da reserva expirar."
      >
        {a?.checkoutUrl && (
          <a href={a.checkoutUrl} className={buttonClass('primary', 'md')}>
            Voltar ao pagamento
          </a>
        )}
      </Message>
    );
  else body = <RazorLoader label="Confirmando pagamento com a InfinitePay" className="py-10" />;

  return (
    <main className="mx-auto grid min-h-[70svh] max-w-md place-items-center px-4 py-12">
      <Card className="w-full p-6 sm:p-8">{body}</Card>
    </main>
  );
}

function Message({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="space-y-3 text-center">
      <h1 className="font-label text-[24px] text-text-100">{title}</h1>
      <p className="text-[15px] leading-relaxed text-text-400">{text}</p>
      {children && <div className="pt-2">{children}</div>}
    </div>
  );
}
