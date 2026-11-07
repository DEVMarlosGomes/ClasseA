import { logger } from 'firebase-functions/v2';
import { onRequest } from 'firebase-functions/v2/https';
import { InvalidWebhookSignatureError, WebhookSignatureValidator } from 'mercadopago';
import { FieldValue, REGION, db } from '../lib/admin';
import { syncInstallment, syncPayment, syncPreapproval } from './mpSync';
import { MP_WEBHOOK_SECRET, PROVIDER, WEBHOOK_SECRETS } from './provider';

const HANDLERS: Record<string, (id: string) => Promise<string>> = {
  subscription_preapproval: syncPreapproval,
  subscription_authorized_payment: syncInstallment,
  payment: syncPayment,
};

const first = (v: unknown): string | undefined => {
  const raw = Array.isArray(v) ? v[0] : v;
  return typeof raw === 'string' || typeof raw === 'number' ? String(raw) : undefined;
};

/**
 * Mercado Pago notifications. Configure the URL of this function in the Mercado Pago panel
 * ("Suas integrações > Webhooks") with the topics payment, subscription_preapproval and
 * subscription_authorized_payment, and save the generated key as the MP_WEBHOOK_SECRET secret.
 *
 * Security: the x-signature HMAC is checked with the official SDK validator; then the resource is
 * fetched again from the API by id, so a forged body can never change state. Answers 200 only after
 * the state is saved; a 500 makes Mercado Pago retry (every 15 minutes, then backing off).
 */
export const mpWebhook = onRequest(
  { region: REGION, secrets: WEBHOOK_SECRETS, memory: '256MiB', timeoutSeconds: 30, maxInstances: 5 },
  async (req, res) => {
    if (PROVIDER !== 'mercadopago') {
      res.status(404).end();
      return;
    }
    if (req.method !== 'POST') {
      res.status(405).end();
      return;
    }
    const body = (req.body ?? {}) as { type?: string; action?: string; data?: { id?: string | number } };
    // The signature covers data.id from the query string (SDK docs); the body copy is only a fallback.
    const dataId = first(req.query['data.id']) ?? first(body.data?.id);
    const type = body.type ?? first(req.query.type) ?? first(req.query.topic);
    const requestId = req.get('x-request-id') ?? '';

    try {
      WebhookSignatureValidator.validate({
        xSignature: req.get('x-signature'),
        xRequestId: requestId,
        dataId,
        secret: MP_WEBHOOK_SECRET.value(),
      });
    } catch (e) {
      const reason = e instanceof InvalidWebhookSignatureError ? e.reason : 'unknown';
      logger.warn('mp webhook rejected', { reason, requestId, type });
      res.status(401).end();
      return;
    }

    const handler = type ? HANDLERS[type] : undefined;
    if (!handler || !dataId) {
      // Signed but not a topic we use (e.g. plan changes): acknowledge so it is not retried.
      res.status(200).send('ignored');
      return;
    }
    try {
      const result = await handler(dataId);
      logger.info('mp webhook processed', { type, dataId, requestId, result });
      // Audit trail for the owner panel and for support (no personal data, only ids and outcomes).
      await db.collection('webhookEvents').add({
        provider: 'mercadopago',
        type,
        action: body.action ?? null,
        dataId,
        requestId,
        result,
        receivedAt: FieldValue.serverTimestamp(),
      });
      res.status(200).send('ok');
    } catch (e) {
      logger.error('mp webhook failed', { type, dataId, requestId, error: e instanceof Error ? e.message : String(e) });
      res.status(500).end();
    }
  },
);
