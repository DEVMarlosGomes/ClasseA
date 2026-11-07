import { defineSecret } from 'firebase-functions/params';

/**
 * InfinitePay Checkout Integrado (one-off PIX and card). Docs: https://www.infinitepay.io/checkout-documentacao
 * (read 2026-11-07). The client pays on InfinitePay's page and comes back via redirect_url.
 *
 * - No webhook signature: every notice is confirmed with /payment_check before anything changes.
 * - No refund API: refunds are done by hand in the InfinitePay app (we flag "refund_pending").
 * - No sandbox: the first real test is a R$ 1,00 purchase, refunded in the app.
 *
 * Enable with ONLINE_PAYMENTS=infinitepay and INFINITEPAY_HANDLE=<InfiniteTag without $> in
 * functions/.env.<project>, plus the INFINITEPAY_API_KEY secret (inchk_..., needed for valid_until).
 */
export const ONLINE_ENABLED = process.env.ONLINE_PAYMENTS === 'infinitepay';
// Declared only when enabled: defineSecret() alone makes the deploy demand the secret.
const INFINITEPAY_API_KEY = ONLINE_ENABLED ? defineSecret('INFINITEPAY_API_KEY') : null;
export const ONLINE_SECRETS = INFINITEPAY_API_KEY ? [INFINITEPAY_API_KEY] : [];
const apiKey = () => {
  if (!INFINITEPAY_API_KEY) throw new Error('InfinitePay is off (ONLINE_PAYMENTS is not "infinitepay").');
  return INFINITEPAY_API_KEY.value();
};

const BASE = 'https://api.checkout.infinitepay.io';
const TIMEOUT_MS = 10_000;

const handle = () => {
  const h = process.env.INFINITEPAY_HANDLE?.replace(/^\$/, '').trim();
  if (!h) throw new Error('INFINITEPAY_HANDLE is not set.');
  return h;
};

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Api-Key': apiKey() },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`InfinitePay ${path} ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text) as T;
}

export interface CheckoutItem {
  description: string;
  quantity: number;
  /** Cents (R$ 10,00 = 1000); InfinitePay minimum is R$ 1,00. */
  price: number;
}

/** Creates a single-use checkout link that stops accepting payments at `validUntil`. Returns its URL. */
export async function createCheckoutLink(input: {
  orderNsu: string;
  items: CheckoutItem[];
  redirectUrl: string;
  webhookUrl?: string;
  validUntil: Date;
  customer?: { name?: string; email?: string; phone_number?: string };
}): Promise<string> {
  const res = await post<{ url?: string }>('/links', {
    handle: handle(),
    order_nsu: input.orderNsu,
    items: input.items,
    redirect_url: input.redirectUrl,
    ...(input.webhookUrl ? { webhook_url: input.webhookUrl } : {}),
    ...(input.customer ? { customer: input.customer } : {}),
    options: { single_payment: true, valid_until: input.validUntil.toISOString() },
  });
  if (!res.url) throw new Error('InfinitePay did not return a checkout URL.');
  return res.url;
}

export interface PaymentCheck {
  success: boolean;
  paid: boolean;
  /** Original charge, cents. */
  amount: number;
  /** What the client actually paid (may be higher with installment interest passed on). */
  paidAmount: number;
  installments: number;
  captureMethod: string;
}

/** The only trustworthy confirmation: InfinitePay's own answer for this order/transaction/slug. */
export async function checkPayment(input: { orderNsu: string; transactionNsu: string; slug: string }): Promise<PaymentCheck> {
  const r = await post<{
    success?: boolean;
    paid?: boolean;
    amount?: number;
    paid_amount?: number;
    installments?: number;
    capture_method?: string;
  }>('/payment_check', { handle: handle(), order_nsu: input.orderNsu, transaction_nsu: input.transactionNsu, slug: input.slug });
  return {
    success: r.success === true,
    paid: r.paid === true,
    amount: Number(r.amount ?? 0),
    paidAmount: Number(r.paid_amount ?? 0),
    installments: Number(r.installments ?? 1),
    captureMethod: String(r.capture_method ?? ''),
  };
}

/** Decides what a payment check means for an appointment that expects `expectedCents`. Pure (unit-tested). */
export function judgeCheck(check: PaymentCheck, expectedCents: number): 'paid' | 'not-paid' | 'amount-mismatch' {
  if (!check.success || !check.paid) return 'not-paid';
  // amount = the original charge; paid_amount may be higher (installment interest), never lower.
  if (check.amount !== expectedCents || check.paidAmount < expectedCents) return 'amount-mismatch';
  return 'paid';
}

export const captureToMethod = (capture: string): 'pix' | 'credit' => (capture === 'pix' ? 'pix' : 'credit');
