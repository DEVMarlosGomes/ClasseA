import { LogOut } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { addDaysToDateKey } from '@shared/time';
import type { Appointment } from '@shared/types';
import { formatBRL } from '@shared/money';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Logo } from '@/components/ui/Logo';
import { Orbs } from '@/components/ui/Orbs';
import { Skeleton } from '@/components/ui/Skeleton';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useLiveQuery } from '@/hooks/useFirestore';
import { compactDate, longDate, todayKey } from '@/lib/dates';
import { useAuth } from '@/features/auth/AuthProvider';
import { RequireRole } from '@/features/auth/RequireRole';
import { AppointmentSheet } from '@/features/barber/AppointmentSheet';
import { useAdminBarbers } from '@/features/admin/hooks';

const PENDING_DAYS = 14;

function useAppointmentsBetween(from: string, to: string) {
  return useLiveQuery<Appointment>(`front-appts:${from}:${to}`, ({ db, collection, query, where }) =>
    query(collection(db, 'appointments'), where('date', '>=', from), where('date', '<=', to)),
  );
}

/** Visits that happened (or should have) and still have no "baixa". */
const needsSettlement = (a: Appointment) => !a.settlement && (a.status === 'confirmed' || a.status === 'completed');

type Tone = 'gold' | 'success' | 'danger' | 'neutral';
function badgeFor(a: Appointment): { label: string; tone: Tone } {
  if (a.settlement) return { label: 'Pago', tone: 'success' };
  if (a.status === 'no_show') return { label: 'Não concluído', tone: 'danger' };
  if (a.status === 'cancelled_by_client' || a.status === 'cancelled_by_barber') return { label: 'Cancelado', tone: 'neutral' };
  if (a.status === 'completed') return { label: 'Aguardando baixa', tone: 'gold' };
  return { label: 'Confirmado', tone: 'gold' };
}

export default function ReceptionPage() {
  return (
    <RequireRole role={['reception', 'admin']}>
      <ReceptionShell />
    </RequireRole>
  );
}

function ReceptionShell() {
  useDocumentMeta({ title: 'Recepção', noindex: true });
  const { roles, signOut } = useAuth();
  const navigate = useNavigate();
  const today = todayKey();
  const [date, setDate] = useState(today);
  const [barberId, setBarberId] = useState('all');
  const [open, setOpen] = useState<Appointment | null>(null);
  const barbers = useAdminBarbers();
  const day = useAppointmentsBetween(date, date);
  const recent = useAppointmentsBetween(addDaysToDateKey(today, -PENDING_DAYS), addDaysToDateKey(today, -1));

  const byBarber = (a: Appointment) => barberId === 'all' || a.barberId === barberId;
  const list = useMemo(
    () => (day.data ?? []).filter(byBarber).sort((a, b) => a.start.localeCompare(b.start)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [day.data, barberId],
  );
  const pending = useMemo(
    () => (recent.data ?? []).filter((a) => needsSettlement(a) && byBarber(a)).sort((a, b) => b.date.localeCompare(a.date) || a.start.localeCompare(b.start)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recent.data, barberId],
  );
  // Keep the open sheet in sync with live updates (e.g. after a baixa).
  const current = open ? ([...(day.data ?? []), ...(recent.data ?? [])].find((a) => a.id === open.id) ?? open) : null;

  return (
    <div className="min-h-svh">
      <Orbs intensity={0.2} />
      <header className="sticky top-0 z-30 border-b border-white/5 bg-ink-950/85 backdrop-blur-xl" style={{ paddingTop: 'var(--safe-top)' }}>
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Logo className="w-20" />
            <span className="font-label text-[12px] tracking-[0.14em] text-gold-500">RECEPÇÃO</span>
          </div>
          <div className="flex items-center gap-1">
            {roles.includes('admin') && (
              <Link to="/admin" className="min-h-11 px-3 py-3 text-[14px] text-gold-400">
                Painel do dono
              </Link>
            )}
            <button
              onClick={() => void signOut().then(() => navigate('/barbeiro/login'))}
              className="flex min-h-11 items-center gap-2 px-3 text-[14px] text-text-400 hover:text-text-100"
            >
              <LogOut className="size-4" aria-hidden="true" />
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 pb-16 pt-6 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-label text-[32px] leading-tight text-text-100">Agenda do dia</h1>
            <p className="text-[14px] text-text-400">{longDate(date)} · toque no atendimento para dar baixa</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="sr-only" htmlFor="front-date">Data</label>
            <input id="front-date" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="h-12 rounded-[12px] border border-ink-600 bg-ink-700 px-3 text-[16px] text-text-100" />
            <label className="sr-only" htmlFor="front-barber">Barbeiro</label>
            <select id="front-barber" value={barberId} onChange={(e) => setBarberId(e.target.value)} className="h-12 min-w-44 rounded-[12px] border border-ink-600 bg-ink-700 px-3 text-[16px] text-text-100">
              <option value="all">Toda a equipe</option>
              {barbers.data?.filter((b) => b.active).map((b) => <option key={b.id} value={b.id}>{b.displayName}</option>)}
            </select>
          </div>
        </div>

        {pending.length > 0 && (
          <section aria-labelledby="pending-title" className="space-y-3">
            <h2 id="pending-title" className="font-label text-[16px] text-gold-400">
              Sem baixa nos últimos {PENDING_DAYS} dias ({pending.length})
            </h2>
            <ul className="space-y-2">
              {pending.map((a) => <VisitRow key={a.id} appt={a} showDate onOpen={setOpen} />)}
            </ul>
          </section>
        )}

        <section aria-label="Atendimentos do dia" className="space-y-2">
          {day.error ? (
            <ErrorState />
          ) : day.loading ? (
            <div className="space-y-2"><Skeleton className="h-20 rounded-[16px]" /><Skeleton className="h-20 rounded-[16px]" /></div>
          ) : list.length === 0 ? (
            <Card><EmptyState title="Nenhum atendimento neste dia" description="Escolha outra data ou outro barbeiro." /></Card>
          ) : (
            <ul className="space-y-2">{list.map((a) => <VisitRow key={a.id} appt={a} onOpen={setOpen} />)}</ul>
          )}
        </section>
      </main>

      <AppointmentSheet appt={current} onClose={() => setOpen(null)} />
    </div>
  );
}

function VisitRow({ appt, onOpen, showDate }: { appt: Appointment; onOpen: (a: Appointment) => void; showDate?: boolean }) {
  const badge = badgeFor(appt);
  return (
    <li>
      <button onClick={() => onOpen(appt)} className="panel flex w-full items-center gap-4 p-4 text-left hover:border-gold-700">
        <span className="tabular w-16 shrink-0 font-label text-[20px] text-gold-400">
          {showDate ? compactDate(appt.date) : appt.start}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block break-words text-[16px] font-bold text-text-100">{appt.clientName}</span>
          <span className="block text-[13px] text-text-400">
            {showDate ? `${appt.start} · ` : ''}com {appt.barberName} · {appt.services.map((s) => s.name).join(' + ')}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <Badge tone={badge.tone}>{badge.label}</Badge>
          {appt.dueAtShopCents > 0 && !appt.settlement && <span className="tabular text-[13px] text-text-100">{formatBRL(appt.dueAtShopCents)}</span>}
        </span>
      </button>
    </li>
  );
}
