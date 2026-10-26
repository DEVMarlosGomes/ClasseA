import { CreditCard, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { BRAND_LABEL } from '@shared/cards';
import { formatBRL } from '@shared/money';
import type { CardBrand, Payment, PaymentMethod } from '@shared/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { LogoMark } from '@/components/ui/Logo';
import { Sheet } from '@/components/ui/Sheet';
import { Skeleton } from '@/components/ui/Skeleton';
import { toast } from '@/components/ui/Toast';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useLiveQuery } from '@/hooks/useFirestore';
import { call, errorMessage } from '@/lib/api';
import { formatInstant } from '@/lib/dates';
import { useAuth } from '@/features/auth/AuthProvider';
import { useMyPaymentMethods } from '@/features/plans/hooks';
import { CardForm } from './CardForm';
import { DemoNotice } from './DemoNotice';

function SavedCard({ card }: { card: PaymentMethod }) {
  const [busy, setBusy] = useState<'default' | 'remove' | null>(null);
  const run = async (kind: 'default' | 'remove') => {
    setBusy(kind);
    try {
      await call(kind === 'default' ? 'setDefaultPaymentMethod' : 'removePaymentMethod', { id: card.id });
      toast.success(kind === 'default' ? 'Cartão padrão atualizado.' : 'Cartão removido.');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };
  return (
    <li className="relative overflow-hidden rounded-[18px] border border-gold-500/20 bg-[linear-gradient(135deg,rgba(40,34,22,0.7),rgba(12,12,12,0.9))] p-5">
      <LogoMark className="absolute -right-4 -top-4 w-24 opacity-[0.07]" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-label text-[14px] text-gold-400">{BRAND_LABEL[card.brand as CardBrand]}</p>
          <p className="tabular mt-3 text-[20px] tracking-[0.12em] text-text-100">•••• {card.last4}</p>
          <p className="tabular mt-1 text-[13px] text-text-400">
            {card.holderName} · {String(card.expMonth).padStart(2, '0')}/{String(card.expYear).slice(-2)}
          </p>
        </div>
        {card.isDefault && <Badge tone="gold">Padrão</Badge>}
      </div>
      <div className="relative mt-4 flex gap-2">
        {!card.isDefault && (
          <Button size="sm" variant="ghost" loading={busy === 'default'} onClick={() => void run('default')}>
            Definir como padrão
          </Button>
        )}
        <Button size="sm" variant="ghost" loading={busy === 'remove'} icon={<Trash2 className="size-4" strokeWidth={1.5} />} onClick={() => void run('remove')}>
          Remover
        </Button>
      </div>
    </li>
  );
}

const STATUS = {
  approved: { tone: 'success' as const, label: 'Aprovado' },
  declined: { tone: 'danger' as const, label: 'Recusado' },
  refunded: { tone: 'neutral' as const, label: 'Estornado' },
  pending: { tone: 'gold' as const, label: 'Pendente' },
};

export default function ClientPaymentsPage() {
  useDocumentMeta({ title: 'Pagamentos', noindex: true });
  const { user } = useAuth();
  const cards = useMyPaymentMethods(user?.uid);
  const [adding, setAdding] = useState(false);
  const payments = useLiveQuery<Payment>(user ? `pays:${user.uid}` : null, ({ db, collection, query, where, orderBy, limit }) =>
    query(collection(db, 'payments'), where('clientId', '==', user!.uid), orderBy('createdAt', 'desc'), limit(30)),
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-label text-[36px] leading-tight text-text-100">Pagamentos</h1>
        <div className="mt-4 max-w-xl">
          <DemoNotice />
        </div>
      </div>

      <section aria-labelledby="cards-title">
        <div className="flex items-center justify-between gap-3">
          <h2 id="cards-title" className="font-label text-[18px] text-text-100">
            Cartões salvos
          </h2>
          <Button size="sm" variant="secondary" icon={<Plus className="size-4" strokeWidth={1.75} />} onClick={() => setAdding(true)}>
            Adicionar
          </Button>
        </div>
        <div className="mt-4">
          {cards.error ? (
            <ErrorState />
          ) : cards.loading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-40 rounded-[18px]" />
            </div>
          ) : cards.data?.length ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {cards.data.map((c) => (
                <SavedCard key={c.id} card={c} />
              ))}
            </ul>
          ) : (
            <div className="panel">
              <EmptyState
                title="Nenhum cartão salvo"
                description="Salve um cartão para pagar online e assinar planos com renovação automática."
                action={
                  <Button icon={<CreditCard className="size-4" strokeWidth={1.75} />} onClick={() => setAdding(true)}>
                    Adicionar cartão
                  </Button>
                }
              />
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="hist-title">
        <h2 id="hist-title" className="font-label text-[18px] text-text-100">
          Cobranças
        </h2>
        <div className="panel mt-4">
          {payments.loading ? (
            <div className="space-y-3 p-5">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-6" />
              ))}
            </div>
          ) : payments.data?.length ? (
            <ul className="divide-y divide-white/5">
              {payments.data.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-[15px] text-text-100">{p.description}</p>
                    <p className="tabular text-[13px] text-text-400">
                      {p.createdAt ? formatInstant(p.createdAt.toDate()) : '—'} · {p.method === 'pix_mock' ? 'PIX' : 'Cartão'} · {p.gatewayRef}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="tabular text-[15px] font-bold text-text-100">{formatBRL(p.amountCents)}</span>
                    <Badge tone={STATUS[p.status].tone}>{STATUS[p.status].label}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nenhuma cobrança ainda" description="Pagamentos online e cobranças de plano aparecem aqui." />
          )}
        </div>
      </section>

      <Sheet open={adding} onOpenChange={setAdding} title="Adicionar cartão">
        <CardForm
          onSaved={(c) => {
            setAdding(false);
            toast.success(`Cartão final ${c.last4} salvo.`);
          }}
        />
        <details className="mt-5 rounded-[12px] border border-ink-600 p-4 text-[13px] text-text-400">
          <summary className="cursor-pointer text-text-100">Cartões de teste</summary>
          <ul className="tabular mt-2 space-y-1">
            <li>4242 4242 4242 4242 · aprovado</li>
            <li>5555 5555 5555 4444 · aprovado (Mastercard)</li>
            <li>4000 0000 0000 0002 · recusado</li>
            <li>4000 0000 0000 9995 · saldo insuficiente</li>
            <li>4000 0000 0000 0069 · cartão vencido</li>
          </ul>
        </details>
      </Sheet>
    </div>
  );
}
