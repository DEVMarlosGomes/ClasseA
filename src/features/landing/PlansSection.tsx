import { Reveal, RevealItem } from '@/components/Reveal';
import { ButtonLink } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/EmptyState';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Skeleton } from '@/components/ui/Skeleton';
import { usePlans } from '@/lib/catalog';
import { PlanCard } from '@/features/plans/PlanCard';

export function PlansSection() {
  const { data, isLoading, isError, refetch } = usePlans();
  const monthly = data?.find((p) => p.period === 'monthly');

  return (
    <section id="planos" aria-labelledby="planos-title" className="scroll-mt-20 bg-ink-900/70 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="px-4 sm:px-6">
          <SectionTitle id="planos-title">Planos</SectionTitle>
          <p className="mx-auto mt-4 max-w-[48ch] text-center text-[16px] text-text-400">
            Corte sempre em dia com valor fixo. Escolha a opção que combina com a sua rotina.
          </p>
        </div>

        {isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : isLoading ? (
          <div className="mt-10 grid gap-4 px-4 sm:px-6 md:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[440px] rounded-[20px]" />
            ))}
          </div>
        ) : (
          <Reveal
            as="ul"
            className="no-scrollbar mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain px-4 pb-4 pt-2 sm:px-6 md:grid md:grid-cols-2 md:overflow-visible xl:grid-cols-4"
          >
            {data?.map((plan) => (
              <RevealItem
                as="li"
                key={plan.id}
                className="w-[84%] max-w-[360px] shrink-0 snap-center md:w-auto md:max-w-none"
              >
                <PlanCard
                  plan={plan}
                  monthly={monthly}
                  action={
                    <ButtonLink
                      to={`/cliente/planos?plano=${plan.id}`}
                      variant={plan.highlight ? 'primary' : 'secondary'}
                      block
                    >
                      Assinar
                    </ButtonLink>
                  }
                />
              </RevealItem>
            ))}
          </Reveal>
        )}
        <p className="mt-6 px-4 text-center text-[14px] text-text-400 sm:px-6">
          Os cortes do plano renovam todo mês. Desligue a renovação automática quando quiser.
        </p>
      </div>
    </section>
  );
}
