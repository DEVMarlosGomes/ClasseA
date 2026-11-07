import { useMemo, useState } from 'react';
import { periodOf } from '@shared/finance';
import { formatBRL } from '@shared/money';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { compactDate, formatInstant, todayKey } from '@/lib/dates';
import { useAuth } from '@/features/auth/AuthProvider';
import { useMyCommissions, useMyPayout } from './hooks';
import { PeriodPicker } from './PeriodPicker';

/** The barber's own commission: only his services that were completed and paid. No shop totals. */
export default function BarberFinancePage() {
  useDocumentMeta({ title: 'Minha comissão', noindex: true });
  const { user } = useAuth();
  const [period, setPeriod] = useState(periodOf(todayKey()));
  const commissions = useMyCommissions(user?.uid, period);
  const payout = useMyPayout(user?.uid, period);

  const rows = useMemo(
    () => [...(commissions.data ?? [])].sort((a, b) => b.date.localeCompare(a.date)),
    [commissions.data],
  );
  const total = rows.reduce((sum, c) => sum + c.amountCents, 0);
  const base = rows.reduce((sum, c) => sum + c.baseCents, 0);
  const paid = payout.data?.amountCents ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-label text-[36px] leading-tight text-text-100">Minha comissão</h1>
          <p className="text-[14px] text-text-400">Serviços que você prestou e que já foram pagos. Repasse quinzenal.</p>
        </div>
        <PeriodPicker period={period} onChange={setPeriod} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Serviços pagos" value={String(rows.length)} />
        <Stat label="Comissão da quinzena" value={formatBRL(total)} highlight />
        <Card className="p-4">
          <p className="text-[12px] text-text-400">Repasse</p>
          {payout.data ? (
            <>
              <p className="tabular mt-1 text-[22px] font-bold text-text-100">{formatBRL(paid)}</p>
              <p className="mt-1 text-[12px] text-success">Pago em {formatInstant(payout.data.paidAt.toDate(), 'dd/MM/yyyy')}</p>
            </>
          ) : (
            <>
              <p className="tabular mt-1 text-[22px] font-bold text-text-100">{formatBRL(total)}</p>
              <p className="mt-1 text-[12px] text-gold-400">A receber</p>
            </>
          )}
        </Card>
      </div>

      {commissions.error ? (
        <ErrorState />
      ) : commissions.loading ? (
        <Skeleton className="h-48 rounded-[20px]" />
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState title="Nada nesta quinzena" description="A comissão aparece aqui quando a recepção dá baixa no pagamento do atendimento." />
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-white/5">
            {rows.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <p className="text-[15px] text-text-100">{c.services.join(' + ')}</p>
                  <p className="text-[13px] text-text-400">
                    {compactDate(c.date)} · base {formatBRL(c.baseCents)}
                    {c.planCoveredCents > 0 && ' (plano)'}
                    {c.deductedFeeCents > 0 && ` · taxa −${formatBRL(c.deductedFeeCents)}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge>{c.pct}%</Badge>
                  <span className="tabular text-[16px] font-bold text-gold-400">{formatBRL(c.amountCents)}</span>
                </div>
              </li>
            ))}
          </ul>
          <p className="border-t border-white/5 px-4 py-3 text-right text-[13px] text-text-400 sm:px-5">
            Base total {formatBRL(base)} · comissão {formatBRL(total)}
          </p>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card className="p-4">
      <p className="text-[12px] text-text-400">{label}</p>
      <p className={highlight ? 'tabular mt-1 text-[22px] font-bold text-gold-400' : 'tabular mt-1 text-[22px] font-bold text-text-100'}>{value}</p>
    </Card>
  );
}
