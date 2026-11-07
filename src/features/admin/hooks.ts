import type { Appointment, Barber, BarberClient, Payment, Plan, Service, Subscription, UserProfile } from '@shared/types';
import { useLiveQuery } from '@/hooks/useFirestore';

export function useAdminBarbers() {
  return useLiveQuery<Barber>('admin-barbers', ({ db, collection, orderBy, query }) =>
    query(collection(db, 'barbers'), orderBy('order')),
  );
}

export function useAdminServices() {
  return useLiveQuery<Service>('admin-services', ({ db, collection, orderBy, query }) =>
    query(collection(db, 'services'), orderBy('order')),
  );
}

export function useAdminPlans() {
  return useLiveQuery<Plan>('admin-plans', ({ db, collection, orderBy, query }) =>
    query(collection(db, 'plans'), orderBy('order')),
  );
}

export function useAdminAppointments(date: string) {
  return useLiveQuery<Appointment>(`admin-appointments-${date}`, ({ db, collection, query, where }) =>
    query(collection(db, 'appointments'), where('date', '==', date)),
  );
}

export function useAdminSubscriptions() {
  return useLiveQuery<Subscription>('admin-subscriptions', ({ db, collection, query }) =>
    query(collection(db, 'subscriptions')),
  );
}

export function useAdminPayments() {
  return useLiveQuery<Payment>('admin-payments', ({ db, collection, query }) => query(collection(db, 'payments')));
}

/** One row per (barber, client) pair from every barber's client book. */
export type AdminClientRow = Omit<BarberClient, 'privateNotes'> & { barberId: string };

export function useAdminClients() {
  return useLiveQuery<AdminClientRow>(
    'admin-clients',
    ({ db, collectionGroup, query }) => query(collectionGroup(db, 'clients')),
    (d) => {
      // The barbers' private notes are theirs: the owner's panel never loads them into the UI state.
      const { privateNotes: _notes, ...data } = d.data() as BarberClient;
      void _notes;
      return { ...data, clientId: data.clientId ?? d.id, barberId: d.ref.parent.parent?.id ?? '' };
    },
  );
}

/** Profiles (name, phone) for labelling subscriptions and payments. Admin-only read. */
export function useAdminUsers() {
  return useLiveQuery<Pick<UserProfile, 'name' | 'phone' | 'email'> & { id: string }>(
    'admin-users',
    ({ db, collection, query }) => query(collection(db, 'users')),
  );
}
