import { addMonths } from 'date-fns';
import { z } from 'zod';
import { PERIOD_MONTHS } from '@shared/defaults';
import {
  addPaymentMethodSchema,
  cancelSubscriptionSchema,
  changePlanSchema,
  createPixChargeSchema,
  pixChargeIdSchema,
  setAutoRenewSchema,
  subscribePlanSchema,
} from '@shared/schemas';
import { cycleKey, shopNow } from '@shared/time';
import type { Plan, Service, Subscription } from '@shared/types';
import { fail, findActiveSubscription, gateway, kit, notifyUser } from './core';
import { handler } from './registry';

const WITHDRAWAL_DAYS = 7;

export const addPaymentMethod = handler(addPaymentMethodSchema, async (input, caller) => {
  const { db, doc, collection, getDocs, writeBatch, serverTimestamp } = await kit();
  const col = collection(db, `users/${caller.uid}/paymentMethods`);
  const existing = await getDocs(col);
  if (existing.size >= 5) fail('failed-precondition', 'too-many-cards', 'Você pode salvar até 5 cartões.');
  // The mock never stores the PAN: only brand, last 4 digits, expiry, holder and the fake token.
  const card = await gateway.tokenizeCard(input);
  const ref = doc(col);
  const makeDefault = input.makeDefault || existing.empty;
  const batch = writeBatch(db);
  if (makeDefault) existing.docs.forEach((d) => batch.update(d.ref, { isDefault: false }));
  batch.set(ref, {
    brand: card.brand,
    last4: card.last4,
    holderName: input.holderName.toUpperCase(),
    expMonth: input.expMonth,
    expYear: 2000 + input.expYear,
    isDefault: makeDefault,
    token: card.token,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
  return { id: ref.id, brand: card.brand, last4: card.last4 };
});

export const removePaymentMethod = handler(z.object({ id: z.string().min(1) }), async ({ id }, caller) => {
  const { db, doc, collection, query, orderBy, limit, getDoc, getDocs, deleteDoc, updateDoc } = await kit();
  const ref = doc(db, `users/${caller.uid}/paymentMethods/${id}`);
  const snap = await getDoc(ref);
  if (!snap.exists()) fail('not-found', 'not-found', 'Cartão não encontrado.');
  const sub = await findActiveSubscription(caller.uid);
  if (sub?.paymentMethodId === id && sub.autoRenew) {
    fail(
      'failed-precondition',
      'card-in-use',
      'Este cartão paga a renovação do seu plano. Troque o cartão do plano ou desligue a renovação antes.',
    );
  }
  await deleteDoc(ref);
  if (snap.get('isDefault')) {
    const next = await getDocs(
      query(collection(db, `users/${caller.uid}/paymentMethods`), orderBy('createdAt', 'desc'), limit(1)),
    );
    if (next.docs[0]) await updateDoc(next.docs[0].ref, { isDefault: true });
  }
  return { ok: true };
});

export const setDefaultPaymentMethod = handler(
  z.object({ id: z.string().min(1) }),
  async ({ id }, caller) => {
    const { db, collection, getDocs, writeBatch } = await kit();
    const all = await getDocs(collection(db, `users/${caller.uid}/paymentMethods`));
    if (!all.docs.some((d) => d.id === id)) fail('not-found', 'not-found', 'Cartão não encontrado.');
    const batch = writeBatch(db);
    all.docs.forEach((d) => batch.update(d.ref, { isDefault: d.id === id }));
    await batch.commit();
    return { ok: true };
  },
);

async function getPlan(planId: string): Promise<Plan> {
  const { db, doc, getDoc } = await kit();
  const snap = await getDoc(doc(db, `plans/${planId}`));
  if (!snap.exists() || snap.get('active') !== true)
    fail('not-found', 'plan-not-found', 'Plano não encontrado.');
  return { id: snap.id, ...(snap.data() as Omit<Plan, 'id'>) };
}

export const createPixCharge = handler(createPixChargeSchema, async (input, caller) => {
  const { db, doc, collection, getDoc, setDoc, serverTimestamp, Timestamp } = await kit();
  let amountCents: number;
  let description: string;
  if (input.purpose === 'subscription') {
    const plan = await getPlan(input.planId ?? '');
    amountCents = plan.priceCents;
    description = `Plano ${plan.name}`;
  } else {
    const ids = input.serviceIds ?? [];
    if (!ids.length) fail('invalid-argument', 'invalid', 'Escolha ao menos um serviço.');
    const snaps = await Promise.all(ids.map((id) => getDoc(doc(db, `services/${id}`))));
    const services = snaps.map((s) => s.data() as Service | undefined);
    if (services.some((s) => !s?.active))
      fail('not-found', 'service-unavailable', 'Um dos serviços não está disponível.');
    amountCents = services.reduce((sum, s) => sum + (s?.priceCents ?? 0), 0);
    description = services.map((s) => s!.name).join(' + ');
  }
  const pix = await gateway.createPix({ amountCents, description });
  const ref = doc(collection(db, 'pixCharges'));
  await setDoc(ref, {
    clientId: caller.uid,
    purpose: input.purpose,
    planId: input.planId ?? null,
    serviceIds: input.serviceIds ?? null,
    amountCents,
    description,
    payload: pix.payload,
    gatewayRef: pix.gatewayRef,
    status: 'pending',
    consumed: false,
    paymentId: null,
    expiresAt: Timestamp.fromDate(pix.expiresAt),
    createdAt: serverTimestamp(),
  });
  return { id: ref.id, payload: pix.payload, amountCents, expiresAt: pix.expiresAt.toISOString() };
});

/** Simulates the gateway webhook confirming a PIX payment. */
export const confirmMockPix = handler(pixChargeIdSchema, async ({ chargeId }, caller) => {
  const { db, doc, collection, runTransaction, serverTimestamp } = await kit();
  const ref = doc(db, `pixCharges/${chargeId}`);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists() || snap.get('clientId') !== caller.uid)
      fail('not-found', 'not-found', 'Cobrança PIX não encontrada.');
    if (snap.get('status') === 'approved')
      return { status: 'approved', paymentId: snap.get('paymentId') as string };
    if (snap.get('expiresAt').toMillis() < Date.now()) {
      tx.update(ref, { status: 'expired' });
      return { status: 'expired', paymentId: null };
    }
    const payRef = doc(collection(db, 'payments'));
    tx.set(payRef, {
      clientId: caller.uid,
      appointmentId: null,
      subscriptionId: null,
      amountCents: snap.get('amountCents'),
      method: 'pix_mock',
      status: 'approved',
      description: snap.get('description'),
      gatewayRef: snap.get('gatewayRef'),
      createdAt: serverTimestamp(),
    });
    tx.update(ref, { status: 'approved', paymentId: payRef.id, paidAt: serverTimestamp() });
    return { status: 'approved', paymentId: payRef.id };
  });
});

export const getPixStatus = handler(pixChargeIdSchema, async ({ chargeId }, caller) => {
  const { db, doc, getDoc } = await kit();
  const snap = await getDoc(doc(db, `pixCharges/${chargeId}`));
  if (!snap.exists() || snap.get('clientId') !== caller.uid)
    fail('not-found', 'not-found', 'Cobrança PIX não encontrada.');
  const expired = snap.get('status') === 'pending' && snap.get('expiresAt').toMillis() < Date.now();
  return { status: expired ? 'expired' : (snap.get('status') as string) };
});

export const subscribePlan = handler(subscribePlanSchema, async (input, caller) => {
  const { db, doc, collection, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp } = await kit();
  const plan = await getPlan(input.planId);
  if (await findActiveSubscription(caller.uid))
    fail('already-exists', 'has-plan', 'Você já tem um plano. Para mudar, use "Trocar de plano".');

  const subRef = doc(collection(db, 'subscriptions'));
  let paymentId: string;
  if (input.method === 'card_mock') {
    const pm = input.paymentMethodId
      ? await getDoc(doc(db, `users/${caller.uid}/paymentMethods/${input.paymentMethodId}`))
      : null;
    if (!pm?.exists()) fail('failed-precondition', 'no-card', 'Escolha um cartão para assinar.');
    const result = await gateway.charge({
      token: pm.get('token'),
      amountCents: plan.priceCents,
      description: `Plano ${plan.name}`,
    });
    const payRef = doc(collection(db, 'payments'));
    await setDoc(payRef, {
      clientId: caller.uid,
      subscriptionId: subRef.id,
      appointmentId: null,
      amountCents: plan.priceCents,
      method: 'card_mock',
      status: result.status,
      description: `Plano ${plan.name}`,
      gatewayRef: result.gatewayRef,
      declineReason: result.status === 'declined' ? result.declineReason : null,
      createdAt: serverTimestamp(),
    });
    if (result.status === 'declined') fail('failed-precondition', result.declineReason, result.message);
    paymentId = payRef.id;
  } else {
    const pixRef = doc(db, `pixCharges/${input.pixChargeId ?? '_'}`);
    const pix = await getDoc(pixRef);
    if (
      !pix.exists() ||
      pix.get('clientId') !== caller.uid ||
      pix.get('purpose') !== 'subscription' ||
      pix.get('planId') !== plan.id
    ) {
      fail('failed-precondition', 'pix-missing', 'Gere o PIX do plano antes de confirmar.');
    }
    if (pix.get('status') !== 'approved')
      fail('failed-precondition', 'pix-pending', 'O PIX ainda não foi pago.');
    if (pix.get('consumed')) fail('failed-precondition', 'pix-used', 'Este PIX já foi usado.');
    paymentId = pix.get('paymentId');
    await updateDoc(pixRef, { consumed: true });
    await updateDoc(doc(db, `payments/${paymentId}`), { subscriptionId: subRef.id });
  }

  const now = new Date();
  const end = addMonths(now, PERIOD_MONTHS[plan.period]);
  await setDoc(subRef, {
    clientId: caller.uid,
    planId: plan.id,
    planName: plan.name,
    period: plan.period,
    status: 'active',
    // PIX cannot be charged automatically, so PIX subscriptions start with renewal off.
    autoRenew: input.method === 'card_mock',
    paymentMethodId: input.method === 'card_mock' ? (input.paymentMethodId ?? null) : null,
    pendingPlanId: null,
    cutsPerMonth: plan.cutsPerMonth,
    usage: { cycle: cycleKey(shopNow().date), cutsUsed: 0 },
    cancelledAt: null,
    lastPaymentId: paymentId,
    startedAt: Timestamp.fromDate(now),
    currentPeriodStart: Timestamp.fromDate(now),
    currentPeriodEnd: Timestamp.fromDate(end),
    createdAt: serverTimestamp(),
  });
  void notifyUser(
    caller.uid,
    `Plano ${plan.name} ativo`,
    'Seu plano já está valendo. Agende seu próximo corte quando quiser.',
    '/cliente/planos',
  );
  return { id: subRef.id };
});

async function ownSubscription(id: string, uid: string) {
  const { db, doc, getDoc } = await kit();
  const ref = doc(db, `subscriptions/${id}`);
  const snap = await getDoc(ref);
  if (!snap.exists() || snap.get('clientId') !== uid)
    fail('not-found', 'not-found', 'Assinatura não encontrada.');
  return { ref, sub: { id: snap.id, ...(snap.data() as Omit<Subscription, 'id'>) } };
}

export const changePlan = handler(changePlanSchema, async ({ planId }, caller) => {
  const { db, doc, updateDoc } = await kit();
  const plan = await getPlan(planId);
  const sub = await findActiveSubscription(caller.uid);
  if (!sub) fail('failed-precondition', 'no-plan', 'Você não tem um plano ativo.');
  await updateDoc(doc(db, `subscriptions/${sub.id}`), {
    pendingPlanId: plan.id === sub.planId ? null : plan.id,
  });
  return { effectiveAt: sub.currentPeriodEnd.toDate().toISOString() };
});

export const setAutoRenew = handler(setAutoRenewSchema, async ({ subscriptionId, autoRenew }, caller) => {
  const { db, doc, collection, query, where, limit, getDoc, getDocs, updateDoc } = await kit();
  const { ref, sub } = await ownSubscription(subscriptionId, caller.uid);
  if (autoRenew) {
    const pm = sub.paymentMethodId
      ? await getDoc(doc(db, `users/${caller.uid}/paymentMethods/${sub.paymentMethodId}`))
      : null;
    if (!pm?.exists()) {
      const def = await getDocs(
        query(collection(db, `users/${caller.uid}/paymentMethods`), where('isDefault', '==', true), limit(1)),
      );
      if (def.empty)
        fail('failed-precondition', 'no-card', 'Cadastre um cartão para ligar a renovação automática.');
      await updateDoc(ref, { autoRenew: true, paymentMethodId: def.docs[0]!.id });
      return { ok: true };
    }
  }
  await updateDoc(ref, { autoRenew });
  return { ok: true };
});

/**
 * Within 7 days of an online purchase (CDC art. 49) the subscription is cancelled and refunded.
 * After that, cancelling turns renewal off and access continues until the end of the period.
 */
export const cancelSubscription = handler(cancelSubscriptionSchema, async ({ subscriptionId }, caller) => {
  const { db, doc, getDoc, updateDoc, serverTimestamp } = await kit();
  const { ref, sub } = await ownSubscription(subscriptionId, caller.uid);
  if (sub.status !== 'active' && sub.status !== 'past_due')
    fail('failed-precondition', 'not-active', 'Esta assinatura já foi encerrada.');
  if (Date.now() - sub.startedAt.toMillis() <= WITHDRAWAL_DAYS * 86_400_000) {
    const lastPaymentId = (sub as Subscription & { lastPaymentId?: string }).lastPaymentId;
    if (lastPaymentId) {
      const pay = await getDoc(doc(db, `payments/${lastPaymentId}`));
      if (pay.get('status') === 'approved') {
        await gateway.refund({ gatewayRef: pay.get('gatewayRef'), amountCents: pay.get('amountCents') });
        await updateDoc(pay.ref, { status: 'refunded' });
      }
    }
    await updateDoc(ref, { status: 'cancelled', autoRenew: false, cancelledAt: serverTimestamp() });
    return { mode: 'refunded' as const };
  }
  await updateDoc(ref, { autoRenew: false });
  return { mode: 'end_of_period' as const, endsAt: sub.currentPeriodEnd.toDate().toISOString() };
});
