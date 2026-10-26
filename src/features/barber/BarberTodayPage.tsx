import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { blockRanges } from '@shared/dayEdit';
import { formatBRL } from '@shared/money';
import { computeDayAvailability } from '@shared/slots';
import { fromMinutes, mergeRanges, rangeToMinutes, shopNow, subtractRanges } from '@shared/time';
import type { Appointment } from '@shared/types';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useLiveDoc } from '@/hooks/useFirestore';
import { cn } from '@/lib/cn';
import { longDate, todayKey } from '@/lib/dates';
import { useAuth } from '@/features/auth/AuthProvider';
import type { BarberDay } from '@shared/types';
import { AppointmentSheet, PAYMENT_SHORT } from './AppointmentSheet';
import { saveDays, stripDay, useBarberAppointments, useMyBarber } from './hooks';

const PX_PER_MIN = 1.6;

function useNowMinutes() {
  const [m, setM] = useState(() => shopNow().minutes);
  useEffect(() => {
    const t = setInterval(() => setM(shopNow().minutes), 30_000);
    return () => clearInterval(t);
  }, []);
  return m;
}

export default function BarberTodayPage() {
  useDocumentMeta({ title: 'Hoje', noindex: true });
  const { user } = useAuth();
  const today = todayKey();
  const barber = useMyBarber(user?.uid);
  const dayDoc = useLiveDoc<BarberDay & { id: string }>(user ? `barbers/${user.uid}/days/${today}` : null);
  const appts = useBarberAppointments(user?.uid, today, today);
  const now = useNowMinutes();
  const [open, setOpen] = useState<Appointment | null>(null);

  const active = useMemo(() => (appts.data ?? []).filter((a) => !a.status.startsWith('cancelled')), [appts.data]);
  const layout = useMemo(() => {
    if (!barber.data) return null;
    const day = stripDay(dayDoc.data);
    const avail = computeDayAvailability(barber.data, today, day, active.map((a) => ({ start: a.start, end: a.end })));
    const working = mergeRanges(avail.workingRanges.map(rangeToMinutes));
    const starts = [...working.map((r) => r.start), ...active.map((a) => rangeToMinutes(a).start)];
    const ends = [...working.map((r) => r.end), ...active.map((a) => rangeToMinutes(a).end)];
    if (!starts.length) return { from: 0, to: 0, free: [], blocked: [], working };
    const from = Math.floor(Math.min(...starts) / 60) * 60;
    const to = Math.ceil(Math.max(...ends) / 60) * 60;
    const blocked = avail.blocked.map(rangeToMinutes).map((b) => ({ ...b, start: Math.max(b.start, from), end: Math.min(b.end, to) })).filter((b) => b.end > b.start);
    const free = subtractRanges(working, [...blocked, ...active.map((a) => rangeToMinutes(a))]).filter((r) => r.end - r.start >= 15);
    return { from, to, free, blocked, working, day };
  }, [barber.data, dayDoc.data, active, today]);

  const forecast = active.filter((a) => a.paymentMode !== 'plan').reduce((s, a) => s + a.totalCents, 0);
  const planCount = active.filter((a) => a.paymentMode === 'plan').length;
  const remaining = active.filter((a) => a.status === 'confirmed').length;

  const block = (start: number, end: number) => {
    if (!user || !layout) return;
    const prev = layout.day ?? null;
    void saveDays(user.uid, [{ date: today, prev, next: blockRanges(prev, [{ start: fromMinutes(start), end: fromMinutes(end) }], null) }], `Bloqueado das ${fromMinutes(start)} às ${fromMinutes(end)}.`);
  };

  if (barber.error || appts.error) return <ErrorState />;

  return (
    <div>
      <p className="text-[14px] text-text-400">{longDate(today)}</p>
      <h1 className="font-label text-[36px] leading-tight text-text-100">Hoje</h1>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          ['Atendimentos', String(active.length)],
          ['Faltam', String(remaining)],
          ['Previsão', formatBRL(forecast)],
        ].map(([k, v]) => (
          <Card key={k} tone="panel" className="p-3 sm:p-4">
            <p className="font-label text-[11px] text-text-400">{k}</p>
            <p className="tabular mt-1 text-[20px] font-bold text-gold-500 sm:text-[24px]">{v}</p>
          </Card>
        ))}
      </div>
      {planCount > 0 && <p className="mt-2 text-[13px] text-text-400">+ {planCount} {planCount === 1 ? 'atendimento' : 'atendimentos'} por plano</p>}

      <div className="mt-6">
        {appts.loading || barber.loading || !layout ? (
          <Skeleton className="h-[480px] rounded-[20px]" />
        ) : layout.to === layout.from ? (
          <div className="panel">
            <EmptyState title="Sem expediente hoje" description="Você não tem horários de trabalho hoje. Para atender, abra um horário extra na Agenda." />
          </div>
        ) : (
          <div className="panel relative overflow-hidden p-3 sm:p-4">
            <div className="relative" style={{ height: (layout.to - layout.from) * PX_PER_MIN }}>
              {Array.from({ length: (layout.to - layout.from) / 60 + 1 }, (_, i) => layout.from + i * 60).map((m) => (
                <div key={m} className="absolute inset-x-0 flex items-start gap-3" style={{ top: (m - layout.from) * PX_PER_MIN }}>
                  <span className="tabular w-11 -translate-y-2 text-right text-[12px] text-text-400">{fromMinutes(m)}</span>
                  <span className="mt-0 h-px flex-1 bg-white/[0.06]" />
                </div>
              ))}

              <div className="absolute inset-y-0 left-14 right-0">
                {layout.blocked.map((b) => (
                  <div
                    key={`b${b.start}`}
                    className="hatch absolute inset-x-0 flex items-center gap-2 rounded-[12px] border border-ink-600 px-3 text-[13px] text-text-400"
                    style={{ top: (b.start - layout.from) * PX_PER_MIN + 1, height: (b.end - b.start) * PX_PER_MIN - 2 }}
                  >
                    <Lock className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                    Bloqueado
                  </div>
                ))}
                {layout.free.map((f) => (
                  <div
                    key={`f${f.start}`}
                    className="absolute inset-x-0 flex items-center justify-between rounded-[12px] border border-dashed border-ink-600 px-3"
                    style={{ top: (f.start - layout.from) * PX_PER_MIN + 1, height: (f.end - f.start) * PX_PER_MIN - 2 }}
                  >
                    <span className="tabular text-[13px] text-text-400">
                      Livre {fromMinutes(f.start)}–{fromMinutes(f.end)}
                    </span>
                    {(f.end - f.start) * PX_PER_MIN >= 36 && f.end - 15 > now && (
                      <button
                        // A gap already under way is blocked from the next quarter hour on.
                        onClick={() => block(f.start < now ? Math.ceil(now / 15) * 15 : f.start, f.end)}
                        className="font-label min-h-9 rounded-full px-3 text-[12px] text-gold-400 hover:bg-gold-500/10"
                      >
                        Bloquear
                      </button>
                    )}
                  </div>
                ))}
                {active.map((a) => {
                  const r = rangeToMinutes(a);
                  const past = a.status !== 'confirmed';
                  const h = (r.end - r.start) * PX_PER_MIN - 3;
                  return (
                    <button
                      key={a.id}
                      onClick={() => setOpen(a)}
                      className={cn(
                        'absolute inset-x-0 overflow-hidden rounded-[12px] border px-3 py-2 text-left transition-colors',
                        past ? 'border-ink-600 bg-ink-800/90' : 'border-gold-500/50 bg-gold-500/[0.14] hover:bg-gold-500/20',
                      )}
                      style={{ top: (r.start - layout.from) * PX_PER_MIN + 1.5, height: h }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="tabular text-[13px] font-bold text-gold-400">{a.start}</span>
                        <span className="truncate text-[15px] font-bold text-text-100">{a.clientName}</span>
                        {a.firstVisit && <Badge tone="solid">1ª visita</Badge>}
                        {a.paymentMode === 'plan' && <Badge tone="gold">Plano</Badge>}
                        {a.status === 'completed' && <Badge tone="success">Concluído</Badge>}
                        {a.status === 'no_show' && <Badge tone="danger">Faltou</Badge>}
                      </div>
                      {h > 44 && (
                        <p className="mt-0.5 truncate text-[13px] text-text-400">
                          {a.services.map((s) => s.name).join(' + ')} · {a.durationMin} min · {PAYMENT_SHORT[a.paymentMode]}
                        </p>
                      )}
                      {h > 66 && a.notes && <p className="mt-0.5 truncate text-[13px] italic text-text-100/70">“{a.notes}”</p>}
                    </button>
                  );
                })}
              </div>

              {now >= layout.from && now <= layout.to && (
                <motion.div
                  aria-label={`Agora, ${fromMinutes(now)}`}
                  className="pointer-events-none absolute left-12 right-0 z-10 flex items-center"
                  initial={false}
                  animate={{ y: (now - layout.from) * PX_PER_MIN }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  style={{ top: 0 }}
                >
                  <span className="size-2.5 rounded-full bg-gold-400 shadow-[0_0_12px_rgba(242,199,92,0.9)]" />
                  <span className="h-[2px] flex-1 bg-gold-400/80" />
                </motion.div>
              )}
            </div>
          </div>
        )}
      </div>
      <AppointmentSheet appt={open} onClose={() => setOpen(null)} />
    </div>
  );
}
