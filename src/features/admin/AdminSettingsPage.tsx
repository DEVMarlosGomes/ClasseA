import { Save, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ShopSettings } from '@shared/types';
import { DEFAULT_SETTINGS, isPlaceholder } from '@shared/defaults';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { toast } from '@/components/ui/Toast';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { errorMessage } from '@/lib/api';
import { useShopSettings } from '@/lib/catalog';
import { loadFirestore } from '@/lib/firebase';

export default function AdminSettingsPage() {
  useDocumentMeta({ title: 'Configurações da barbearia', noindex: true });
  const settings = useShopSettings();
  const [draft, setDraft] = useState<ShopSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (settings.data) setDraft(settings.data); }, [settings.data]);

  const set = <K extends keyof ShopSettings>(key: K, value: ShopSettings[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const setAddress = (key: keyof ShopSettings['address'], value: string) => setDraft((d) => ({ ...d, address: { ...d.address, [key]: value } }));
  const placeholders = [draft.legalName, draft.cnpj, draft.address.street, draft.address.district, draft.address.zip].filter(isPlaceholder).length;

  const save = async () => {
    if (!draft.name.trim() || !draft.email.includes('@') || !draft.whatsapp.replace(/\D/g, '').length) return toast.error('Revise nome, e-mail e WhatsApp.');
    setSaving(true);
    try {
      const { db, doc, setDoc } = await loadFirestore();
      await setDoc(doc(db, 'settings/shop'), { ...draft, whatsapp: draft.whatsapp.replace(/\D/g, '') });
      await settings.refetch();
      toast.success('Configurações publicadas no app.');
    } catch (e) { toast.error(errorMessage(e)); } finally { setSaving(false); }
  };

  if (settings.isLoading && !settings.data) return <Skeleton className="h-[600px] rounded-[20px]" />;

  return (
    <div className="space-y-6">
      <div><p className="font-label text-[12px] tracking-[0.16em] text-gold-500">NEGÓCIO</p><h1 className="font-label mt-1 text-[36px] leading-tight text-text-100">Configurações</h1><p className="mt-1 text-[14px] text-text-400">Fonte única dos dados mostrados no site, nas regras de agenda e nos documentos.</p></div>
      {placeholders > 0 && <div role="alert" className="flex gap-3 rounded-[16px] border border-gold-700 bg-gold-500/10 p-4 text-[14px] text-gold-400"><TriangleAlert className="mt-0.5 size-5 shrink-0" /><p>Há {placeholders} campos obrigatórios ainda com valores de exemplo. Substitua todos antes do deploy de produção.</p></div>}
      <Card className="p-5 sm:p-6"><h2 className="font-label text-[22px] text-text-100">Identificação e contato</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><Input label="Nome comercial" value={draft.name} onChange={(e) => set('name', e.target.value)} /><Input label="Razão social" value={draft.legalName} onChange={(e) => set('legalName', e.target.value)} /><Input label="CNPJ" value={draft.cnpj} onChange={(e) => set('cnpj', e.target.value)} /><Input label="E-mail" type="email" value={draft.email} onChange={(e) => set('email', e.target.value)} /><Input label="WhatsApp (55 + DDD + número)" inputMode="tel" value={draft.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} /><Input label="Instagram (sem @)" value={draft.instagram} onChange={(e) => set('instagram', e.target.value.replace(/^@/, ''))} /></div></Card>
      <Card className="p-5 sm:p-6"><h2 className="font-label text-[22px] text-text-100">Endereço</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><Input label="Rua e número" value={draft.address.street} onChange={(e) => setAddress('street', e.target.value)} /><Input label="Bairro" value={draft.address.district} onChange={(e) => setAddress('district', e.target.value)} /><Input label="Cidade" value={draft.address.city} onChange={(e) => setAddress('city', e.target.value)} /><Input label="Estado" maxLength={2} value={draft.address.state} onChange={(e) => setAddress('state', e.target.value.toUpperCase())} /><Input label="CEP" value={draft.address.zip} onChange={(e) => setAddress('zip', e.target.value)} /><Input label="Busca no Google Maps" value={draft.address.mapsQuery} onChange={(e) => setAddress('mapsQuery', e.target.value)} /></div></Card>
      <Card className="p-5 sm:p-6"><h2 className="font-label text-[22px] text-text-100">Regras de agendamento</h2><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><NumberField label="Cancelamento mínimo (horas)" value={draft.cancellationPolicyHours} min={0} onChange={(v) => set('cancellationPolicyHours', v)} /><NumberField label="Janela de agenda (dias)" value={draft.bookingWindowDays} min={1} onChange={(v) => set('bookingWindowDays', v)} /><NumberField label="Antecedência mínima (min)" value={draft.minAdvanceMin} min={0} onChange={(v) => set('minAdvanceMin', v)} /><NumberField label="Tolerância de atraso (min)" value={draft.lateToleranceMin} min={0} onChange={(v) => set('lateToleranceMin', v)} /><NumberField label="Máximo de horários futuros" value={draft.maxFutureAppointments} min={1} onChange={(v) => set('maxFutureAppointments', v)} /></div></Card>
      <Card className="p-5 sm:p-6"><h2 className="font-label text-[22px] text-text-100">Horários exibidos no site</h2><div className="mt-4 space-y-3">{draft.openingHours.map((row, index) => <div key={index} className="grid gap-3 sm:grid-cols-2"><Input label="Dias" value={row.days} onChange={(e) => set('openingHours', draft.openingHours.map((r, i) => i === index ? { ...r, days: e.target.value } : r))} /><Input label="Horários" value={row.hours} onChange={(e) => set('openingHours', draft.openingHours.map((r, i) => i === index ? { ...r, hours: e.target.value } : r))} /></div>)}</div></Card>
      <Button size="lg" icon={<Save className="size-4" />} loading={saving} onClick={() => void save()}>Salvar configurações</Button>
    </div>
  );
}

function NumberField({ label, value, min, onChange }: { label: string; value: number; min: number; onChange: (value: number) => void }) {
  return <Input label={label} type="number" inputMode="numeric" min={min} value={value} onChange={(e) => onChange(Math.max(min, Number(e.target.value)))} />;
}
