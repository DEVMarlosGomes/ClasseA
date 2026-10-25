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
  expiresAt: Date;
}

export interface PaymentGateway {
  tokenizeCard(card: CardInput): Promise<TokenizedCard>;
  charge(input: { token: string; amountCents: number; description: string }): Promise<ChargeResult>;
  refund(input: { gatewayRef: string; amountCents: number }): Promise<{ status: 'refunded'; gatewayRef: string }>;
  createPix(input: { amountCents: number; description: string }): Promise<PixCharge>;
  getPixStatus(gatewayRef: string): Promise<'pending' | 'approved' | 'expired'>;
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
}

export const gateway: PaymentGateway = new MockPaymentGateway();
