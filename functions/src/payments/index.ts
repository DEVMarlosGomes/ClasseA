import { z } from 'zod';
import { addPaymentMethodSchema, createPixChargeSchema, pixChargeIdSchema } from '../../../shared/schemas';
import type { Service } from '../../../shared/types';
import { FieldValue, Timestamp, db } from '../lib/admin';
import { callable, fail } from '../lib/callable';
import { findActiveSubscription } from '../lib/data';
import { approvePixCharge } from './mpSync';
import { getPlan } from './plans';
import { GATEWAY_SECRETS, PROVIDER, gateway } from './provider';

const SECRETS = { secrets: GATEWAY_SECRETS };

export const addPaymentMethod = callable(addPaymentMethodSchema, async (input, caller) => {
  const col = db.collection(`users/${caller.uid}/paymentMethods`);
  const existing = await col.get();
  if (existing.size >= 5) fail('failed-precondition', 'too-many-cards', 'Você pode salvar até 5 cartões.');
  // The PAN goes to the gateway only; we store brand, last 4 digits, expiry, holder and the token.
  const card = await gateway.tokenizeCard(input);
  const ref = col.doc();
  const makeDefault = input.makeDefault || existing.empty;
  const batch = db.batch();
  if (makeDefault) existing.docs.forEach((d) => batch.update(d.ref, { isDefault: false }));
  batch.set(ref, {
    brand: card.brand,
    last4: card.last4,
    holderName: input.holderName.toUpperCase(),
    expMonth: input.expMonth,
    expYear: 2000 + input.expYear,
    isDefault: makeDefault,
    token: card.token,
    createdAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();
  return { id: ref.id, brand: card.brand, last4: card.last4 };
});

export const removePaymentMethod = callable(z.object({ id: z.string().min(1) }), async ({ id }, caller) => {
  const ref = db.doc(`users/${caller.uid}/paymentMethods/${id}`);
  const snap = await ref.get();
  if (!snap.exists) fail('not-found', 'not-found', 'Cartão não encontrado.');
  const sub = await findActiveSubscription(caller.uid);
  if (sub?.paymentMethodId === id && sub.autoRenew) {
    fail('failed-precondition', 'card-in-use', 'Este cartão paga a renovação do seu plano. Troque o cartão do plano ou desligue a renovação antes.');
  }
  await ref.delete();
  if (snap.get('isDefault')) {
    const next = await db.collection(`users/${caller.uid}/paymentMethods`).orderBy('createdAt', 'desc').limit(1).get();
    if (next.docs[0]) await next.docs[0].ref.update({ isDefault: true });
  }
  return { ok: true };
});

export const setDefaultPaymentMethod = callable(z.object({ id: z.string().min(1) }), async ({ id }, caller) => {
  const col = db.collection(`users/${caller.uid}/paymentMethods`);
  const all = await col.get();
  if (!all.docs.some((d) => d.id === id)) fail('not-found', 'not-found', 'Cartão não encontrado.');
  const batch = db.batch();
  all.docs.forEach((d) => batch.update(d.ref, { isDefault: d.id === id }));
  await batch.commit();
  return { ok: true };
});


export const createPixCharge = callable(createPixChargeSchema, async (input, caller) => {
  let amountCents: number;
  let description: string;
  if (input.purpose === 'subscription') {
    const plan = await getPlan(input.planId ?? '');
    amountCents = plan.priceCents;
    description = `Plano ${plan.name}`;
  } else {
    const ids = input.serviceIds ?? [];
    if (!ids.length) fail('invalid-argument', 'invalid', 'Escolha ao menos um serviço.');
    const snaps = await db.getAll(...ids.map((id) => db.doc(`services/${id}`)));
    const services = snaps.map((s) => s.data() as Service | undefined);
    if (services.some((s) => !s?.active)) fail('not-found', 'service-unavailable', 'Um dos serviços não está disponível.');
    amountCents = services.reduce((sum, s) => sum + (s?.priceCents ?? 0), 0);
    description = services.map((s) => s!.name).join(' + ');
  }
  const ref = db.collection('pixCharges').doc();
  // external_reference = our charge id: the webhook maps the Mercado Pago payment back to it.
  const pix = await gateway.createPix({ amountCents, description, externalReference: ref.id, payerEmail: caller.email });
  await ref.set({
    clientId: caller.uid,
    purpose: input.purpose,
    planId: input.planId ?? null,
    serviceIds: input.serviceIds ?? null,
    amountCents,
    description,
    payload: pix.payload,
    qrBase64: pix.qrBase64 ?? null,
    gatewayRef: pix.gatewayRef,
    status: 'pending',
    consumed: false,
    paymentId: null,
    expiresAt: Timestamp.fromDate(pix.expiresAt),
    createdAt: FieldValue.serverTimestamp(),
  });
  return { id: ref.id, payload: pix.payload, qrBase64: pix.qrBase64 ?? null, amountCents, expiresAt: pix.expiresAt.toISOString() };
}, SECRETS);

/** Simulates the gateway webhook confirming a PIX payment. Disabled when the gateway is real. */
export const confirmMockPix = callable(pixChargeIdSchema, async ({ chargeId }, caller) => {
  if (PROVIDER !== 'mock') fail('failed-precondition', 'not-available', 'A confirmação do PIX chega automaticamente pelo banco.');
  const snap = await db.doc(`pixCharges/${chargeId}`).get();
  if (!snap.exists || snap.get('clientId') !== caller.uid) fail('not-found', 'not-found', 'Cobrança PIX não encontrada.');
  if (snap.get('status') !== 'approved' && (snap.get('expiresAt') as Timestamp).toMillis() < Date.now()) {
    await snap.ref.update({ status: 'expired' });
    return { status: 'expired', paymentId: null };
  }
  return { status: 'approved', paymentId: await approvePixCharge(chargeId, 'pix_mock') };
});

export const getPixStatus = callable(pixChargeIdSchema, async ({ chargeId }, caller) => {
  const snap = await db.doc(`pixCharges/${chargeId}`).get();
  if (!snap.exists || snap.get('clientId') !== caller.uid) fail('not-found', 'not-found', 'Cobrança PIX não encontrada.');
  const pending = snap.get('status') === 'pending';
  if (pending && PROVIDER === 'mercadopago') {
    // Fallback for a delayed webhook: ask Mercado Pago directly.
    const remote = await gateway.getPixStatus(snap.get('gatewayRef'));
    if (remote === 'approved') {
      await approvePixCharge(chargeId, 'pix');
      return { status: 'approved' };
    }
  }
  const expired = pending && (snap.get('expiresAt') as Timestamp).toMillis() < Date.now();
  return { status: expired ? 'expired' : (snap.get('status') as string) };
}, SECRETS);

export {
  cancelSubscription,
  changePlan,
  processSubscriptions,
  setAutoRenew,
  subscribePlan,
} from './subscriptions';
