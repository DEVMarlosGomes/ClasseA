import { Clock } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router';
import { cn } from '@/lib/cn';
import { useBarbers, useServices, useShopSettings } from '@/lib/catalog';
import { relativeDayLabel, todayKey } from '@/lib/dates';
import { useNextFreeSlot } from '@/features/booking/availability';

/** Live chip with the real next free slot, read from availabilityPublic. */
export function NextSlotChip({ className }: { className?: string }) {
  const barbers = useBarbers();
  const services = useServices();
  const settings = useShopSettings();
  const corte = useMemo(() => {
    const list = services.data ?? [];
    return list.find((s) => s.category === 'cabelo') ?? list[0];
  }, [services.data]);
  const { slot, loading } = useNextFreeSlot(
    barbers.data,
    corte?.durationMin ?? 30,
    settings.data?.minAdvanceMin ?? 60,
    !!corte,
  );

  const failed = barbers.isError || services.isError;
  if (failed || (!loading && !slot && !barbers.isLoading)) {
    return null;
  }

  const day = slot ? relativeDayLabel(slot.date, todayKey()) : '';
  const dayText = day === 'Hoje' || day === 'Amanhã' ? day.toLowerCase() : day;
  const href = slot
    ? `/agendar?barbeiro=${slot.barber.id}&data=${slot.date}${corte ? `&servico=${corte.id}` : ''}`
    : '/agendar';

  return (
    <Link
      to={href}
      aria-live="polite"
      className={cn(
        'glass inline-flex min-h-11 items-center gap-3 !rounded-full px-4 py-2 text-[14px] text-text-100 transition-colors hover:border-[var(--gold-hairline-strong)]',
        className,
      )}
    >
      <span className="relative flex size-2.5" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
        <span className="relative inline-flex size-2.5 rounded-full bg-success" />
      </span>
      {loading || !slot ? (
        <span className="flex items-center gap-2 text-text-400">
          <Clock className="size-4" strokeWidth={1.5} aria-hidden="true" />
          Buscando o próximo horário livre…
        </span>
      ) : (
        <span>
          Próximo horário livre:{' '}
          <strong className="tabular font-bold text-gold-400">
            {dayText}, {slot.start}
          </strong>{' '}
          com {slot.barber.displayName}
        </span>
      )}
    </Link>
  );
}
