import { useState } from 'react';
import { METHOD_LABEL, PLATFORM_LABEL, onlinePaidCents, planCoveredCents } from '@shared/finance';
import { formatBRL } from '@shared/money';
import type { Appointment, FeePlatform, ShopMethod } from '@shared/types';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Input, Textarea } from '@/components/ui/Input';
import { toast } from '@/components/ui/Toast';
import { call, errorMessage } from '@/lib/api';
import { formatInstant } from '@/lib/dates';

const METHODS: ShopMethod[] = ['cash', 'pix', 'credit', 'debit'];
const PLATFORMS: (FeePlatform | 'none')[] = ['infinitepay', 'mercadopago', 'none'];

const toCents = (v: string) => Math.round(Number(v.replace(/\./g, '').replace(',', '.')) * 100);
const toInput = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');

/** "Dar baixa": visit done and paid. Prefills what is due at the counter; plan and online parts are shown, not edited. */
export function SettleForm({ appt, onDone, onBack }: { appt: Appointment; onDone: () => void; onBack: () => void }) {
  const due = appt.dueAtShopCents;
  const [method, setMethod] = useState<ShopMethod | null>(null);
  const [platform, setPlatform] = useState<FeePlatform | 'none'>('infinitepay');
  const [amount, setAmount] = useState(toInput(due));
  const [busy, setBusy] = useState(false);
  const received = toCents(amount);
  const valid = due === 0 || (!!method && Number.isFinite(received) && received >= 0);
  const covered = planCoveredCents(appt);
  const online = onlinePaidCents(appt);

  const submit = async () => {
    setBusy(true);
    try {
      await call('settleAppointment', {
        id: appt.id,
        method: due > 0 ? method : null,
        platform: method === 'cash' ? 'none' : platform,
        receivedCents: due > 0 ? received : 0,
      });
      toast.success('Baixa registrada. Atendimento concluído e pago.');
      onDone();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <dl className="panel divide-y divide-white/5 px-4 text-[14px]">
        {covered > 0 && <Row label="Coberto pelo plano" value={formatBRL(covered)} />}
        {online > 0 && <Row label="Pago no app" value={formatBRL(online)} />}
        <Row label="A receber na barbearia" value={formatBRL(due)} strong />
      </dl>

      {due > 0 ? (
        <>
          <fieldset>
            <legend className="font-label mb-2 text-[12px] text-text-400">Como o cliente pagou</legend>
            <div className="flex flex-wrap gap-2">
              {METHODS.map((m) => (
                <Chip key={m} selected={method === m} onClick={() => setMethod(m)}>
                  {METHOD_LABEL[m]}
                </Chip>
              ))}
            </div>
          </fieldset>
          {method && method !== 'cash' && (
            <fieldset>
              <legend className="font-label mb-2 text-[12px] text-text-400">Maquininha / conta que recebeu</legend>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map((p) => (
                  <Chip key={p} selected={platform === p} onClick={() => setPlatform(p)}>
                    {p === 'none' ? 'Outra (sem taxa)' : PLATFORM_LABEL[p]}
                  </Chip>
                ))}
              </div>
            </fieldset>
          )}
          <Input
            label="Valor recebido (R$)"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
            hint={received !== due && Number.isFinite(received) ? `Diferente da tabela (${formatBRL(due)}). Confira antes de confirmar.` : undefined}
          />
        </>
      ) : (
        <p className="text-[14px] text-text-400">Nada a receber na barbearia. A baixa só confirma que o atendimento aconteceu.</p>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="secondary" onClick={onBack}>
          Voltar
        </Button>
        <Button disabled={!valid} loading={busy} onClick={() => void submit()}>
          Confirmar baixa
        </Button>
      </div>
      <p className="text-[12px] text-text-400">Fica registrado quem deu a baixa e quando.</p>
    </div>
  );
}

const CLOSE_REASONS = ['Cliente não compareceu', 'Cliente desistiu na hora', 'Chegou muito atrasado', 'Outro'];

/** Closes a visit as not completed. The reason is mandatory; date, time and who closed it are recorded. */
export function CloseForm({ appt, onDone, onBack }: { appt: Appointment; onDone: () => void; onBack: () => void }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await call('barberUpdateAppointmentStatus', { id: appt.id, status: 'no_show', reason: reason.trim() });
      toast.success('Atendimento encerrado como não concluído.');
      onDone();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <p className="text-[14px] text-text-400">Não gera comissão. O motivo, a data e o horário ficam registrados.</p>
      <div className="flex flex-wrap gap-2">
        {CLOSE_REASONS.map((r) => (
          <Chip key={r} selected={reason === r} onClick={() => setReason(r === 'Outro' ? '' : r)}>
            {r}
          </Chip>
        ))}
      </div>
      <Textarea label="Justificativa (obrigatória)" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />
      <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="secondary" onClick={onBack}>
          Voltar
        </Button>
        <Button variant="danger" disabled={reason.trim().length < 3} loading={busy} onClick={() => void submit()}>
          Encerrar como não concluído
        </Button>
      </div>
    </div>
  );
}

/** Read-only summary of a settled or closed visit. */
export function SettlementSummary({ appt }: { appt: Appointment }) {
  const s = appt.settlement;
  if (s) {
    const how = s.shop ? `${METHOD_LABEL[s.shop.method]}${s.shop.platform !== 'none' ? ` · ${PLATFORM_LABEL[s.shop.platform]}` : ''}` : 'Sem valor no balcão';
    return (
      <p className="rounded-[12px] border border-success/40 bg-success/10 p-3 text-[14px] text-text-100">
        Pago · {formatBRL(s.receivedCents + s.planCoveredCents)} ({how}). Baixa por {s.registeredByName || 'equipe'}
        {s.paidAt ? ` em ${formatInstant(s.paidAt.toDate())}` : ''}.
      </p>
    );
  }
  const c = appt.closure;
  if (c && appt.status === 'no_show') {
    return (
      <p className="rounded-[12px] border border-danger/40 bg-danger/10 p-3 text-[14px] text-text-100">
        Não concluído: “{c.reason}”. Por {c.byName || 'equipe'}
        {c.at ? ` em ${formatInstant(c.at.toDate())}` : ''}.
      </p>
    );
  }
  return null;
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <dt className="text-text-400">{label}</dt>
      <dd className={strong ? 'tabular font-bold text-text-100' : 'tabular text-text-100'}>{value}</dd>
    </div>
  );
}
