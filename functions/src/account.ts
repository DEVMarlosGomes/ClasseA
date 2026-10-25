import { z } from 'zod';
import { LEGAL_VERSIONS } from '../../shared/defaults';
import { brPhoneSchema, deleteMyAccountSchema } from '../../shared/schemas';
import type { Role } from '../../shared/types';
import { recomputeAvailability } from './availability';
import { FieldValue, auth, db } from './lib/admin';
import { callable, fail } from './lib/callable';
import { getSettings } from './lib/data';

const completeProfileSchema = z.object({
  name: z.string().trim().min(3, 'Informe seu nome completo').max(80),
  phone: brPhoneSchema,
  birthDate: z
    .string()
    .optional()
    .refine((v) => !v || /^\d{2}\/\d{2}\/\d{4}$/.test(v), 'Use o formato DD/MM/AAAA'),
  ageDeclaration: z.enum(['adult', 'guardian']),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'É preciso aceitar os Termos e a Política de Privacidade' }) }),
  marketingOptIn: z.boolean(),
});

async function logConsent(uid: string, type: string, version: string, choices: Record<string, boolean>, ua: string) {
  await db.collection('consentLogs').add({ uid, type, version, choices, userAgent: ua.slice(0, 300), createdAt: FieldValue.serverTimestamp() });
}

function toIsoDate(br?: string): string | null {
  if (!br) return null;
  const [d, m, y] = br.split('/');
  return `${y}-${m}-${d}`;
}

/** Creates the profile, records consents with proof and grants the client role. */
export const completeProfile = callable(completeProfileSchema, async (input, caller, req) => {
  const ua = String(req.rawRequest.headers['user-agent'] ?? '');
  const settings = await getSettings();
  const versions = settings.currentLegalVersions ?? LEGAL_VERSIONS;
  const ref = db.doc(`users/${caller.uid}`);
  const existing = await ref.get();
  const user = await auth.getUser(caller.uid);
  const roles = new Set<Role>((user.customClaims?.roles as Role[] | undefined) ?? []);
  roles.add('client');
  await ref.set(
    {
      name: input.name,
      email: user.email ?? caller.email ?? '',
      phone: input.phone,
      birthDate: toIsoDate(input.birthDate),
      role: roles.has('admin') ? 'admin' : roles.has('barber') ? 'barber' : 'client',
      roles: [...roles],
      avatarUrl: user.photoURL ?? null,
      consents: {
        termsVersion: versions.terms,
        privacyVersion: versions.privacy,
        acceptedAt: FieldValue.serverTimestamp(),
        marketingOptIn: input.marketingOptIn,
        marketingAt: input.marketingOptIn ? FieldValue.serverTimestamp() : null,
        ageDeclaration: input.ageDeclaration,
      },
      ...(existing.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
      deletedAt: null,
    },
    { merge: true },
  );
  await auth.setCustomUserClaims(caller.uid, { ...(user.customClaims ?? {}), roles: [...roles] });
  await Promise.all([
    logConsent(caller.uid, 'terms', versions.terms, { accepted: true }, ua),
    logConsent(caller.uid, 'privacy', versions.privacy, { accepted: true }, ua),
    logConsent(caller.uid, 'marketing', versions.privacy, { optIn: input.marketingOptIn }, ua),
  ]);
  return { ok: true };
});

export const acceptLegalVersions = callable(z.object({}), async (_input, caller, req) => {
  const ua = String(req.rawRequest.headers['user-agent'] ?? '');
  const { currentLegalVersions: v } = await getSettings();
  await db.doc(`users/${caller.uid}`).update({
    'consents.termsVersion': v.terms,
    'consents.privacyVersion': v.privacy,
    'consents.acceptedAt': FieldValue.serverTimestamp(),
  });
  await Promise.all([
    logConsent(caller.uid, 'terms', v.terms, { accepted: true }, ua),
    logConsent(caller.uid, 'privacy', v.privacy, { accepted: true }, ua),
  ]);
  return { ok: true };
});

export const setMarketingConsent = callable(z.object({ optIn: z.boolean() }), async ({ optIn }, caller, req) => {
  const ua = String(req.rawRequest.headers['user-agent'] ?? '');
  const { currentLegalVersions: v } = await getSettings();
  await db.doc(`users/${caller.uid}`).update({
    'consents.marketingOptIn': optIn,
    'consents.marketingAt': FieldValue.serverTimestamp(),
  });
  await logConsent(caller.uid, 'marketing', v.privacy, { optIn }, ua);
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
export const exportMyData = callable(z.object({}), async (_input, caller) => {
  const uid = caller.uid;
  const [user, cards, appts, subs, pays, consents, requests] = await Promise.all([
    db.doc(`users/${uid}`).get(),
    db.collection(`users/${uid}/paymentMethods`).get(),
    db.collection('appointments').where('clientId', '==', uid).get(),
    db.collection('subscriptions').where('clientId', '==', uid).get(),
    db.collection('payments').where('clientId', '==', uid).get(),
    db.collection('consentLogs').where('uid', '==', uid).get(),
    db.collection('dataRequests').where('uid', '==', uid).get(),
  ]);
  await db.collection('dataRequests').add({ uid, type: 'export', status: 'done', createdAt: FieldValue.serverTimestamp(), resolvedAt: FieldValue.serverTimestamp() });
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
 * Deletes profile, cards, notifications and barber notes; anonymises appointments and keeps payments
 * (anonymised) for the 5-year tax retention period.
 */
export const deleteMyAccount = callable(deleteMyAccountSchema, async (_input, caller) => {
  const uid = caller.uid;
  if (caller.roles.includes('barber') || caller.roles.includes('admin')) {
    fail('failed-precondition', 'staff', 'Contas da equipe são removidas pelo administrador.');
  }
  const requestRef = await db.collection('dataRequests').add({ uid, type: 'delete', status: 'open', createdAt: FieldValue.serverTimestamp() });

  // Future bookings are cancelled first so the slots go back to the agenda.
  const appts = await db.collection('appointments').where('clientId', '==', uid).get();
  const touchedDays = new Set<string>();
  for (const d of appts.docs) {
    const a = d.data();
    if (a.status === 'confirmed') {
      const locks = await db.collection('slotLocks').where('appointmentId', '==', d.id).get();
      await Promise.all(locks.docs.map((l) => l.ref.delete()));
      touchedDays.add(`${a.barberId}|${a.date}`);
    }
    await d.ref.update({
      clientName: 'Cliente removido',
      clientPhone: '',
      notes: null,
      clientId: `removed:${d.id}`,
      ...(a.status === 'confirmed' ? { status: 'cancelled_by_client', cancelReason: 'Conta excluída', cancelledAt: FieldValue.serverTimestamp() } : {}),
    });
  }

  const subs = await db.collection('subscriptions').where('clientId', '==', uid).get();
  await Promise.all(subs.docs.map((s) => s.ref.update({ status: 'cancelled', autoRenew: false, clientId: `removed:${s.id}`, paymentMethodId: null })));
  const pays = await db.collection('payments').where('clientId', '==', uid).get();
  await Promise.all(pays.docs.map((p) => p.ref.update({ clientId: `removed:${p.id}` })));
  const pix = await db.collection('pixCharges').where('clientId', '==', uid).get();
  await Promise.all(pix.docs.map((p) => p.ref.delete()));

  for (const sub of ['paymentMethods', 'notifications']) {
    const docs = await db.collection(`users/${uid}/${sub}`).get();
    await Promise.all(docs.docs.map((d) => d.ref.delete()));
  }
  const barbers = await db.collection('barbers').get();
  await Promise.all(barbers.docs.map((b) => db.doc(`barberClients/${b.id}/clients/${uid}`).delete()));
  await db.doc(`users/${uid}`).delete();

  await Promise.all([...touchedDays].map((k) => {
    const [barberId, date] = k.split('|');
    return recomputeAvailability(barberId!, date!);
  }));
  await requestRef.update({ status: 'done', resolvedAt: FieldValue.serverTimestamp() });
  await auth.deleteUser(uid);
  return { ok: true };
});
