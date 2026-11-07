import { Download } from 'lucide-react';
import { useMemo, useState } from 'react';
import { periodOf, periodRange } from '@shared/finance';
import { formatBRL } from '@shared/money';
import { addDaysToDateKey, shopTimeToDate } from '@shared/time';
import type { Commission } from '@shared/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { todayKey } from '@/lib/dates';
import { useAdminBarbers } from '@/features/admin/hooks';
import { FinanceSettingsCard } from './FinanceSettingsCard';
import { useAppointmentsInRange, useCommissionsByPeriod, useFinanceSettingsDoc, usePaymentsInRange, usePayoutsByPeriod } from './hooks';
import { PeriodPicker } from './PeriodPicker';
import { RefundsCard } from './RefundsCard';
import { type PayoutTarget, PayoutSheet } from './PayoutSheet';

/** Owner only: every number of the shop for one biweekly period. */
export default function AdminFinancePage() {
  useDocumentMeta({ title: 'Financeiro', noindex: true });
  const today = todayKey();
  const [period, setPeriod] = useState(periodOf(today));
  const [payout, setPayout] = useState<PayoutTarget | null>(null);
  const { from, to } = periodRange(period);
  const range = useMemo(() => ({ from: shopTimeToDate(from, '00:00'), to: shopTimeToDate(addDaysToDateKey(to, 1), '00:00') }), [from, to]);

  const barbers = useAdminBarbers();
  const settings = useFinanceSettingsDoc();
  const appts = useAppointmentsInRange(from, to);
  const commissions = useCommissionsByPeriod(period);
  const payouts = usePayoutsByPeriod(period);
  const payments = usePaymentsInRange(range.from, range.to);

  const sum = useMemo(() => {
    const settled = (appts.data ?? []).filter((a) => a.settlement);
    const pending = (appts.data ?? []).filter((a) => !a.settlement && (a.status === 'confirmed' || a.status === 'completed') && a.date < today);
    const notDone = (appts.data ?? []).filter((a) => a.status === 'no_show');
    const services = settled.reduce((s, a) => s + (a.settlement?.receivedCents ?? 0), 0);
    const fees = settled.reduce((s, a) => s + (a.settlement?.feeCents ?? 0), 0);
    const planCovered = settled.reduce((s, a) => s + (a.settlement?.planCoveredCents ?? 0), 0);
    // Plans sold in the period (subscription payments); app payments for visits are already in `services`.
    const plans = (payments.data ?? []).filter((p) => p.subscriptionId && p.status === 'approved').reduce((s, p) => s + p.amountCents, 0);
    const commission = (commissions.data ?? []).reduce((s, c) => s + c.amountCents, 0);
    return { settled, pending, notDone, services, fees, planCovered, plans, commission, result: services + plans - fees - commission };
  }, [appts.data, payments.data, commissions.data, today]);

  const perBarber = useMemo(() => {
    const map = new Map<string, { name: string; count: number; base: number; amount: number }>();
    for (const c of commissions.data ?? []) {
      const row = map.get(c.barberId) ?? { name: c.barberName, count: 0, base: 0, amount: 0 };
      row.count++;
      row.base += c.baseCents;
      row.amount += c.amountCents;
      map.set(c.barberId, row);
    }
    return [...map.entries()].sort((a, b) => b[1].amount - a[1].amount);
  }, [commissions.data]);
  const paidOut = new Map((payouts.data ?? []).map((p) => [p.barberId, p]));

  const loading = appts.loading || commissions.loading || payments.loading;
  const failed = appts.error || commissions.error || payments.error;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-label text-[12px] tracking-[0.16em] text-gold-500">ADMINISTRAÇÃO</p>
          <h1 className="font-label mt-1 text-[36px] leading-tight text-text-100">Financeiro</h1>
          <p className="mt-1 text-[14px] text-text-400">Só você vê estes números. Valores pelo dia do atendimento.</p>
        </div>
        <PeriodPicker period={period} onChange={setPeriod} />
      </div>

      <RefundsCard />

      {failed ? (
        <ErrorState />
      ) : loading ? (
        <Skeleton className="h-40 rounded-[20px]" />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Recebido em atendimentos" value={formatBRL(sum.services)} hint={`${sum.settled.length} com baixa`} />
            <Stat label="Planos vendidos" value={formatBRL(sum.plans)} hint={sum.planCovered ? `${formatBRL(sum.planCovered)} em cortes do plano` : undefined} />
            <Stat label="Comissões + taxas" value={formatBRL(sum.commission + sum.fees)} hint={`comissões ${formatBRL(sum.commission)} · taxas ${formatBRL(sum.fees)}`} />
            <Stat label="Resultado" value={formatBRL(sum.result)} highlight />
          </div>

          {(sum.pending.length > 0 || sum.notDone.length > 0) && (
            <Card className="flex flex-wrap items-center gap-3 p-4">
              {sum.pending.length > 0 && <Badge tone="danger">{sum.pending.length} sem baixa</Badge>}
              {sum.notDone.length > 0 && <Badge>{sum.notDone.length} não concluídos</Badge>}
              <p className="text-[13px] text-text-400">Atendimentos sem baixa não entram no resultado nem na comissão. A recepção dá baixa em /recepcao.</p>
            </Card>
          )}

          <Card className="overflow-hidden p-0">
            <div className="flex items-center justify-between gap-3 border-b border-white/5 px-5 py-4">
              <h2 className="font-label text-[20px] text-text-100">Comissões por barbeiro</h2>
              <Button size="sm" variant="secondary" icon={<Download className="size-4" />} disabled={!commissions.data?.length} onClick={() => downloadCsv(period, commissions.data ?? [])}>
                CSV
              </Button>
            </div>
            {perBarber.length === 0 ? (
              <p className="px-5 py-6 text-[14px] text-text-400">Nenhuma baixa nesta quinzena.</p>
            ) : (
              <ul className="divide-y divide-white/5">
                {perBarber.map(([barberId, r]) => {
                  const paid = paidOut.get(barberId);
                  return (
                    <li key={barberId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                      <div>
                        <p className="font-bold text-text-100">{r.name}</p>
                        <p className="tabular text-[13px] text-text-400">{r.count} serviços pagos · base {formatBRL(r.base)}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="tabular text-[18px] font-bold text-gold-400">{formatBRL(r.amount)}</span>
                        {paid ? (
                          <Badge tone="success">Repassado {formatBRL(paid.amountCents)}</Badge>
                        ) : (
                          <Button size="sm" onClick={() => setPayout({ barberId, barberName: r.name, period, dueCents: r.amount })}>
                            Registrar repasse
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </>
      )}

      {barbers.data && settings.data !== undefined && <FinanceSettingsCard raw={settings.data} barbers={barbers.data} />}
      <PayoutSheet target={payout} onClose={() => setPayout(null)} />
    </div>
  );
}

function Stat({ label, value, hint, highlight }: { label: string; value: string; hint?: string; highlight?: boolean }) {
  return (
    <Card className="p-4">
      <p className="text-[12px] text-text-400">{label}</p>
      <p className={highlight ? 'tabular mt-1 text-[22px] font-bold text-gold-400' : 'tabular mt-1 text-[22px] font-bold text-text-100'}>{value}</p>
      {hint && <p className="mt-1 text-[12px] text-text-400">{hint}</p>}
    </Card>
  );
}

function downloadCsv(period: string, rows: Commission[]) {
  const cents = (n: number) => (n / 100).toFixed(2).replace('.', ',');
  const lines = [
    ['Data', 'Barbeiro', 'Serviços', 'Recebido', 'Plano', 'Taxa descontada', 'Base', '%', 'Comissão'].join(';'),
    ...[...rows]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((c) => [c.date, c.barberName, c.services.join(' + '), cents(c.receivedCents), cents(c.planCoveredCents), cents(c.deductedFeeCents), cents(c.baseCents), String(c.pct).replace('.', ','), cents(c.amountCents)].join(';')),
  ];
  // BOM so Excel opens the accents correctly.
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `comissoes-${period}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
