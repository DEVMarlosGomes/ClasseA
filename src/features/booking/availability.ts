import { useEffect, useMemo, useState } from 'react';
import { computeDayAvailability, generateSlots } from '@shared/slots';
import type { AvailabilityPublic, Barber } from '@shared/types';
import { loadFirestore } from '@/lib/firebase';
import { nextDays, shopNow } from '@/lib/dates';

export const availabilityId = (barberId: string, date: string) => `${barberId}_${date}`;

/** Public availability for a barber/day, falling back to the weekly template when no doc exists yet. */
export function resolveAvailability(
  barber: Barber,
  date: string,
  doc: AvailabilityPublic | undefined | null,
): AvailabilityPublic {
  return doc ?? computeDayAvailability(barber, date, null, []);
}

/** One-shot read of availabilityPublic for several days (chunks of 30 for the `in` operator). */
export async function fetchAvailability(dates: string[]): Promise<Map<string, AvailabilityPublic>> {
  const { db, collection, getDocs, query, where } = await loadFirestore();
  const out = new Map<string, AvailabilityPublic>();
  for (let i = 0; i < dates.length; i += 30) {
    const snap = await getDocs(query(collection(db, 'availabilityPublic'), where('date', 'in', dates.slice(i, i + 30))));
    snap.forEach((d) => out.set(d.id, d.data() as AvailabilityPublic));
  }
  return out;
}

/** Realtime availability for a set of barbers on one day. */
export function useLiveDayAvailability(barbers: Barber[] | undefined, date: string | null) {
  const [docs, setDocs] = useState<Map<string, AvailabilityPublic> | null>(null);
  const ids = barbers?.map((b) => b.id).join(',') ?? '';
  useEffect(() => {
    if (!date || !ids) return;
    setDocs(null);
    let unsub: (() => void) | undefined;
    let cancelled = false;
    void loadFirestore().then(({ db, collection, onSnapshot, query, where }) => {
      if (cancelled) return;
      unsub = onSnapshot(query(collection(db, 'availabilityPublic'), where('date', '==', date)), (snap) => {
        const map = new Map<string, AvailabilityPublic>();
        snap.forEach((d) => map.set(d.id, d.data() as AvailabilityPublic));
        setDocs(map);
      });
    });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [date, ids]);

  return useMemo(() => {
    if (!barbers || !date || !docs) return null;
    return new Map(barbers.map((b) => [b.id, resolveAvailability(b, date, docs.get(availabilityId(b.id, date)))]));
  }, [barbers, date, docs]);
}

export interface FreeSlot {
  date: string;
  start: string;
  barber: Barber;
}

/** Earliest free start across barbers within `days`, for the given duration. */
export function earliestSlot(
  barbers: Barber[],
  dates: string[],
  docs: Map<string, AvailabilityPublic>,
  durationMin: number,
  minAdvanceMin: number,
): FreeSlot | null {
  const now = shopNow();
  for (const date of dates) {
    let best: FreeSlot | null = null;
    for (const barber of barbers) {
      const avail = resolveAvailability(barber, date, docs.get(availabilityId(barber.id, date)));
      const first = generateSlots(avail, { durationMin, now, minAdvanceMin })[0];
      if (first && (!best || first < best.start)) best = { date, start: first, barber };
    }
    if (best) return best;
  }
  return null;
}

export function useNextFreeSlot(
  barbers: Barber[] | undefined,
  durationMin: number,
  minAdvanceMin: number,
  enabled = true,
): { slot: FreeSlot | null; loading: boolean } {
  const [state, setState] = useState<{ slot: FreeSlot | null; loading: boolean }>({ slot: null, loading: true });
  const ids = barbers?.map((b) => b.id).join(',');
  useEffect(() => {
    if (!enabled || !barbers?.length) {
      if (barbers && !barbers.length) setState({ slot: null, loading: false });
      return;
    }
    let cancelled = false;
    const dates = nextDays(14);
    fetchAvailability(dates)
      .then((docs) => {
        if (!cancelled) setState({ slot: earliestSlot(barbers, dates, docs, durationMin, minAdvanceMin), loading: false });
      })
      .catch(() => !cancelled && setState({ slot: null, loading: false }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, durationMin, minAdvanceMin, enabled]);
  return state;
}
