import { MessageCircle, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { formatInstant } from '@/lib/dates';
import { type AdminClientRow, useAdminBarbers, useAdminClients } from './hooks';

type Filter = 'todos' | 'plano' | 'sumidos' | 'faltas';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'plano', label: 'Com plano ativo' },
  { value: 'sumidos', label: 'Sem visita há 30+ dias' },
  { value: 'faltas', label: 'Com faltas' },
];

interface ClientSummary {
  clientId: string;
  name: string;
  phone: string;
  visits: number;
  noShows: number;
  lastVisitAt: number | null;
  hasActivePlan: boolean;
  byBarber: { barberId: string; visits: number }[];
}

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** A client may be in several barbers' books: merge into one row per client. */
export function mergeClients(rows: AdminClientRow[]): ClientSummary[] {
  const map = new Map<string, ClientSummary>();
  for (const r of rows) {
    const last = r.lastVisitAt?.toMillis() ?? null;
    const c = map.get(r.clientId) ?? {
      clientId: r.clientId,
      name: r.name,
      phone: r.phone,
      visits: 0,
      noShows: 0,
      lastVisitAt: null,
      hasActivePlan: false,
      byBarber: [],
    };
    c.visits += r.visits;
    c.noShows += r.noShows;
    c.hasActivePlan ||= r.hasActivePlan;
    if (last !== null && (c.lastVisitAt === null || last > c.lastVisitAt)) {
      c.lastVisitAt = last;
      // The most recent book has the freshest name and phone.
      c.name = r.name || c.name;
      c.phone = r.phone || c.phone;
    }
    c.byBarber.push({ barberId: r.barberId, visits: r.visits });
    map.set(r.clientId, c);
  }
  return [...map.values()];
}

export default function AdminClientsPage() {
  useDocumentMeta({ title: 'Clientes', noindex: true });
  const clients = useAdminClients();
  const barbers = useAdminBarbers();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('todos');
  const [barberId, setBarberId] = useState('all');
  const names = useMemo(() => new Map((barbers.data ?? []).map((b) => [b.id, b.displayName])), [barbers.data]);

  const all = useMemo(() => mergeClients(clients.data ?? []), [clients.data]);
  const list = useMemo(() => {
    const now = Date.now();
    const term = normalize(q.trim());
    const digits = q.replace(/\D/g, '');
    return all
      .filter((c) => !term || normalize(c.name).includes(term) || (digits.length >= 3 && c.phone.includes(digits)))
      .filter((c) => barberId === 'all' || c.byBarber.some((b) => b.barberId === barberId))
      .filter((c) => {
        if (filter === 'plano') return c.hasActivePlan;
        if (filter === 'sumidos') return !c.lastVisitAt || now - c.lastVisitAt > 30 * 86_400_000;
        if (filter === 'faltas') return c.noShows > 0;
        return true;
      })
      .sort((a, b) => (b.lastVisitAt ?? 0) - (a.lastVisitAt ?? 0));
  }, [all, q, filter, barberId]);

  return (
    <div className="space-y-6">
      <div>
        <p className="font-label text-[12px] tracking-[0.16em] text-gold-500">CLIENTES</p>
        <h1 className="font-label mt-1 text-[36px] leading-tight text-text-100">Clientes da barbearia</h1>
        <p className="mt-1 text-[14px] text-text-400">
          {all.length} {all.length === 1 ? 'cliente' : 'clientes'} atendidos pela equipe. As anotações
          particulares de cada barbeiro não aparecem aqui.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Buscar cliente</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-text-400" aria-hidden="true" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nome ou telefone"
            className="h-12 w-full rounded-[12px] border border-ink-600 bg-ink-700 pl-11 pr-3 text-[16px] text-text-100"
          />
        </label>
        <label className="sr-only" htmlFor="clients-barber">Barbeiro</label>
        <select
          id="clients-barber"
          value={barberId}
          onChange={(e) => setBarberId(e.target.value)}
          className="h-12 min-w-44 rounded-[12px] border border-ink-600 bg-ink-700 px-3 text-[16px] text-text-100"
        >
          <option value="all">Toda a equipe</option>
          {barbers.data?.map((b) => <option key={b.id} value={b.id}>{b.displayName}</option>)}
        </select>
      </div>
      <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1">
        {FILTERS.map((f) => (
          <Chip key={f.value} selected={filter === f.value} onClick={() => setFilter(f.value)} className="shrink-0">
            {f.label}
          </Chip>
        ))}
      </div>

      {clients.error ? (
        <ErrorState />
      ) : clients.loading ? (
        <div className="space-y-3"><Skeleton className="h-20 rounded-[20px]" /><Skeleton className="h-20 rounded-[20px]" /></div>
      ) : list.length === 0 ? (
        <Card><EmptyState title="Nenhum cliente encontrado" description="Ajuste a busca ou os filtros." /></Card>
      ) : (
        <ul className="space-y-3">
          {list.map((c) => (
            <li key={c.clientId}>
              <Card className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-[16px] font-bold text-text-100">{c.name || 'Cliente sem nome'}</p>
                    <p className="tabular text-[14px] text-text-400">{c.phone || 'Sem telefone'}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {c.hasActivePlan && <Badge tone="gold">Plano ativo</Badge>}
                    {c.noShows > 0 && <Badge tone="danger">{c.noShows} {c.noShows === 1 ? 'falta' : 'faltas'}</Badge>}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-text-400">
                  <span>{c.visits} {c.visits === 1 ? 'visita' : 'visitas'}</span>
                  <span>
                    Última visita: {c.lastVisitAt ? formatInstant(new Date(c.lastVisitAt), 'dd/MM/yyyy') : 'ainda não veio'}
                  </span>
                  <span>
                    Atendido por{' '}
                    {c.byBarber.map((b) => `${names.get(b.barberId) ?? 'barbeiro removido'} (${b.visits})`).join(', ')}
                  </span>
                </div>
                {c.phone && (
                  <a
                    href={`https://wa.me/${c.phone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex min-h-11 items-center gap-2 text-[14px] text-gold-400 hover:text-gold-300"
                  >
                    <MessageCircle className="size-4" aria-hidden="true" />
                    Chamar no WhatsApp
                  </a>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
