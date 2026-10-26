import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Plan } from '@shared/types';
import { PERIOD_MONTHS } from '@shared/defaults';
import { formatBRL, savingsPercent } from '@shared/money';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';

export const PERIOD_LABEL: Record<Plan['period'], string> = {
  monthly: 'por mês',
  semiannual: 'a cada 6 meses',
  annual: 'por ano',
};

export function planSavings(plan: Plan, monthly: Plan | undefined): number {
  if (plan.regularPriceCents && plan.regularPriceCents > plan.priceCents) {
    return Math.round(((plan.regularPriceCents - plan.priceCents) / plan.regularPriceCents) * 100);
  }
  if (!monthly || plan.period === 'monthly') return 0;
  return savingsPercent(monthly.priceCents, PERIOD_MONTHS[plan.period], plan.priceCents);
}

interface PlanCardProps {
  plan: Plan;
  monthly?: Plan;
  action: ReactNode;
  current?: boolean;
  className?: string;
}

/** Plan card. The highlighted plan gets a slowly rotating metallic border and a whisper of marble. */
export function PlanCard({ plan, monthly, action, current, className }: PlanCardProps) {
  const savings = planSavings(plan, monthly);
  const body = (
    <div
      className={cn(
        'relative flex h-full flex-col overflow-hidden rounded-[19px] p-6 sm:p-7',
        plan.highlight ? 'bg-[#0d0c0a]' : 'panel',
      )}
    >
      {plan.highlight && (
        <div aria-hidden="true" className="marble pointer-events-none absolute inset-0 opacity-[0.045]" />
      )}
      <div className="relative flex flex-col items-start gap-3">
        <h3 className="font-label text-[28px] text-text-100">{plan.name}</h3>
        {current ? (
          <Badge tone="success">Seu plano</Badge>
        ) : plan.highlight ? (
          <Badge tone="solid">Melhor valor</Badge>
        ) : savings > 0 ? (
          <Badge tone="gold">Economize {savings}%</Badge>
        ) : null}
      </div>

      <div className="relative mt-6">
        {plan.regularPriceCents && (
          <p className="tabular mb-1 text-[14px] text-text-400 line-through">
            Avulso sairia por {formatBRL(plan.regularPriceCents)}
          </p>
        )}
        <p className="tabular text-[40px] font-bold leading-none tracking-tight text-gold-500 sm:text-[44px]">
          {formatBRL(plan.priceCents)}
        </p>
        <p className="mt-2 text-[14px] text-text-400">{PERIOD_LABEL[plan.period]}</p>
        {plan.savingsCents && (
          <p className="tabular mt-3 inline-flex rounded-full border border-gold-500/25 bg-gold-500/10 px-3 py-1.5 text-[14px] font-bold text-gold-400">
            Economize {formatBRL(plan.savingsCents)} no mês
          </p>
        )}
        {plan.period !== 'monthly' && (
          <p className="tabular mt-3 text-[16px] text-text-100">
            Equivale a <strong className="text-gold-400">{formatBRL(plan.monthlyEquivalentCents)}</strong> por
            mês
            {savings > 0 && plan.highlight && (
              <span className="text-text-400"> · {savings}% de economia</span>
            )}
          </p>
        )}
      </div>

      <div className="stitch relative my-6" role="presentation" />

      <ul className="relative flex-1 space-y-3">
        {plan.benefits.map((b) => (
          <li key={b} className="flex items-start gap-3 text-[15px] leading-snug text-text-100">
            <Check className="mt-0.5 size-4 shrink-0 text-gold-500" strokeWidth={2} aria-hidden="true" />
            {b}
          </li>
        ))}
      </ul>

      <div className="relative mt-8">{action}</div>
      {plan.availabilityLabel && (
        <p className="font-label relative mt-3 text-center text-[11px] uppercase tracking-[0.12em] text-text-400">
          {plan.availabilityLabel}
        </p>
      )}
    </div>
  );

  if (!plan.highlight) return <div className={cn('h-full', className)}>{body}</div>;

  return (
    <div
      className={cn(
        'relative h-full overflow-hidden rounded-[20px] p-px shadow-[0_24px_60px_-24px_rgba(233,181,66,0.45)]',
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 aspect-square w-[200%] -translate-x-1/2 -translate-y-1/2"
      >
        <div
          className="h-full w-full"
          style={{
            background:
              'conic-gradient(from 0deg, #9a7220, #f6d47a, #e5b03a, #6b4f16, #b8862b, #f2c75c, #9a7220)',
            animation: 'spin-slow 9s linear infinite',
          }}
        />
      </div>
      <div className="relative h-full">{body}</div>
    </div>
  );
}
