import { CalendarClock, CalendarPlus, Navigation, X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { Appointment, AppointmentStatus, ShopSettings } from '@shared/types';
import { formatBRL } from '@shared/money';
import { WhatsAppIcon } from '@/components/icons';
import { Badge } from '@/components/ui/Badge';
import { Button, buttonClass } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { Sheet } from '@/components/ui/Sheet';
import { toast } from '@/components/ui/Toast';
import { useLiveQuery } from '@/hooks/useFirestore';
import { call, errorMessage } from '@/lib/api';
import { downloadIcs } from '@/lib/calendar';
import { longDate, waLink } from '@/lib/dates';
import { formatAddress, mapsUrl } from '@/features/landing/shopInfo';
import { useBooking } from '@/features/booking/store';

export function useMyAppointments(uid: string | undefined) {
  return useLiveQuery<Appointment>(uid ? `appts:${uid}` : null, ({ db, collection, query, where, orderBy, limit }) =>
    query(collection(db, 'appointments'), where('clientId', '==', uid), orderBy('startAt', 'desc'), limit(60)),
  );
}

export function splitAppointments(list: Appointment[] | undefined) {
  const now = Date.now();
  const upcoming = (list ?? [])
    .filter((a) => a.status === 'confirmed' && a.startAt.toMillis() + a.durationMin * 60_000 > now)
    .sort((a, b) => a.startAt.toMillis() - b.startAt.toMillis());
  const history = (list ?? []).filter((a) => !upcoming.includes(a));
  return { upcoming, history };
}

export const STATUS_BADGE: Record<AppointmentStatus, { tone: 'gold' | 'success' | 'danger' | 'neutral'; label: string }> = {
  confirmed: { tone: 'gold', label: 'Confirmado' },
  completed: { tone: 'success', label: 'Concluído' },
  no_show: { tone: 'danger', label: 'Não compareceu' },
  cancelled_by_client: { tone: 'neutral', label: 'Cancelado' },
  cancelled_by_barber: { tone: 'danger', label: 'Cancelado pela barbearia' },
};

export function canChange(a: Appointment, settings: ShopSettings | undefined): boolean {
  return a.status === 'confirmed' && a.startAt.toMillis() - Date.now() >= (settings?.cancellationPolicyHours ?? 2) * 3_600_000;
}

/** Starts the booking flow from the "Dia" step, keeping services and barber of the original booking. */
export function useReschedule() {
  const navigate = useNavigate();
  const hydrate = useBooking((s) => s.hydrate);
  const reset = useBooking((s) => s.reset);
  return (a: Appointment) => {
    reset();
    hydrate({ serviceIds: a.services.map((s) => s.id), barberId: a.barberId, date: null, step: 2, rescheduleId: a.id });
    navigate('/agendar');
  };
}

export function useRepeat() {
  const navigate = useNavigate();
  const hydrate = useBooking((s) => s.hydrate);
  const reset = useBooking((s) => s.reset);
  return (a: Appointment) => {
    reset();
    hydrate({ serviceIds: a.services.map((s) => s.id), barberId: a.barberId, date: null, step: 2 });
    navigate('/agendar');
  };
}

export function AppointmentActions({ appt, settings }: { appt: Appointment; settings: ShopSettings | undefined }) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const reschedule = useReschedule();
  const changeable = canChange(appt, settings);
  const names = appt.services.map((s) => s.name).join(' + ');

  return (
    <>
      <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {changeable ? (
          <>
            <Button size="sm" variant="secondary" icon={<CalendarClock className="size-4" strokeWidth={1.75} />} onClick={() => reschedule(appt)}>
              Reagendar
            </Button>
            <Button size="sm" variant="danger" icon={<X className="size-4" strokeWidth={1.75} />} onClick={() => setCancelOpen(true)}>
              Cancelar
            </Button>
          </>
        ) : (
          settings && (
            <a
              href={waLink(settings.whatsapp, `Olá! Preciso falar sobre meu horário de ${longDate(appt.date)} às ${appt.start}.`)}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClass('secondary', 'sm', 'col-span-2')}
            >
              <WhatsAppIcon className="size-4" />
              Falar com a barbearia
            </a>
          )
        )}
        {settings && (
          <a href={mapsUrl(settings)} target="_blank" rel="noopener noreferrer" className={buttonClass('ghost', 'sm')}>
            <Navigation className="size-4" strokeWidth={1.5} />
            Como chegar
          </a>
        )}
        <Button
          size="sm"
          variant="ghost"
          icon={<CalendarPlus className="size-4" strokeWidth={1.75} />}
          onClick={() =>
            downloadIcs({
              title: `${names} · Classe A Barbearia`,
              description: `Atendimento com ${appt.barberName}.`,
              location: settings ? formatAddress(settings) || settings.name : 'Classe A Barbearia',
              date: appt.date,
              start: appt.start,
              end: appt.end,
              uid: appt.id,
            })
          }
        >
          Adicionar à agenda
        </Button>
      </div>
      {!changeable && appt.status === 'confirmed' && (
        <p className="mt-3 text-[13px] text-text-400">
          Cancelamentos e remarcações pelo app vão até {settings?.cancellationPolicyHours ?? 2} h antes do horário.
        </p>
      )}

      <Sheet
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancelar atendimento?"
        description={`${names} com ${appt.barberName}, ${longDate(appt.date)} às ${appt.start}.`}
        size="sm"
        footer={
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="secondary" onClick={() => setCancelOpen(false)}>
              Manter horário
            </Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await call('cancelAppointment', { id: appt.id, reason: reason || undefined });
                  toast.success('Atendimento cancelado.', {
                    description: appt.paymentMode === 'plan' ? 'O corte voltou para o seu plano.' : undefined,
                  });
                  setCancelOpen(false);
                } catch (e) {
                  toast.error(errorMessage(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Cancelar atendimento
            </Button>
          </div>
        }
      >
        <Textarea label="Motivo (opcional)" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />
        {appt.paymentMode === 'card_mock' || appt.paymentMode === 'pix_mock' ? (
          <p className="mt-3 text-[14px] text-text-400">O valor pago online é estornado (simulação).</p>
        ) : null}
      </Sheet>
    </>
  );
}

export function AppointmentSummary({ appt }: { appt: Appointment }) {
  const status = STATUS_BADGE[appt.status];
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[16px] font-bold text-text-100">{longDate(appt.date)}</p>
          <p className="tabular text-[14px] text-text-400">
            {appt.start} – {appt.end} · com {appt.barberName}
          </p>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      <p className="mt-2 text-[15px] text-text-100">{appt.services.map((s) => s.name).join(' + ')}</p>
      <p className="tabular mt-1 text-[14px] text-text-400">
        {appt.paymentMode === 'plan' ? 'Plano' : formatBRL(appt.totalCents)}
        {appt.cancelReason ? ` · ${appt.cancelReason}` : ''}
      </p>
    </div>
  );
}
