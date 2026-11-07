import { addMonths } from 'date-fns';
import { logger } from 'firebase-functions/v2';
import { PERIOD_MONTHS } from '../../../shared/defaults';
import { cancelSubscriptionSchema, changePlanSchema, setAutoRenewSchema, subscribePlanSchema } from '../../../shared/schemas';
import { cycleKey, shopNow } from '../../../shared/time';
import type { Plan, Subscription } from '../../../shared/types';
import { FieldValue, Timestamp, db } from '../lib/admin';
import { callable, fail } from '../lib/callable';
import { findActiveSubscription } from '../lib/data';
import { notifyUser } from '../notify';
import type { GatewaySubscription } from './gateway';
import { getPlan } from './plans';
import { FREQUENCY_MONTHS, mapPreapprovalStatus } from './mpStatus';
import { GATEWAY_SECRETS, PROVIDER, gateway } from './provider';

const WITHDRAWAL_DAYS = 7;
/** Mercado Pago retries a declined installment for up to 10 days; the mock scheduler gives 3. */
const GRACE_DAYS = { mock: 3, mercadopago: 10 } as const;
const SECRETS = { secrets: GATEWAY_SECRETS };

export const subscribePlan = callable(subscribePlanSchema, async (input, caller) => {
  const plan = await getPlan(input.planId);
  const existing = await findActiveSubscription(caller.uid);
  if (existing) fail('already-exists', 'has-plan', 'Você já tem um plano. Para mudar, use "Trocar de plano".');

  const subRef = db.collection('subscriptions').doc();
  let paymentId: string | null;
  let gatewayRef: string | null = null;
  if (input.method === 'card_mock' && PROVIDER === 'mercadopago') {
    // Mercado Pago charges every installment itself; the webhook records each payment.
    gatewayRef = await startGatewaySubscription(subRef.id, plan, input.cardToken, caller.email);
    paymentId = null;
  } else if (input.method === 'card_mock') {
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
    paymentMethodId: input.method === 'card_mock' && !gatewayRef ? (input.paymentMethodId ?? null) : null,
    pendingPlanId: null,
    cutsPerMonth: plan.cutsPerMonth,
    usage: { cycle: cycleKey(shopNow().date), cutsUsed: 0 },
    cancelledAt: null,
  };
  await subRef.set({
    ...sub,
    lastPaymentId: paymentId,
    gatewayRef,
    startedAt: Timestamp.fromDate(now),
    currentPeriodStart: Timestamp.fromDate(now),
    currentPeriodEnd: Timestamp.fromDate(end),
    createdAt: FieldValue.serverTimestamp(),
  });
  void notifyUser(caller.uid, `Plano ${plan.name} ativo`, 'Seu plano já está valendo. Agende seu próximo corte quando quiser.', '/cliente/planos');
  return { id: subRef.id };
}, SECRETS);

/**
 * Creates the Mercado Pago subscription (card validated by Mercado Pago with a small test charge;
 * the first installment follows within about an hour). The plan is active from now; if that first
 * installment fails, the webhook flags the subscription as past_due.
 */
async function startGatewaySubscription(
  subscriptionId: string,
  plan: Plan,
  cardToken: string | null | undefined,
  email: string | undefined,
): Promise<string> {
  if (!cardToken) fail('failed-precondition', 'no-card', 'Informe os dados do cartão para assinar.');
  if (!email) fail('failed-precondition', 'no-email', 'Sua conta precisa de um e-mail para assinar um plano.');
  const declined = 'O Mercado Pago não aprovou este cartão. Confira os dados ou use outro cartão.';
  let created: GatewaySubscription;
  try {
    created = await gateway.createSubscription({
      externalReference: subscriptionId,
      reason: `Classe A - Plano ${plan.name}`,
      payerEmail: email,
      cardToken,
      amountCents: plan.priceCents,
      frequencyMonths: FREQUENCY_MONTHS[plan.period],
    });
  } catch (e) {
    logger.warn('mp subscription refused', { subscriptionId, error: e instanceof Error ? e.message : String(e) });
    fail('failed-precondition', 'card-declined', declined);
  }
  if (mapPreapprovalStatus(created.status) !== 'active') {
    // Not authorized (e.g. pending): do not leave a half-created charge behind.
    await gateway.updateSubscription(created.gatewayRef, { cancel: true }).catch(() => undefined);
    fail('failed-precondition', 'card-declined', declined);
  }
  return created.gatewayRef;
}

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
  if (sub.gatewayRef) {
    // Mercado Pago can change the amount of the next installments, not the billing frequency.
    if (FREQUENCY_MONTHS[plan.period] !== FREQUENCY_MONTHS[sub.period]) {
      fail('failed-precondition', 'period-change', 'Para trocar entre mensal, semestral e anual, desligue a renovação e assine o novo plano ao fim do período.');
    }
    await gateway.updateSubscription(sub.gatewayRef, { amountCents: plan.priceCents });
  }
  await db.doc(`subscriptions/${sub.id}`).update({ pendingPlanId: plan.id === sub.planId ? null : plan.id });
  return { effectiveAt: sub.currentPeriodEnd.toDate().toISOString() };
}, SECRETS);

export const setAutoRenew = callable(setAutoRenewSchema, async ({ subscriptionId, autoRenew }, caller) => {
  const { ref, sub } = await ownSubscription(subscriptionId, caller.uid);
  if (sub.gatewayRef) {
    if (autoRenew && !sub.autoRenew) {
      // A cancelled Mercado Pago subscription cannot be resumed without the card again.
      fail('failed-precondition', 'needs-card', 'Para religar a renovação, assine o plano de novo quando este período terminar.');
    }
    if (!autoRenew && sub.autoRenew) await gateway.updateSubscription(sub.gatewayRef, { cancel: true });
    await ref.update({ autoRenew });
    return { ok: true };
  }
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
}, SECRETS);

/**
 * Within 7 days of an online purchase (CDC art. 49) the subscription is cancelled and refunded.
 * After that, cancelling turns renewal off and access continues until the end of the period.
 */
export const cancelSubscription = callable(cancelSubscriptionSchema, async ({ subscriptionId }, caller) => {
  const { ref, sub } = await ownSubscription(subscriptionId, caller.uid);
  if (sub.status !== 'active' && sub.status !== 'past_due') fail('failed-precondition', 'not-active', 'Esta assinatura já foi encerrada.');
  const withinWithdrawal = Date.now() - sub.startedAt.toMillis() <= WITHDRAWAL_DAYS * 86_400_000;
  // Stop future Mercado Pago charges in both cases, and record it at once: if the refund below fails,
  // a retry must not ask Mercado Pago to cancel an already cancelled subscription.
  if (sub.gatewayRef && sub.autoRenew) {
    await gateway.updateSubscription(sub.gatewayRef, { cancel: true });
    await ref.update({ autoRenew: false });
  }
  if (withinWithdrawal) {
    const lastPaymentId = sub.lastPaymentId;
    if (lastPaymentId) {
      const pay = await db.doc(`payments/${lastPaymentId}`).get();
      if (pay.get('status') === 'approved') {
        await gateway.refund({ gatewayRef: pay.get('gatewayRef'), amountCents: pay.get('amountCents'), idempotencyKey: `refund-${pay.id}` });
        await pay.ref.update({ status: 'refunded' });
      }
    }
    await ref.update({ status: 'cancelled', autoRenew: false, cancelledAt: FieldValue.serverTimestamp() });
    return { mode: 'refunded' as const };
  }
  await ref.update({ autoRenew: false });
  return { mode: 'end_of_period' as const, endsAt: sub.currentPeriodEnd.toDate().toISOString() };
}, SECRETS);

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
    const grace = GRACE_DAYS[sub.gatewayRef ? 'mercadopago' : 'mock'];
    const graceOver = now.getTime() - sub.currentPeriodEnd.toMillis() > grace * 86_400_000;
    if (!sub.autoRenew || (sub.status === 'past_due' && graceOver)) {
      if (sub.gatewayRef && sub.autoRenew) {
        await gateway.updateSubscription(sub.gatewayRef, { cancel: true }).catch(() => undefined);
      }
      await doc.ref.update({ status: 'expired', autoRenew: false });
      stats.expired++;
      continue;
    }
    if (sub.gatewayRef) {
      // Mercado Pago charges the renewal and the webhook extends the period. Until it arrives the
      // plan is past due; a subscription cancelled there (lost webhook) is caught here.
      const remote = await gateway.getSubscription(sub.gatewayRef).catch(() => null);
      if (remote && mapPreapprovalStatus(remote.status) === 'cancelled') {
        await doc.ref.update({ status: 'expired', autoRenew: false });
        stats.expired++;
      } else if (sub.status === 'active') {
        await doc.ref.update({ status: 'past_due' });
        stats.pastDue++;
      }
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
