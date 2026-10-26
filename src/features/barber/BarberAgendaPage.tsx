import { ChevronLeft, ChevronRight, Copy, LockOpen, Lock, Plus, Settings2, CalendarOff } from 'lucide-react';
import { useMemo, useState } from 'react';
import { addExtraOpening, blockRanges, blockWholeDay, cellsToRanges, releaseRanges, releaseWholeDay } from '@shared/dayEdit';
import { buildAgendaCells, computeDayAvailability } from '@shared/slots';
import { addDaysToDateKey, isHHmm, overlaps, rangeToMinutes, weekdayOf } from '@shared/time';
import type { Appointment, Barber, BarberDay, WeeklyTemplate } from '@shared/types';
import { parseISO } from 'date-fns';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { ErrorState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Sheet } from '@/components/ui/Sheet';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tabs } from '@/components/ui/Tabs';
import { toast } from '@/components/ui/Toast';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import { call, errorMessage } from '@/lib/api';
import { compactDate, longDate, todayKey } from '@/lib/dates';
import { loadFirestore } from '@/lib/firebase';
import { useAuth } from '@/features/auth/AuthProvider';
import { AgendaGrid, type DayColumn, type SelectionMode } from './AgendaGrid';
import { AppointmentSheet } from './AppointmentSheet';
import { saveDays, stripDay, useBarberAppointments, useBarberDays, useMyBarber } from './hooks';

const REASONS = ['Almoço', 'Folga', 'Curso', 'Pessoal', 'Outro'];
const WEEKDAY_LABEL: Record<string, string> = { mon: 'Segunda', tue: 'Terça', wed: 'Quarta', thu: 'Quinta', fri: 'Sexta', sat: 'Sábado', sun: 'Domingo' };

function weekStart(date: string): string {
  const dow = parseISO(date).getDay();
  return addDaysToDateKey(date, dow === 0 ? -6 : 1 - dow);
}

interface Conflict {
  appts: Appointment[];
  /** Applies the change; `cancel` true cancels the conflicting appointments first. */
  run: (cancel: boolean) => Promise<void>;
}

function TemplateEditor({ barber, open, onOpenChange }: { barber: Barber; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [tpl, setTpl] = useState<WeeklyTemplate>(barber.weeklyTemplate);
  const [interval, setInterval] = useState(barber.slotIntervalMin);
  const [buffer, setBuffer] = useState(barber.bufferMin);
  const [busy, setBusy] = useState(false);
  const order = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
  const valid = order.every((d) => tpl[d].every((r) => isHHmm(r.start) && isHHmm(r.end) && r.start < r.end));

  const update = (d: (typeof order)[number], i: number, key: 'start' | 'end', v: string) =>
    setTpl((t) => ({ ...t, [d]: t[d].map((r, j) => (j === i ? { ...r, [key]: v } : r)) }));

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Modelo semanal"
      description="Vale para todas as semanas até você mudar. Bloqueios e horários extras de cada dia continuam valendo."
      size="lg"
      footer={
        <Button
          block
          size="lg"
          disabled={!valid}
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const { db, doc, updateDoc } = await loadFirestore();
              await updateDoc(doc(db, `barbers/${barber.id}`), { weeklyTemplate: tpl, slotIntervalMin: interval, bufferMin: buffer });
              toast.success('Modelo semanal salvo.');
              onOpenChange(false);
            } catch (e) {
              toast.error(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          Salvar modelo
        </Button>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="font-label text-[12px] text-text-400">Intervalo entre horários</span>
            <select value={interval} onChange={(e) => setInterval(Number(e.target.value))} className="mt-1 h-12 w-full rounded-[12px] border border-ink-600 bg-ink-700 px-3 text-text-100">
              {[15, 30, 45, 60].map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="font-label text-[12px] text-text-400">Pausa entre atendimentos</span>
            <select value={buffer} onChange={(e) => setBuffer(Number(e.target.value))} className="mt-1 h-12 w-full rounded-[12px] border border-ink-600 bg-ink-700 px-3 text-text-100">
              {[0, 5, 10, 15, 20, 30].map((m) => (
                <option key={m} value={m}>
                  {m ? `${m} min` : 'Sem pausa'}
                </option>
              ))}
            </select>
          </label>
        </div>
        {order.map((d) => (
          <div key={d} className="rounded-[14px] border border-ink-600 p-4">
            <div className="flex items-center justify-between">
              <p className="font-label text-[14px] text-text-100">{WEEKDAY_LABEL[d]}</p>
              <button
                className="font-label min-h-9 text-[12px] text-gold-400"
                onClick={() => setTpl((t) => ({ ...t, [d]: [...t[d], { start: t[d].at(-1)?.end ?? '09:00', end: '18:00' }].slice(0, 4) }))}
              >
                + Intervalo
              </button>
            </div>
            {tpl[d].length === 0 && <p className="mt-2 text-[13px] text-text-400">Não trabalha</p>}
            {tpl[d].map((r, i) => (
              <div key={i} className="mt-2 flex items-center gap-2">
                <input type="time" step={900} value={r.start} onChange={(e) => update(d, i, 'start', e.target.value)} className="tabular h-11 flex-1 rounded-[10px] border border-ink-600 bg-ink-700 px-3 text-text-100" aria-label={`${WEEKDAY_LABEL[d]}, início`} />
                <span className="text-text-400">às</span>
                <input type="time" step={900} value={r.end} onChange={(e) => update(d, i, 'end', e.target.value)} className="tabular h-11 flex-1 rounded-[10px] border border-ink-600 bg-ink-700 px-3 text-text-100" aria-label={`${WEEKDAY_LABEL[d]}, fim`} />
                <button onClick={() => setTpl((t) => ({ ...t, [d]: t[d].filter((_, j) => j !== i) }))} className="grid size-11 place-items-center text-text-400 hover:text-danger" aria-label="Remover intervalo">
                  ×
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Sheet>
  );
}

export default function BarberAgendaPage() {
  useDocumentMeta({ title: 'Agenda', noindex: true });
  const { user } = useAuth();
  const desktop = useIsDesktop();
  const [view, setView] = useState<'dia' | 'semana'>(desktop ? 'semana' : 'dia');
  const [anchor, setAnchor] = useState(todayKey());
  const [reason, setReason] = useState<string>('Almoço');
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [conflictBusy, setConflictBusy] = useState(false);
  const [openAppt, setOpenAppt] = useState<Appointment | null>(null);
  const [sheet, setSheet] = useState<'template' | 'extra' | 'period' | null>(null);
  const [extra, setExtra] = useState({ start: '10:00', end: '14:00' });
  const [period, setPeriod] = useState({ from: todayKey(), to: addDaysToDateKey(todayKey(), 6) });

  const dates = useMemo(() => {
    if (view === 'dia') return [anchor];
    const ws = weekStart(anchor);
    return Array.from({ length: 7 }, (_, i) => addDaysToDateKey(ws, i));
  }, [view, anchor]);
  const from = dates[0]!;
  const to = dates[dates.length - 1]!;

  const barber = useMyBarber(user?.uid);
  const days = useBarberDays(user?.uid, from, to);
  const appts = useBarberAppointments(user?.uid, from, to);
  const reasonValue = reason === 'Outro' ? null : reason;

  const dayMap = useMemo(() => new Map((days.data ?? []).map((d) => [d.id, stripDay(d)])), [days.data]);
  const active = useMemo(() => (appts.data ?? []).filter((a) => a.status === 'confirmed' || a.status === 'completed' || a.status === 'no_show'), [appts.data]);

  const columns: DayColumn[] | null = useMemo(() => {
    if (!barber.data || !days.data || !appts.data) return null;
    const avails = dates.map((date) =>
      computeDayAvailability(barber.data!, date, dayMap.get(date) ?? null, active.filter((a) => a.date === date).map((a) => ({ start: a.start, end: a.end }))),
    );
    // Same row range for every column of the week.
    const all = avails.flatMap((a) => a.workingRanges.map(rangeToMinutes));
    const startMin = Math.min(8 * 60, ...all.map((r) => r.start));
    const endMin = Math.max(20 * 60, ...all.map((r) => r.end));
    const hh = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    return dates.map((date, i) => ({
      date,
      cells: buildAgendaCells(avails[i]!, hh(startMin), hh(Math.min(endMin, 24 * 60 - 1))).map((c) => ({
        ...c,
        appt: c.state === 'busy' ? active.find((a) => a.date === date && overlaps(rangeToMinutes(a), rangeToMinutes(c))) : undefined,
      })),
    }));
  }, [barber.data, days.data, appts.data, dates, dayMap, active]);

  const confirmedIn = (date: string, ranges: { start: string; end: string }[]) =>
    active.filter((a) => a.status === 'confirmed' && a.date === date && ranges.some((r) => overlaps(rangeToMinutes(a), rangeToMinutes(r))));

  const cancelAll = async (list: Appointment[], why: string) => {
    for (const a of list) await call('barberUpdateAppointmentStatus', { id: a.id, status: 'cancelled_by_barber', reason: why });
  };

  const apply = (date: string, cells: DayColumn['cells'], mode: SelectionMode) => {
    if (!user) return;
    const prev = dayMap.get(date) ?? null;
    if (mode === 'release') {
      const ranges = cellsToRanges(cells.filter((c) => c.state === 'blocked').map((c) => c.start), barber.data!.slotIntervalMin);
      if (!ranges.length) return;
      void saveDays(user.uid, [{ date, prev, next: releaseRanges(prev, ranges) }], ranges.length === 1 && cells.length === 1 ? `${cells[0]!.start} liberado.` : 'Horários liberados.');
      return;
    }
    const step = barber.data!.slotIntervalMin;
    const target = cells.filter((c) => c.state === 'free' || c.state === 'busy');
    const ranges = cellsToRanges(target.map((c) => c.start), step);
    const clash = confirmedIn(date, ranges);
    const doBlock = async (cancel: boolean) => {
      if (cancel) await cancelAll(clash, reasonValue ? `Horário bloqueado (${reasonValue.toLowerCase()})` : 'Horário bloqueado pelo barbeiro');
      const keep = cancel ? ranges : cellsToRanges(target.filter((c) => c.state === 'free').map((c) => c.start), step);
      if (!keep.length) return;
      await saveDays(user.uid, [{ date, prev, next: blockRanges(prev, keep, reasonValue) }], cells.length === 1 ? `${cells[0]!.start} bloqueado.` : 'Horários bloqueados.');
    };
    if (clash.length) setConflict({ appts: clash, run: doBlock });
    else void doBlock(false);
  };

  const quickDay = (kind: 'block' | 'release') => {
    if (!user || view !== 'dia') return;
    const prev = dayMap.get(anchor) ?? null;
    if (kind === 'release') return void saveDays(user.uid, [{ date: anchor, prev, next: releaseWholeDay(prev) }], 'Dia liberado.');
    const clash = active.filter((a) => a.status === 'confirmed' && a.date === anchor);
    const run = async (cancel: boolean) => {
      if (cancel) await cancelAll(clash, reasonValue ? `Dia bloqueado (${reasonValue.toLowerCase()})` : 'Dia bloqueado pelo barbeiro');
      if (!cancel && clash.length) {
        // Keep the appointments: block only around them.
        const day = columns?.[0];
        const free = day?.cells.filter((c) => c.state === 'free') ?? [];
        const ranges = cellsToRanges(free.map((c) => c.start), barber.data!.slotIntervalMin);
        return saveDays(user.uid, [{ date: anchor, prev, next: blockRanges(prev, ranges, reasonValue) }], 'Horários livres do dia bloqueados.');
      }
      await saveDays(user.uid, [{ date: anchor, prev, next: blockWholeDay(prev, reasonValue) }], 'Dia bloqueado.');
    };
    if (clash.length) setConflict({ appts: clash, run });
    else void run(false);
  };

  const copyWeek = async () => {
    if (!user) return;
    const ws = weekStart(anchor);
    const src = Array.from({ length: 7 }, (_, i) => addDaysToDateKey(ws, i));
    const { db, doc, getDoc } = await loadFirestore();
    const changes = await Promise.all(
      src.map(async (d) => {
        const target = addDaysToDateKey(d, 7);
        const prevSnap = await getDoc(doc(db, `barbers/${user.uid}/days/${target}`));
        const prev = prevSnap.exists() ? stripDay(prevSnap.data() as BarberDay) : null;
        const next = dayMap.get(d) ?? { status: 'open' as const, blocks: [], extraOpenings: [] };
        return { date: target, prev, next };
      }),
    );
    await saveDays(user.uid, changes, `Semana copiada para ${compactDate(addDaysToDateKey(ws, 7))}.`);
  };

  const blockPeriod = async () => {
    if (!user || period.from > period.to) return;
    const list: string[] = [];
    for (let d = period.from; d <= period.to && list.length < 62; d = addDaysToDateKey(d, 1)) list.push(d);
    const { db, collection, getDocs, query, where, doc, getDoc } = await loadFirestore();
    const snap = await getDocs(
      query(collection(db, 'appointments'), where('barberId', '==', user.uid), where('date', '>=', period.from), where('date', '<=', period.to)),
    );
    const clash = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Appointment).filter((a) => a.status === 'confirmed');
    const run = async (cancel: boolean) => {
      if (cancel) await cancelAll(clash, reasonValue ? `Barbeiro indisponível (${reasonValue.toLowerCase()})` : 'Barbeiro indisponível');
      const keepDates = new Set(cancel ? [] : clash.map((a) => a.date));
      const changes = await Promise.all(
        list
          .filter((d) => !keepDates.has(d))
          .map(async (d) => {
            const s = await getDoc(doc(db, `barbers/${user.uid}/days/${d}`));
            const prev = s.exists() ? stripDay(s.data() as BarberDay) : null;
            return { date: d, prev, next: blockWholeDay(prev, reasonValue) };
          }),
      );
      await saveDays(user.uid, changes, `${changes.length} ${changes.length === 1 ? 'dia bloqueado' : 'dias bloqueados'}.`);
      setSheet(null);
    };
    if (clash.length) setConflict({ appts: clash, run });
    else await run(false);
  };

  const move = (dir: -1 | 1) => setAnchor((a) => addDaysToDateKey(a, dir * (view === 'dia' ? 1 : 7)));

  if (barber.error || days.error || appts.error) return <ErrorState />;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-label text-[36px] leading-tight text-text-100">Agenda</h1>
          <p className="text-[14px] text-text-400">Toque para bloquear ou liberar. Segure e arraste para vários horários.</p>
        </div>
        <Button size="sm" variant="secondary" icon={<Settings2 className="size-4" strokeWidth={1.5} />} onClick={() => setSheet('template')} disabled={!barber.data}>
          Modelo semanal
        </Button>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Tabs
          ariaLabel="Visualização"
          value={view}
          onValueChange={(v) => setView(v as 'dia' | 'semana')}
          items={[
            { value: 'dia', label: 'Dia' },
            { value: 'semana', label: 'Semana' },
          ]}
          listClassName="w-44"
        />
        <div className="flex items-center gap-1">
          <button onClick={() => move(-1)} className="grid size-11 place-items-center rounded-full hover:bg-white/5" aria-label="Anterior">
            <ChevronLeft className="size-5" strokeWidth={1.5} />
          </button>
          <button onClick={() => setAnchor(todayKey())} className="font-label min-h-11 rounded-full px-3 text-[13px] text-gold-400 hover:bg-gold-500/10">
            Hoje
          </button>
          <button onClick={() => move(1)} className="grid size-11 place-items-center rounded-full hover:bg-white/5" aria-label="Próximo">
            <ChevronRight className="size-5" strokeWidth={1.5} />
          </button>
        </div>
        <p className="text-[15px] text-text-100">{view === 'dia' ? longDate(anchor) : `${compactDate(from)} a ${compactDate(to)}`}</p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="Motivo do bloqueio">
        <span className="font-label mr-1 text-[12px] text-text-400">Motivo</span>
        {REASONS.map((r) => (
          <Chip key={r} selected={reason === r} onClick={() => setReason(r)} className="min-h-9 px-3 text-[13px]">
            {r}
          </Chip>
        ))}
      </div>

      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
        {view === 'dia' && (
          <>
            <Button size="sm" variant="secondary" icon={<Lock className="size-4" strokeWidth={1.5} />} onClick={() => quickDay('block')}>
              Bloquear dia
            </Button>
            <Button size="sm" variant="secondary" icon={<LockOpen className="size-4" strokeWidth={1.5} />} onClick={() => quickDay('release')}>
              Liberar dia
            </Button>
            <Button size="sm" variant="secondary" icon={<Plus className="size-4" strokeWidth={1.5} />} onClick={() => setSheet('extra')}>
              Horário extra
            </Button>
          </>
        )}
        <Button size="sm" variant="secondary" icon={<CalendarOff className="size-4" strokeWidth={1.5} />} onClick={() => setSheet('period')}>
          Bloquear período
        </Button>
        <Button size="sm" variant="secondary" icon={<Copy className="size-4" strokeWidth={1.5} />} onClick={() => void copyWeek()}>
          Copiar semana
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-[12px] text-text-400" aria-hidden="true">
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-[4px] border border-ink-600 bg-white/[0.035]" />Livre</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-[4px] bg-gold-500" />Ocupado</span>
        <span className="flex items-center gap-1.5"><span className="hatch size-3 rounded-[4px] border border-ink-600" />Bloqueado</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-[4px] border border-dashed border-ink-700" />Fora do expediente</span>
      </div>

      <div className="panel mt-4 p-3 sm:p-4">
        {!columns ? <Skeleton className="h-[520px]" /> : <AgendaGrid columns={columns} compact={view === 'semana'} onApply={apply} onOpenAppointment={setOpenAppt} />}
      </div>

      <AppointmentSheet appt={openAppt} onClose={() => setOpenAppt(null)} />

      <Sheet
        open={!!conflict}
        onOpenChange={(o) => !o && setConflict(null)}
        title="Há atendimento neste horário"
        size="sm"
        description={
          conflict
            ? `${conflict.appts.length === 1 ? 'Há 1 atendimento' : `Há ${conflict.appts.length} atendimentos`} neste horário (${conflict.appts
                .slice(0, 3)
                .map((a) => `${a.clientName.split(' ')[0]}, ${a.start}, ${a.services.map((s) => s.name.toLowerCase()).join(' + ')}`)
                .join('; ')}). Manter o atendimento ou cancelar e avisar o cliente?`
            : undefined
        }
        footer={
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              variant="secondary"
              loading={conflictBusy}
              onClick={async () => {
                setConflictBusy(true);
                await conflict?.run(false);
                setConflictBusy(false);
                setConflict(null);
              }}
            >
              Manter o atendimento
            </Button>
            <Button
              variant="danger"
              loading={conflictBusy}
              onClick={async () => {
                setConflictBusy(true);
                try {
                  await conflict?.run(true);
                } catch (e) {
                  toast.error(errorMessage(e));
                }
                setConflictBusy(false);
                setConflict(null);
              }}
            >
              Cancelar e avisar
            </Button>
          </div>
        }
      >
        <p className="text-[14px] text-text-400">Manter bloqueia só os horários livres ao redor. Nada é cancelado sem a sua confirmação.</p>
      </Sheet>

      <Sheet
        open={sheet === 'extra'}
        onOpenChange={(o) => !o && setSheet(null)}
        title="Abrir horário extra"
        description={longDate(anchor)}
        size="sm"
        footer={
          <Button
            block
            disabled={!(isHHmm(extra.start) && isHHmm(extra.end) && extra.start < extra.end)}
            onClick={() => {
              if (!user) return;
              const prev = dayMap.get(anchor) ?? null;
              void saveDays(user.uid, [{ date: anchor, prev, next: addExtraOpening(prev, extra) }], `Horário extra das ${extra.start} às ${extra.end}.`);
              setSheet(null);
            }}
          >
            Abrir horário
          </Button>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Input label="Início" type="time" step={900} value={extra.start} onChange={(e) => setExtra((x) => ({ ...x, start: e.target.value }))} />
          <Input label="Fim" type="time" step={900} value={extra.end} onChange={(e) => setExtra((x) => ({ ...x, end: e.target.value }))} />
        </div>
        <p className="mt-3 text-[13px] text-text-400">
          Útil para atender fora do padrão, como num {WEEKDAY_LABEL[weekdayOf(anchor)] === 'Domingo' ? 'domingo' : 'dia de folga'} das 10:00 às 14:00. Os
          clientes veem o horário na hora.
        </p>
      </Sheet>

      <Sheet
        open={sheet === 'period'}
        onOpenChange={(o) => !o && setSheet(null)}
        title="Bloquear período"
        description="Férias, curso ou folga de vários dias. Usa o motivo escolhido acima."
        size="sm"
        footer={
          <Button block disabled={period.from > period.to} onClick={() => void blockPeriod()}>
            Bloquear de {compactDate(period.from)} a {compactDate(period.to)}
          </Button>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Input label="De" type="date" value={period.from} min={todayKey()} onChange={(e) => setPeriod((p) => ({ ...p, from: e.target.value }))} />
          <Input label="Até" type="date" value={period.to} min={period.from} onChange={(e) => setPeriod((p) => ({ ...p, to: e.target.value }))} />
        </div>
      </Sheet>

      {barber.data && sheet === 'template' && <TemplateEditor barber={barber.data} open onOpenChange={(o) => !o && setSheet(null)} />}
    </div>
  );
}
