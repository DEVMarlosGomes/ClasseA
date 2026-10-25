import type { PaymentMethod, Subscription } from '@shared/types';
import { cycleKey } from '@shared/time';
import { useLiveQuery } from '@/hooks/useFirestore';
import { todayKey } from '@/lib/dates';

/** The signed-in client's current subscription (active or past due), live. */
export function useMySubscription(uid: string | undefined) {
  const q = useLiveQuery<Subscription>(uid ? `sub:${uid}` : null, ({ db, collection, query, where, limit }) =>
    query(collection(db, 'subscriptions'), where('clientId', '==', uid), where('status', 'in', ['active', 'past_due']), limit(1)),
  );
  const sub = q.data?.[0] ?? null;
  return { ...q, sub, usage: sub ? planUsage(sub) : null };
}

export function planUsage(sub: Subscription): { used: number; total: number | null; remaining: number | null } {
  const used = sub.usage?.cycle === cycleKey(todayKey()) ? sub.usage.cutsUsed : 0;
  const total = sub.cutsPerMonth;
  return { used, total, remaining: total == null ? null : Math.max(0, total - used) };
}

export function useMyPaymentMethods(uid: string | undefined) {
  return useLiveQuery<PaymentMethod>(uid ? `pm:${uid}` : null, ({ db, collection, query, orderBy }) =>
    query(collection(db, `users/${uid}/paymentMethods`), orderBy('createdAt', 'desc')),
  );
}
