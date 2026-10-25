import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { DEFAULT_TEMPLATE } from '../../shared/defaults';
import { createBarberSchema, setUserRoleSchema } from '../../shared/schemas';
import type { Role } from '../../shared/types';
import { OCCUPYING, recomputeAvailability } from './availability';
import { FieldValue, IS_EMULATOR, REGION, auth, db } from './lib/admin';
import { callable, fail } from './lib/callable';
import { notify } from './notify';

function primaryRole(roles: Role[]): Role {
  return roles.includes('admin') ? 'admin' : roles.includes('barber') ? 'barber' : 'client';
}

/** Admin only. Roles live in the `roles` custom claim; users/{uid}.role mirrors it for the UI. */
export const setUserRole = callable(
  setUserRoleSchema,
  async ({ uid, roles }, caller) => {
    if (uid === caller.uid && !roles.includes('admin')) {
      fail('failed-precondition', 'self-demote', 'Você não pode remover seu próprio acesso de administrador.');
    }
    const user = await auth.getUser(uid);
    await auth.setCustomUserClaims(uid, { ...(user.customClaims ?? {}), roles });
    await db.doc(`users/${uid}`).set({ role: primaryRole(roles), roles }, { merge: true });
    return { ok: true };
  },
  { roles: ['admin'] },
);

/** Creates the barber's account (no self sign-up) and e-mails a link to set the password. */
export const createBarber = callable(
  createBarberSchema,
  async (input) => {
    let user;
    try {
      user = await auth.getUserByEmail(input.email);
    } catch {
      user = await auth.createUser({ email: input.email, displayName: input.displayName, emailVerified: false });
    }
    const roles = new Set<Role>((user.customClaims?.roles as Role[] | undefined) ?? []);
    roles.add('barber');
    await auth.setCustomUserClaims(user.uid, { ...(user.customClaims ?? {}), roles: [...roles] });
    const count = (await db.collection('barbers').count().get()).data().count;
    await db.doc(`barbers/${user.uid}`).set(
      {
        uid: user.uid,
        displayName: input.displayName,
        bio: input.bio,
        photoUrl: null,
        specialties: input.specialties,
        serviceIds: input.serviceIds,
        active: true,
        order: count + 1,
        weeklyTemplate: DEFAULT_TEMPLATE,
        slotIntervalMin: 30,
        bufferMin: 0,
      },
      { merge: true },
    );
    await db.doc(`users/${user.uid}`).set(
      { name: input.displayName, email: input.email, phone: '', role: primaryRole([...roles]), roles: [...roles], createdAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    const link = await auth.generatePasswordResetLink(input.email);
    await notify({
      uid: user.uid,
      email: input.email,
      title: 'Bem-vindo à equipe Classe A',
      body: `Sua conta de barbeiro foi criada. Defina sua senha neste link: ${link}`,
      link: '/barbeiro/login',
    });
    return { uid: user.uid, inviteLink: IS_EMULATOR ? link : null };
  },
  { roles: ['admin'] },
);

/** Keeps the barber's client book (visits, last visit, favourites, no-shows) in sync. */
export async function refreshBarberClient(barberId: string, clientId: string): Promise<void> {
  if (clientId.startsWith('removed:')) return;
  const snap = await db.collection('appointments').where('barberId', '==', barberId).where('clientId', '==', clientId).get();
  if (snap.empty) return;
  let visits = 0;
  let noShows = 0;
  let lastVisitAt: FirebaseFirestore.Timestamp | null = null;
  const counts: Record<string, number> = {};
  let name = '';
  let phone = '';
  let latest = 0;
  for (const d of snap.docs) {
    const a = d.data();
    const t = a.startAt?.toMillis?.() ?? 0;
    if (t >= latest) {
      latest = t;
      name = a.clientName;
      phone = a.clientPhone;
    }
    if (a.status === 'completed') {
      visits++;
      if (!lastVisitAt || t > lastVisitAt.toMillis()) lastVisitAt = a.startAt;
    }
    if (a.status === 'no_show') noShows++;
    if (OCCUPYING.includes(a.status)) for (const s of a.services ?? []) counts[s.name] = (counts[s.name] ?? 0) + 1;
  }
  const plan = await db.collection('subscriptions').where('clientId', '==', clientId).where('status', '==', 'active').limit(1).get();
  const favoriteServices = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([n]) => n);
  const ref = db.doc(`barberClients/${barberId}/clients/${clientId}`);
  const existing = await ref.get();
  await ref.set(
    {
      clientId,
      name,
      phone,
      visits,
      noShows,
      lastVisitAt,
      favoriteServices,
      serviceCounts: counts,
      hasActivePlan: !plan.empty,
      updatedAt: FieldValue.serverTimestamp(),
      ...(existing.exists ? {} : { privateNotes: '', firstSeenAt: FieldValue.serverTimestamp() }),
    },
    { merge: true },
  );
}

export const onAppointmentWrite = onDocumentWritten({ document: 'appointments/{id}', region: REGION }, async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  const days = new Set<string>();
  for (const a of [before, after]) if (a) days.add(`${a.barberId}|${a.date}`);
  await Promise.all(
    [...days].map((k) => {
      const [barberId, date] = k.split('|');
      return recomputeAvailability(barberId!, date!);
    }),
  );
  const a = after ?? before;
  if (a && (!before || !after || before.status !== after.status || before.clientName !== after.clientName)) {
    await refreshBarberClient(a.barberId, a.clientId);
  }
});
