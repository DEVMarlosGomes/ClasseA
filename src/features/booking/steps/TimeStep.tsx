import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { type DayPeriod, generateSlots, periodOf } from '@shared/slots';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { SlotPill } from '@/components/ui/SlotPill';
import { EASE } from '@/lib/motion';
import { relativeDayLabel, shopNow } from '@/lib/dates';
import { useLiveDayAvailability } from '../availability';
import { useBooking } from '../store';
import { useBookingData } from '../useBookingData';
import { useWindowAvailability } from './DayStep';

const PERIODS: { key: DayPeriod; label: string }[] = [
  { key: 'manha', label: 'Manhã' },
  { key: 'tarde', label: 'Tarde' },
  { key: 'noite', label: 'Noite' },
];

/** Live slot grid. Listens to availabilityPublic, so a slot booked or blocked elsewhere slides out. */
export function TimeStep({ onPicked }: { onPicked: () => void }) {
  const { eligible, durationMin, settings } = useBookingData();
  const { barberId, date, start, setStart, setDate, slotTakenNotice, dismissSlotNotice } = useBooking();
  const relevant = useMemo(
    () => (barberId && barberId !== 'any' ? eligible.filter((b) => b.id === barberId) : eligible),
    [barberId, eligible],
  );
  const live = useLiveDayAvailability(relevant, date);
  const [lostNotice, setLostNotice] = useState(false);
  const windowAvail = useWindowAvailability();

  const slots = useMemo(() => {
    if (!live) return null;
    const now = shopNow();
    const set = new Set<string>();
    for (const avail of live.values()) {
      for (const s of generateSlots(avail, { durationMin, now, minAdvanceMin: settings?.minAdvanceMin ?? 60 })) set.add(s);
    }
    return [...set].sort();
  }, [live, durationMin, settings?.minAdvanceMin]);

  // If the chosen slot disappears while the client is looking, drop it and say why.
  const prev = useRef<string[] | null>(null);
  useEffect(() => {
    if (slots && start && prev.current?.includes(start) && !slots.includes(start)) {
      setStart(null);
      setLostNotice(true);
    }
    prev.current = slots;
  }, [slots, start, setStart]);

  const nextWithSlots = useMemo(() => {
    if (!windowAvail.data || !date) return null;
    return windowAvail.days.find((d) => d > date && windowAvail.data!.get(d)) ?? null;
  }, [windowAvail.data, windowAvail.days, date]);

  const notice = lostNotice || slotTakenNotice;

  if (!date) return null;

  return (
    <div>
      <AnimatePresence>
        {notice && (
          <motion.div
            role="alert"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-5 flex items-start gap-3 rounded-[14px] border border-gold-600/60 bg-gold-500/10 p-4 text-[14px] text-text-100"
          >
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-gold-400" strokeWidth={1.5} aria-hidden="true" />
            <p className="flex-1">Esse horário acabou de ser reservado. Escolha outro.</p>
            <button
              onClick={() => {
                setLostNotice(false);
                dismissSlotNotice();
              }}
              className="font-label min-h-8 text-[12px] text-gold-400 underline"
            >
              Ok
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="mb-5 text-[16px] text-text-400">
        <span className="text-text-100">{relativeDayLabel(date)}</span> · horários para {durationMin} min de atendimento
      </p>

      <p className="sr-only" aria-live="polite">
        {slots ? `${slots.length} horários disponíveis` : 'Carregando horários'}
      </p>

      {!slots ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {Array.from({ length: 12 }, (_, i) => (
            <Skeleton key={i} className="h-12 rounded-[14px]" />
          ))}
        </div>
      ) : slots.length === 0 ? (
        <EmptyState
          title="Sem horários neste dia"
          description="Os horários deste dia acabaram ou o barbeiro não atende."
          action={
            nextWithSlots ? (
              <button
                onClick={() => setDate(nextWithSlots)}
                className="font-label inline-flex min-h-11 items-center gap-2 rounded-full border border-gold-600 px-5 text-[14px] text-gold-400 hover:bg-gold-500/10"
              >
                Ver {relativeDayLabel(nextWithSlots).toLowerCase()}
                <ArrowRight className="size-4" strokeWidth={1.75} />
              </button>
            ) : undefined
          }
        />
      ) : (
        <LayoutGroup id="slots">
          <div className="space-y-6">
            {PERIODS.map(({ key, label }) => {
              const list = slots.filter((s) => periodOf(s) === key);
              if (!list.length) return null;
              return (
                <section key={key} aria-labelledby={`p-${key}`}>
                  <h3 id={`p-${key}`} className="font-label mb-2.5 text-[13px] text-gold-500">
                    {label}
                  </h3>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-5">
                    <AnimatePresence initial={false}>
                      {list.map((t) => (
                        <motion.div
                          key={t}
                          layout
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.25 } }}
                          transition={{ duration: 0.25, ease: EASE }}
                        >
                          <SlotPill
                            time={t}
                            state={t === start ? 'selected' : 'free'}
                            onSelect={() => {
                              setStart(t);
                              setLostNotice(false);
                              dismissSlotNotice();
                              onPicked();
                            }}
                          />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </section>
              );
            })}
          </div>
        </LayoutGroup>
      )}
    </div>
  );
}
