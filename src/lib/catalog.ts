import { useQuery } from '@tanstack/react-query';
import type { Barber, Plan, Service, ShopSettings } from '@shared/types';
import { DEFAULT_SETTINGS, PUBLIC_BARBERS, SEED_PLANS, SEED_SERVICES } from '@shared/defaults';
import { loadFirestoreLite } from './firebase';

const STALE = 5 * 60 * 1000;

async function fetchActive<T>(name: string, fallback: T[]): Promise<T[]> {
  try {
    const { db, collection, getDocs, query, where } = await loadFirestoreLite();
    const snap = await getDocs(query(collection(db, name), where('active', '==', true)));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as unknown as T & { order?: number })
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  } catch {
    return fallback;
  }
}

const DEFAULT_SERVICES: Service[] = SEED_SERVICES.map((service) => ({
  ...service,
  id: service.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, ''),
}));
const DEFAULT_PLANS: Plan[] = SEED_PLANS.map((plan) => ({ ...plan }));

export function useServices() {
  return useQuery({
    queryKey: ['services'],
    queryFn: () => fetchActive<Service>('services', DEFAULT_SERVICES),
    staleTime: STALE,
    initialData: DEFAULT_SERVICES,
    initialDataUpdatedAt: 0,
  });
}

export function usePlans() {
  return useQuery({
    queryKey: ['plans'],
    queryFn: () => fetchActive<Plan>('plans', DEFAULT_PLANS),
    staleTime: STALE,
    initialData: DEFAULT_PLANS,
    initialDataUpdatedAt: 0,
  });
}

export function useBarbers() {
  return useQuery({
    queryKey: ['barbers'],
    queryFn: () => fetchActive<Barber>('barbers', PUBLIC_BARBERS),
    staleTime: STALE,
    initialData: PUBLIC_BARBERS,
    initialDataUpdatedAt: 0,
  });
}

export function useShopSettings() {
  return useQuery({
    queryKey: ['settings', 'shop'],
    queryFn: async (): Promise<ShopSettings> => {
      const { db, doc, getDoc } = await loadFirestoreLite();
      const snap = await getDoc(doc(db, 'settings/shop'));
      return { ...DEFAULT_SETTINGS, ...(snap.data() as Partial<ShopSettings> | undefined) };
    },
    staleTime: STALE,
    // Keep the public footer and contact information available when Firebase is
    // temporarily unavailable. `initialDataUpdatedAt: 0` still makes the real
    // settings request run immediately.
    initialData: DEFAULT_SETTINGS,
    initialDataUpdatedAt: 0,
  });
}

export const CATEGORY_LABEL: Record<Service['category'], string> = {
  cabelo: 'Cabelo',
  barba: 'Barba',
  combos: 'Combos',
  acabamentos: 'Acabamentos',
};
