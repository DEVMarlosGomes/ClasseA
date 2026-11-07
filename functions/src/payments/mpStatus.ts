/**
 * Pure mappings between Mercado Pago states and ours. No SDK or Firestore imports, so they are unit-tested
 * in isolation (functions/src/payments/mpStatus.test.ts).
 *
 * Sources: Mercado Pago docs (subscriptions, authorized payments) and the official SDK types, 2026-11.
 * The preapproval and authorized-payment status lists are not fully enumerated in the docs, so unknown
 * values map to "no change" instead of guessing.
 */
import type { PlanPeriod, SubscriptionStatus } from '../../../shared/types';

export const FREQUENCY_MONTHS: Record<PlanPeriod, number> = { monthly: 1, semiannual: 6, annual: 12 };

/** Preapproval (subscription) status → our subscription status. `null` = leave as it is. */
export function mapPreapprovalStatus(status: string | undefined): SubscriptionStatus | null {
  switch (status) {
    case 'authorized':
      return 'active';
    case 'paused':
      return 'past_due';
    // The API spells it "cancelled" in the SDK comments and "canceled" in the docs: accept both.
    case 'cancelled':
    case 'canceled':
      return 'cancelled';
    default:
      return null; // "pending" or anything undocumented
  }
}

export type InstallmentOutcome = 'approved' | 'retrying' | 'failed' | 'pending';

/**
 * One recurring charge (authorized payment). Docs: "processed" is final (paid, or out of retries),
 * "recycling" means declined and will be retried, "waiting for gateway" is in progress. The nested
 * payment status tells paid from failed.
 */
export function mapInstallment(status: string | undefined, paymentStatus: string | undefined): InstallmentOutcome {
  if (paymentStatus === 'approved') return 'approved';
  if (status === 'recycling') return 'retrying';
  if (status === 'processed') return 'failed';
  if (paymentStatus === 'rejected' || paymentStatus === 'cancelled') return 'retrying';
  return 'pending';
}

export type PixOutcome = 'pending' | 'approved' | 'expired';

export function mapPaymentStatus(status: string | undefined): PixOutcome {
  if (status === 'approved') return 'approved';
  if (status === 'cancelled' || status === 'rejected' || status === 'expired') return 'expired';
  return 'pending';
}

/** Mercado Pago works in reais with cents as decimals; we keep integer cents. */
export const toReais = (cents: number) => Math.round(cents) / 100;
export const toCents = (reais: number | string | undefined) => Math.round(Number(reais ?? 0) * 100);
