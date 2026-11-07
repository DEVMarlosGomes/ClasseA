import { useEffect, useState } from 'react';
import { METHOD_LABEL, periodLabel } from '@shared/finance';
import { formatBRL } from '@shared/money';
import type { Payout } from '@shared/types';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Input, Textarea } from '@/components/ui/Input';
import { Sheet } from '@/components/ui/Sheet';
import { toast } from '@/components/ui/Toast';
import { errorMessage } from '@/lib/api';
import { loadAuth, loadFirestore } from '@/lib/firebase';

const METHODS: Payout['method'][] = ['transfer', 'pix', 'cash'];
const LABEL: Record<Payout['method'], string> = { ...METHOD_LABEL, transfer: 'Transferência' };

export interface PayoutTarget {
  barberId: string;
  barberName: string;
  period: string;
  dueCents: number;
}

/** Owner registers what he paid a barber for one biweekly period (payouts/{barberId}_{period}). */
export function PayoutSheet({ target, onClose }: { target: PayoutTarget | null; onClose: () => void }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<Payout['method']>('pix');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (target) {
      setAmount((target.dueCents / 100).toFixed(2).replace('.', ','));
      setNote('');
    }
  }, [target]);

  if (!target) return null;
  const cents = Math.round(Number(amount.replace(/\./g, '').replace(',', '.')) * 100);

  const save = async () => {
    setBusy(true);
    try {
      const [{ db, doc, setDoc, serverTimestamp }, { auth }] = await Promise.all([loadFirestore(), loadAuth()]);
      await setDoc(doc(db, `payouts/${target.barberId}_${target.period}`), {
        barberId: target.barberId,
        period: target.period,
        amountCents: cents,
        method,
        note: note.trim(),
        paidAt: serverTimestamp(),
        registeredBy: auth.currentUser?.uid ?? '',
      });
      toast.success(`Repasse de ${formatBRL(cents)} registrado para ${target.barberName}.`);
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Repasse · ${target.barberName}`}
      description={`Quinzena de ${periodLabel(target.period)} · comissão ${formatBRL(target.dueCents)}`}
      size="sm"
      footer={
        <Button block disabled={!Number.isFinite(cents) || cents < 0} loading={busy} onClick={() => void save()}>
          Registrar repasse
        </Button>
      }
    >
      <div className="space-y-4">
        <Input label="Valor pago (R$)" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))} />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Forma do repasse">
          {METHODS.map((m) => (
            <Chip key={m} selected={method === m} onClick={() => setMethod(m)}>
              {LABEL[m]}
            </Chip>
          ))}
        </div>
        <Textarea label="Observação (opcional)" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Sheet>
  );
}
