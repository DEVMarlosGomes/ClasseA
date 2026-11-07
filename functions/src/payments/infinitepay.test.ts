import { describe, expect, it } from 'vitest';
import { captureToMethod, judgeCheck, type PaymentCheck } from './infinitepay';

const check = (over: Partial<PaymentCheck>): PaymentCheck => ({
  success: true,
  paid: true,
  amount: 6500,
  paidAmount: 6500,
  installments: 1,
  captureMethod: 'pix',
  ...over,
});

describe('judgeCheck (InfinitePay /payment_check → our decision)', () => {
  it('confirms only when InfinitePay says paid and the charge matches the booking', () => {
    expect(judgeCheck(check({}), 6500)).toBe('paid');
  });

  it('accepts a higher paid_amount (installment interest passed on to the client)', () => {
    expect(judgeCheck(check({ captureMethod: 'credit_card', installments: 3, paidAmount: 6890 }), 6500)).toBe('paid');
  });

  it('never confirms an unpaid or unsuccessful check', () => {
    expect(judgeCheck(check({ paid: false }), 6500)).toBe('not-paid');
    expect(judgeCheck(check({ success: false }), 6500)).toBe('not-paid');
  });

  it('flags a different charge or a short payment instead of confirming', () => {
    expect(judgeCheck(check({ amount: 100, paidAmount: 100 }), 6500)).toBe('amount-mismatch');
    expect(judgeCheck(check({ paidAmount: 6000 }), 6500)).toBe('amount-mismatch');
  });

  it('maps the capture method for the fee estimate', () => {
    expect(captureToMethod('pix')).toBe('pix');
    expect(captureToMethod('credit_card')).toBe('credit');
  });
});
