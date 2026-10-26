import { ChevronRight, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import type { BarberClient } from '@shared/types';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Chip } from '@/components/ui/Chip';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useLiveQuery } from '@/hooks/useFirestore';
import { formatInstant } from '@/lib/dates';
import { useAuth } from '@/features/auth/AuthProvider';

type Filter = 'todos' | 'frequentes' | 'sumidos' | 'plano' | 'faltas';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'frequentes', label: 'Frequentes' },
  { value: 'sumidos', label: 'Sem visita há 30+ dias' },
  { value: 'plano', label: 'Com plano ativo' },
  { value: 'faltas', label: 'Com faltas' },
];

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export function useBarberClients(uid: string | undefined) {
  return useLiveQuery<BarberClient & { id: string }>(uid ? `bclients:${uid}` : null, ({ db, collection, query }) =>
    query(collection(db, `barberClients/${uid}/clients`)),
  );
}

export default function BarberClientsPage() {
  useDocumentMeta({ title: 'Clientes', noindex: true });
  const { user } = useAuth();
  const clients = useBarberClients(user?.uid);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('todos');

  const list = useMemo(() => {
    const now = Date.now();
    const term = normalize(q.trim());
    const digits = q.replace(/\D/g, '');
    return (clients.data ?? [])
      .filter((c) => !term || normalize(c.name).includes(term) || (digits.length >= 3 && c.phone.includes(digits)))
      .filter((c) => {
        if (filter === 'frequentes') return c.visits >= 3;
        if (filter === 'sumidos') return !c.lastVisitAt || now - c.lastVisitAt.toMillis() > 30 * 86_400_000;
        if (filter === 'plano') return c.hasActivePlan;
        if (filter === 'faltas') return c.noShows > 0;
        return true;
      })
      .sort((a, b) => (b.lastVisitAt?.toMillis() ?? 0) - (a.lastVisitAt?.toMillis() ?? 0));
  }, [clients.data, q, filter]);

  return (
    <div>
      <h1 className="font-label text-[36px] leading-tight text-text-100">Clientes</h1>
      <div className="relative mt-5">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-text-400" strokeWidth={1.5} aria-hidden="true" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome ou telefone"
          aria-label="Buscar cliente"
          className="h-12 w-full rounded-[14px] border border-ink-600 bg-ink-700/70 pl-12 pr-4 text-[16px] text-text-100 placeholder:text-text-400 focus:border-gold-500 focus:outline-none"
        />
      </div>
      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filtros">
        {FILTERS.map((f) => (
          <Chip key={f.value} selected={filter === f.value} onClick={() => setFilter(f.value)} className="shrink-0">
            {f.label}
          </Chip>
        ))}
      </div>

      <div className="mt-5">
        {clients.error ? (
          <ErrorState />
        ) : clients.loading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 rounded-[14px]" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="panel">
            <EmptyState
              title={clients.data?.length ? 'Nenhum cliente encontrado' : 'Seus clientes aparecem aqui'}
              description={clients.data?.length ? 'Tente outro nome ou filtro.' : 'Assim que alguém agendar com você, a ficha é criada automaticamente.'}
            />
          </div>
        ) : (
          <ul className="panel divide-y divide-white/5 overflow-hidden">
            {list.map((c) => (
              <li key={c.id}>
                <Link to={`/barbeiro/clientes/${c.id}`} className="flex min-h-16 items-center gap-4 px-4 py-3 hover:bg-white/[0.03]">
                  <Avatar name={c.name} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-[16px] font-bold text-text-100">
                      {c.name}
                      {c.hasActivePlan && <Badge tone="gold">Plano</Badge>}
                    </p>
                    <p className="tabular text-[13px] text-text-400">
                      {c.lastVisitAt ? `Última visita ${formatInstant(c.lastVisitAt.toDate(), 'dd/MM/yyyy')}` : 'Ainda sem visita'} · {c.visits}{' '}
                      {c.visits === 1 ? 'visita' : 'visitas'}
                      {c.noShows > 0 && ` · ${c.noShows} ${c.noShows === 1 ? 'falta' : 'faltas'}`}
                    </p>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-text-400" strokeWidth={1.5} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
