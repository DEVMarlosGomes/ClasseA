import { useMemo, useState } from 'react';
import type { PaymentStatus, SubscriptionStatus } from '@shared/types';
import { formatBRL } from '@shared/money';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tabs } from '@/components/ui/Tabs';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { formatInstant, todayKey } from '@/lib/dates';
import { useAdminPayments, useAdminSubscriptions, useAdminUsers } from './hooks';

type Tone = 'gold' | 'success' | 'danger' | 'neutral';

const SUB_STATUS: Record<SubscriptionStatus, { label: string; tone: Tone }> = {
  active: { label: 'Ativa', tone: 'success' },
  past_due: { label: 'Pagamento pendente', tone: 'danger' },
  cancelled: { label: 'Cancelada', tone: 'neutral' },
  expired: { label: 'Encerrada', tone: 'neutral' },
};

const PAY_STATUS: Record<PaymentStatus, { label: string; tone: Tone }> = {
  approved: { label: 'Aprovada', tone: 'success' },
  declined: { label: 'Recusada', tone: 'danger' },
  refunded: { label: 'Estornada', tone: 'neutral' },
  pending: { label: 'Aguardando', tone: 'gold' },
  refund_pending: { label: 'Estorno pendente', tone: 'danger' },
};

// Overdue first, then active, then the closed ones.
const SUB_ORDER: Record<SubscriptionStatus, number> = { past_due: 0, active: 1, cancelled: 2, expired: 3 };

export default function AdminSubscriptionsPage() {
  useDocumentMeta({ title: 'Assinaturas e cobranças', noindex: true });
  const [tab, setTab] = useState('subscriptions');
  const [month, setMonth] = useState(todayKey().slice(0, 7));
  const subscriptions = useAdminSubscriptions();
  const payments = useAdminPayments();
  const users = useAdminUsers();
  const userMap = useMemo(() => new Map((users.data ?? []).map((u) => [u.id, u])), [users.data]);
  const clientLabel = (uid: string) => userMap.get(uid)?.name ?? 'Cliente';

  const sortedSubscriptions = useMemo(
    () =>
      [...(subscriptions.data ?? [])].sort(
        (a, b) => SUB_ORDER[a.status] - SUB_ORDER[b.status] || a.currentPeriodEnd.toMillis() - b.currentPeriodEnd.toMillis(),
      ),
    [subscriptions.data],
  );
  const monthPayments = useMemo(
    () =>
      (payments.data ?? [])
        .filter((p) => formatInstant(p.createdAt.toDate(), 'yyyy-MM') === month)
        .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()),
    [payments.data, month],
  );
  const received = monthPayments.filter((p) => p.status === 'approved').reduce((sum, p) => sum + p.amountCents, 0);
  const pastDue = sortedSubscriptions.filter((s) => s.status === 'past_due').length;

  return (
    <div className="space-y-6">
      <div>
        <p className="font-label text-[12px] tracking-[0.16em] text-gold-500">PLANOS</p>
        <h1 className="font-label mt-1 text-[36px] leading-tight text-text-100">Assinaturas e cobranças</h1>
        <p className="mt-2 text-[14px] text-text-400">
          Os valores desta versão são simulados e não representam cobranças reais.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Summary label="Assinaturas ativas" value={String(sortedSubscriptions.filter((s) => s.status === 'active').length)} />
        <Summary label="Com pagamento pendente" value={String(pastDue)} alert={pastDue > 0} />
        <Summary label={`Recebido em ${formatMonth(month)}`} value={formatBRL(received)} />
      </div>
      <Tabs
        value={tab}
        onValueChange={setTab}
        items={[
          { value: 'subscriptions', label: 'Assinaturas' },
          { value: 'payments', label: 'Cobranças' },
        ]}
      />
      {tab === 'subscriptions' ? (
        subscriptions.error ? (
          <ErrorState />
        ) : subscriptions.loading ? (
          <Skeleton className="h-56 rounded-[20px]" />
        ) : sortedSubscriptions.length === 0 ? (
          <Card><EmptyState title="Nenhuma assinatura" description="As novas contratações aparecem aqui em tempo real." /></Card>
        ) : (
          <div className="space-y-3">
            {sortedSubscriptions.map((s) => (
              <Card key={s.id} className={s.status === 'past_due' ? 'border-danger/40 p-5' : 'p-5'}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-text-100">{clientLabel(s.clientId)}</p>
                    <p className="mt-1 text-[13px] text-text-400">
                      {s.planName}
                      {userMap.get(s.clientId)?.phone ? ` · ${userMap.get(s.clientId)!.phone}` : ''}
                    </p>
                  </div>
                  <Badge tone={SUB_STATUS[s.status].tone}>{SUB_STATUS[s.status].label}</Badge>
                </div>
                <div className="mt-4 grid gap-2 text-[14px] text-text-400 sm:grid-cols-3">
                  <span>Início: {formatInstant(s.startedAt.toDate(), 'dd/MM/yyyy')}</span>
                  <span>
                    {s.status === 'active' || s.status === 'past_due' ? 'Vence' : 'Venceu'}:{' '}
                    {formatInstant(s.currentPeriodEnd.toDate(), 'dd/MM/yyyy')}
                  </span>
                  <span>{s.autoRenew ? 'Renovação automática' : 'Sem renovação'}</span>
                </div>
                {s.cutsPerMonth !== null && (
                  <p className="mt-2 text-[13px] text-text-400">
                    Cortes no mês: {s.usage.cutsUsed} de {s.cutsPerMonth}
                  </p>
                )}
              </Card>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-[14px] text-text-400" htmlFor="payments-month">Mês</label>
            <input
              id="payments-month"
              type="month"
              value={month}
              onChange={(e) => e.target.value && setMonth(e.target.value)}
              className="h-12 rounded-[12px] border border-ink-600 bg-ink-700 px-3 text-[16px] text-text-100"
            />
          </div>
          {payments.error ? (
            <ErrorState />
          ) : payments.loading ? (
            <Skeleton className="h-56 rounded-[20px]" />
          ) : monthPayments.length === 0 ? (
            <Card><EmptyState title="Nenhuma cobrança neste mês" description="Escolha outro mês para ver o histórico." /></Card>
          ) : (
            <div className="space-y-3">
              {monthPayments.map((p) => (
                <Card key={p.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-text-100">{clientLabel(p.clientId)}</p>
                      <p className="mt-1 text-[13px] text-text-400">
                        {p.description} · {p.method === 'pix_mock' || p.method === 'pix' ? 'PIX' : 'Cartão'}
                      </p>
                      <p className="mt-1 break-all text-[12px] text-text-400">
                        {formatInstant(p.createdAt.toDate())} · {p.gatewayRef}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="tabular font-bold text-text-100">{formatBRL(p.amountCents)}</p>
                      <Badge tone={PAY_STATUS[p.status].tone}>{PAY_STATUS[p.status].label}</Badge>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatMonth(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return formatInstant(new Date(y!, m! - 1, 15), 'MMM/yyyy');
}

function Summary({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <Card className="p-4">
      <p className="text-[12px] text-text-400">{label}</p>
      <p className={alert ? 'tabular mt-1 text-[22px] font-bold text-danger' : 'tabular mt-1 text-[22px] font-bold text-text-100'}>
        {value}
      </p>
    </Card>
  );
}
