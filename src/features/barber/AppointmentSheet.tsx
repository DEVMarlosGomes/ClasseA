import { Check, UserX, X } from 'lucide-react';
import { useState } from 'react';
import type { Appointment } from '@shared/types';
import { formatBRL } from '@shared/money';
import { WhatsAppIcon } from '@/components/icons';
import { Badge } from '@/components/ui/Badge';
import { Button, buttonClass } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Textarea } from '@/components/ui/Input';
import { Sheet } from '@/components/ui/Sheet';
import { toast } from '@/components/ui/Toast';
import { call, errorMessage } from '@/lib/api';
import { formatPhone, longDate, waLink } from '@/lib/dates';
import { STATUS_BADGE } from '@/features/client/appointments';

export const PAYMENT_SHORT = { plan: 'Plano', pay_at_shop: 'Na barbearia', card_mock: 'Cartão (pago)', pix_mock: 'PIX (pago)' } as const;
const CANCEL_REASONS = ['Imprevisto pessoal', 'Problema de saúde', 'Barbearia fechada', 'Outro'];

export function AppointmentSheet({ appt, onClose }: { appt: Appointment | null; onClose: () => void }) {
  const [mode, setMode] = useState<'view' | 'cancel'>('view');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  if (!appt) return null;
  const startsIn = appt.startAt.toMillis() - Date.now();
  const canMark = startsIn <= 30 * 60_000 && ['confirmed', 'completed', 'no_show'].includes(appt.status);
  const status = STATUS_BADGE[appt.status];

  const update = async (status: 'completed' | 'no_show' | 'cancelled_by_barber') => {
    setBusy(status);
    try {
      await call('barberUpdateAppointmentStatus', { id: appt.id, status, reason: status === 'cancelled_by_barber' ? reason : undefined });
      toast.success(status === 'completed' ? 'Atendimento concluído.' : status === 'no_show' ? 'Falta registrada.' : 'Atendimento cancelado. O cliente foi avisado.');
      setMode('view');
      setReason('');
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet
      open={!!appt}
      onOpenChange={(o) => {
        if (!o) {
          setMode('view');
          onClose();
        }
      }}
      title={appt.clientName}
      description={`${longDate(appt.date)} · ${appt.start} às ${appt.end}`}
      size="sm"
      footer={
        mode === 'cancel' ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="secondary" onClick={() => setMode('view')}>
              Voltar
            </Button>
            <Button variant="danger" disabled={reason.trim().length < 3} loading={busy === 'cancelled_by_barber'} onClick={() => void update('cancelled_by_barber')}>
              Cancelar e avisar
            </Button>
          </div>
        ) : appt.status === 'confirmed' || canMark ? (
          <div className="grid grid-cols-2 gap-2">
            <Button disabled={!canMark} loading={busy === 'completed'} icon={<Check className="size-4" />} onClick={() => void update('completed')}>
              Concluir
            </Button>
            <Button variant="secondary" disabled={!canMark} loading={busy === 'no_show'} icon={<UserX className="size-4" strokeWidth={1.75} />} onClick={() => void update('no_show')}>
              Não veio
            </Button>
            {appt.status === 'confirmed' && (
              <Button variant="danger" className="col-span-2" icon={<X className="size-4" />} onClick={() => setMode('cancel')}>
                Cancelar atendimento
              </Button>
            )}
          </div>
        ) : undefined
      }
    >
      {mode === 'view' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge tone={status.tone}>{status.label}</Badge>
            {appt.paymentMode === 'plan' && <Badge tone="gold">Plano</Badge>}
            {appt.firstVisit && <Badge tone="solid">1ª visita</Badge>}
          </div>
          <dl className="space-y-3 text-[15px]">
            <div>
              <dt className="font-label text-[12px] text-text-400">Serviços</dt>
              <dd className="text-text-100">{appt.services.map((s) => s.name).join(' + ')} · {appt.durationMin} min</dd>
            </div>
            <div>
              <dt className="font-label text-[12px] text-text-400">Pagamento</dt>
              <dd className="tabular text-text-100">
                {PAYMENT_SHORT[appt.paymentMode]}
                {appt.dueAtShopCents > 0 && ` · receber ${formatBRL(appt.dueAtShopCents)}`}
              </dd>
            </div>
            {appt.notes && (
              <div>
                <dt className="font-label text-[12px] text-text-400">Observação do cliente</dt>
                <dd className="text-text-100">“{appt.notes}”</dd>
              </div>
            )}
          </dl>
          {appt.clientPhone && (
            <a href={waLink(appt.clientPhone, `Olá, ${appt.clientName.split(' ')[0]}! Aqui é da Classe A Barbearia.`)} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary', 'md', 'w-full')}>
              <WhatsAppIcon className="size-5" />
              WhatsApp {formatPhone(appt.clientPhone)}
            </a>
          )}
          {!canMark && appt.status === 'confirmed' && (
            <p className="text-[13px] text-text-400">Concluir e marcar falta ficam disponíveis a partir de 30 min antes do horário.</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-[14px] text-text-400">O cliente recebe o aviso na hora. Valores pagos online e cortes do plano são devolvidos.</p>
          <div className="flex flex-wrap gap-2">
            {CANCEL_REASONS.map((r) => (
              <Chip key={r} selected={reason === r} onClick={() => setReason(r === 'Outro' ? '' : r)}>
                {r}
              </Chip>
            ))}
          </div>
          <Textarea label="Motivo (obrigatório)" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />
        </div>
      )}
    </Sheet>
  );
}
