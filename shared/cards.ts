import type { CardBrand } from './types';

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export function luhnValid(number: string): boolean {
  const digits = onlyDigits(number);
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

const ELO_PREFIXES = [
  '401178', '401179', '431274', '438935', '451416', '457393', '457631', '457632', '504175',
  '627780', '636297', '636368', '650031', '650032', '650033', '650035', '650051', '650405',
  '650439', '650485', '650538', '650541', '650598', '650700', '650718', '650720', '650727',
  '650901', '650920', '651652', '655000', '655021',
];

export function detectBrand(number: string): CardBrand {
  const d = onlyDigits(number);
  if (!d) return 'unknown';
  if (ELO_PREFIXES.some((p) => d.startsWith(p)) || /^(5067|4576|4011|5090)/.test(d)) return 'elo';
  if (/^(606282|3841)/.test(d)) return 'hipercard';
  if (/^3[47]/.test(d)) return 'amex';
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(d)) return 'mastercard';
  if (/^4/.test(d)) return 'visa';
  return 'unknown';
}

export const BRAND_LABEL: Record<CardBrand, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  elo: 'Elo',
  amex: 'American Express',
  hipercard: 'Hipercard',
  unknown: 'Cartão',
};

export function cvvLength(brand: CardBrand): number {
  return brand === 'amex' ? 4 : 3;
}

/** True when MM/YY is the current month or later (shop-local month is close enough for expiry). */
export function expiryValid(month: number, year2: number, now: Date = new Date()): boolean {
  if (month < 1 || month > 12) return false;
  const year = 2000 + year2;
  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth() + 1;
  if (year > nowYear + 20) return false;
  return year > nowYear || (year === nowYear && month >= nowMonth);
}

/** Outcomes the mock gateway produces for the documented test cards. */
export type MockCardOutcome = 'approved' | 'card_declined' | 'insufficient_funds' | 'expired_card';

export function mockOutcomeFor(number: string): MockCardOutcome {
  switch (onlyDigits(number)) {
    case '4000000000000002':
      return 'card_declined';
    case '4000000000009995':
      return 'insufficient_funds';
    case '4000000000000069':
      return 'expired_card';
    default:
      return 'approved';
  }
}

export const DECLINE_MESSAGES: Record<Exclude<MockCardOutcome, 'approved'>, string> = {
  card_declined: 'O banco recusou este cartão. Tente outro cartão ou pague com PIX.',
  insufficient_funds: 'Saldo ou limite insuficiente. Tente outro cartão ou pague com PIX.',
  expired_card: 'Este cartão está vencido. Confira a validade ou use outro cartão.',
};
