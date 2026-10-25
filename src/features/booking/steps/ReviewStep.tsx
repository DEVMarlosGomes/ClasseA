import { CalendarDays, Clock, CreditCard, Scissors } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatBRL } from '@shared/money';
import { endTime } from '@shared/slots';
import { Avatar } from '@/components/ui/Avatar';
import { Textarea } from '@/components/ui/Input';
import { durationLabel, longDate } from '@/lib/dates';
import { useBooking } from '../store';
import { useBookingData } from '../useBookingData';

const PAYMENT_LABEL = {
  plan: 'Plano de assinatura',
  pay_at_shop: 'Pagar na barbearia',
  card_mock: 'Cartão (simulado)',
  pix_mock: 'PIX (simulado, aprovado)',
} as const;

function Line({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-4 py-4">
      <span className="mt-0.5 text-gold-500">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="font-label text-[12px] text-text-400">{label}</p>
        <div className="mt-0.5 text-[16px] text-text-100">{children}</div>
      </div>
    </div>
  );
}

export function ReviewStep() {
  const { selected, durationMin, totalCents, barber, settings, dueWithPlanCents } = useBookingData();
  const { barberId, date, start, paymentMode, notes, setNotes } = useBooking();
  if (!date || !start || !paymentMode) return null;
  const end = endTime(start, durationMin);
  const due = paymentMode === 'plan' ? dueWithPlanCents : paymentMode === 'pay_at_shop' ? totalCents : 0;

  return (
    <div>
      <div className="panel divide-y divide-white/5 px-5">
        <div className="flex items-center gap-4 py-4">
          {barber ? <Avatar name={barber.displayName} src={barber.photoUrl} size={56} /> : null}
          <div>
            <p className="font-label text-[12px] text-text-400">Barbeiro</p>
            <p className="text-[18px] font-bold text-text-100">
              {barberId === 'any' ? 'Sem preferência (o primeiro livre neste horário)' : barber?.displayName}
            </p>
          </div>
        </div>
        <Line icon={<Scissors className="size-5" strokeWidth={1.5} />} label="Serviços">
          <ul className="space-y-1">
            {selected.map((s) => (
              <li key={s.id} className="flex justify-between gap-4">
                <span>{s.name}</span>
                <span className="tabular text-text-400">{formatBRL(s.priceCents)}</span>
              </li>
            ))}
          </ul>
        </Line>
        <Line icon={<CalendarDays className="size-5" strokeWidth={1.5} />} label="Data">
          <span>{longDate(date)}</span>
        </Line>
        <Line icon={<Clock className="size-5" strokeWidth={1.5} />} label="Horário">
          <span className="tabular">
            {start} às {end}
          </span>{' '}
          <span className="text-text-400">· {durationLabel(durationMin)}</span>
        </Line>
        <Line icon={<CreditCard className="size-5" strokeWidth={1.5} />} label="Pagamento">
          {PAYMENT_LABEL[paymentMode]}
          {due > 0 && <span className="tabular block text-[14px] text-text-400">{formatBRL(due)} a pagar na barbearia</span>}
        </Line>
        <div className="flex items-baseline justify-between py-4">
          <span className="font-label text-[14px] text-text-400">Total</span>
          <span className="tabular text-[24px] font-bold text-gold-500">{formatBRL(totalCents)}</span>
        </div>
      </div>

      <div className="mt-6">
        <Textarea
          label="Observação para o barbeiro (opcional)"
          value={notes}
          maxLength={200}
          onChange={(e) => setNotes(e.target.value)}
          hint={`${notes.length}/200 · ex.: "máquina 2 nas laterais"`}
        />
      </div>

      <p className="mt-5 text-[14px] leading-relaxed text-text-400">
        Você pode cancelar ou remarcar pelo app até {settings?.cancellationPolicyHours ?? 2} h antes. Tolerância de atraso de{' '}
        {settings?.lateToleranceMin ?? 10} min. Depois disso, fale com a barbearia pelo WhatsApp.
      </p>
    </div>
  );
}
