import { addMonths } from 'date-fns';
import { logger } from 'firebase-functions/v2';
import { PERIOD_MONTHS } from '../../../shared/defaults';
import type { Plan, Subscription } from '../../../shared/types';
import { FieldValue, Timestamp, db } from '../lib/admin';
import { notifyUser } from '../notify';
import { mapInstallment, mapPaymentStatus, mapPreapprovalStatus } from './mpStatus';
import { gateway } from './provider';

/**
 * Applies gateway state to Firestore. Every handler re-reads the resource from Mercado Pago (never
 * trusts the notification body) and is idempotent: the same notification twice, or out of order,
 * ends in the same state. Payments use the gateway payment id in the document id to dedupe.
 */

/** Marks a PIX charge paid and records the payment, once. Used by the webhook, polling and the mock. */
export async function approvePixCharge(chargeId: string, method: 'pix' | 'pix_mock'): Promise<string | null> {
  const ref = db.doc(`pixCharges/${chargeId}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    if (snap.get('status') === 'approved') return snap.get('paymentId') as string;
    const payRef = db.collection('payments').doc(method === 'pix' ? `mp_${snap.get('gatewayRef')}` : db.collection('payments').doc().id);
    tx.set(payRef, {
      clientId: snap.get('clientId'),
      appointmentId: null,
      subscriptionId: null,
      amountCents: snap.get('amountCents'),
      method,
      status: 'approved',
      description: snap.get('description'),
      gatewayRef: snap.get('gatewayRef'),
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.update(ref, { status: 'approved', paymentId: payRef.id, paidAt: FieldValue.serverTimestamp() });
    return payRef.id;
  });
}

async function subscriptionByGatewayRef(gatewayRef: string) {
  const snap = await db.collection('subscriptions').where('gatewayRef', '==', gatewayRef).limit(1).get();
  const doc = snap.docs[0];
  return doc ? { ref: doc.ref, sub: { id: doc.id, ...(doc.data() as Omit<Subscription, 'id'>) } } : null;
}

/** subscription_preapproval: the subscription itself changed (cancelled or paused at Mercado Pago). */
export async function syncPreapproval(gatewayRef: string): Promise<string> {
  const remote = await gateway.getSubscription(gatewayRef);
  const found = await subscriptionByGatewayRef(gatewayRef);
  if (!found) return 'unknown-subscription';
  const mapped = mapPreapprovalStatus(remote.status);
  const { ref, sub } = found;
  if (mapped === 'cancelled' && sub.autoRenew) {
    // Cancelled at Mercado Pago (by the client, by us, or after 3 failed installments): no more charges,
    // access lasts until the end of the paid period; processSubscriptions then expires it.
    await ref.update({ autoRenew: false });
    return 'renewal-off';
  }
  if (mapped === 'past_due' && sub.status === 'active') {
    await ref.update({ status: 'past_due' });
    return 'past-due';
  }
  return 'no-change';
}

/** subscription_authorized_payment: one installment was charged, declined or is being retried. */
export async function syncInstallment(installmentId: string): Promise<string> {
  const inst = await gateway.getInstallment(installmentId);
  const found = await subscriptionByGatewayRef(inst.subscriptionRef);
  if (!found) return 'unknown-subscription';
  const outcome = mapInstallment(inst.status, inst.paymentStatus ?? undefined);

  if (outcome === 'approved' && inst.paymentId) {
    const payRef = db.doc(`payments/mp_${inst.paymentId}`);
    const result = await db.runTransaction(async (tx) => {
      const [pay, subSnap] = await Promise.all([tx.get(payRef), tx.get(found.ref)]);
      if (pay.exists) return 'duplicate';
      const sub = subSnap.data() as Omit<Subscription, 'id'>;
      // The first installment pays the period that started at sign-up; later ones renew it.
      const first = !sub.lastPaymentId;
      const nextPlanId = !first && sub.pendingPlanId ? sub.pendingPlanId : null;
      const plan = nextPlanId ? ((await tx.get(db.doc(`plans/${nextPlanId}`))).data() as Plan | undefined) : undefined;
      tx.set(payRef, {
        clientId: sub.clientId,
        subscriptionId: found.sub.id,
        appointmentId: null,
        amountCents: inst.amountCents,
        method: 'card',
        status: 'approved',
        description: `${first ? 'Plano' : 'Renovação plano'} ${plan?.name ?? sub.planName}`,
        gatewayRef: inst.paymentId,
        declineReason: null,
        createdAt: FieldValue.serverTimestamp(),
      });
      const renewal = first
        ? {}
        : {
            currentPeriodStart: sub.currentPeriodEnd,
            currentPeriodEnd: Timestamp.fromDate(
              addMonths(sub.currentPeriodEnd.toDate(), PERIOD_MONTHS[plan?.period ?? sub.period]),
            ),
            ...(plan ? { planId: nextPlanId, planName: plan.name, period: plan.period, cutsPerMonth: plan.cutsPerMonth } : {}),
            pendingPlanId: null,
          };
      tx.update(found.ref, { status: 'active', lastPaymentId: payRef.id, ...renewal });
      return first ? 'first-payment' : 'renewed';
    });
    return result;
  }

  if ((outcome === 'retrying' || outcome === 'failed') && found.sub.status === 'active') {
    await found.ref.update({ status: 'past_due' });
    void notifyUser(
      found.sub.clientId,
      'Não conseguimos cobrar seu plano',
      'O Mercado Pago vai tentar de novo nos próximos dias. Se o cartão mudou, atualize-o em Pagamentos.',
      '/cliente/pagamentos',
    );
    return 'past-due';
  }
  return 'no-change';
}

/** payment: only PIX charges are handled here (subscription payments arrive as installments). */
export async function syncPayment(paymentId: string): Promise<string> {
  const p = await gateway.getPayment(paymentId);
  if (!p.externalReference) return 'no-reference';
  const charge = await db.doc(`pixCharges/${p.externalReference}`).get();
  if (!charge.exists || charge.get('gatewayRef') !== p.id) return 'not-a-pix-charge';
  const outcome = mapPaymentStatus(p.status);
  if (outcome === 'approved') {
    // Amount check: a tampered or mismatched payment must not unlock a booking or a plan.
    if (p.amountCents !== charge.get('amountCents')) {
      logger.error('pix amount mismatch', { paymentId, expected: charge.get('amountCents'), got: p.amountCents });
      return 'amount-mismatch';
    }
    await approvePixCharge(charge.id, 'pix');
    return 'approved';
  }
  if (outcome === 'expired' && charge.get('status') === 'pending') {
    await charge.ref.update({ status: 'expired' });
    return 'expired';
  }
  return 'no-change';
}
