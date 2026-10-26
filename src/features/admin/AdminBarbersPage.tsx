import { Pencil, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Barber } from '@shared/types';
import { Avatar } from '@/components/ui/Avatar';
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
import { call, errorMessage } from '@/lib/api';
import { loadFirestore } from '@/lib/firebase';
import { useAdminBarbers, useAdminServices } from './hooks';

interface Draft { displayName: string; email: string; bio: string; specialties: string[]; serviceIds: string[]; }
const empty: Draft = { displayName: '', email: '', bio: '', specialties: [], serviceIds: [] };

export default function AdminBarbersPage() {
  useDocumentMeta({ title: 'Barbeiros', noindex: true });
  const barbers = useAdminBarbers();
  const services = useAdminServices();
  const [editing, setEditing] = useState<Barber | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(empty);
  const [specialty, setSpecialty] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) return;
    setDraft(editing === 'new' ? empty : { displayName: editing.displayName, email: '', bio: editing.bio, specialties: editing.specialties, serviceIds: editing.serviceIds });
  }, [editing]);

  const save = async () => {
    if (draft.displayName.trim().length < 2 || (editing === 'new' && !draft.email.includes('@')) || !draft.serviceIds.length) return toast.error('Informe nome, e-mail e ao menos um serviço.');
    setSaving(true);
    try {
      if (editing === 'new') {
        const result = await call<Draft, { uid: string; inviteLink: string | null }>('createBarber', { ...draft, displayName: draft.displayName.trim(), email: draft.email.trim().toLowerCase() });
        toast.success('Barbeiro criado.', result.inviteLink ? { description: 'No emulador, o convite foi gerado e pode ser conferido no painel do Auth.' } : { description: 'O convite de senha foi enviado por e-mail.' });
      } else {
        const { db, doc, updateDoc } = await loadFirestore();
        await updateDoc(doc(db, `barbers/${editing!.id}`), { displayName: draft.displayName.trim(), bio: draft.bio.trim(), specialties: draft.specialties, serviceIds: draft.serviceIds });
        toast.success('Perfil do barbeiro atualizado.');
      }
      setEditing(null);
    } catch (e) { toast.error(errorMessage(e)); } finally { setSaving(false); }
  };

  const toggle = async (barber: Barber) => {
    try { const { db, doc, updateDoc } = await loadFirestore(); await updateDoc(doc(db, `barbers/${barber.id}`), { active: !barber.active }); toast.success(barber.active ? 'Barbeiro removido das novas escolhas.' : 'Barbeiro reativado.'); }
    catch (e) { toast.error(errorMessage(e)); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="font-label text-[12px] tracking-[0.16em] text-gold-500">EQUIPE</p><h1 className="font-label mt-1 text-[36px] leading-tight text-text-100">Barbeiros</h1><p className="mt-1 text-[14px] text-text-400">Crie acessos, defina especialidades e controle quem aparece no agendamento.</p></div><Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>Novo barbeiro</Button></div>
      {barbers.error ? <ErrorState /> : barbers.loading ? <Skeleton className="h-72 rounded-[20px]" /> : !barbers.data?.length ? <Card><EmptyState title="Nenhum barbeiro cadastrado" /></Card> : (
        <div className="grid gap-4 lg:grid-cols-2">{barbers.data.map((b) => <Card key={b.id} className="p-5"><div className="flex items-start gap-4"><Avatar name={b.displayName} src={b.photoUrl} size={56} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-label text-[22px] text-text-100">{b.displayName}</h2>{!b.active && <Badge>Inativo</Badge>}</div><p className="mt-1 text-[13px] leading-relaxed text-text-400">{b.bio || 'Bio ainda não preenchida.'}</p><div className="mt-3 flex flex-wrap gap-2">{b.specialties.map((s) => <Badge key={s} tone="gold">{s}</Badge>)}</div><p className="mt-3 text-[12px] text-text-400">{b.serviceIds.length} serviços · intervalos de {b.slotIntervalMin} min</p></div><button onClick={() => setEditing(b)} aria-label={`Editar ${b.displayName}`} className="grid size-11 shrink-0 place-items-center rounded-full text-text-400 hover:bg-white/5 hover:text-gold-400"><Pencil className="size-4" /></button></div><div className="mt-4 border-t border-white/5 pt-3"><Switch checked={b.active} onCheckedChange={() => void toggle(b)} label={b.active ? 'Disponível para agendamento' : 'Inativo'} description="Desativar preserva agenda e histórico." /></div></Card>)}</div>
      )}
      <Sheet open={!!editing} onOpenChange={(open) => !open && setEditing(null)} title={editing === 'new' ? 'Novo barbeiro' : 'Editar barbeiro'} description={editing === 'new' ? 'A conta será criada e receberá um convite para definir a senha.' : 'As mudanças aparecem na landing e no agendamento.'} footer={<Button block size="lg" loading={saving} onClick={() => void save()}>Salvar barbeiro</Button>}>
        <div className="space-y-4">
          <Input label="Nome de exibição" value={draft.displayName} onChange={(e) => setDraft((d) => ({ ...d, displayName: e.target.value }))} />
          {editing === 'new' && <Input label="E-mail de acesso" type="email" inputMode="email" value={draft.email} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} />}
          <Textarea label="Bio curta" value={draft.bio} onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))} maxLength={240} />
          <div><p className="font-label mb-2 text-[12px] text-text-400">Especialidades</p><div className="flex flex-wrap gap-2">{draft.specialties.map((s) => <span key={s} className="inline-flex min-h-9 items-center gap-1 rounded-full border border-gold-700 bg-gold-500/10 pl-3 pr-1 text-[14px] text-gold-400">{s}<button onClick={() => setDraft((d) => ({ ...d, specialties: d.specialties.filter((x) => x !== s) }))} className="grid size-7 place-items-center" aria-label={`Remover ${s}`}><X className="size-3.5" /></button></span>)}</div><form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); const value = specialty.trim(); if (value && !draft.specialties.includes(value) && draft.specialties.length < 6) setDraft((d) => ({ ...d, specialties: [...d.specialties, value] })); setSpecialty(''); }}><Input label="Nova especialidade" value={specialty} onChange={(e) => setSpecialty(e.target.value)} wrapperClassName="flex-1" /><Button type="submit" variant="secondary" className="h-14">Adicionar</Button></form></div>
          <fieldset><legend className="font-label mb-2 text-[12px] text-text-400">Serviços executados</legend><div className="grid gap-1 sm:grid-cols-2">{services.data?.map((s) => <Checkbox key={s.id} checked={draft.serviceIds.includes(s.id)} onChange={(e) => setDraft((d) => ({ ...d, serviceIds: e.target.checked ? [...d.serviceIds, s.id] : d.serviceIds.filter((id) => id !== s.id) }))} label={s.name} />)}</div></fieldset>
        </div>
      </Sheet>
    </div>
  );
}
