import { z } from 'zod';
import { LEGAL_VERSIONS } from '@shared/defaults';
import { brPhoneSchema, deleteMyAccountSchema } from '@shared/schemas';
import type { Role } from '@shared/types';
import { loadAuth } from '../firebase';
import { fail, getRoles, getSettings, kit, primaryRole, recomputeAvailability, userAgent } from './core';
import { handler } from './registry';

const completeProfileSchema = z.object({
  name: z.string().trim().min(3, 'Informe seu nome completo').max(80),
  phone: brPhoneSchema,
  birthDate: z
    .string()
    .optional()
    .refine((v) => !v || /^\d{2}\/\d{2}\/\d{4}$/.test(v), 'Use o formato DD/MM/AAAA'),
  ageDeclaration: z.enum(['adult', 'guardian']),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: 'É preciso aceitar os Termos e a Política de Privacidade' }),
  }),
  marketingOptIn: z.boolean(),
});

async function logConsent(uid: string, type: string, version: string, choices: Record<string, boolean>) {
  const { db, collection, addDoc, serverTimestamp } = await kit();
  await addDoc(collection(db, 'consentLogs'), {
    uid,
    type,
    version,
    choices,
    userAgent: userAgent(),
    createdAt: serverTimestamp(),
  });
}

function toIsoDate(br?: string): string | null {
  if (!br) return null;
  const [d, m, y] = br.split('/');
  return `${y}-${m}-${d}`;
}

/** Creates the profile, records consents and grants the client role (roles/{uid}). */
export const completeProfile = handler(completeProfileSchema, async (input, caller) => {
  const { db, doc, getDoc, setDoc, serverTimestamp } = await kit();
  const { auth } = await loadAuth();
  const settings = await getSettings();
  const versions = settings.currentLegalVersions ?? LEGAL_VERSIONS;
  const ref = doc(db, `users/${caller.uid}`);
  const existing = await getDoc(ref);
  const current = await getRoles(caller.uid);
  const roles = new Set<Role>(current);
  roles.add('client');
  if (!current.includes('client')) await setDoc(doc(db, `roles/${caller.uid}`), { roles: [...roles] });
  await setDoc(
    ref,
    {
      name: input.name,
      email: auth.currentUser?.email ?? caller.email ?? '',
      phone: input.phone,
      birthDate: toIsoDate(input.birthDate),
      ...(existing.exists()
        ? {}
        : { role: primaryRole(roles), roles: [...roles], createdAt: serverTimestamp() }),
      avatarUrl: existing.get('avatarUrl') ?? auth.currentUser?.photoURL ?? null,
      consents: {
        termsVersion: versions.terms,
        privacyVersion: versions.privacy,
        acceptedAt: serverTimestamp(),
        marketingOptIn: input.marketingOptIn,
        marketingAt: input.marketingOptIn ? serverTimestamp() : null,
        ageDeclaration: input.ageDeclaration,
      },
      deletedAt: null,
    },
    { merge: true },
  );
  await Promise.all([
    logConsent(caller.uid, 'terms', versions.terms, { accepted: true }),
    logConsent(caller.uid, 'privacy', versions.privacy, { accepted: true }),
    logConsent(caller.uid, 'marketing', versions.privacy, { optIn: input.marketingOptIn }),
  ]);
  return { ok: true };
});

export const acceptLegalVersions = handler(z.object({}), async (_input, caller) => {
  const { db, doc, updateDoc, serverTimestamp } = await kit();
  const { currentLegalVersions: v } = await getSettings();
  await updateDoc(doc(db, `users/${caller.uid}`), {
    'consents.termsVersion': v.terms,
    'consents.privacyVersion': v.privacy,
    'consents.acceptedAt': serverTimestamp(),
  });
  await Promise.all([
    logConsent(caller.uid, 'terms', v.terms, { accepted: true }),
    logConsent(caller.uid, 'privacy', v.privacy, { accepted: true }),
  ]);
  return { ok: true };
});

export const setMarketingConsent = handler(z.object({ optIn: z.boolean() }), async ({ optIn }, caller) => {
  const { db, doc, updateDoc, serverTimestamp } = await kit();
  const { currentLegalVersions: v } = await getSettings();
  await updateDoc(doc(db, `users/${caller.uid}`), {
    'consents.marketingOptIn': optIn,
    'consents.marketingAt': serverTimestamp(),
  });
  await logConsent(caller.uid, 'marketing', v.privacy, { optIn });
  return { ok: true };
});

function plain(value: unknown): unknown {
  if (value && typeof value === 'object') {
    if ('toDate' in value && typeof (value as { toDate: unknown }).toDate === 'function') {
      return (value as { toDate: () => Date }).toDate().toISOString();
    }
    if (Array.isArray(value)) return value.map(plain);
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]));
  }
  return value;
}

/** LGPD art. 18: full export of the holder's data as JSON. */
export const exportMyData = handler(z.object({}), async (_input, caller) => {
  const { db, doc, collection, query, where, getDoc, getDocs, addDoc, serverTimestamp } = await kit();
  const uid = caller.uid;
  const byClient = (name: string) => getDocs(query(collection(db, name), where('clientId', '==', uid)));
  const [user, cards, appts, subs, pays, consents, requests] = await Promise.all([
    getDoc(doc(db, `users/${uid}`)),
    getDocs(collection(db, `users/${uid}/paymentMethods`)),
    byClient('appointments'),
    byClient('subscriptions'),
    byClient('payments'),
    getDocs(query(collection(db, 'consentLogs'), where('uid', '==', uid))),
    getDocs(query(collection(db, 'dataRequests'), where('uid', '==', uid))),
  ]);
  await addDoc(collection(db, 'dataRequests'), {
    uid,
    type: 'export',
    status: 'done',
    createdAt: serverTimestamp(),
    resolvedAt: serverTimestamp(),
  });
  return plain({
    geradoEm: new Date().toISOString(),
    controlador: 'Classe A Barbearia',
    perfil: user.data() ?? null,
    // The gateway token is an internal reference, not personal data of the holder.
    cartoes: cards.docs.map((d) => {
      const { token: _token, ...rest } = d.data();
      void _token;
      return { id: d.id, ...rest };
    }),
    agendamentos: appts.docs.map((d) => ({ id: d.id, ...d.data() })),
    assinaturas: subs.docs.map((d) => ({ id: d.id, ...d.data() })),
    cobrancas: pays.docs.map((d) => ({ id: d.id, ...d.data() })),
    consentimentos: consents.docs.map((d) => ({ id: d.id, ...d.data() })),
    solicitacoes: requests.docs.map((d) => ({ id: d.id, ...d.data() })),
  });
});

/**
 * Deletes profile, cards, notifications and barber book entries; anonymises appointments and keeps
 * payments (anonymised) for the tax retention period. Finally deletes the Auth user.
 */
export const deleteMyAccount = handler(deleteMyAccountSchema, async (_input, caller) => {
  const {
    db,
    doc,
    collection,
    query,
    where,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    runTransaction,
    deleteField,
    serverTimestamp,
  } = await kit();
  const { auth, deleteUser } = await loadAuth();
  const uid = caller.uid;
  if (caller.roles.includes('barber') || caller.roles.includes('admin')) {
    fail('failed-precondition', 'staff', 'Contas da equipe são removidas pelo administrador.');
  }
  // Auth refuses to delete a user whose sign-in is older than ~5 minutes; check before touching data.
  const lastSignIn = Date.parse(auth.currentUser?.metadata.lastSignInTime ?? '');
  if (!lastSignIn || Date.now() - lastSignIn > 4 * 60_000) {
    fail(
      'failed-precondition',
      'recent-login',
      'Por segurança, saia e entre de novo na sua conta antes de excluí-la.',
    );
  }
  const requestRef = await addDoc(collection(db, 'dataRequests'), {
    uid,
    type: 'delete',
    status: 'open',
    createdAt: serverTimestamp(),
  });
  const byClient = (name: string) => getDocs(query(collection(db, name), where('clientId', '==', uid)));

  // Future bookings are cancelled first so the slots go back to the agenda.
  const appts = await byClient('appointments');
  const touchedDays = new Set<string>();
  const barbers = new Set<string>();
  for (const d of appts.docs) {
    const a = d.data();
    barbers.add(a.barberId);
    if (a.status === 'confirmed') {
      const locks = await getDocs(query(collection(db, 'slotLocks'), where('appointmentId', '==', d.id)));
      await runTransaction(db, async (tx) => {
        locks.docs.forEach((l) => tx.delete(l.ref));
        tx.set(
          doc(db, `dayBusy/${a.barberId}_${a.date}`),
          { busy: { [d.id]: deleteField() } },
          { merge: true },
        );
      });
      touchedDays.add(`${a.barberId}|${a.date}`);
    }
    await updateDoc(d.ref, {
      clientName: 'Cliente removido',
      clientPhone: '',
      notes: null,
      clientId: `removed:${d.id}`,
      ...(a.status === 'confirmed'
        ? { status: 'cancelled_by_client', cancelReason: 'Conta excluída', cancelledAt: serverTimestamp() }
        : {}),
    });
  }

  const subs = await byClient('subscriptions');
  await Promise.all(
    subs.docs.map((s) =>
      updateDoc(s.ref, {
        status: 'cancelled',
        autoRenew: false,
        clientId: `removed:${s.id}`,
        paymentMethodId: null,
      }),
    ),
  );
  const pays = await byClient('payments');
  await Promise.all(pays.docs.map((p) => updateDoc(p.ref, { clientId: `removed:${p.id}` })));
  const pix = await byClient('pixCharges');
  await Promise.all(pix.docs.map((p) => deleteDoc(p.ref)));

  for (const sub of ['paymentMethods', 'notifications']) {
    const docs = await getDocs(collection(db, `users/${uid}/${sub}`));
    await Promise.all(docs.docs.map((d) => deleteDoc(d.ref)));
  }
  await Promise.all(
    [...barbers].map((b) => deleteDoc(doc(db, `barberClients/${b}/clients/${uid}`)).catch(() => undefined)),
  );
  await Promise.all(
    [...touchedDays].map((k) => {
      const [barberId, date] = k.split('|');
      return recomputeAvailability(barberId!, date!);
    }),
  );
  await updateDoc(requestRef, { status: 'done', resolvedAt: serverTimestamp() });
  await deleteDoc(doc(db, `users/${uid}`));
  await deleteDoc(doc(db, `roles/${uid}`));
  if (auth.currentUser) await deleteUser(auth.currentUser);
  return { ok: true };
});
