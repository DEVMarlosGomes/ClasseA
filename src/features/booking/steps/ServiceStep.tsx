import { Check, Clock } from 'lucide-react';
import type { Service } from '@shared/types';
import { formatBRL } from '@shared/money';
import { Badge } from '@/components/ui/Badge';
import { ErrorState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';
import { CATEGORY_LABEL } from '@/lib/catalog';
import { durationLabel } from '@/lib/dates';
import { useBooking } from '../store';
import { useBookingData } from '../useBookingData';

const ORDER: Service['category'][] = ['cabelo', 'barba', 'combos', 'acabamentos'];

export function ServiceStep() {
  const { services, planActive } = useBookingData();
  const { serviceIds, toggleService } = useBooking();

  if (services.isError) return <ErrorState onRetry={() => void services.refetch()} />;
  if (services.isLoading)
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 rounded-[16px]" />
        ))}
      </div>
    );

  return (
    <div className="space-y-8">
      <p className="text-[16px] text-text-400">Escolha um ou mais serviços. Dá para juntar corte e barba, por exemplo.</p>
      {ORDER.map((cat) => {
        const list = services.data?.filter((s) => s.category === cat) ?? [];
        if (!list.length) return null;
        return (
          <section key={cat} aria-labelledby={`cat-${cat}`}>
            <h2 id={`cat-${cat}`} className="font-label mb-3 text-[14px] text-gold-500">
              {CATEGORY_LABEL[cat]}
            </h2>
            <ul className="panel divide-y divide-white/5 overflow-hidden">
              {list.map((s) => {
                const on = serviceIds.includes(s.id);
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => toggleService(s.id)}
                      className={cn(
                        'flex w-full items-center gap-4 px-4 py-4 text-left transition-colors duration-150 sm:px-5',
                        on ? 'bg-gold-500/[0.07]' : 'hover:bg-white/[0.03]',
                      )}
                    >
                      <span
                        className={cn(
                          'grid size-6 shrink-0 place-items-center rounded-[8px] border transition-colors duration-150',
                          on ? 'border-transparent bg-gold-500 text-ink-950' : 'border-ink-600 bg-ink-700',
                        )}
                        aria-hidden="true"
                      >
                        {on && <Check className="size-4" strokeWidth={2.5} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-[16px] font-bold text-text-100">{s.name}</span>
                          {planActive && s.includedInPlans && <Badge tone="success">Incluso no seu plano</Badge>}
                        </span>
                        <span className="mt-0.5 block text-[14px] leading-snug text-text-400">{s.description}</span>
                        <span className="tabular mt-1.5 inline-flex items-center gap-1.5 text-[13px] text-text-400">
                          <Clock className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
                          {durationLabel(s.durationMin)}
                        </span>
                      </span>
                      <span className="tabular shrink-0 text-[16px] font-bold text-gold-500">{formatBRL(s.priceCents)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
