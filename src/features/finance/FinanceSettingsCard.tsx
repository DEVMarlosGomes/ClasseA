import { useEffect, useState } from 'react';
import { PLATFORM_LABEL, clampPct, financeSettings } from '@shared/finance';
import type { Barber, FeePlatform, FinanceSettings } from '@shared/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { toast } from '@/components/ui/Toast';
import { errorMessage } from '@/lib/api';
import { loadFirestore } from '@/lib/firebase';

const PLATFORMS: FeePlatform[] = ['infinitepay', 'mercadopago'];
const FEE_FIELDS: { platform: FeePlatform; method: 'pix' | 'credit' | 'debit'; label: string }[] = [
  { platform: 'infinitepay', method: 'pix', label: 'InfinitePay · PIX' },
  { platform: 'infinitepay', method: 'debit', label: 'InfinitePay · débito' },
  { platform: 'infinitepay', method: 'credit', label: 'InfinitePay · crédito' },
  { platform: 'mercadopago', method: 'credit', label: 'Mercado Pago · cartão' },
];

const num = (v: string) => Number(v.replace(',', '.'));
const clean = (v: string) => v.replace(/[^\d.,]/g, '');
const feeKey = (f: { platform: FeePlatform; method: string }) => `${f.platform}.${f.method}`;

/** Owner-only: default %, % per barber, and whether platform fees are deducted before the commission. */
export function FinanceSettingsCard({ raw, barbers }: { raw: Partial<FinanceSettings> | null | undefined; barbers: Barber[] }) {
  const [draft, setDraft] = useState<FinanceSettings>(financeSettings(raw));
  const [pcts, setPcts] = useState<Record<string, string>>({});
  // Text while typing ("3,15" must be typeable); converted to numbers only on save.
  const [defPct, setDefPct] = useState('35');
  const [fees, setFees] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const s = financeSettings(raw);
    setDraft(s);
    setDefPct(String(s.defaultCommissionPct).replace('.', ','));
    setFees(Object.fromEntries(FEE_FIELDS.map((f) => [feeKey(f), String(s.fees[f.platform][f.method] ?? 0).replace('.', ',')])));
  }, [raw]);
  useEffect(() => {
    setPcts(Object.fromEntries(barbers.map((b) => [b.id, typeof b.commissionPct === 'number' ? String(b.commissionPct) : ''])));
  }, [barbers]);

  const togglePlatform = (p: FeePlatform) =>
    setDraft((d) => ({ ...d, deductFrom: d.deductFrom.includes(p) ? d.deductFrom.filter((x) => x !== p) : [...d.deductFrom, p] }));

  const save = async () => {
    setBusy(true);
    try {
      const { db, doc, setDoc, writeBatch } = await loadFirestore();
      const feeTable: FinanceSettings['fees'] = { infinitepay: {}, mercadopago: {} };
      for (const f of FEE_FIELDS) feeTable[f.platform][f.method] = clampPct(num(fees[feeKey(f)] ?? '0') || 0);
      await setDoc(doc(db, 'settings/finance'), {
        defaultCommissionPct: clampPct(num(defPct) || 0),
        deductPlatformFees: draft.deductPlatformFees,
        deductFrom: draft.deductFrom,
        fees: feeTable,
      });
      const batch = writeBatch(db);
      for (const b of barbers) {
        const v = pcts[b.id]?.trim() ?? '';
        const next = v === '' ? null : clampPct(num(v));
        if (next !== (typeof b.commissionPct === 'number' ? b.commissionPct : null)) batch.update(doc(db, `barbers/${b.id}`), { commissionPct: next });
      }
      await batch.commit();
      toast.success('Regras de comissão salvas. Valem para as próximas baixas.');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="space-y-6 p-5">
      <div>
        <h2 className="font-label text-[20px] text-text-100">Regras de comissão</h2>
        <p className="mt-1 text-[13px] text-text-400">Mudanças valem para as próximas baixas; o que já foi pago não é recalculado.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Comissão padrão (%)"
          inputMode="decimal"
          value={defPct}
          onChange={(e) => setDefPct(clean(e.target.value))}
        />
      </div>

      <fieldset>
        <legend className="font-label mb-2 text-[12px] text-text-400">Por barbeiro (vazio = padrão)</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {barbers.map((b) => (
            <Input
              key={b.id}
              label={`${b.displayName}${b.active ? '' : ' (inativo)'}`}
              inputMode="decimal"
              value={pcts[b.id] ?? ''}
              onChange={(e) => setPcts((p) => ({ ...p, [b.id]: clean(e.target.value) }))}
              hint={pcts[b.id] === '0' ? 'Sem comissão (ex.: o dono)' : undefined}
            />
          ))}
        </div>
      </fieldset>

      <div className="border-t border-white/5 pt-4">
        <Switch
          checked={draft.deductPlatformFees}
          onCheckedChange={(v) => setDraft((d) => ({ ...d, deductPlatformFees: v, deductFrom: v && d.deductFrom.length === 0 ? ['infinitepay'] : d.deductFrom }))}
          label="Descontar taxa da plataforma"
          description="Desligado: comissão sobre o valor bruto recebido. Ligado: desconta a taxa da maquininha/plataforma antes."
        />
        {draft.deductPlatformFees && (
          <fieldset className="mt-3">
            <legend className="font-label mb-2 text-[12px] text-text-400">Descontar a taxa de</legend>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => (
                <Chip key={p} selected={draft.deductFrom.includes(p)} onClick={() => togglePlatform(p)}>
                  {PLATFORM_LABEL[p]}
                </Chip>
              ))}
            </div>
          </fieldset>
        )}
      </div>

      <fieldset>
        <legend className="font-label mb-2 text-[12px] text-text-400">Taxas do seu contrato (%)</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {FEE_FIELDS.map((f) => (
            <Input
              key={feeKey(f)}
              label={f.label}
              inputMode="decimal"
              value={fees[feeKey(f)] ?? '0'}
              onChange={(e) => setFees((m) => ({ ...m, [feeKey(f)]: clean(e.target.value) }))}
            />
          ))}
        </div>
      </fieldset>

      <Button loading={busy} onClick={() => void save()}>
        Salvar regras
      </Button>
    </Card>
  );
}
