import { describe, expect, it } from 'vitest';
import {
  commissionPctFor,
  computeCommission,
  estimateFee,
  financeSettings,
  onlinePaidCents,
  periodLabel,
  periodOf,
  periodRange,
  planCoveredCents,
  shiftPeriod,
} from './finance';
import type { AppointmentService } from './types';

const settings = financeSettings({
  defaultCommissionPct: 35,
  deductPlatformFees: false,
  deductFrom: [],
  fees: { infinitepay: { credit: 3.15, debit: 1.37, pix: 0 }, mercadopago: { credit: 4.98 } },
});
const svc = (priceCents: number, coveredByPlan = false): AppointmentService => ({ id: 'x', name: 'Corte', durationMin: 30, priceCents, coveredByPlan });

describe('commission (35% of what was received)', () => {
  it('cash at the counter: 35% of the amount received', () => {
    const c = computeCommission({ shop: { platform: 'none', receivedCents: 5000, feeCents: 0 }, online: null, planCoveredCents: 0 }, 35, settings);
    expect(c).toMatchObject({ receivedCents: 5000, baseCents: 5000, amountCents: 1750 });
  });

  it('uses what was actually received, not the table price (e.g. a discount)', () => {
    const c = computeCommission({ shop: { platform: 'none', receivedCents: 4000, feeCents: 0 }, online: null, planCoveredCents: 0 }, 35, settings);
    expect(c.amountCents).toBe(1400);
  });

  it('plan-covered services count at their table price', () => {
    const c = computeCommission({ shop: null, online: null, planCoveredCents: 4500 }, 35, settings);
    expect(c).toMatchObject({ baseCents: 4500, amountCents: 1575 });
  });

  it('gross by default: the card fee is not deducted', () => {
    const fee = estimateFee(settings, 'infinitepay', 'credit', 10000);
    expect(fee).toBe(315);
    const c = computeCommission({ shop: { platform: 'infinitepay', receivedCents: 10000, feeCents: fee }, online: null, planCoveredCents: 0 }, 35, settings);
    expect(c).toMatchObject({ feeCents: 315, deductedFeeCents: 0, baseCents: 10000, amountCents: 3500 });
  });

  it('net: deducts the fee only for the platforms the owner selected', () => {
    const net = financeSettings({ ...settings, deductPlatformFees: true, deductFrom: ['infinitepay'] });
    const parts = {
      shop: { platform: 'infinitepay' as const, receivedCents: 10000, feeCents: 315 },
      online: { platform: 'mercadopago' as const, receivedCents: 2000, feeCents: 100 },
      planCoveredCents: 0,
    };
    const c = computeCommission(parts, 35, net);
    expect(c).toMatchObject({ receivedCents: 12000, feeCents: 415, deductedFeeCents: 315, baseCents: 11685, amountCents: 4090 });
  });

  it('the interruptor off ignores the platform list', () => {
    const off = financeSettings({ ...settings, deductPlatformFees: false, deductFrom: ['infinitepay'] });
    const c = computeCommission({ shop: { platform: 'infinitepay', receivedCents: 10000, feeCents: 315 }, online: null, planCoveredCents: 0 }, 35, off);
    expect(c.deductedFeeCents).toBe(0);
  });

  it('cash and "none" never have fees', () => {
    expect(estimateFee(settings, 'infinitepay', 'cash', 10000)).toBe(0);
    expect(estimateFee(settings, 'none', 'credit', 10000)).toBe(0);
  });
});

describe('percentage per barber', () => {
  it("uses the barber's own % (including 0 for the owner), else the default", () => {
    expect(commissionPctFor({ commissionPct: 40 }, settings)).toBe(40);
    expect(commissionPctFor({ commissionPct: 0 }, settings)).toBe(0);
    expect(commissionPctFor({ commissionPct: null }, settings)).toBe(35);
    expect(commissionPctFor(undefined, settings)).toBe(35);
  });
  it('clamps nonsense', () => {
    expect(financeSettings({ defaultCommissionPct: 140 }).defaultCommissionPct).toBe(100);
    expect(financeSettings({ defaultCommissionPct: -5 }).defaultCommissionPct).toBe(0);
    expect(financeSettings(null).defaultCommissionPct).toBe(35);
  });
});

describe('appointment parts', () => {
  it('splits plan coverage and online payment', () => {
    expect(planCoveredCents({ paymentMode: 'plan', services: [svc(4500, true), svc(2000)] })).toBe(4500);
    expect(planCoveredCents({ paymentMode: 'pay_at_shop', services: [svc(4500, true)] })).toBe(0);
    expect(onlinePaidCents({ paymentMode: 'pix_mock', totalCents: 6500, dueAtShopCents: 0, services: [] })).toBe(6500);
    expect(onlinePaidCents({ paymentMode: 'pay_at_shop', totalCents: 6500, dueAtShopCents: 6500, services: [] })).toBe(0);
  });
});

describe('biweekly periods', () => {
  it('splits the month at the 15th', () => {
    expect(periodOf('2026-11-15')).toBe('2026-11-A');
    expect(periodOf('2026-11-16')).toBe('2026-11-B');
    expect(periodRange('2026-02-B')).toEqual({ from: '2026-02-16', to: '2026-02-28' });
    expect(periodRange('2026-11-A')).toEqual({ from: '2026-11-01', to: '2026-11-15' });
  });
  it('moves between periods across years', () => {
    expect(shiftPeriod('2026-11-A', 1)).toBe('2026-11-B');
    expect(shiftPeriod('2026-12-B', 1)).toBe('2027-01-A');
    expect(shiftPeriod('2027-01-A', -1)).toBe('2026-12-B');
    expect(periodLabel('2026-11-B')).toBe('16 a 30 de nov/2026');
  });
});
