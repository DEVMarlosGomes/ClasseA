import { defineSecret } from 'firebase-functions/params';
import { MockPaymentGateway, type PaymentGateway } from './gateway';
import { MercadoPagoGateway } from './mercadopago';

/**
 * Which gateway this deployment uses. Set PAYMENTS_PROVIDER=mercadopago in functions/.env.<project>
 * (read at deploy and at runtime). Anything else, or unset, keeps the mock: nothing real is charged.
 */
export const PROVIDER: 'mock' | 'mercadopago' = process.env.PAYMENTS_PROVIDER === 'mercadopago' ? 'mercadopago' : 'mock';

// Created with `firebase functions:secrets:set MP_ACCESS_TOKEN` / `MP_WEBHOOK_SECRET`; never in .env or VITE_*.
export const MP_ACCESS_TOKEN = defineSecret('MP_ACCESS_TOKEN');
export const MP_WEBHOOK_SECRET = defineSecret('MP_WEBHOOK_SECRET');

/**
 * Secrets bound only to the functions that talk to the gateway, and only when it is real, so a mock
 * deployment needs no secret at all.
 */
export const GATEWAY_SECRETS = PROVIDER === 'mercadopago' ? [MP_ACCESS_TOKEN] : [];
export const WEBHOOK_SECRETS = PROVIDER === 'mercadopago' ? [MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET] : [];

/** Public URL of the mpWebhook function, sent as notification_url on PIX payments. */
const webhookUrl = () => process.env.MP_WEBHOOK_URL || undefined;

export const gateway: PaymentGateway =
  PROVIDER === 'mercadopago' ? new MercadoPagoGateway(() => MP_ACCESS_TOKEN.value(), webhookUrl) : new MockPaymentGateway();
