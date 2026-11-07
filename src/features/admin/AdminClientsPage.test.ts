import { describe, expect, it } from 'vitest';
import { mergeClients } from './AdminClientsPage';
import type { AdminClientRow } from './hooks';

const ts = (iso: string) => ({ toDate: () => new Date(iso), toMillis: () => new Date(iso).getTime() });

const row = (over: Partial<AdminClientRow>): AdminClientRow => ({
  clientId: 'c1',
  barberId: 'roberth',
  name: 'João',
  phone: '+5511999990000',
  visits: 1,
  noShows: 0,
  lastVisitAt: null,
  favoriteServices: [],
  hasActivePlan: false,
  ...over,
});

describe('mergeClients', () => {
  it('merges the same client across barbers, keeping the freshest contact', () => {
    const [c, ...rest] = mergeClients([
      row({ barberId: 'roberth', visits: 2, noShows: 1, name: 'João', lastVisitAt: ts('2026-10-01T12:00:00Z') }),
      row({ barberId: 'igor', visits: 3, hasActivePlan: true, name: 'João Silva', phone: '+5511988887777', lastVisitAt: ts('2026-11-01T12:00:00Z') }),
    ]);
    expect(rest).toHaveLength(0);
    expect(c).toMatchObject({ visits: 5, noShows: 1, hasActivePlan: true, name: 'João Silva', phone: '+5511988887777' });
    expect(c!.lastVisitAt).toBe(new Date('2026-11-01T12:00:00Z').getTime());
    expect(c!.byBarber).toEqual([{ barberId: 'roberth', visits: 2 }, { barberId: 'igor', visits: 3 }]);
  });

  it('keeps different clients apart and handles clients who never came', () => {
    const out = mergeClients([row({ clientId: 'a', visits: 0 }), row({ clientId: 'b' })]);
    expect(out.map((c) => c.clientId)).toEqual(['a', 'b']);
    expect(out[0]!.lastVisitAt).toBeNull();
  });
});
