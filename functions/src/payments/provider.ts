import { defineSecret } from 'firebase-functions/params';
import { MockPaymentGateway, type PaymentGateway } from './gateway';
import { MercadoPagoGateway } from './mercadopago';

/**
 * Which gateway this deployment uses. Set PAYMENTS_PROVIDER=mercadopago in functions/.env.<project>
 * (read at deploy and at runtime). Anything else, or unset, keeps the mock: nothing real is charged.
 */
export const PROVIDER: 'mock' | 'mercadopago' = process.env.PAYMENTS_PROVIDER === 'mercadopago' ? 'mercadopago' : 'mock';

/**
 * defineSecret() puts the secret in the deploy manifest just by being called, and the deploy then
 * demands it exists. So secrets are declared only when their gateway is on: a mock deployment needs
 * none. Created with `firebase functions:secrets:set MP_ACCESS_TOKEN` / `MP_WEBHOOK_SECRET`.
 */
const MP_ON = PROVIDER === 'mercadopago';
const MP_ACCESS_TOKEN = MP_ON ? defineSecret('MP_ACCESS_TOKEN') : null;
const MP_WEBHOOK_SECRET = MP_ON ? defineSecret('MP_WEBHOOK_SECRET') : null;

const required = (s: ReturnType<typeof defineSecret> | null, name: string) => {
  if (!s) throw new Error(`${name} is only available with PAYMENTS_PROVIDER=mercadopago.`);
  return s.value();
};
export const mpAccessToken = () => required(MP_ACCESS_TOKEN, 'MP_ACCESS_TOKEN');
export const mpWebhookSecret = () => required(MP_WEBHOOK_SECRET, 'MP_WEBHOOK_SECRET');

/**
 * Secrets bound only to the functions that talk to the gateway, and only when it is real, so a mock
 * deployment needs no secret at all.
 */
export const GATEWAY_SECRETS = MP_ACCESS_TOKEN ? [MP_ACCESS_TOKEN] : [];
export const WEBHOOK_SECRETS = MP_ACCESS_TOKEN && MP_WEBHOOK_SECRET ? [MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET] : [];

/** Public URL of the mpWebhook function, sent as notification_url on PIX payments. */
const webhookUrl = () => process.env.MP_WEBHOOK_URL || undefined;

export const gateway: PaymentGateway =
  PROVIDER === 'mercadopago' ? new MercadoPagoGateway(mpAccessToken, webhookUrl) : new MockPaymentGateway();
