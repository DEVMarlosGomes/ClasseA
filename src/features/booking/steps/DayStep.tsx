import { useQuery } from '@tanstack/react-query';
import { CalendarDays } from 'lucide-react';
import { useMemo, useState } from 'react';
import { generateSlots } from '@shared/slots';
import { parseISO } from 'date-fns';
import { DayStrip } from '@/components/ui/DayStrip';
import { ErrorState } from '@/components/ui/EmptyState';
import { Sheet } from '@/components/ui/Sheet';
import { cn } from '@/lib/cn';
import { longDate, monthTitle, nextDays, shopNow, todayKey } from '@/lib/dates';
import { availabilityId, fetchAvailability, resolveAvailability } from '../availability';
import { useBooking } from '../store';
import { useBookingData } from '../useBookingData';

/** Which days in the booking window have at least one start for the chosen duration. */
export function useWindowAvailability() {
  const { eligible, durationMin, settings } = useBookingData();
  const barberId = useBooking((s) => s.barberId);
  const relevant = barberId && barberId !== 'any' ? eligible.filter((b) => b.id === barberId) : eligible;
  const days = useMemo(() => nextDays(settings?.bookingWindowDays ?? 30), [settings?.bookingWindowDays]);
  const query = useQuery({
    queryKey: ['window', relevant.map((b) => b.id).join(','), durationMin, days[0], days.length],
    enabled: relevant.length > 0 && durationMin > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const docs = await fetchAvailability(days);
      const now = shopNow();
      const map = new Map<string, boolean>();
      for (const date of days) {
        map.set(
          date,
          relevant.some(
            (b) =>
              generateSlots(resolveAvailability(b, date, docs.get(availabilityId(b.id, date))), {
                durationMin,
                now,
                minAdvanceMin: settings?.minAdvanceMin ?? 60,
              }).length > 0,
          ),
        );
      }
      return map;
    },
  });
  return { days, ...query };
}

const WEEK = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

function MonthGrid({ days, available, selected, onPick }: { days: string[]; available: Map<string, boolean> | undefined; selected: string | null; onPick: (d: string) => void }) {
  const months = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const d of days) groups.set(d.slice(0, 7), [...(groups.get(d.slice(0, 7)) ?? []), d]);
    return [...groups.entries()];
  }, [days]);
  return (
    <div className="space-y-8">
      {months.map(([month, list]) => {
        const lead = parseISO(list[0]!).getDay();
        return (
          <section key={month} aria-label={monthTitle(list[0]!)}>
            <h3 className="font-label mb-3 text-[16px] text-text-100">{monthTitle(list[0]!)}</h3>
            <div className="grid grid-cols-7 gap-1.5 text-center">
              {WEEK.map((w) => (
                <span key={w} className="font-label pb-1 text-[11px] text-text-400">
                  {w}
                </span>
              ))}
              {Array.from({ length: lead }, (_, i) => (
                <span key={`e${i}`} />
              ))}
              {list.map((d) => {
                const ok = available?.get(d);
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={ok === false}
                    onClick={() => onPick(d)}
                    aria-label={longDate(d)}
                    aria-pressed={selected === d}
                    className={cn(
                      'tabular aspect-square rounded-[12px] text-[15px] font-bold transition-colors',
                      selected === d ? 'gold-metal text-ink-950' : 'bg-ink-800 text-text-100 hover:bg-ink-700',
                      ok === false && 'bg-transparent text-text-400/40 line-through',
                    )}
                  >
                    {Number(d.slice(8))}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function DayStep({ onPicked }: { onPicked: () => void }) {
  const { date, setDate } = useBooking();
  const { days, data, isError, refetch } = useWindowAvailability();
  const [monthOpen, setMonthOpen] = useState(false);
  const today = todayKey();
  const options = days.map((d) => ({ date: d, available: data ? (data.get(d) ?? false) : null }));
  const noneAvailable = data && ![...data.values()].some(Boolean);

  const pick = (d: string) => {
    setDate(d);
    setMonthOpen(false);
    onPicked();
  };

  if (isError) return <ErrorState onRetry={() => void refetch()} />;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-[16px] text-text-400">Dias apagados estão sem horário livre.</p>
        <button
          type="button"
          onClick={() => setMonthOpen(true)}
          className="font-label inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-ink-600 px-4 text-[14px] text-text-100 hover:border-gold-600"
        >
          <CalendarDays className="size-4 text-gold-500" strokeWidth={1.5} aria-hidden="true" />
          Ver mês
        </button>
      </div>
      <DayStrip days={options} selected={date} today={today} onSelect={pick} />
      {date && <p className="mt-5 text-[16px] text-text-100">{longDate(date)}</p>}
      {noneAvailable && (
        <p className="mt-6 rounded-[14px] border border-ink-600 bg-ink-800 p-4 text-[14px] text-text-400">
          Não há horários livres nos próximos {days.length} dias para essa escolha. Tente outro barbeiro ou fale com a barbearia.
        </p>
      )}
      <Sheet open={monthOpen} onOpenChange={setMonthOpen} title="Escolha o dia" size="sm">
        <MonthGrid days={days} available={data} selected={date} onPick={pick} />
      </Sheet>
    </div>
  );
}
