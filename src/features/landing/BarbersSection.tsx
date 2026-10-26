import { ArrowRight, Crown } from 'lucide-react';
import { Link } from 'react-router';
import type { Barber } from '@shared/types';
import { Reveal, RevealItem } from '@/components/Reveal';
import { initials } from '@/components/ui/Avatar';
import { ErrorState } from '@/components/ui/EmptyState';
import { LogoMark } from '@/components/ui/Logo';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Skeleton } from '@/components/ui/Skeleton';
import { useBarbers } from '@/lib/catalog';

export function BarbersSection() {
  const { data, isLoading, isError, refetch } = useBarbers();
  if (!isLoading && !isError && data?.length === 0) return null;

  return (
    <section id="barbeiros" aria-labelledby="barbeiros-title" className="scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="px-4 sm:px-6">
          <SectionTitle id="barbeiros-title">Barbeiros</SectionTitle>
          <p className="mx-auto mt-4 max-w-[46ch] text-center text-[16px] text-text-400">
            Cada um com sua especialidade. Escolha com quem você quer sentar na cadeira.
          </p>
        </div>
        {isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : (
          <Reveal
            as="ul"
            className="no-scrollbar mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain px-4 pb-4 sm:px-6 lg:grid lg:grid-cols-3 lg:overflow-visible"
          >
            {isLoading
              ? [0, 1, 2].map((i) => (
                  <li key={i} className="w-[72%] max-w-[300px] shrink-0 lg:w-auto lg:max-w-none">
                    <Skeleton className="aspect-[4/5] rounded-[20px]" />
                  </li>
                ))
              : data?.map((b) => (
                  <RevealItem
                    as="li"
                    key={b.id}
                    className="w-[72%] max-w-[300px] shrink-0 snap-center lg:w-auto lg:max-w-none"
                  >
                    <BarberCard barber={b} />
                  </RevealItem>
                ))}
          </Reveal>
        )}
      </div>
    </section>
  );
}

function BarberCard({ barber }: { barber: Barber }) {
  return (
    <Link
      to={`/agendar?barbeiro=${barber.id}`}
      className={`group relative block overflow-hidden rounded-[20px] bg-ink-800 transition-[border-color,transform,box-shadow] duration-300 hover:border-gold-500/45 focus-visible:border-gold-500/45 ${barber.featured ? 'border border-gold-500/70 shadow-[0_24px_60px_-28px_rgba(233,181,66,0.75)] lg:-translate-y-3' : 'border border-gold-500/15'}`}
      aria-label={`Agendar com ${barber.displayName}`}
    >
      <div className="relative aspect-[4/5] overflow-hidden">
        {barber.photoUrl ? (
          <img
            src={barber.photoUrl}
            alt=""
            loading="lazy"
            width={600}
            height={750}
            className="h-full w-full object-cover grayscale transition-[filter,transform] duration-700 ease-brand group-hover:scale-[1.03] group-hover:grayscale-0 group-focus-visible:grayscale-0"
            style={{ objectPosition: barber.photoPosition ?? 'center' }}
          />
        ) : (
          <div className="relative grid h-full w-full place-items-center bg-[radial-gradient(80%_60%_at_50%_35%,#1e1a12,#0b0b0b)]">
            <LogoMark className="absolute right-5 top-5 w-6 opacity-30" />
            <span className="font-label text-[88px] leading-none tracking-[0.06em] text-gold-500/90 transition-transform duration-700 ease-brand group-hover:scale-105">
              {initials(barber.displayName)}
            </span>
          </div>
        )}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-ink-950 via-ink-950/70 to-transparent"
        />
      </div>
      <div className="absolute inset-x-0 bottom-0 p-5">
        {barber.roleLabel && (
          <span className="font-label mb-3 inline-flex items-center gap-1.5 rounded-full bg-gold-500 px-3 py-1 text-[11px] uppercase tracking-[0.1em] text-ink-950">
            <Crown className="size-3.5" strokeWidth={2} aria-hidden="true" />
            {barber.roleLabel}
          </span>
        )}
        <h3 className="font-label text-[28px] leading-none text-text-100">{barber.displayName}</h3>
        {barber.specialties.length > 0 && (
          <p className="mt-2 text-[14px] text-text-400">{barber.specialties.join(' · ')}</p>
        )}
        <span className="font-label mt-4 inline-flex min-h-11 items-center gap-1.5 text-[14px] text-gold-400">
          Agendar com {barber.displayName.split(' ')[0]}
          <ArrowRight
            className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
            strokeWidth={1.75}
          />
        </span>
      </div>
    </Link>
  );
}
