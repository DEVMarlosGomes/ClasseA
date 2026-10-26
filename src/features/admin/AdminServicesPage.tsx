import { Pencil, Plus, Scissors } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Service, ServiceCategory } from '@shared/types';
import { formatBRL } from '@shared/money';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Checkbox, Input, Textarea } from '@/components/ui/Input';
import { Sheet } from '@/components/ui/Sheet';
import { Skeleton } from '@/components/ui/Skeleton';
import { Switch } from '@/components/ui/Switch';
import { toast } from '@/components/ui/Toast';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { errorMessage } from '@/lib/api';
import { CATEGORY_LABEL } from '@/lib/catalog';
import { loadFirestore } from '@/lib/firebase';
import { useAdminServices } from './hooks';

type Draft = Omit<Service, 'id'>;
const emptyDraft: Draft = { name: '', description: '', category: 'cabelo', durationMin: 30, priceCents: 0, includedInPlans: false, active: true, order: 1 };

export default function AdminServicesPage() {
  useDocumentMeta({ title: 'Serviços', noindex: true });
  const services = useAdminServices();
  const [editing, setEditing] = useState<Service | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) return;
    setDraft(editing === 'new' ? { ...emptyDraft, order: (services.data?.length ?? 0) + 1 } : {
      name: editing.name, description: editing.description, category: editing.category, durationMin: editing.durationMin,
      priceCents: editing.priceCents, includedInPlans: editing.includedInPlans, active: editing.active, order: editing.order,
    });
  }, [editing, services.data?.length]);

  const grouped = useMemo(() => Object.entries(CATEGORY_LABEL).map(([key, label]) => ({ key: key as ServiceCategory, label, items: (services.data ?? []).filter((s) => s.category === key) })), [services.data]);

  const save = async () => {
    if (!draft.name.trim() || !draft.description.trim() || draft.durationMin < 5 || draft.priceCents < 0) return toast.error('Revise nome, descrição, duração e preço.');
    setSaving(true);
    try {
      const { db, collection, doc, setDoc } = await loadFirestore();
      const ref = editing === 'new' ? doc(collection(db, 'services')) : doc(db, `services/${editing!.id}`);
      await setDoc(ref, { ...draft, name: draft.name.trim(), description: draft.description.trim() }, { merge: true });
      toast.success(editing === 'new' ? 'Serviço criado.' : 'Serviço atualizado.');
      setEditing(null);
    } catch (e) { toast.error(errorMessage(e)); } finally { setSaving(false); }
  };

  const toggle = async (service: Service) => {
    try {
      const { db, doc, updateDoc } = await loadFirestore();
      await updateDoc(doc(db, `services/${service.id}`), { active: !service.active });
      toast.success(service.active ? 'Serviço ocultado do agendamento.' : 'Serviço publicado no agendamento.');
    } catch (e) { toast.error(errorMessage(e)); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="font-label text-[12px] tracking-[0.16em] text-gold-500">CATÁLOGO</p><h1 className="font-label mt-1 text-[36px] leading-tight text-text-100">Serviços</h1><p className="mt-1 text-[14px] text-text-400">Preços e durações usados na landing e no agendamento.</p></div>
        <Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>Novo serviço</Button>
      </div>
      {services.error ? <ErrorState /> : services.loading ? <Skeleton className="h-72 rounded-[20px]" /> : !services.data?.length ? <Card><EmptyState title="Nenhum serviço cadastrado" /></Card> : grouped.map((group) => group.items.length > 0 && (
        <section key={group.key} className="space-y-3">
          <h2 className="font-label text-[18px] tracking-[0.12em] text-gold-400">{group.label.toUpperCase()}</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {group.items.map((s) => <Card key={s.id} className="p-5"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-gold-500/10 text-gold-400"><Scissors className="size-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-bold text-text-100">{s.name}</p>{!s.active && <Badge>Oculto</Badge>}{s.includedInPlans && <Badge tone="gold">Incluído nos planos</Badge>}</div><p className="mt-1 text-[13px] leading-relaxed text-text-400">{s.description}</p><p className="tabular mt-3 text-[14px] text-text-100">{s.durationMin} min · {formatBRL(s.priceCents)}</p></div><button aria-label={`Editar ${s.name}`} onClick={() => setEditing(s)} className="grid size-11 shrink-0 place-items-center rounded-full text-text-400 hover:bg-white/5 hover:text-gold-400"><Pencil className="size-4" /></button></div><div className="mt-4 border-t border-white/5 pt-3"><Switch checked={s.active} onCheckedChange={() => void toggle(s)} label={s.active ? 'Disponível' : 'Oculto'} description="Controla a exibição pública sem apagar o histórico." /></div></Card>)}
          </div>
        </section>
      ))}
      <Sheet open={!!editing} onOpenChange={(open) => !open && setEditing(null)} title={editing === 'new' ? 'Novo serviço' : 'Editar serviço'} description="As mudanças entram no catálogo em tempo real." footer={<Button block size="lg" loading={saving} onClick={() => void save()}>Salvar serviço</Button>}>
        <div className="space-y-4">
          <Input label="Nome" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
          <Textarea label="Descrição" value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} maxLength={180} />
          <label className="block"><span className="font-label text-[12px] text-text-400">Categoria</span><select value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value as ServiceCategory }))} className="mt-1 h-12 w-full rounded-[12px] border border-ink-600 bg-ink-700 px-3 text-text-100">{Object.entries(CATEGORY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <div className="grid grid-cols-2 gap-3"><Input label="Duração (min)" type="number" inputMode="numeric" min={5} step={5} value={draft.durationMin} onChange={(e) => setDraft((d) => ({ ...d, durationMin: Number(e.target.value) }))} /><Input label="Preço (R$)" type="number" inputMode="decimal" min={0} step="0.01" value={(draft.priceCents / 100).toFixed(2)} onChange={(e) => setDraft((d) => ({ ...d, priceCents: Math.round(Number(e.target.value) * 100) }))} /></div>
          <Input label="Ordem de exibição" type="number" inputMode="numeric" min={1} value={draft.order} onChange={(e) => setDraft((d) => ({ ...d, order: Number(e.target.value) }))} />
          <Checkbox checked={draft.includedInPlans} onChange={(e) => setDraft((d) => ({ ...d, includedInPlans: e.target.checked }))} label="Pode ser coberto pelos planos" />
          <Switch checked={draft.active} onCheckedChange={(active) => setDraft((d) => ({ ...d, active }))} label="Serviço disponível" />
        </div>
      </Sheet>
    </div>
  );
}
