import { logger } from 'firebase-functions/v2';
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { confirmOnlinePaymentSchema, markRefundedSchema } from '../../../shared/schemas';
import { SHOP_TZ } from '../../../shared/time';
import type { Appointment, UserProfile } from '../../../shared/types';
import { recomputeAvailability } from '../availability';
import { FieldValue, REGION, Timestamp, db } from '../lib/admin';
import { callable, fail } from '../lib/callable';
import { cancelInTx } from '../lib/holds';
import { notifyUser } from '../notify';
import { ONLINE_ENABLED, ONLINE_SECRETS, captureToMethod, checkPayment, createCheckoutLink, judgeCheck } from './infinitepay';

/** How long a slot is held while the client pays on InfinitePay's page. */
export const HOLD_MINUTES = 20;

/** Creates the InfinitePay link for a pending appointment and stores it. Throws if InfinitePay refuses. */
export async function startCheckout(appt: Pick<Appointment, 'id' | 'services' | 'totalCents' | 'clientId'>, holdUntil: Date) {
  const site = process.env.SITE_URL?.replace(/\/$/, '');
  if (!site) throw new Error('SITE_URL is not set.');
  const profile = (await db.doc(`users/${appt.clientId}`).get()).data() as UserProfile | undefined;
  const url = await createCheckoutLink({
    orderNsu: appt.id,
    items: appt.services.map((s) => ({ description: s.name, quantity: 1, price: s.priceCents })),
    redirectUrl: `${site}/agendar/retorno`,
    webhookUrl: process.env.IP_WEBHOOK_URL || undefined,
    validUntil: holdUntil,
    customer: profile ? { name: profile.name, email: profile.email, phone_number: profile.phone } : undefined,
  });
  await db.doc(`appointments/${appt.id}`).update({ checkoutUrl: url });
  return url;
}

type Outcome = 'confirmed' | 'duplicate' | 'refund-pending' | 'not-paid' | 'amount-mismatch' | 'unknown-order';

/**
 * Confirms an online payment with InfinitePay's /payment_check (never trusting the webhook body or the
 * redirect parameters) and applies it once: the payment document id is the InfinitePay transaction.
 * Paid in time → appointment confirmed. Paid after the hold expired or the visit was cancelled → the
 * money is flagged "refund_pending" for the owner to refund in the InfinitePay app.
 */
export async function applyOnlinePayment(input: { orderNsu: string; transactionNsu: string; slug: string }): Promise<Outcome> {
  const apptRef = db.doc(`appointments/${input.orderNsu}`);
  const first = await apptRef.get();
  if (!first.exists) return 'unknown-order';
  const expected = (first.data() as Appointment).totalCents;
  const check = await checkPayment(input);
  const verdict = judgeCheck(check, expected);
  if (verdict === 'not-paid') return 'not-paid';
  if (verdict === 'amount-mismatch') {
    logger.error('infinitepay amount mismatch', { orderNsu: input.orderNsu, expected, amount: check.amount, paid: check.paidAmount });
    return 'amount-mismatch';
  }

  const payRef = db.doc(`payments/ip_${input.transactionNsu}`);
  const outcome = await db.runTransaction(async (tx): Promise<Outcome> => {
    const [pay, snap] = await Promise.all([tx.get(payRef), tx.get(apptRef)]);
    const appt = snap.data() as Appointment;
    // Same transaction seen again (webhook retry + redirect): already applied, no second notice.
    if (pay.exists) return 'duplicate';
    const inTime = appt.status === 'pending_payment';
    const method = captureToMethod(check.captureMethod);
    tx.set(payRef, {
      clientId: appt.clientId,
      appointmentId: snap.id,
      subscriptionId: null,
      amountCents: check.paidAmount,
      method: method === 'pix' ? 'pix' : 'card',
      provider: 'infinitepay',
      status: inTime ? 'approved' : 'refund_pending',
      description: appt.services.map((s) => s.name).join(' + '),
      gatewayRef: input.transactionNsu,
      slug: input.slug,
      installments: check.installments,
      createdAt: FieldValue.serverTimestamp(),
    });
    if (!inTime) return 'refund-pending';
    tx.update(apptRef, {
      status: 'confirmed',
      paymentId: payRef.id,
      onlineMethod: method,
      checkoutUrl: null,
      paymentHoldUntil: null,
    });
    return 'confirmed';
  });

  const appt = first.data() as Appointment;
  if (outcome === 'confirmed') {
    void notifyUser(appt.clientId, 'Pagamento aprovado — agendamento confirmado', `${appt.services.map((s) => s.name).join(' + ')} com ${appt.barberName} em ${appt.date.split('-').reverse().join('/')} às ${appt.start}.`, '/cliente/agendamentos');
  } else if (outcome === 'refund-pending') {
    void notifyUser(appt.clientId, 'Recebemos seu pagamento depois do prazo', 'A reserva do horário já tinha expirado. A barbearia vai estornar o valor; se preferir, agende de novo.', '/cliente/agendamentos');
  }
  return outcome;
}

/** Called by the return page (/agendar/retorno) with InfinitePay's redirect parameters. */
export const confirmOnlinePayment = callable(
  confirmOnlinePaymentSchema,
  async (input, caller) => {
    const snap = await db.doc(`appointments/${input.orderNsu}`).get();
    if (!snap.exists || snap.get('clientId') !== caller.uid) fail('not-found', 'not-found', 'Agendamento não encontrado.');
    const outcome = await applyOnlinePayment(input);
    return { outcome };
  },
  { secrets: ONLINE_SECRETS },
);

/**
 * InfinitePay webhook (set per link as webhook_url). Unsigned by design, so it only triggers the same
 * /payment_check confirmation. 200 for anything handled; 500 lets InfinitePay retry on our errors.
 */
export const ipWebhook = onRequest(
  { region: REGION, secrets: ONLINE_SECRETS, memory: '256MiB', timeoutSeconds: 30, maxInstances: 5 },
  async (req, res) => {
    if (!ONLINE_ENABLED) {
      res.status(404).end();
      return;
    }
    if (req.method !== 'POST') {
      res.status(405).end();
      return;
    }
    const b = (req.body ?? {}) as { order_nsu?: unknown; transaction_nsu?: unknown; invoice_slug?: unknown };
    const parsed = confirmOnlinePaymentSchema.safeParse({ orderNsu: b.order_nsu, transactionNsu: b.transaction_nsu, slug: b.invoice_slug });
    if (!parsed.success) {
      res.status(400).end();
      return;
    }
    try {
      const outcome = await applyOnlinePayment(parsed.data);
      logger.info('infinitepay webhook', { orderNsu: parsed.data.orderNsu, outcome });
      await db.collection('webhookEvents').add({ provider: 'infinitepay', type: 'payment', dataId: parsed.data.orderNsu, result: outcome, receivedAt: FieldValue.serverTimestamp() });
      res.status(200).send('ok');
    } catch (e) {
      logger.error('infinitepay webhook failed', { orderNsu: parsed.data.orderNsu, error: e instanceof Error ? e.message : String(e) });
      res.status(500).end();
    }
  },
);

/** Releases slots whose online payment never came (every 5 minutes). */
export const expireOnlineHolds = onSchedule({ schedule: '*/5 * * * *', timeZone: SHOP_TZ, region: REGION }, async () => {
  // Few documents at a time: filter the deadline in code instead of needing a composite index.
  const pending = await db.collection('appointments').where('status', '==', 'pending_payment').get();
  const now = Date.now();
  for (const d of pending.docs) {
    const until = (d.get('paymentHoldUntil') as Timestamp | null)?.toMillis() ?? 0;
    if (until > now) continue;
    try {
      const appt = await cancelInTx(
        d.id,
        (a) => {
          if (a.status !== 'pending_payment') fail('failed-precondition', 'not-pending', 'Already handled.');
        },
        { status: 'payment_expired', cancelReason: 'Pagamento online não concluído no prazo', checkoutUrl: null },
        () => false,
      );
      await recomputeAvailability(appt.barberId, appt.date);
      void notifyUser(appt.clientId, 'Reserva expirada', 'O pagamento não foi concluído a tempo e o horário foi liberado. Você pode agendar de novo.', '/agendar');
    } catch (e) {
      // A payment confirmed meanwhile wins: the check above fails and the hold stays confirmed.
      logger.info('hold not expired', { id: d.id, reason: e instanceof Error ? e.message : String(e) });
    }
  }
});

/** Owner marks a payment as refunded after doing it in the InfinitePay app (no refund API). */
export const markPaymentRefunded = callable(
  markRefundedSchema,
  async ({ paymentId }, caller) => {
    const ref = db.doc(`payments/${paymentId}`);
    const snap = await ref.get();
    if (!snap.exists) fail('not-found', 'not-found', 'Pagamento não encontrado.');
    if (snap.get('status') !== 'refund_pending') fail('failed-precondition', 'not-pending', 'Este pagamento não está aguardando estorno.');
    await ref.update({ status: 'refunded', refundedAt: FieldValue.serverTimestamp(), refundedBy: caller.uid });
    return { ok: true };
  },
  { roles: ['admin'] },
);

