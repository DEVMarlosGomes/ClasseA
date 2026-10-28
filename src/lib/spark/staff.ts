import { deleteApp, initializeApp } from 'firebase/app';
import { DEFAULT_TEMPLATE } from '@shared/defaults';
import { createBarberSchema, setUserRoleSchema } from '@shared/schemas';
import type { Role } from '@shared/types';
import { firebaseConfig } from '../firebase';
import { OCCUPYING, fail, getRoles, kit, notifyUser, primaryRole, randomId } from './core';
import { handler } from './registry';

/** Admin only. Roles live in roles/{uid}; users/{uid}.role mirrors them for the UI. */
const setUserRole = handler(
  setUserRoleSchema,
  async ({ uid, roles }, caller) => {
    if (uid === caller.uid && !roles.includes('admin')) {
      fail(
        'failed-precondition',
        'self-demote',
        'Você não pode remover seu próprio acesso de administrador.',
      );
    }
    const { db, doc, writeBatch } = await kit();
    const batch = writeBatch(db);
    batch.set(doc(db, `roles/${uid}`), { roles });
    batch.set(doc(db, `users/${uid}`), { role: primaryRole(roles), roles }, { merge: true });
    await batch.commit();
    return { ok: true };
  },
  { roles: ['admin'] },
);

/**
 * Creates the barber's account (no self sign-up) and e-mails a link to set the password. Without
 * the Admin SDK the account is created through a throwaway app instance so the admin stays signed in.
 */
const createBarber = handler(
  createBarberSchema,
  async (input) => {
    const auth = await import('firebase/auth');
    const secondary = initializeApp(firebaseConfig, `invite-${Date.now()}`);
    let uid: string;
    try {
      const a = auth.getAuth(secondary);
      a.languageCode = 'pt-BR';
      try {
        const cred = await auth.createUserWithEmailAndPassword(a, input.email, `${randomId('', 24)}!a1`);
        await auth.updateProfile(cred.user, { displayName: input.displayName });
        uid = cred.user.uid;
      } catch (e) {
        if ((e as { code?: string }).code === 'auth/email-already-in-use') {
          fail(
            'already-exists',
            'email-in-use',
            'Já existe uma conta com este e-mail. No ambiente de testes, use outro e-mail para o barbeiro.',
          );
        }
        throw e;
      }
      await auth.sendPasswordResetEmail(a, input.email);
      await auth.signOut(a);
    } finally {
      await deleteApp(secondary);
    }

    const { db, doc, collection, getCountFromServer, writeBatch, serverTimestamp } = await kit();
    const roles = new Set<Role>(await getRoles(uid).catch(() => []));
    roles.add('barber');
    const count = (await getCountFromServer(collection(db, 'barbers'))).data().count;
    const batch = writeBatch(db);
    batch.set(doc(db, `roles/${uid}`), { roles: [...roles] });
    batch.set(
      doc(db, `barbers/${uid}`),
      {
        uid,
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
    batch.set(
      doc(db, `users/${uid}`),
      {
        name: input.displayName,
        email: input.email,
        phone: '',
        role: primaryRole(roles),
        roles: [...roles],
        createdAt: serverTimestamp(),
      },
      { merge: true },
    );
    await batch.commit();
    await notifyUser(
      uid,
      'Bem-vindo à equipe Classe A',
      'Sua conta de barbeiro foi criada. Enviamos um link por e-mail para você definir a senha.',
      '/barbeiro/login',
    );
    return { uid, inviteLink: null };
  },
  { roles: ['admin'] },
);

export const callables = { setUserRole, createBarber };

/**
 * Keeps the barber's client book (visits, last visit, favourites, no-shows) in sync. Runs as whoever
 * changed the appointment, so it only reads what that person may read and never touches privateNotes.
 */
export async function refreshBarberClient(barberId: string, clientId: string): Promise<void> {
  if (clientId.startsWith('removed:')) return;
  try {
    const { db, doc, collection, query, where, limit, getDocs, setDoc, serverTimestamp } = await kit();
    const snap = await getDocs(
      query(
        collection(db, 'appointments'),
        where('barberId', '==', barberId),
        where('clientId', '==', clientId),
      ),
    );
    if (snap.empty) return;
    let visits = 0;
    let noShows = 0;
    let lastVisitAt: unknown = null;
    let lastVisitMs = 0;
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
        if (t > lastVisitMs) {
          lastVisitMs = t;
          lastVisitAt = a.startAt;
        }
      }
      if (a.status === 'no_show') noShows++;
      if (OCCUPYING.includes(a.status))
        for (const s of a.services ?? []) counts[s.name] = (counts[s.name] ?? 0) + 1;
    }
    // Barbers cannot read the client's subscriptions; keep the previous flag in that case.
    const plan = await getDocs(
      query(
        collection(db, 'subscriptions'),
        where('clientId', '==', clientId),
        where('status', '==', 'active'),
        limit(1),
      ),
    ).catch(() => null);
    const favoriteServices = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([n]) => n);
    await setDoc(
      doc(db, `barberClients/${barberId}/clients/${clientId}`),
      {
        clientId,
        name,
        phone,
        visits,
        noShows,
        lastVisitAt,
        favoriteServices,
        serviceCounts: counts,
        ...(plan ? { hasActivePlan: !plan.empty } : {}),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch (e) {
    console.warn('barber client book not refreshed', e);
  }
}
