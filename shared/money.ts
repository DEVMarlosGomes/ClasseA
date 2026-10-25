const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** "R$ 45,00" with a regular space (Intl uses a non-breaking one, which breaks tests and copy-paste). */
export function formatBRL(cents: number): string {
  return brl.format(cents / 100).replace(/\s/g, ' ');
}

/** "R$ 45" when there are no cents, otherwise "R$ 45,90". */
export function formatBRLShort(cents: number): string {
  if (cents % 100 === 0) return `R$ ${(cents / 100).toLocaleString('pt-BR')}`;
  return formatBRL(cents);
}

export function savingsPercent(monthlyCents: number, months: number, totalCents: number): number {
  const full = monthlyCents * months;
  if (full <= 0) return 0;
  return Math.round(((full - totalCents) / full) * 100);
}
