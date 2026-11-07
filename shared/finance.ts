/**
 * Commission and settlement rules (decided by the owner, 2026-11-07). Pure functions shared by the
 * Cloud Functions, the Spark test backend and the screens, so every place computes the same numbers.
 *
 * - Commission = pct × value received, only for visits that were completed AND paid.
 * - Services covered by the client's plan count at their table price.
 * - Optional: deduct the platform fee (card machine / gateway) before the commission, only for the
 *   platforms the owner selected.
 * - Payout is biweekly: 1–15 (A) and 16–end of month (B).
 */
import type { Appointment, Barber, FeePlatform, FinanceSettings, SettlementPart, ShopMethod } from './types';

export const DEFAULT_FINANCE: FinanceSettings = {
  defaultCommissionPct: 35,
  deductPlatformFees: false,
  deductFrom: [],
  fees: { infinitepay: {}, mercadopago: {} },
};

export const PLATFORM_LABEL: Record<FeePlatform | 'none', string> = {
  infinitepay: 'InfinitePay',
  mercadopago: 'Mercado Pago',
  none: 'Sem taxa',
};

export const METHOD_LABEL: Record<ShopMethod, string> = {
  cash: 'Dinheiro',
  pix: 'PIX',
  credit: 'Crédito',
  debit: 'Débito',
};

/** Normalises a settings document that may be missing or partial. */
export function financeSettings(raw: Partial<FinanceSettings> | null | undefined): FinanceSettings {
  return {
    defaultCommissionPct: clampPct(raw?.defaultCommissionPct ?? DEFAULT_FINANCE.defaultCommissionPct),
    deductPlatformFees: raw?.deductPlatformFees === true,
    deductFrom: (raw?.deductFrom ?? []).filter((p): p is FeePlatform => p === 'infinitepay' || p === 'mercadopago'),
    fees: {
      infinitepay: { ...(raw?.fees?.infinitepay ?? {}) },
      mercadopago: { ...(raw?.fees?.mercadopago ?? {}) },
    },
  };
}

export function clampPct(n: number): number {
  return Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n * 100) / 100)) : 0;
}

/** The barber's own % if set, otherwise the shop default. */
export function commissionPctFor(barber: Pick<Barber, 'commissionPct'> | null | undefined, settings: FinanceSettings): number {
  const own = barber?.commissionPct;
  return clampPct(typeof own === 'number' ? own : settings.defaultCommissionPct);
}

/** Fee estimated from the owner's table (e.g. InfinitePay credit 3.15%). Cash and "none" are free. */
export function estimateFee(
  settings: FinanceSettings,
  platform: FeePlatform | 'none',
  method: ShopMethod | 'pix' | 'credit' | 'debit' | null,
  amountCents: number,
): number {
  if (platform === 'none' || !method || method === 'cash') return 0;
  const pct = settings.fees[platform]?.[method] ?? 0;
  return Math.round((amountCents * clampPct(pct)) / 100);
}

/** Table price of the services the plan covered on this visit. */
export function planCoveredCents(appt: Pick<Appointment, 'services' | 'paymentMode'>): number {
  if (appt.paymentMode !== 'plan') return 0;
  return appt.services.filter((s) => s.coveredByPlan).reduce((sum, s) => sum + s.priceCents, 0);
}

/** What was paid in the app before the visit (card/PIX online). */
export function onlinePaidCents(appt: Pick<Appointment, 'paymentMode' | 'totalCents' | 'dueAtShopCents' | 'services'>): number {
  if (appt.paymentMode === 'pay_at_shop') return 0;
  if (appt.paymentMode === 'plan') return 0;
  return Math.max(0, appt.totalCents - appt.dueAtShopCents);
}

const deducted = (part: SettlementPart | null, settings: FinanceSettings) =>
  part && settings.deductPlatformFees && part.platform !== 'none' && settings.deductFrom.includes(part.platform)
    ? part.feeCents
    : 0;

export interface CommissionCalc {
  receivedCents: number;
  feeCents: number;
  deductedFeeCents: number;
  planCoveredCents: number;
  baseCents: number;
  pct: number;
  amountCents: number;
}

export function computeCommission(
  parts: { shop: SettlementPart | null; online: SettlementPart | null; planCoveredCents: number },
  pct: number,
  settings: FinanceSettings,
): CommissionCalc {
  const receivedCents = (parts.shop?.receivedCents ?? 0) + (parts.online?.receivedCents ?? 0);
  const feeCents = (parts.shop?.feeCents ?? 0) + (parts.online?.feeCents ?? 0);
  const deductedFeeCents = deducted(parts.shop, settings) + deducted(parts.online, settings);
  const baseCents = Math.max(0, receivedCents - deductedFeeCents + parts.planCoveredCents);
  return {
    receivedCents,
    feeCents,
    deductedFeeCents,
    planCoveredCents: parts.planCoveredCents,
    baseCents,
    pct,
    amountCents: Math.round((baseCents * pct) / 100),
  };
}

/** Biweekly period of a date key (YYYY-MM-DD): days 1–15 → A, 16–end → B. */
export function periodOf(dateKey: string): string {
  const day = Number(dateKey.slice(8, 10));
  return `${dateKey.slice(0, 7)}-${day <= 15 ? 'A' : 'B'}`;
}

/** First and last date keys of a period. */
export function periodRange(period: string): { from: string; to: string } {
  const [y, m, half] = period.split('-') as [string, string, 'A' | 'B'];
  const last = new Date(Date.UTC(Number(y), Number(m), 0)).getUTCDate();
  return half === 'A' ? { from: `${y}-${m}-01`, to: `${y}-${m}-15` } : { from: `${y}-${m}-16`, to: `${y}-${m}-${last}` };
}

export function shiftPeriod(period: string, delta: number): string {
  const [y, m, half] = period.split('-') as [string, string, 'A' | 'B'];
  let index = (Number(y) * 12 + Number(m) - 1) * 2 + (half === 'A' ? 0 : 1) + delta;
  const h = index % 2 === 0 ? 'A' : 'B';
  index = Math.floor(index / 2);
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}-${h}`;
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function periodLabel(period: string): string {
  const { from, to } = periodRange(period);
  return `${Number(from.slice(8))} a ${Number(to.slice(8))} de ${MONTHS[Number(from.slice(5, 7)) - 1]}/${from.slice(0, 4)}`;
}
