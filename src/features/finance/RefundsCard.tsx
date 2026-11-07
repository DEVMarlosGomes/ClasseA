import { useState } from 'react';
import { formatBRL } from '@shared/money';
import type { Payment } from '@shared/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { toast } from '@/components/ui/Toast';
import { useLiveQuery } from '@/hooks/useFirestore';
import { call, errorMessage } from '@/lib/api';
import { formatInstant } from '@/lib/dates';

/**
 * Online payments that must be refunded by hand in the InfinitePay app (it has no refund API):
 * visits cancelled after paying, or payments that arrived after the slot hold expired.
 */
export function RefundsCard() {
  const pending = useLiveQuery<Payment & { slug?: string }>('refund-pending', ({ db, collection, query, where }) =>
    query(collection(db, 'payments'), where('status', '==', 'refund_pending')),
  );
  const [busy, setBusy] = useState<string | null>(null);
  if (!pending.data?.length) return null;

  const done = async (id: string) => {
    setBusy(id);
    try {
      await call('markPaymentRefunded', { paymentId: id });
      toast.success('Estorno registrado.');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="space-y-3 border-danger/40 p-5">
      <div>
        <h2 className="font-label text-[20px] text-text-100">Estornos a fazer ({pending.data.length})</h2>
        <p className="mt-1 text-[13px] text-text-400">
          Faça o estorno no app da InfinitePay (a API dela não estorna) e depois marque aqui.
        </p>
      </div>
      <ul className="divide-y divide-white/5">
        {pending.data.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="text-[15px] text-text-100">{p.description}</p>
              <p className="break-all text-[12px] text-text-400">
                {p.createdAt ? formatInstant(p.createdAt.toDate()) : '—'} · transação {p.gatewayRef}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="tabular font-bold text-text-100">{formatBRL(p.amountCents)}</span>
              <Button size="sm" variant="secondary" loading={busy === p.id} onClick={() => void done(p.id)}>
                Já estornei
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
