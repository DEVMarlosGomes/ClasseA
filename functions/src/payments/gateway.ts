import { DECLINE_MESSAGES, type MockCardOutcome, detectBrand, mockOutcomeFor, onlyDigits } from '../../../shared/cards';
import type { CardBrand } from '../../../shared/types';
import { randomId } from '../lib/data';

/**
 * Payment gateway boundary. Swapping the mock for Mercado Pago, Pagar.me or Stripe means writing a
 * new implementation of this interface; the front-end and the callables do not change.
 *
 * In a real integration the card is tokenised by the gateway's browser SDK and only the token
 * reaches our servers (PCI-DSS). The mock receives the PAN only to pick a scripted outcome and
 * never stores it.
 */
export interface CardInput {
  number: string;
  holderName: string;
  expMonth: number;
  expYear: number;
}

export interface TokenizedCard {
  token: string;
  brand: CardBrand;
  last4: string;
}

export type ChargeResult =
  | { status: 'approved'; gatewayRef: string }
  | { status: 'declined'; gatewayRef: string; declineReason: Exclude<MockCardOutcome, 'approved'>; message: string };

export interface PixCharge {
  gatewayRef: string;
  payload: string;
  /** PNG/JPEG QR image as base64 when the gateway provides one (Mercado Pago does). */
  qrBase64?: string | null;
  expiresAt: Date;
}

/** Recurring charge kept by the gateway (Mercado Pago preapproval). */
export interface GatewaySubscription {
  gatewayRef: string;
  /** Raw gateway status; map it with mpStatus.mapPreapprovalStatus. */
  status: string;
  externalReference: string | null;
  nextPaymentDate: Date | null;
}

/** One installment of a recurring charge (Mercado Pago authorized payment). */
export interface GatewayInstallment {
  id: string;
  subscriptionRef: string;
  status: string;
  paymentId: string | null;
  paymentStatus: string | null;
  amountCents: number;
}

export interface GatewayPayment {
  id: string;
  status: string;
  amountCents: number;
  externalReference: string | null;
}

export interface PaymentGateway {
  /** "mock" keeps the demo flows (test cards, simulated PIX); "mercadopago" moves real money. */
  readonly provider: 'mock' | 'mercadopago';
  tokenizeCard(card: CardInput): Promise<TokenizedCard>;
  charge(input: { token: string; amountCents: number; description: string }): Promise<ChargeResult>;
  /** Full refund. `idempotencyKey` makes retries safe (Mercado Pago requires it). */
  refund(input: { gatewayRef: string; amountCents: number; idempotencyKey?: string }): Promise<{ status: 'refunded'; gatewayRef: string }>;
  createPix(input: { amountCents: number; description: string; externalReference?: string; payerEmail?: string }): Promise<PixCharge>;
  getPixStatus(gatewayRef: string): Promise<'pending' | 'approved' | 'expired'>;
  createSubscription(input: {
    externalReference: string;
    reason: string;
    payerEmail: string;
    cardToken: string;
    amountCents: number;
    frequencyMonths: number;
  }): Promise<GatewaySubscription>;
  /** Cancel, or change amount/card for the next charges. */
  updateSubscription(gatewayRef: string, change: { cancel?: boolean; amountCents?: number; cardToken?: string }): Promise<GatewaySubscription>;
  getSubscription(gatewayRef: string): Promise<GatewaySubscription>;
  getInstallment(id: string): Promise<GatewayInstallment>;
  getPayment(id: string): Promise<GatewayPayment>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const latency = () => (process.env.MOCK_GATEWAY_FAST === 'true' ? 0 : 800 + Math.floor(Math.random() * 700));

/** CRC16-CCITT used by the BR Code (PIX copia-e-cola) checksum. */
function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
  }
  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}

function emv(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
}

export class MockPaymentGateway implements PaymentGateway {
  readonly provider = 'mock' as const;
  async tokenizeCard(card: CardInput): Promise<TokenizedCard> {
    await sleep(latency());
    const digits = onlyDigits(card.number);
    const outcome = mockOutcomeFor(digits);
    // The outcome is encoded in the fake token so later charges behave like the test card.
    return { token: `mock_tok_${outcome}_${randomId('', 16)}`, brand: detectBrand(digits), last4: digits.slice(-4) };
  }

  async charge(input: { token: string; amountCents: number }): Promise<ChargeResult> {
    await sleep(latency());
    const gatewayRef = randomId('MOCK-');
    const outcome = (/^mock_tok_([a-z_]+?)_[A-Z0-9]+$/.exec(input.token)?.[1] ?? 'approved') as MockCardOutcome;
    if (outcome === 'approved') return { status: 'approved', gatewayRef };
    return { status: 'declined', gatewayRef, declineReason: outcome, message: DECLINE_MESSAGES[outcome] };
  }

  async refund(input: { gatewayRef: string }) {
    await sleep(latency() / 2);
    return { status: 'refunded' as const, gatewayRef: input.gatewayRef };
  }

  async createPix(input: { amountCents: number; description: string }): Promise<PixCharge> {
    await sleep(latency() / 2);
    const gatewayRef = randomId('MOCK-PIX-');
    // Fictitious BR Code: structurally valid, but the key and merchant are fake.
    const body =
      emv('00', '01') +
      emv('26', emv('00', 'br.gov.bcb.pix') + emv('01', 'demo@classeabarbearia.invalid')) +
      emv('52', '0000') +
      emv('53', '986') +
      emv('54', (input.amountCents / 100).toFixed(2)) +
      emv('58', 'BR') +
      emv('59', 'CLASSE A DEMO') +
      emv('60', 'SAO PAULO') +
      emv('62', emv('05', gatewayRef.replace(/-/g, '').slice(0, 25))) +
      '6304';
    return { gatewayRef, payload: body + crc16(body), expiresAt: new Date(Date.now() + 10 * 60 * 1000) };
  }

  async getPixStatus(): Promise<'pending'> {
    // The mock never settles by itself: the user taps "Simular pagamento aprovado" (confirmMockPix).
    return 'pending';
  }

  // The mock keeps renewing through processSubscriptions + charge(), so these only echo the input.
  async createSubscription(input: { externalReference: string }): Promise<GatewaySubscription> {
    return { gatewayRef: randomId('MOCK-SUB-'), status: 'authorized', externalReference: input.externalReference, nextPaymentDate: null };
  }

  async updateSubscription(gatewayRef: string, change: { cancel?: boolean }): Promise<GatewaySubscription> {
    return { gatewayRef, status: change.cancel ? 'cancelled' : 'authorized', externalReference: null, nextPaymentDate: null };
  }

  async getSubscription(gatewayRef: string): Promise<GatewaySubscription> {
    return { gatewayRef, status: 'authorized', externalReference: null, nextPaymentDate: null };
  }

  async getInstallment(id: string): Promise<GatewayInstallment> {
    return { id, subscriptionRef: '', status: 'processed', paymentId: null, paymentStatus: null, amountCents: 0 };
  }

  async getPayment(id: string): Promise<GatewayPayment> {
    return { id, status: 'pending', amountCents: 0, externalReference: null };
  }
}
