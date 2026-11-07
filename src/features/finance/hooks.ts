import type { Appointment, Commission, FinanceSettings, Payment, Payout } from '@shared/types';
import { useLiveDoc, useLiveQuery } from '@/hooks/useFirestore';

/** A barber's own commissions in one biweekly period (rules allow only his own). */
export function useMyCommissions(uid: string | undefined, period: string) {
  return useLiveQuery<Commission>(uid ? `my-comm:${uid}:${period}` : null, ({ db, collection, query, where }) =>
    query(collection(db, 'commissions'), where('barberId', '==', uid), where('period', '==', period)),
  );
}

export function useMyPayout(uid: string | undefined, period: string) {
  return useLiveDoc<Payout>(uid ? `payouts/${uid}_${period}` : null);
}

// ---------- owner only ----------

export function useCommissionsByPeriod(period: string) {
  return useLiveQuery<Commission>(`comm:${period}`, ({ db, collection, query, where }) =>
    query(collection(db, 'commissions'), where('period', '==', period)),
  );
}

export function usePayoutsByPeriod(period: string) {
  return useLiveQuery<Payout>(`payouts:${period}`, ({ db, collection, query, where }) =>
    query(collection(db, 'payouts'), where('period', '==', period)),
  );
}

export function useFinanceSettingsDoc() {
  return useLiveDoc<Partial<FinanceSettings>>('settings/finance');
}

/** Every appointment of the period (settled or not): revenue, pending "baixas" and no-shows. */
export function useAppointmentsInRange(from: string, to: string) {
  return useLiveQuery<Appointment>(`fin-appts:${from}:${to}`, ({ db, collection, query, where }) =>
    query(collection(db, 'appointments'), where('date', '>=', from), where('date', '<=', to)),
  );
}

/** Online payments created in the period (plans and app payments). */
export function usePaymentsInRange(from: Date, to: Date) {
  return useLiveQuery<Payment>(`fin-pay:${from.toISOString()}:${to.toISOString()}`, ({ db, collection, query, where, Timestamp }) =>
    query(collection(db, 'payments'), where('createdAt', '>=', Timestamp.fromDate(from)), where('createdAt', '<', Timestamp.fromDate(to))),
  );
}
