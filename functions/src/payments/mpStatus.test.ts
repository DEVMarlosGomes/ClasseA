import { createHmac } from 'node:crypto';
import { WebhookSignatureValidator } from 'mercadopago';
import { describe, expect, it } from 'vitest';
import { FREQUENCY_MONTHS, mapInstallment, mapPaymentStatus, mapPreapprovalStatus, toCents, toReais } from './mpStatus';

describe('mapPreapprovalStatus', () => {
  it('maps the documented states and leaves unknown ones alone', () => {
    expect(mapPreapprovalStatus('authorized')).toBe('active');
    expect(mapPreapprovalStatus('paused')).toBe('past_due');
    expect(mapPreapprovalStatus('cancelled')).toBe('cancelled');
    expect(mapPreapprovalStatus('canceled')).toBe('cancelled');
    expect(mapPreapprovalStatus('pending')).toBeNull();
    expect(mapPreapprovalStatus('something-new')).toBeNull();
    expect(mapPreapprovalStatus(undefined)).toBeNull();
  });
});

describe('mapInstallment', () => {
  it('trusts the nested payment status for success', () => {
    expect(mapInstallment('processed', 'approved')).toBe('approved');
  });
  it('tells retries from final failures', () => {
    expect(mapInstallment('recycling', 'rejected')).toBe('retrying');
    expect(mapInstallment('processed', 'rejected')).toBe('failed');
    expect(mapInstallment('waiting for gateway', null as unknown as undefined)).toBe('pending');
  });
});

describe('mapPaymentStatus', () => {
  it('only approves "approved"', () => {
    expect(mapPaymentStatus('approved')).toBe('approved');
    expect(mapPaymentStatus('pending')).toBe('pending');
    expect(mapPaymentStatus('in_process')).toBe('pending');
    expect(mapPaymentStatus('cancelled')).toBe('expired');
    expect(mapPaymentStatus('rejected')).toBe('expired');
  });
});

describe('money and periods', () => {
  it('converts cents without float drift', () => {
    expect(toReais(4990)).toBe(49.9);
    expect(toCents(49.9)).toBe(4990);
    expect(toCents('24.50')).toBe(2450);
    expect(toCents(undefined)).toBe(0);
  });
  it('bills every 1, 6 or 12 months', () => {
    expect(FREQUENCY_MONTHS).toEqual({ monthly: 1, semiannual: 6, annual: 12 });
  });
});

// Contract of the webhook: data.id from the query string, x-request-id and ts form the HMAC manifest.
describe('webhook signature (official SDK validator, as mpWebhook calls it)', () => {
  const secret = 'test-secret';
  const sign = (dataId: string, requestId: string, ts: string) =>
    createHmac('sha256', secret).update(`id:${dataId};request-id:${requestId};ts:${ts};`).digest('hex');

  it('accepts a genuine notification', () => {
    const ts = '1704908010';
    const v1 = sign('123456', 'req-1', ts);
    expect(() =>
      WebhookSignatureValidator.validate({ xSignature: `ts=${ts},v1=${v1}`, xRequestId: 'req-1', dataId: '123456', secret }),
    ).not.toThrow();
  });

  it('rejects a notification whose id was swapped', () => {
    const ts = '1704908010';
    const v1 = sign('123456', 'req-1', ts);
    expect(() =>
      WebhookSignatureValidator.validate({ xSignature: `ts=${ts},v1=${v1}`, xRequestId: 'req-1', dataId: '999999', secret }),
    ).toThrow();
  });

  it('rejects a missing or malformed header', () => {
    expect(() => WebhookSignatureValidator.validate({ xSignature: undefined, xRequestId: 'r', dataId: '1', secret })).toThrow();
    expect(() => WebhookSignatureValidator.validate({ xSignature: 'garbage', xRequestId: 'r', dataId: '1', secret })).toThrow();
  });
});
