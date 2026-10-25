import { addMonths } from 'date-fns';
import { z } from 'zod';
import { PERIOD_MONTHS } from '../../../shared/defaults';
import {
  addPaymentMethodSchema,
  cancelSubscriptionSchema,
  changePlanSchema,
  createPixChargeSchema,
  pixChargeIdSchema,
  setAutoRenewSchema,
  subscribePlanSchema,
} from '../../../shared/schemas';
import { cycleKey, shopNow } from '../../../shared/time';
import type { Plan, Service, Subscription } from '../../../shared/types';
import { FieldValue, Timestamp, db } from '../lib/admin';
import { callable, fail } from '../lib/callable';
import { findActiveSubscription } from '../lib/data';
import { notifyUser } from '../notify';
import { gateway } from './gateway';

const WITHDRAWAL_DAYS = 7;

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

async function getPlan(planId: string): Promise<Plan> {
  const snap = await db.doc(`plans/${planId}`).get();
  if (!snap.exists || snap.get('active') !== true) fail('not-found', 'plan-not-found', 'Plano não encontrado.');
  return { id: snap.id, ...(snap.data() as Omit<Plan, 'id'>) };
}

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
  const pix = await gateway.createPix({ amountCents, description });
  const ref = db.collection('pixCharges').doc();
  await ref.set({
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
    createdAt: FieldValue.serverTimestamp(),
  });
  return { id: ref.id, payload: pix.payload, amountCents, expiresAt: pix.expiresAt.toISOString() };
});

/** Simulates the gateway webhook confirming a PIX payment. */
export const confirmMockPix = callable(pixChargeIdSchema, async ({ chargeId }, caller) => {
  const ref = db.doc(`pixCharges/${chargeId}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.get('clientId') !== caller.uid) fail('not-found', 'not-found', 'Cobrança PIX não encontrada.');
    if (snap.get('status') === 'approved') return { status: 'approved', paymentId: snap.get('paymentId') as string };
    if ((snap.get('expiresAt') as Timestamp).toMillis() < Date.now()) {
      tx.update(ref, { status: 'expired' });
      return { status: 'expired', paymentId: null };
    }
    const payRef = db.collection('payments').doc();
    tx.set(payRef, {
      clientId: caller.uid,
      appointmentId: null,
      subscriptionId: null,
      amountCents: snap.get('amountCents'),
      method: 'pix_mock',
      status: 'approved',
      description: snap.get('description'),
      gatewayRef: snap.get('gatewayRef'),
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.update(ref, { status: 'approved', paymentId: payRef.id, paidAt: FieldValue.serverTimestamp() });
    return { status: 'approved', paymentId: payRef.id };
  });
});

export const getPixStatus = callable(pixChargeIdSchema, async ({ chargeId }, caller) => {
  const snap = await db.doc(`pixCharges/${chargeId}`).get();
  if (!snap.exists || snap.get('clientId') !== caller.uid) fail('not-found', 'not-found', 'Cobrança PIX não encontrada.');
  const expired = snap.get('status') === 'pending' && (snap.get('expiresAt') as Timestamp).toMillis() < Date.now();
  return { status: expired ? 'expired' : (snap.get('status') as string) };
});

export const subscribePlan = callable(subscribePlanSchema, async (input, caller) => {
  const plan = await getPlan(input.planId);
  const existing = await findActiveSubscription(caller.uid);
  if (existing) fail('already-exists', 'has-plan', 'Você já tem um plano. Para mudar, use "Trocar de plano".');

  const subRef = db.collection('subscriptions').doc();
  let paymentId: string;
  if (input.method === 'card_mock') {
    const pm = input.paymentMethodId ? await db.doc(`users/${caller.uid}/paymentMethods/${input.paymentMethodId}`).get() : null;
    if (!pm?.exists) fail('failed-precondition', 'no-card', 'Escolha um cartão para assinar.');
    const result = await gateway.charge({ token: pm.get('token'), amountCents: plan.priceCents, description: `Plano ${plan.name}` });
    const payRef = db.collection('payments').doc();
    await payRef.set({
      clientId: caller.uid,
      subscriptionId: subRef.id,
      appointmentId: null,
      amountCents: plan.priceCents,
      method: 'card_mock',
      status: result.status,
      description: `Plano ${plan.name}`,
      gatewayRef: result.gatewayRef,
      declineReason: result.status === 'declined' ? result.declineReason : null,
      createdAt: FieldValue.serverTimestamp(),
    });
    if (result.status === 'declined') fail('failed-precondition', result.declineReason, result.message);
    paymentId = payRef.id;
  } else {
    const pixRef = db.doc(`pixCharges/${input.pixChargeId ?? '_'}`);
    const pix = await pixRef.get();
    if (!pix.exists || pix.get('clientId') !== caller.uid || pix.get('purpose') !== 'subscription' || pix.get('planId') !== plan.id) {
      fail('failed-precondition', 'pix-missing', 'Gere o PIX do plano antes de confirmar.');
    }
    if (pix.get('status') !== 'approved') fail('failed-precondition', 'pix-pending', 'O PIX ainda não foi pago.');
    if (pix.get('consumed')) fail('failed-precondition', 'pix-used', 'Este PIX já foi usado.');
    paymentId = pix.get('paymentId');
    await pixRef.update({ consumed: true });
    await db.doc(`payments/${paymentId}`).update({ subscriptionId: subRef.id });
  }

  const now = new Date();
  const end = addMonths(now, PERIOD_MONTHS[plan.period]);
  const sub: Omit<Subscription, 'id' | 'startedAt' | 'currentPeriodStart' | 'currentPeriodEnd'> = {
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
  };
  await subRef.set({
    ...sub,
    lastPaymentId: paymentId,
    startedAt: Timestamp.fromDate(now),
    currentPeriodStart: Timestamp.fromDate(now),
    currentPeriodEnd: Timestamp.fromDate(end),
    createdAt: FieldValue.serverTimestamp(),
  });
  void notifyUser(caller.uid, `Plano ${plan.name} ativo`, 'Seu plano já está valendo. Agende seu próximo corte quando quiser.', '/cliente/planos');
  return { id: subRef.id };
});

async function ownSubscription(id: string, uid: string) {
  const ref = db.doc(`subscriptions/${id}`);
  const snap = await ref.get();
  if (!snap.exists || snap.get('clientId') !== uid) fail('not-found', 'not-found', 'Assinatura não encontrada.');
  return { ref, sub: { id: snap.id, ...(snap.data() as Omit<Subscription, 'id'>) } };
}

export const changePlan = callable(changePlanSchema, async ({ planId }, caller) => {
  const plan = await getPlan(planId);
  const sub = await findActiveSubscription(caller.uid);
  if (!sub) fail('failed-precondition', 'no-plan', 'Você não tem um plano ativo.');
  await db.doc(`subscriptions/${sub.id}`).update({ pendingPlanId: plan.id === sub.planId ? null : plan.id });
  return { effectiveAt: sub.currentPeriodEnd.toDate().toISOString() };
});

export const setAutoRenew = callable(setAutoRenewSchema, async ({ subscriptionId, autoRenew }, caller) => {
  const { ref, sub } = await ownSubscription(subscriptionId, caller.uid);
  if (autoRenew) {
    const pmId = sub.paymentMethodId;
    const pm = pmId ? await db.doc(`users/${caller.uid}/paymentMethods/${pmId}`).get() : null;
    if (!pm?.exists) {
      const def = await db.collection(`users/${caller.uid}/paymentMethods`).where('isDefault', '==', true).limit(1).get();
      if (def.empty) fail('failed-precondition', 'no-card', 'Cadastre um cartão para ligar a renovação automática.');
      await ref.update({ autoRenew: true, paymentMethodId: def.docs[0]!.id });
      return { ok: true };
    }
  }
  await ref.update({ autoRenew });
  return { ok: true };
});

/**
 * Within 7 days of an online purchase (CDC art. 49) the subscription is cancelled and refunded.
 * After that, cancelling turns renewal off and access continues until the end of the period.
 */
export const cancelSubscription = callable(cancelSubscriptionSchema, async ({ subscriptionId }, caller) => {
  const { ref, sub } = await ownSubscription(subscriptionId, caller.uid);
  if (sub.status !== 'active' && sub.status !== 'past_due') fail('failed-precondition', 'not-active', 'Esta assinatura já foi encerrada.');
  const withinWithdrawal = Date.now() - sub.startedAt.toMillis() <= WITHDRAWAL_DAYS * 86_400_000;
  if (withinWithdrawal) {
    const lastPaymentId = (sub as Subscription & { lastPaymentId?: string }).lastPaymentId;
    if (lastPaymentId) {
      const pay = await db.doc(`payments/${lastPaymentId}`).get();
      if (pay.get('status') === 'approved') {
        await gateway.refund({ gatewayRef: pay.get('gatewayRef'), amountCents: pay.get('amountCents') });
        await pay.ref.update({ status: 'refunded' });
      }
    }
    await ref.update({ status: 'cancelled', autoRenew: false, cancelledAt: FieldValue.serverTimestamp() });
    return { mode: 'refunded' as const };
  }
  await ref.update({ autoRenew: false });
  return { mode: 'end_of_period' as const, endsAt: sub.currentPeriodEnd.toDate().toISOString() };
});

/** Renews, flags past_due or expires subscriptions. Called by the daily scheduler. */
export async function processSubscriptions(now = new Date()): Promise<{ renewed: number; pastDue: number; expired: number }> {
  const stats = { renewed: 0, pastDue: 0, expired: 0 };
  const due = await db
    .collection('subscriptions')
    .where('status', 'in', ['active', 'past_due'])
    .where('currentPeriodEnd', '<=', Timestamp.fromDate(now))
    .get();
  for (const doc of due.docs) {
    const sub = { id: doc.id, ...(doc.data() as Omit<Subscription, 'id'>) };
    const graceOver = now.getTime() - sub.currentPeriodEnd.toMillis() > 3 * 86_400_000;
    if (!sub.autoRenew || (sub.status === 'past_due' && graceOver)) {
      await doc.ref.update({ status: 'expired' });
      stats.expired++;
      continue;
    }
    const plan = await getPlan(sub.pendingPlanId ?? sub.planId).catch(() => null);
    const pm = sub.paymentMethodId ? await db.doc(`users/${sub.clientId}/paymentMethods/${sub.paymentMethodId}`).get() : null;
    if (!plan || !pm?.exists) {
      await doc.ref.update({ status: 'past_due' });
      stats.pastDue++;
      continue;
    }
    const result = await gateway.charge({ token: pm.get('token'), amountCents: plan.priceCents, description: `Renovação plano ${plan.name}` });
    const payRef = db.collection('payments').doc();
    await payRef.set({
      clientId: sub.clientId,
      subscriptionId: sub.id,
      appointmentId: null,
      amountCents: plan.priceCents,
      method: 'card_mock',
      status: result.status,
      description: `Renovação plano ${plan.name}`,
      gatewayRef: result.gatewayRef,
      declineReason: result.status === 'declined' ? result.declineReason : null,
      createdAt: FieldValue.serverTimestamp(),
    });
    if (result.status === 'declined') {
      await doc.ref.update({ status: 'past_due' });
      void notifyUser(sub.clientId, 'Não conseguimos renovar seu plano', `${result.message} Atualize o cartão em Pagamentos.`, '/cliente/pagamentos');
      stats.pastDue++;
      continue;
    }
    const start = sub.currentPeriodEnd.toDate();
    await doc.ref.update({
      status: 'active',
      planId: plan.id,
      planName: plan.name,
      period: plan.period,
      cutsPerMonth: plan.cutsPerMonth,
      pendingPlanId: null,
      lastPaymentId: payRef.id,
      currentPeriodStart: Timestamp.fromDate(start),
      currentPeriodEnd: Timestamp.fromDate(addMonths(start, PERIOD_MONTHS[plan.period])),
    });
    stats.renewed++;
  }

  // New calendar month: reset monthly usage on every active subscription.
  const cycle = cycleKey(shopNow(now).date);
  const active = await db.collection('subscriptions').where('status', '==', 'active').get();
  const batch = db.batch();
  active.docs.forEach((d) => {
    if (d.get('usage.cycle') !== cycle) batch.update(d.ref, { usage: { cycle, cutsUsed: 0 } });
  });
  await batch.commit();

  // Renewal reminder 3 days before.
  const in3 = new Date(now.getTime() + 3 * 86_400_000);
  const soon = await db
    .collection('subscriptions')
    .where('status', '==', 'active')
    .where('currentPeriodEnd', '>=', Timestamp.fromDate(new Date(in3.getTime() - 86_400_000)))
    .where('currentPeriodEnd', '<', Timestamp.fromDate(in3))
    .get();
  for (const d of soon.docs) {
    if (d.get('autoRenew')) {
      void notifyUser(d.get('clientId'), 'Seu plano renova em 3 dias', `A renovação do plano ${d.get('planName')} acontece automaticamente no cartão cadastrado.`, '/cliente/planos');
    }
  }
  return stats;
}
