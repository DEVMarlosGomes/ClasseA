import { Check, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';
import { useBooking } from '../store';
import { useBookingData } from '../useBookingData';

function Option({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        'relative flex w-full items-center gap-4 rounded-[18px] border p-4 text-left transition-colors duration-150',
        selected ? 'border-gold-500 bg-gold-500/[0.08]' : 'border-ink-600 bg-ink-800/70 hover:border-gold-700',
      )}
    >
      {children}
      <span
        aria-hidden="true"
        className={cn(
          'ml-auto grid size-6 shrink-0 place-items-center rounded-full border',
          selected ? 'border-transparent bg-gold-500 text-ink-950' : 'border-ink-600',
        )}
      >
        {selected && <Check className="size-4" strokeWidth={2.5} />}
      </span>
    </button>
  );
}

export function BarberStep({ onPicked }: { onPicked: () => void }) {
  const { barbers, eligible } = useBookingData();
  const { barberId, setBarber } = useBooking();

  if (barbers.isError) return <ErrorState onRetry={() => void barbers.refetch()} />;
  if (barbers.isLoading)
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 rounded-[18px]" />
        ))}
      </div>
    );
  if (!eligible.length)
    return (
      <EmptyState
        title="Nenhum barbeiro faz essa combinação"
        description="Volte e tente separar os serviços, ou fale com a barbearia pelo WhatsApp."
      />
    );

  const pick = (id: string) => {
    setBarber(id);
    onPicked();
  };

  return (
    <div role="radiogroup" aria-label="Escolha o barbeiro" className="space-y-3">
      <Option selected={barberId === 'any'} onClick={() => pick('any')}>
        <span className="grid size-14 shrink-0 place-items-center rounded-full border border-gold-700/60 bg-gold-500/10 text-gold-400">
          <Sparkles className="size-6" strokeWidth={1.5} aria-hidden="true" />
        </span>
        <span>
          <span className="block text-[16px] font-bold text-text-100">Sem preferência</span>
          <span className="block text-[14px] text-text-400">Mostramos o horário mais cedo entre todos</span>
        </span>
      </Option>
      {eligible.map((b) => (
        <Option key={b.id} selected={barberId === b.id} onClick={() => pick(b.id)}>
          <Avatar name={b.displayName} src={b.photoUrl} size={56} />
          <span className="min-w-0">
            <span className="block text-[16px] font-bold text-text-100">{b.displayName}</span>
            {b.specialties.length > 0 && <span className="block truncate text-[14px] text-text-400">{b.specialties.join(' · ')}</span>}
          </span>
        </Option>
      ))}
    </div>
  );
}
