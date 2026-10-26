import type { Appointment, Barber, BarberDay } from '@shared/types';
import { toast } from '@/components/ui/Toast';
import { useLiveDoc, useLiveQuery } from '@/hooks/useFirestore';
import { errorMessage } from '@/lib/api';
import { loadFirestore } from '@/lib/firebase';

export function useMyBarber(uid: string | undefined) {
  return useLiveDoc<Barber>(uid ? `barbers/${uid}` : null);
}

export function useBarberDays(uid: string | undefined, from: string, to: string) {
  return useLiveQuery<BarberDay & { id: string }>(uid ? `days:${uid}:${from}:${to}` : null, ({ db, collection, query, where, documentId }) =>
    query(collection(db, `barbers/${uid}/days`), where(documentId(), '>=', from), where(documentId(), '<=', to)),
  );
}

/** Live appointments of one barber in a date range (both inclusive). */
export function useBarberAppointments(uid: string | undefined, from: string, to: string) {
  return useLiveQuery<Appointment>(uid ? `bappts:${uid}:${from}:${to}` : null, ({ db, collection, query, where, orderBy }) =>
    query(
      collection(db, 'appointments'),
      where('barberId', '==', uid),
      where('date', '>=', from),
      where('date', '<=', to),
      orderBy('date'),
      orderBy('start'),
    ),
  );
}

async function writeDay(uid: string, date: string, day: BarberDay | null) {
  const { db, doc, setDoc, deleteDoc, serverTimestamp } = await loadFirestore();
  const ref = doc(db, `barbers/${uid}/days/${date}`);
  if (!day) return deleteDoc(ref);
  await setDoc(ref, {
    status: day.status,
    blocks: day.blocks.map((b) => ({ start: b.start, end: b.end, reason: b.reason ?? null })),
    extraOpenings: day.extraOpenings.map((r) => ({ start: r.start, end: r.end })),
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
}

/**
 * Saves one or more day overrides and offers a 5-second "Desfazer" that restores the previous state.
 * Firestore's local cache applies the write instantly, so the grid updates before the server answers.
 */
export async function saveDays(uid: string, changes: { date: string; next: BarberDay; prev: BarberDay | null }[], message: string) {
  try {
    await Promise.all(changes.map((c) => writeDay(uid, c.date, c.next)));
    toast.success(message, {
      duration: 5000,
      action: {
        label: 'Desfazer',
        onClick: () => {
          void Promise.all(changes.map((c) => writeDay(uid, c.date, c.prev))).then(
            () => toast.info('Alteração desfeita.'),
            (e) => toast.error(errorMessage(e)),
          );
        },
      },
    });
  } catch (e) {
    toast.error(errorMessage(e));
  }
}

export function stripDay(d: (BarberDay & { id?: string }) | null | undefined): BarberDay | null {
  if (!d) return null;
  return { status: d.status, blocks: d.blocks ?? [], extraOpenings: d.extraOpenings ?? [] };
}
