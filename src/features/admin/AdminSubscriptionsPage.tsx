import { useMemo, useState } from 'react';
import type { SubscriptionStatus } from '@shared/types';
import { formatBRL } from '@shared/money';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tabs } from '@/components/ui/Tabs';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { formatInstant } from '@/lib/dates';
import { useAdminPayments, useAdminSubscriptions } from './hooks';

const STATUS: Record<SubscriptionStatus, { label: string; tone: 'gold' | 'success' | 'danger' | 'neutral' }> = {
  active: { label: 'Ativa', tone: 'success' },
  past_due: { label: 'Pendente', tone: 'danger' },
  cancelled: { label: 'Cancelada', tone: 'neutral' },
  expired: { label: 'Encerrada', tone: 'neutral' },
};

export default function AdminSubscriptionsPage() {
  useDocumentMeta({ title: 'Assinaturas e cobranças', noindex: true });
  const [tab, setTab] = useState('subscriptions');
  const subscriptions = useAdminSubscriptions();
  const payments = useAdminPayments();
  const sortedSubscriptions = useMemo(
    () => [...(subscriptions.data ?? [])].sort((a, b) => b.startedAt.toMillis() - a.startedAt.toMillis()),
    [subscriptions.data],
  );
  const sortedPayments = useMemo(
    () => [...(payments.data ?? [])].sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()),
    [payments.data],
  );
  const approved = sortedPayments.filter((p) => p.status === 'approved').reduce((sum, p) => sum + p.amountCents, 0);

  return (
    <div className="space-y-6">
      <div>
        <p className="font-label text-[12px] tracking-[0.16em] text-gold-500">PLANOS</p>
        <h1 className="font-label mt-1 text-[36px] leading-tight text-text-100">Assinaturas e cobranças</h1>
        <p className="mt-2 text-[14px] text-text-400">Os valores desta versão são simulados e não representam cobranças reais.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Summary label="Assinaturas ativas" value={String(sortedSubscriptions.filter((s) => s.status === 'active').length)} />
        <Summary label="Cobranças aprovadas" value={String(sortedPayments.filter((p) => p.status === 'approved').length)} />
        <Summary label="Volume simulado" value={formatBRL(approved)} />
      </div>
      <Tabs value={tab} onValueChange={setTab} items={[{ value: 'subscriptions', label: 'Assinaturas' }, { value: 'payments', label: 'Cobranças' }]} />
      {tab === 'subscriptions' ? (
        subscriptions.error ? <ErrorState /> : subscriptions.loading ? <Skeleton className="h-56 rounded-[20px]" /> : sortedSubscriptions.length === 0 ? (
          <Card><EmptyState title="Nenhuma assinatura" description="As novas contratações aparecem aqui em tempo real." /></Card>
        ) : <div className="space-y-3">{sortedSubscriptions.map((s) => <Card key={s.id} className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold text-text-100">{s.planName}</p><p className="mt-1 break-all text-[13px] text-text-400">Cliente {s.clientId}</p></div><Badge tone={STATUS[s.status].tone}>{STATUS[s.status].label}</Badge></div><div className="mt-4 grid gap-2 text-[14px] text-text-400 sm:grid-cols-3"><span>Início: {formatInstant(s.startedAt.toDate(), 'dd/MM/yyyy')}</span><span>Renova: {formatInstant(s.currentPeriodEnd.toDate(), 'dd/MM/yyyy')}</span><span>{s.autoRenew ? 'Renovação automática' : 'Sem renovação'}</span></div></Card>)}</div>
      ) : (
        payments.error ? <ErrorState /> : payments.loading ? <Skeleton className="h-56 rounded-[20px]" /> : sortedPayments.length === 0 ? (
          <Card><EmptyState title="Nenhuma cobrança" description="As transações simuladas aparecem aqui." /></Card>
        ) : <div className="space-y-3">{sortedPayments.map((p) => <Card key={p.id} className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold text-text-100">{p.description}</p><p className="mt-1 text-[13px] text-text-400">{formatInstant(p.createdAt.toDate())} · {p.gatewayRef}</p></div><div className="text-right"><p className="tabular font-bold text-text-100">{formatBRL(p.amountCents)}</p><Badge tone={p.status === 'approved' ? 'success' : p.status === 'declined' ? 'danger' : 'neutral'}>{p.status === 'approved' ? 'Aprovada' : p.status === 'declined' ? 'Recusada' : p.status}</Badge></div></div></Card>)}</div>
      )}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <Card className="p-4"><p className="text-[12px] text-text-400">{label}</p><p className="tabular mt-1 text-[22px] font-bold text-text-100">{value}</p></Card>;
}
