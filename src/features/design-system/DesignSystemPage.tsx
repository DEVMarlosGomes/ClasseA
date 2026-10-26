import { Scissors, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Divider } from '@/components/ui/Divider';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input, Textarea } from '@/components/ui/Input';
import { Logo } from '@/components/ui/Logo';
import { Orbs } from '@/components/ui/Orbs';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Skeleton } from '@/components/ui/Skeleton';
import { SlotPill } from '@/components/ui/SlotPill';
import { Stepper } from '@/components/ui/Stepper';
import { SuccessCheck } from '@/components/ui/SuccessCheck';
import { Switch } from '@/components/ui/Switch';
import { Tabs } from '@/components/ui/Tabs';
import { toast } from '@/components/ui/Toast';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';

export default function DesignSystemPage() {
  useDocumentMeta({ title: 'Design system', noindex: true });
  const [tab, setTab] = useState('componentes');
  const [enabled, setEnabled] = useState(true);
  const [selectedChip, setSelectedChip] = useState('Corte');
  const [selectedSlot, setSelectedSlot] = useState('10:00');

  return (
    <main className="relative min-h-svh overflow-hidden px-4 py-10 sm:px-6">
      <Orbs intensity={0.35} />
      <div className="relative mx-auto max-w-6xl space-y-12">
        <header className="flex flex-wrap items-end justify-between gap-6">
          <div><Logo className="w-36" /><p className="font-label mt-4 text-[12px] tracking-[0.16em] text-gold-500">AMBIENTE DE DESENVOLVIMENTO</p><h1 className="font-label mt-1 text-[42px] text-text-100">Design system</h1></div>
          <Tabs value={tab} onValueChange={setTab} items={[{ value: 'componentes', label: 'Componentes' }, { value: 'estados', label: 'Estados' }]} />
        </header>

        <section className="space-y-5"><SectionTitle align="left">BOTÕES</SectionTitle><Card className="flex flex-wrap gap-3 p-5"><Button>Primário</Button><Button variant="secondary">Secundário</Button><Button variant="ghost">Ghost</Button><Button variant="danger" icon={<Trash2 className="size-4" />}>Perigo</Button><Button loading>Salvando</Button><Button disabled>Desabilitado</Button></Card></section>

        <section className="space-y-5"><SectionTitle align="left">FORMULÁRIOS</SectionTitle><Card className="grid gap-4 p-5 md:grid-cols-2"><Input label="Nome completo" defaultValue="João Pereira" /><Input label="E-mail" type="email" error="Informe um e-mail válido." /><Textarea label="Observação" defaultValue="Prefiro máquina 2 nas laterais." /><div className="space-y-3"><Switch checked={enabled} onCheckedChange={setEnabled} label="Receber novidades" description="Exemplo de preferência opcional." /><Switch checked disabled onCheckedChange={() => undefined} label="Cookies necessários" description="Sempre ativos para o app funcionar." /></div></Card></section>

        <section className="space-y-5"><SectionTitle align="left">SELEÇÃO</SectionTitle><Card className="space-y-6 p-5"><div className="flex flex-wrap gap-2">{['Corte', 'Barba', 'Sobrancelha'].map((item) => <Chip key={item} selected={selectedChip === item} icon={<Scissors className="size-4" />} onClick={() => setSelectedChip(item)}>{item}</Chip>)}</div><div className="grid max-w-xl grid-cols-2 gap-2 sm:grid-cols-4">{(['09:30', '10:00', '10:30', '11:00'] as const).map((time, index) => <SlotPill key={time} time={time} state={index === 2 ? 'busy' : selectedSlot === time ? 'selected' : index === 3 ? 'blocked' : 'free'} onSelect={() => setSelectedSlot(time)} />)}</div><Stepper steps={['Serviço', 'Barbeiro', 'Dia', 'Horário']} current={1} onBack={() => undefined} /></Card></section>

        <section className="space-y-5"><SectionTitle align="left">STATUS E FEEDBACK</SectionTitle><Card className="p-5"><div className="flex flex-wrap gap-2"><Badge tone="gold">Confirmado</Badge><Badge tone="success">Concluído</Badge><Badge tone="danger">Cancelado</Badge><Badge>Bloqueado</Badge><Badge tone="solid">Destaque</Badge></div><Divider className="my-6" /><div className="flex flex-wrap items-center gap-6"><Avatar name="João Pereira" size={56} /><Skeleton className="h-14 max-w-sm rounded-[14px]" /><SuccessCheck size={72} /></div><div className="mt-6 flex flex-wrap gap-3"><Button variant="secondary" onClick={() => toast.success('Alterações salvas.')}>Toast de sucesso</Button><Button variant="secondary" onClick={() => toast.error('Não foi possível concluir.')}>Toast de erro</Button></div></Card></section>

        <section className="space-y-5"><SectionTitle align="left">ESTADO VAZIO</SectionTitle><Card><EmptyState title="Nenhum horário marcado" description="Escolha um serviço e encontre o melhor horário." action={<Button>Agendar horário</Button>} /></Card></section>
      </div>
    </main>
  );
}
