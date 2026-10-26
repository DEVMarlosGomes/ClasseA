import { ChevronLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import type { Appointment, BarberClient } from '@shared/types';
import { WhatsAppIcon } from '@/components/icons';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button, buttonClass } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Textarea } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { toast } from '@/components/ui/Toast';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useLiveDoc, useLiveQuery } from '@/hooks/useFirestore';
import { errorMessage } from '@/lib/api';
import { formatInstant, formatPhone, longDate, waLink } from '@/lib/dates';
import { loadFirestore } from '@/lib/firebase';
import { useAuth } from '@/features/auth/AuthProvider';
import { STATUS_BADGE } from '@/features/client/appointments';

export default function BarberClientDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const client = useLiveDoc<BarberClient & { id: string }>(user && id ? `barberClients/${user.uid}/clients/${id}` : null);
  useDocumentMeta({ title: client.data?.name ?? 'Cliente', noindex: true });
  const history = useLiveQuery<Appointment>(user && id ? `bhist:${user.uid}:${id}` : null, ({ db, collection, query, where, orderBy, limit }) =>
    query(collection(db, 'appointments'), where('barberId', '==', user!.uid), where('clientId', '==', id), orderBy('startAt', 'desc'), limit(30)),
  );
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => setNotes(client.data?.privateNotes ?? ''), [client.data?.privateNotes]);

  if (client.error) return <ErrorState />;
  if (client.loading) return <Skeleton className="h-72 rounded-[20px]" />;
  const c = client.data;
  if (!c) return <EmptyState title="Cliente não encontrado" description="Esta ficha não existe ou não pertence à sua agenda." action={<Link to="/barbeiro/clientes" className="text-gold-400 underline">Voltar</Link>} />;

  const saveNotes = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { db, doc, updateDoc } = await loadFirestore();
      await updateDoc(doc(db, `barberClients/${user.uid}/clients/${id}`), { privateNotes: notes.slice(0, 1000) });
      toast.success('Notas salvas.');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link to="/barbeiro/clientes" className="font-label -ml-2 inline-flex min-h-11 items-center gap-1 px-2 text-[13px] text-text-400 hover:text-text-100">
        <ChevronLeft className="size-4" strokeWidth={1.5} />
        Clientes
      </Link>
      <Card className="p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <Avatar name={c.name} size={64} />
          <div className="min-w-0">
            <h1 className="font-label truncate text-[28px] leading-tight text-text-100">{c.name}</h1>
            <p className="tabular text-[14px] text-text-400">{formatPhone(c.phone)}</p>
          </div>
        </div>
        <dl className="mt-6 grid grid-cols-3 gap-2">
          {[
            ['Visitas', String(c.visits)],
            ['Última', c.lastVisitAt ? formatInstant(c.lastVisitAt.toDate(), 'dd/MM') : '—'],
            ['Faltas', String(c.noShows)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-[14px] bg-white/[0.03] p-3">
              <dt className="font-label text-[11px] text-text-400">{k}</dt>
              <dd className="tabular mt-1 text-[20px] font-bold text-gold-500">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          {c.hasActivePlan ? <Badge tone="gold">Plano ativo</Badge> : <Badge>Sem plano</Badge>}
          {c.favoriteServices.map((s) => (
            <Badge key={s} tone="neutral">
              {s}
            </Badge>
          ))}
        </div>
        {c.phone && (
          <a href={waLink(c.phone, `Olá, ${c.name.split(' ')[0]}! Aqui é da Classe A Barbearia.`)} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary', 'md', 'mt-5 w-full sm:w-auto')}>
            <WhatsAppIcon className="size-5" />
            Chamar no WhatsApp
          </a>
        )}
      </Card>

      <Card tone="panel" className="p-5 sm:p-6">
        <h2 className="font-label text-[18px] text-text-100">Notas privadas</h2>
        <p className="mt-1 text-[13px] text-text-400">Só você vê. Ex.: máquina 2 nas laterais, risca do lado esquerdo.</p>
        <div className="mt-4">
          <Textarea label="Como ele gosta do corte" value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} hint={`${notes.length}/1000`} />
        </div>
        <Button className="mt-3" size="sm" loading={saving} disabled={notes === (c.privateNotes ?? '')} onClick={() => void saveNotes()}>
          Salvar notas
        </Button>
      </Card>

      <Card tone="panel" className="p-5 sm:p-6">
        <h2 className="font-label text-[18px] text-text-100">Histórico com você</h2>
        <ul className="mt-3 divide-y divide-white/5">
          {history.data?.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-[15px] text-text-100">{longDate(a.date)} · {a.start}</p>
                <p className="truncate text-[13px] text-text-400">{a.services.map((s) => s.name).join(' + ')}</p>
              </div>
              <Badge tone={STATUS_BADGE[a.status].tone}>{STATUS_BADGE[a.status].label}</Badge>
            </li>
          ))}
          {history.data?.length === 0 && <li className="py-3 text-[14px] text-text-400">Sem atendimentos ainda.</li>}
        </ul>
      </Card>
    </div>
  );
}
