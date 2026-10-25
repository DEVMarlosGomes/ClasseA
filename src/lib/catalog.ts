import { useQuery } from '@tanstack/react-query';
import type { Barber, Plan, Service, ShopSettings } from '@shared/types';
import { DEFAULT_SETTINGS } from '@shared/defaults';
import { loadFirestore } from './firebase';

const STALE = 5 * 60 * 1000;

async function fetchActive<T>(name: string): Promise<T[]> {
  const { db, collection, getDocs, query, where } = await loadFirestore();
  const snap = await getDocs(query(collection(db, name), where('active', '==', true)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as unknown as T & { order?: number })
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function useServices() {
  return useQuery({ queryKey: ['services'], queryFn: () => fetchActive<Service>('services'), staleTime: STALE });
}

export function usePlans() {
  return useQuery({ queryKey: ['plans'], queryFn: () => fetchActive<Plan>('plans'), staleTime: STALE });
}

export function useBarbers() {
  return useQuery({ queryKey: ['barbers'], queryFn: () => fetchActive<Barber>('barbers'), staleTime: STALE });
}

export function useShopSettings() {
  return useQuery({
    queryKey: ['settings', 'shop'],
    queryFn: async (): Promise<ShopSettings> => {
      const { db, doc, getDoc } = await loadFirestore();
      const snap = await getDoc(doc(db, 'settings/shop'));
      return { ...DEFAULT_SETTINGS, ...(snap.data() as Partial<ShopSettings> | undefined) };
    },
    staleTime: STALE,
    placeholderData: DEFAULT_SETTINGS,
  });
}

export const CATEGORY_LABEL: Record<Service['category'], string> = {
  cabelo: 'Cabelo',
  barba: 'Barba',
  combos: 'Combos',
  acabamentos: 'Acabamentos',
};
