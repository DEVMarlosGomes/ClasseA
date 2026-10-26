import { Crown, Pencil, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Plan, PlanPeriod } from '@shared/types';
import { formatBRL } from '@shared/money';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Sheet } from '@/components/ui/Sheet';
import { Skeleton } from '@/components/ui/Skeleton';
import { Switch } from '@/components/ui/Switch';
import { toast } from '@/components/ui/Toast';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { errorMessage } from '@/lib/api';
import { loadFirestore } from '@/lib/firebase';
import { useAdminPlans } from './hooks';

type Draft = Omit<Plan, 'id'>;
const empty: Draft = { name: '', period: 'monthly', priceCents: 0, monthlyEquivalentCents: 0, cutsPerMonth: 4, benefits: [], highlight: false, active: true, order: 1 };
const PERIOD_LABEL: Record<PlanPeriod, string> = { monthly: 'Mensal', semiannual: 'Semestral', annual: 'Anual' };

export default function AdminPlansPage() {
  useDocumentMeta({ title: 'Planos', noindex: true });
  const plans = useAdminPlans();
  const [editing, setEditing] = useState<Plan | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(empty);
  const [benefit, setBenefit] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) return;
    setDraft(editing === 'new' ? { ...empty, order: (plans.data?.length ?? 0) + 1 } : {
      name: editing.name, period: editing.period, priceCents: editing.priceCents,
      monthlyEquivalentCents: editing.monthlyEquivalentCents, cutsPerMonth: editing.cutsPerMonth,
      benefits: editing.benefits, highlight: editing.highlight, active: editing.active, order: editing.order,
    });
  }, [editing, plans.data?.length]);

  const save = async () => {
    if (!draft.name.trim() || draft.priceCents <= 0 || draft.monthlyEquivalentCents <= 0 || !draft.benefits.length) return toast.error('Informe nome, valores e ao menos um benefício.');
    setSaving(true);
    try {
      const { db, collection, doc, setDoc } = await loadFirestore();
      const ref = editing === 'new' ? doc(collection(db, 'plans')) : doc(db, `plans/${editing!.id}`);
      await setDoc(ref, { ...draft, name: draft.name.trim() }, { merge: true });
      toast.success(editing === 'new' ? 'Plano criado.' : 'Plano atualizado.');
      setEditing(null);
    } catch (e) { toast.error(errorMessage(e)); } finally { setSaving(false); }
  };

  const toggle = async (plan: Plan) => {
    try { const { db, doc, updateDoc } = await loadFirestore(); await updateDoc(doc(db, `plans/${plan.id}`), { active: !plan.active }); toast.success(plan.active ? 'Plano ocultado.' : 'Plano publicado.'); }
    catch (e) { toast.error(errorMessage(e)); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="font-label text-[12px] tracking-[0.16em] text-gold-500">RECORRÊNCIA</p><h1 className="font-label mt-1 text-[36px] leading-tight text-text-100">Planos</h1><p className="mt-1 text-[14px] text-text-400">Benefícios e preços exibidos na landing e na área do cliente.</p></div><Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>Novo plano</Button></div>
      {plans.error ? <ErrorState /> : plans.loading ? <Skeleton className="h-72 rounded-[20px]" /> : !plans.data?.length ? <Card><EmptyState title="Nenhum plano cadastrado" /></Card> : (
        <div className="grid gap-4 lg:grid-cols-3">{plans.data.map((p) => <Card key={p.id} tone={p.highlight ? 'gold' : 'glass'} className="flex flex-col p-5"><div className="flex items-start justify-between gap-3"><span className="grid size-10 place-items-center rounded-full bg-gold-500/10 text-gold-400"><Crown className="size-5" /></span><button aria-label={`Editar ${p.name}`} onClick={() => setEditing(p)} className="grid size-11 place-items-center rounded-full text-text-400 hover:bg-white/5 hover:text-gold-400"><Pencil className="size-4" /></button></div><div className="mt-3 flex flex-wrap gap-2"><Badge tone="gold">{PERIOD_LABEL[p.period]}</Badge>{p.highlight && <Badge tone="solid">Destaque</Badge>}{!p.active && <Badge>Oculto</Badge>}</div><h2 className="font-label mt-3 text-[26px] text-text-100">{p.name}</h2><p className="tabular mt-1 text-[24px] font-bold text-gold-400">{formatBRL(p.priceCents)}</p><p className="text-[13px] text-text-400">equivale a {formatBRL(p.monthlyEquivalentCents)}/mês</p><ul className="mt-4 flex-1 space-y-2 text-[14px] text-text-400">{p.benefits.map((b) => <li key={b}>• {b}</li>)}</ul><div className="mt-5 border-t border-white/5 pt-3"><Switch checked={p.active} onCheckedChange={() => void toggle(p)} label={p.active ? 'Disponível' : 'Oculto'} /></div></Card>)}</div>
      )}
      <Sheet open={!!editing} onOpenChange={(open) => !open && setEditing(null)} title={editing === 'new' ? 'Novo plano' : 'Editar plano'} description="A cobrança permanece simulada nesta versão." footer={<Button block size="lg" loading={saving} onClick={() => void save()}>Salvar plano</Button>}>
        <div className="space-y-4">
          <Input label="Nome" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
          <label className="block"><span className="font-label text-[12px] text-text-400">Período</span><select value={draft.period} onChange={(e) => setDraft((d) => ({ ...d, period: e.target.value as PlanPeriod }))} className="mt-1 h-12 w-full rounded-[12px] border border-ink-600 bg-ink-700 px-3 text-text-100">{Object.entries(PERIOD_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <div className="grid grid-cols-2 gap-3"><Input label="Valor total (R$)" type="number" min={0} step="0.01" value={(draft.priceCents / 100).toFixed(2)} onChange={(e) => setDraft((d) => ({ ...d, priceCents: Math.round(Number(e.target.value) * 100) }))} /><Input label="Equivalente mensal" type="number" min={0} step="0.01" value={(draft.monthlyEquivalentCents / 100).toFixed(2)} onChange={(e) => setDraft((d) => ({ ...d, monthlyEquivalentCents: Math.round(Number(e.target.value) * 100) }))} /></div>
          <div className="grid grid-cols-2 gap-3"><Input label="Cortes por mês" type="number" min={0} value={draft.cutsPerMonth ?? ''} onChange={(e) => setDraft((d) => ({ ...d, cutsPerMonth: e.target.value ? Number(e.target.value) : null }))} /><Input label="Ordem" type="number" min={1} value={draft.order} onChange={(e) => setDraft((d) => ({ ...d, order: Number(e.target.value) }))} /></div>
          <div><p className="font-label mb-2 text-[12px] text-text-400">Benefícios</p><div className="space-y-2">{draft.benefits.map((b) => <div key={b} className="flex min-h-11 items-center justify-between rounded-[12px] border border-ink-600 px-3 text-[14px] text-text-100"><span>{b}</span><button onClick={() => setDraft((d) => ({ ...d, benefits: d.benefits.filter((x) => x !== b) }))} aria-label={`Remover ${b}`} className="grid size-9 place-items-center text-text-400"><X className="size-4" /></button></div>)}</div><form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); const value = benefit.trim(); if (value && !draft.benefits.includes(value)) setDraft((d) => ({ ...d, benefits: [...d.benefits, value] })); setBenefit(''); }}><Input label="Novo benefício" value={benefit} onChange={(e) => setBenefit(e.target.value)} wrapperClassName="flex-1" /><Button type="submit" variant="secondary" className="h-14">Adicionar</Button></form></div>
          <Switch checked={draft.highlight} onCheckedChange={(highlight) => setDraft((d) => ({ ...d, highlight }))} label="Destacar este plano" />
          <Switch checked={draft.active} onCheckedChange={(active) => setDraft((d) => ({ ...d, active }))} label="Plano disponível" />
        </div>
      </Sheet>
    </div>
  );
}
