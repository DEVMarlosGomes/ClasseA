import { ArrowRight, Clock } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import type { Service } from '@shared/types';
import { formatBRL } from '@shared/money';
import { Reveal, RevealItem } from '@/components/Reveal';
import { ErrorState } from '@/components/ui/EmptyState';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tabs } from '@/components/ui/Tabs';
import { CATEGORY_LABEL, useServices } from '@/lib/catalog';
import { durationLabel } from '@/lib/dates';

const ORDER: Service['category'][] = ['cabelo', 'barba', 'combos', 'acabamentos'];

/** The shop's price board: one glass board, services as rows with a dotted leader to the price. */
export function ServicesSection() {
  const { data, isLoading, isError, refetch } = useServices();
  const categories = useMemo(() => ORDER.filter((c) => data?.some((s) => s.category === c)), [data]);
  const [tab, setTab] = useState<string>('cabelo');
  const active = categories.includes(tab as Service['category']) ? tab : (categories[0] ?? 'cabelo');
  const list = (data ?? []).filter((s) => s.category === active);

  return (
    <section id="servicos" aria-labelledby="servicos-title" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-5xl">
        <SectionTitle id="servicos-title">Serviços</SectionTitle>
        <p className="mx-auto mt-4 max-w-[46ch] text-center text-[16px] text-text-400">
          Do corte clássico ao degradê na navalha. Escolha o serviço e agende direto com o barbeiro.
        </p>

        <div className="glass mt-10 p-2 sm:p-3">
          {categories.length > 1 && (
            <Tabs
              ariaLabel="Categorias de serviço"
              items={categories.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))}
              value={active}
              onValueChange={setTab}
              listClassName="mx-auto max-w-xl"
            />
          )}

          {isError ? (
            <ErrorState onRetry={() => void refetch()} />
          ) : isLoading ? (
            <div className="grid gap-px p-2 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="space-y-3 p-5">
                  <Skeleton className="h-5 w-1/2" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
              ))}
            </div>
          ) : (
            <Reveal as="ul" key={active} className="mt-2 grid sm:grid-cols-2 lg:grid-cols-3">
              {list.map((s) => (
                <RevealItem as="li" key={s.id}>
                  <ServiceRow service={s} />
                </RevealItem>
              ))}
            </Reveal>
          )}
        </div>
      </div>
    </section>
  );
}

function ServiceRow({ service }: { service: Service }) {
  return (
    <article className="group flex h-full flex-col rounded-[16px] p-5 transition-colors duration-200 hover:bg-white/[0.03]">
      <div className="flex items-baseline gap-3">
        <h3 className="font-label text-[20px] text-text-100">{service.name}</h3>
        <span aria-hidden="true" className="mb-1 h-px flex-1 border-b border-dotted border-gold-700/70" />
        <span className="tabular text-[18px] font-bold text-gold-500">{formatBRL(service.priceCents)}</span>
      </div>
      <p className="mt-2 flex-1 text-[14px] leading-relaxed text-text-400">{service.description}</p>
      <div className="mt-4 flex items-center justify-between">
        <span className="tabular inline-flex items-center gap-1.5 text-[14px] text-text-400">
          <Clock className="size-4" strokeWidth={1.5} aria-hidden="true" />
          {durationLabel(service.durationMin)}
        </span>
        <Link
          to={`/agendar?servico=${service.id}`}
          className="font-label -mr-2 inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-[14px] text-gold-400 transition-colors hover:bg-gold-500/10"
          aria-label={`Agendar ${service.name}`}
        >
          Agendar este
          <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" strokeWidth={1.75} />
        </Link>
      </div>
    </article>
  );
}
