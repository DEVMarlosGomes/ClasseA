import type { Plan } from '../../../shared/types';
import { db } from '../lib/admin';
import { fail } from '../lib/callable';

/** Active plan or a friendly not-found error. */
export async function getPlan(planId: string): Promise<Plan> {
  const snap = await db.doc(`plans/${planId}`).get();
  if (!snap.exists || snap.get('active') !== true) fail('not-found', 'plan-not-found', 'Plano não encontrado.');
  return { id: snap.id, ...(snap.data() as Omit<Plan, 'id'>) };
}
