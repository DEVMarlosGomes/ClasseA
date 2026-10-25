import { CalendarPlus, ListChecks, Navigation } from 'lucide-react';
import { WhatsAppIcon } from '@/components/icons';
import { Button, ButtonLink, buttonClass } from '@/components/ui/Button';
import { SuccessCheck } from '@/components/ui/SuccessCheck';
import { downloadIcs, googleCalendarUrl } from '@/lib/calendar';
import { longDate } from '@/lib/dates';
import { formatAddress, mapsUrl } from '@/features/landing/shopInfo';
import { useBooking } from '../store';
import { useBookingData } from '../useBookingData';

export function SuccessStep() {
  const { result, reset, serviceIds } = useBooking();
  const { settings, services } = useBookingData();
  if (!result || !settings) return null;
  const names = serviceIds.map((id) => services.data?.find((s) => s.id === id)?.name).filter(Boolean).join(' + ');
  const location = formatAddress(settings) || settings.name;
  const event = {
    title: `${names} · Classe A Barbearia`,
    description: `Atendimento com ${result.barberName}. Para cancelar ou remarcar, use o app até ${settings.cancellationPolicyHours} h antes.`,
    location,
    date: result.date,
    start: result.start,
    end: result.end,
    uid: result.id,
  };
  const share = `Agendei na Classe A Barbearia: ${names} com ${result.barberName}, ${longDate(result.date)} às ${result.start}.`;

  return (
    <div className="flex flex-col items-center text-center">
      <SuccessCheck />
      <h2 className="font-label mt-6 text-[28px] text-text-100">Agendamento confirmado</h2>
      <p className="mt-3 max-w-[38ch] text-[16px] text-text-100/85">
        {names} com <strong className="text-gold-400">{result.barberName}</strong>
        <br />
        <span>{longDate(result.date)}</span>, das{' '}
        <span className="tabular">
          {result.start} às {result.end}
        </span>
      </p>
      <p className="mt-2 text-[14px] text-text-400">Enviamos a confirmação e um lembrete chega antes do horário.</p>

      <div className="mt-8 grid w-full max-w-md gap-2">
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" icon={<CalendarPlus className="size-4" strokeWidth={1.75} />} onClick={() => downloadIcs(event)}>
            Agenda (.ics)
          </Button>
          <a href={googleCalendarUrl(event)} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary', 'md')}>
            Google Agenda
          </a>
        </div>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(share)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass('secondary', 'md')}
        >
          <WhatsAppIcon className="size-5" />
          Enviar para meu WhatsApp
        </a>
        <ButtonLink to="/cliente/agendamentos" onClick={() => reset()} icon={<ListChecks className="size-4" strokeWidth={1.75} />}>
          Ver meus agendamentos
        </ButtonLink>
        <a href={mapsUrl(settings)} target="_blank" rel="noopener noreferrer" className={buttonClass('ghost', 'md')}>
          <Navigation className="size-4" strokeWidth={1.5} />
          Como chegar
        </a>
      </div>
    </div>
  );
}
