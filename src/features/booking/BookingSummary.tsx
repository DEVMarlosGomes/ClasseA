import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, Clock, Scissors, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatBRL } from '@shared/money';
import { compactDate, durationLabel, relativeDayLabel } from '@/lib/dates';
import { useBooking } from './store';
import { useBookingData } from './useBookingData';

/** Sticky summary: glass bar at the bottom on mobile, side panel on desktop. Holds the advance button. */
export function BookingSummary({ action, variant }: { action: ReactNode; variant: 'bar' | 'panel' }) {
  const { selected, durationMin, totalCents, barber } = useBookingData();
  const { barberId, date, start } = useBooking();
  const count = selected.length;

  if (variant === 'bar') {
    return (
      <div className="glass pb-safe fixed inset-x-0 bottom-0 z-40 !rounded-none !rounded-t-[22px] !border-x-0 !border-b-0 px-4 pt-3 lg:hidden">
        <div className="mb-3 flex items-end justify-between gap-3" aria-live="polite">
          <div className="min-w-0">
            <p className="truncate text-[14px] text-text-100">
              {count ? selected.map((s) => s.name).join(' + ') : 'Nenhum serviço escolhido'}
            </p>
            <p className="tabular text-[12px] text-text-400">
              {count ? durationLabel(durationMin) : 'Escolha ao menos um'}
              {date && ` · ${relativeDayLabel(date)}`}
              {start && ` às ${start}`}
            </p>
          </div>
          <AnimatePresence mode="popLayout">
            <motion.p
              key={totalCents}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="tabular shrink-0 text-[20px] font-bold text-gold-500"
            >
              {formatBRL(totalCents)}
            </motion.p>
          </AnimatePresence>
        </div>
        {action}
      </div>
    );
  }

  const Row = ({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) => (
    <div className="flex gap-3 py-3">
      <span className="mt-0.5 text-gold-500">{icon}</span>
      <div className="min-w-0">
        <p className="font-label text-[12px] text-text-400">{label}</p>
        <div className="text-[15px] text-text-100">{value}</div>
      </div>
    </div>
  );

  return (
    <aside aria-label="Resumo do agendamento" className="glass sticky top-24 hidden p-6 lg:block">
      <h2 className="font-label text-[18px] text-text-100">Resumo</h2>
      <div className="mt-2 divide-y divide-white/5" aria-live="polite">
        <Row
          icon={<Scissors className="size-4" strokeWidth={1.5} />}
          label="Serviços"
          value={
            count ? (
              <ul className="space-y-1">
                {selected.map((s) => (
                  <li key={s.id} className="flex justify-between gap-4">
                    <span>{s.name}</span>
                    <span className="tabular text-text-400">{formatBRL(s.priceCents)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-text-400">Escolha ao menos um</span>
            )
          }
        />
        <Row icon={<Clock className="size-4" strokeWidth={1.5} />} label="Duração" value={count ? durationLabel(durationMin) : '—'} />
        <Row
          icon={<UserRound className="size-4" strokeWidth={1.5} />}
          label="Barbeiro"
          value={barberId === 'any' ? 'Sem preferência' : (barber?.displayName ?? '—')}
        />
        <Row
          icon={<CalendarDays className="size-4" strokeWidth={1.5} />}
          label="Quando"
          value={date ? `${relativeDayLabel(date)}, ${compactDate(date)}${start ? ` às ${start}` : ''}` : '—'}
        />
      </div>
      <div className="stitch my-4" role="presentation" />
      <div className="flex items-baseline justify-between">
        <span className="font-label text-[14px] text-text-400">Total</span>
        <span className="tabular text-[28px] font-bold text-gold-500">{formatBRL(totalCents)}</span>
      </div>
      <div className="mt-5">{action}</div>
    </aside>
  );
}
