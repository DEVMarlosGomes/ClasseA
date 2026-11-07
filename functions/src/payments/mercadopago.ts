import { Invoice, MercadoPagoConfig, Payment, PaymentRefund, PreApproval } from 'mercadopago';
import type {
  CardInput,
  ChargeResult,
  GatewayInstallment,
  GatewayPayment,
  GatewaySubscription,
  PaymentGateway,
  PixCharge,
  TokenizedCard,
} from './gateway';
import { toCents, toReais } from './mpStatus';

const PIX_MINUTES = 30; // Mercado Pago accepts expirations from 30 minutes on.

interface Clients {
  payment: Payment;
  refund: PaymentRefund;
  preapproval: PreApproval;
  invoice: Invoice;
}

/**
 * Real gateway (Mercado Pago, official SDK). Every write sends an idempotency key, so a retried call
 * never charges twice. Card numbers never reach this code: the browser tokenises them with the
 * Mercado Pago SDK (Card Payment Brick) and we only receive a single-use `card_token_id`.
 */
export class MercadoPagoGateway implements PaymentGateway {
  readonly provider = 'mercadopago' as const;
  private clients: Clients | null = null;

  /**
   * @param accessToken read lazily: secrets are only available at request time, not at module load.
   * @param notificationUrl webhook for PIX payments (subscriptions use the URL set in the MP panel).
   */
  constructor(
    private readonly accessToken: () => string,
    private readonly notificationUrl: () => string | undefined,
  ) {}

  private mp(): Clients {
    if (!this.clients) {
      const config = new MercadoPagoConfig({ accessToken: this.accessToken(), options: { timeout: 10_000 } });
      this.clients = {
        payment: new Payment(config),
        refund: new PaymentRefund(config),
        preapproval: new PreApproval(config),
        invoice: new Invoice(config),
      };
    }
    return this.clients;
  }

  async tokenizeCard(_card: CardInput): Promise<TokenizedCard> {
    void _card;
    throw new Error('With Mercado Pago the card is tokenised in the browser; the PAN never reaches the server.');
  }

  async charge(_input: { token: string; amountCents: number; description: string }): Promise<ChargeResult> {
    void _input;
    // One-off card payments for appointments need a fresh token + CVV per charge (front-end, phase 2b).
    throw new Error('Card payments for appointments are not enabled with Mercado Pago yet.');
  }

  async refund(input: { gatewayRef: string; idempotencyKey?: string }) {
    // No amount in the body = full refund (Mercado Pago API reference, create refund).
    await this.mp().refund.create({
      payment_id: input.gatewayRef,
      requestOptions: { idempotencyKey: input.idempotencyKey ?? `refund-${input.gatewayRef}` },
    });
    return { status: 'refunded' as const, gatewayRef: input.gatewayRef };
  }

  async createPix(input: { amountCents: number; description: string; externalReference?: string; payerEmail?: string }): Promise<PixCharge> {
    const expiresAt = new Date(Date.now() + PIX_MINUTES * 60_000);
    const res = await this.mp().payment.create({
      body: {
        transaction_amount: toReais(input.amountCents),
        description: input.description,
        payment_method_id: 'pix',
        payer: { email: input.payerEmail ?? '' },
        external_reference: input.externalReference,
        date_of_expiration: expiresAt.toISOString().replace('Z', '-00:00'),
        notification_url: this.notificationUrl(),
      },
      requestOptions: { idempotencyKey: input.externalReference ? `pix-${input.externalReference}` : undefined },
    });
    const data = res.point_of_interaction?.transaction_data;
    if (!res.id || !data?.qr_code) throw new Error('Mercado Pago did not return a PIX code.');
    return { gatewayRef: String(res.id), payload: data.qr_code, qrBase64: data.qr_code_base64 ?? null, expiresAt };
  }

  async getPixStatus(gatewayRef: string): Promise<'pending' | 'approved' | 'expired'> {
    const p = await this.getPayment(gatewayRef);
    if (p.status === 'approved') return 'approved';
    if (p.status === 'cancelled' || p.status === 'rejected' || p.status === 'expired') return 'expired';
    return 'pending';
  }

  async createSubscription(input: {
    externalReference: string;
    reason: string;
    payerEmail: string;
    cardToken: string;
    amountCents: number;
    frequencyMonths: number;
  }): Promise<GatewaySubscription> {
    const res = await this.mp().preapproval.create({
      body: {
        reason: input.reason,
        external_reference: input.externalReference,
        payer_email: input.payerEmail,
        card_token_id: input.cardToken,
        status: 'authorized',
        auto_recurring: {
          frequency: input.frequencyMonths,
          frequency_type: 'months',
          transaction_amount: toReais(input.amountCents),
          currency_id: 'BRL',
        },
      },
      requestOptions: { idempotencyKey: `sub-${input.externalReference}` },
    });
    return toSubscription(res);
  }

  async updateSubscription(gatewayRef: string, change: { cancel?: boolean; amountCents?: number; cardToken?: string }) {
    const res = await this.mp().preapproval.update({
      id: gatewayRef,
      body: {
        ...(change.cancel ? { status: 'cancelled' } : {}),
        ...(change.amountCents !== undefined
          ? { auto_recurring: { transaction_amount: toReais(change.amountCents), currency_id: 'BRL' } }
          : {}),
        ...(change.cardToken ? { card_token_id: change.cardToken } : {}),
      },
    });
    return toSubscription(res);
  }

  async getSubscription(gatewayRef: string): Promise<GatewaySubscription> {
    return toSubscription(await this.mp().preapproval.get({ id: gatewayRef }));
  }

  async getInstallment(id: string): Promise<GatewayInstallment> {
    const res = await this.mp().invoice.get({ id });
    return {
      id: String(res.id ?? id),
      subscriptionRef: res.preapproval_id ?? '',
      status: res.status ?? '',
      paymentId: res.payment?.id ? String(res.payment.id) : null,
      paymentStatus: res.payment?.status ?? null,
      amountCents: toCents(res.transaction_amount),
    };
  }

  async getPayment(id: string): Promise<GatewayPayment> {
    const res = await this.mp().payment.get({ id });
    return {
      id: String(res.id ?? id),
      status: res.status ?? '',
      amountCents: toCents(res.transaction_amount),
      externalReference: res.external_reference ?? null,
    };
  }
}

function toSubscription(res: { id?: string; status?: string; external_reference?: string | number; next_payment_date?: string | number }): GatewaySubscription {
  if (!res.id) throw new Error('Mercado Pago did not return a subscription id.');
  return {
    gatewayRef: res.id,
    status: res.status ?? '',
    externalReference: res.external_reference !== undefined ? String(res.external_reference) : null,
    nextPaymentDate: res.next_payment_date ? new Date(res.next_payment_date) : null,
  };
}
