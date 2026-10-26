import { CalendarDays, Clock3, Scissors, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { AppointmentStatus } from '@shared/types';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { longDate, todayKey } from '@/lib/dates';
import { formatBRL } from '@shared/money';
import { useAdminAppointments, useAdminBarbers } from './hooks';

const STATUS: Record<AppointmentStatus, { label: string; tone: 'gold' | 'success' | 'danger' | 'neutral' }> = {
  confirmed: { label: 'Confirmado', tone: 'gold' },
  completed: { label: 'Concluído', tone: 'success' },
  no_show: { label: 'Não compareceu', tone: 'danger' },
  cancelled_by_client: { label: 'Cancelado pelo cliente', tone: 'neutral' },
  cancelled_by_barber: { label: 'Cancelado pela equipe', tone: 'neutral' },
};

export default function AdminAgendaPage() {
  useDocumentMeta({ title: 'Agenda da equipe', noindex: true });
  const [date, setDate] = useState(todayKey());
  const [barberId, setBarberId] = useState('all');
  const appointments = useAdminAppointments(date);
  const barbers = useAdminBarbers();
  const list = useMemo(
    () =>
      (appointments.data ?? [])
        .filter((a) => barberId === 'all' || a.barberId === barberId)
        .sort((a, b) => a.start.localeCompare(b.start)),
    [appointments.data, barberId],
  );
  const active = list.filter((a) => a.status === 'confirmed' || a.status === 'completed');
  const revenue = active.reduce((sum, a) => sum + a.dueAtShopCents, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-label text-[12px] tracking-[0.16em] text-gold-500">VISÃO GERAL</p>
          <h1 className="font-label mt-1 text-[36px] leading-tight text-text-100">Agenda da equipe</h1>
          <p className="mt-1 text-[14px] text-text-400">{longDate(date)}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="admin-date">Data</label>
          <input
            id="admin-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-12 rounded-[12px] border border-ink-600 bg-ink-700 px-3 text-[16px] text-text-100"
          />
          <label className="sr-only" htmlFor="admin-barber">Barbeiro</label>
          <select
            id="admin-barber"
            value={barberId}
            onChange={(e) => setBarberId(e.target.value)}
            className="h-12 min-w-44 rounded-[12px] border border-ink-600 bg-ink-700 px-3 text-[16px] text-text-100"
          >
            <option value="all">Toda a equipe</option>
            {barbers.data?.map((b) => <option key={b.id} value={b.id}>{b.displayName}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat icon={CalendarDays} label="Atendimentos" value={String(active.length)} />
        <Stat icon={Users} label="Profissionais" value={String(new Set(active.map((a) => a.barberId)).size)} />
        <Stat icon={Clock3} label="A receber no local" value={formatBRL(revenue)} />
      </div>

      {appointments.error ? <ErrorState /> : appointments.loading ? (
        <div className="space-y-3"><Skeleton className="h-24 rounded-[20px]" /><Skeleton className="h-24 rounded-[20px]" /></div>
      ) : list.length === 0 ? (
        <Card><EmptyState title="Nenhum atendimento neste dia" description="Escolha outra data ou confira outro profissional." /></Card>
      ) : (
        <div className="space-y-3">
          {list.map((a) => {
            const status = STATUS[a.status];
            return (
              <Card key={a.id} className="p-4 sm:p-5">
                <div className="flex items-start gap-4">
                  <div className="tabular w-14 shrink-0 font-label text-[22px] text-gold-400">{a.start}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-[16px] font-bold text-text-100">{a.clientName}</p>
                        <p className="text-[14px] text-text-400">com {a.barberName}</p>
                      </div>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </div>
                    <p className="mt-3 flex items-center gap-2 text-[14px] text-text-400">
                      <Scissors className="size-4 text-gold-600" aria-hidden="true" />
                      {a.services.map((s) => s.name).join(' + ')} · {a.durationMin} min
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-text-400">
                      <span>{a.paymentMode === 'plan' ? 'Plano' : a.paymentMode === 'pay_at_shop' ? `${formatBRL(a.dueAtShopCents)} no local` : 'Pago no app (simulado)'}</span>
                      {a.firstVisit && <span className="text-gold-400">Primeira visita</span>}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <span className="grid size-10 place-items-center rounded-full bg-gold-500/10 text-gold-400"><Icon className="size-5" strokeWidth={1.6} /></span>
      <div><p className="text-[12px] text-text-400">{label}</p><p className="tabular text-[18px] font-bold text-text-100">{value}</p></div>
    </Card>
  );
}
