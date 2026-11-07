import { useEffect, useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { AgendaEditor } from '@/features/barber/BarberAgendaPage';
import { useAdminBarbers } from './hooks';

/** The owner manages any barber's routine: blocks, extra openings, weekly template and cancellations. */
export default function AdminRoutinePage() {
  useDocumentMeta({ title: 'Rotina da equipe', noindex: true });
  const barbers = useAdminBarbers();
  const list = (barbers.data ?? []).filter((b) => b.active);
  const [barberId, setBarberId] = useState<string | null>(null);

  useEffect(() => {
    if (!barberId && list[0]) setBarberId(list[0].id);
  }, [barberId, list]);

  const current = list.find((b) => b.id === barberId);

  return (
    <div className="space-y-6">
      <div>
        <p className="font-label text-[12px] tracking-[0.16em] text-gold-500">EQUIPE</p>
        <h1 className="font-label mt-1 text-[36px] leading-tight text-text-100">Rotina da equipe</h1>
        <p className="mt-1 text-[14px] text-text-400">
          Escolha o barbeiro para ver a semana, bloquear ou liberar horários e ajustar o modelo semanal.
        </p>
      </div>

      {barbers.error ? (
        <ErrorState />
      ) : barbers.loading ? (
        <Skeleton className="h-12 w-72 rounded-full" />
      ) : list.length === 0 ? (
        <Card>
          <EmptyState title="Nenhum barbeiro ativo" description="Cadastre ou reative um barbeiro em Barbeiros." />
        </Card>
      ) : (
        <div role="group" aria-label="Barbeiro" className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {list.map((b) => (
            <Chip
              key={b.id}
              selected={b.id === barberId}
              onClick={() => setBarberId(b.id)}
              icon={<Avatar name={b.displayName} src={b.photoUrl} size={28} />}
              className="shrink-0 pl-1.5"
            >
              {b.displayName}
            </Chip>
          ))}
        </div>
      )}

      {/* key resets the editor (week, selection, sheets) when switching barbers. */}
      {current && <AgendaEditor key={current.id} barberId={current.id} title={`Agenda de ${current.displayName}`} />}
    </div>
  );
}
