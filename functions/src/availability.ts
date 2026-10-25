import type { Transaction } from 'firebase-admin/firestore';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { computeDayAvailability } from '../../shared/slots';
import type { AppointmentStatus, AvailabilityPublic, Barber, BarberDay } from '../../shared/types';
import { FieldValue, REGION, db } from './lib/admin';

/** Statuses that keep a slot occupied. */
export const OCCUPYING: AppointmentStatus[] = ['confirmed', 'completed', 'no_show'];

export async function dayAppointments(barberId: string, date: string, tx?: Transaction) {
  const q = db
    .collection('appointments')
    .where('barberId', '==', barberId)
    .where('date', '==', date)
    .where('status', 'in', OCCUPYING);
  const snap = tx ? await tx.get(q) : await q.get();
  return snap.docs.map((d) => ({ id: d.id, start: d.get('start') as string, end: d.get('end') as string, ...d.data() }));
}

export async function buildAvailability(
  barber: Barber,
  date: string,
  tx?: Transaction,
): Promise<AvailabilityPublic> {
  const dayRef = db.doc(`barbers/${barber.id}/days/${date}`);
  const daySnap = tx ? await tx.get(dayRef) : await dayRef.get();
  const day = daySnap.exists ? (daySnap.data() as BarberDay) : null;
  const busy = await dayAppointments(barber.id, date, tx);
  return computeDayAvailability(barber, date, day, busy.map((b) => ({ start: b.start, end: b.end })));
}

/** Rebuilds the PII-free public projection for one barber/day. */
export async function recomputeAvailability(barberId: string, date: string): Promise<void> {
  const snap = await db.doc(`barbers/${barberId}`).get();
  if (!snap.exists) return;
  const barber = { id: snap.id, ...(snap.data() as Omit<Barber, 'id'>) };
  const availability = await buildAvailability(barber, date);
  await db.doc(`availabilityPublic/${barberId}_${date}`).set({ ...availability, updatedAt: FieldValue.serverTimestamp() });
}

export const onBarberDayWrite = onDocumentWritten(
  { document: 'barbers/{barberId}/days/{date}', region: REGION },
  async (event) => {
    await recomputeAvailability(event.params.barberId, event.params.date);
  },
);

/** Template or interval changes: refresh every already-materialised future day of that barber. */
export const onBarberWrite = onDocumentWritten({ document: 'barbers/{barberId}', region: REGION }, async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!after) return;
  const relevant = ['weeklyTemplate', 'slotIntervalMin', 'bufferMin'].some(
    (k) => JSON.stringify(before?.[k]) !== JSON.stringify(after[k]),
  );
  if (!relevant) return;
  const today = new Date().toISOString().slice(0, 10);
  const docs = await db
    .collection('availabilityPublic')
    .where('barberId', '==', event.params.barberId)
    .where('date', '>=', today)
    .get();
  await Promise.all(docs.docs.map((d) => recomputeAvailability(event.params.barberId, d.get('date') as string)));
});
