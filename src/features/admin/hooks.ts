import type { Appointment, Barber, Payment, Plan, Service, Subscription } from '@shared/types';
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
