import type { Appointment, Subscription } from '../../../shared/types';
import { lockSlices } from '../../../shared/slots';
import { FieldValue, db } from './admin';
import { fail } from './callable';

/** Slot locks are 15-minute slices: slotLocks/{barberId}_{date}_{HH:mm}. */
export const LOCK_STEP = 15;

export const lockRefs = (barberId: string, date: string, start: string, durationMin: number) =>
  lockSlices(start, durationMin, LOCK_STEP).map((hhmm) => db.doc(`slotLocks/${barberId}_${date}_${hhmm}`));

/** Cancels inside a transaction: deletes its locks and returns plan usage (all reads before writes). */
export async function cancelInTx(
  id: string,
  check: (a: Appointment) => void,
  patch: Record<string, unknown>,
  refundPlan: (a: Appointment) => boolean,
): Promise<Appointment> {
  let appt!: Appointment;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(db.doc(`appointments/${id}`));
    if (!snap.exists) fail('not-found', 'not-found', 'Agendamento não encontrado.');
    appt = { id: snap.id, ...(snap.data() as Omit<Appointment, 'id'>) };
    check(appt);
    // Gather all lock reads first.
    const refs = lockRefs(appt.barberId, appt.date, appt.start, appt.durationMin + 60);
    const locks = await Promise.all(refs.map((r) => tx.get(r)));
    let sub = null;
    if (refundPlan(appt) && appt.paymentMode === 'plan' && appt.subscriptionId) sub = await tx.get(db.doc(`subscriptions/${appt.subscriptionId}`));
    locks.forEach((l, i) => {
      if (l.exists && l.get('appointmentId') === appt.id) tx.delete(refs[i]!);
    });
    if (sub?.exists) {
      const usage = sub.get('usage') as Subscription['usage'];
      const cycle = (appt as Appointment & { usageCycle?: string }).usageCycle;
      if (usage && usage.cycle === cycle && usage.cutsUsed > 0) tx.update(sub.ref, { 'usage.cutsUsed': usage.cutsUsed - 1 });
    }
    tx.update(snap.ref, { ...patch, cancelledAt: FieldValue.serverTimestamp() });
  });
  return appt;
}
