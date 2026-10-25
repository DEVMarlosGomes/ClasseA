import type { Plan, Service, ShopSettings, WeeklyTemplate } from './types';

export const LEGAL_VERSIONS = { terms: '1.0', privacy: '1.0', cookies: '1.0' } as const;

/**
 * Business data the shop has not confirmed yet. Everything marked TODO(cliente) is editable in
 * /admin/configuracoes and must be replaced before launch.
 */
export const DEFAULT_SETTINGS: ShopSettings = {
  name: 'Classe A Barbearia',
  legalName: 'TODO(cliente) Razão social da Classe A Barbearia',
  cnpj: 'TODO(cliente) 00.000.000/0000-00',
  address: {
    street: 'TODO(cliente) Rua e número',
    district: 'TODO(cliente) Bairro',
    city: 'São Paulo',
    state: 'SP',
    zip: 'TODO(cliente) 00000-000',
    mapsQuery: 'Classe A Barbearia',
  },
  whatsapp: '5511900000000', // TODO(cliente)
  instagram: 'classeabarbearia', // TODO(cliente)
  email: 'contato@classeabarbearia.com.br', // TODO(cliente)
  openingHours: [
    { days: 'Terça a sexta', hours: '09:00 – 20:00' },
    { days: 'Sábado', hours: '08:00 – 18:00' },
    { days: 'Domingo e segunda', hours: 'Fechado' },
  ],
  cancellationPolicyHours: 2,
  bookingWindowDays: 30,
  minAdvanceMin: 60,
  lateToleranceMin: 10,
  maxFutureAppointments: 2,
  currentLegalVersions: { ...LEGAL_VERSIONS },
  socialProof: [],
};

export function isPlaceholder(value: string | undefined | null): boolean {
  return !value || value.startsWith('TODO(cliente)');
}

// TODO(cliente): services, durations and prices are placeholders.
export const SEED_SERVICES: Omit<Service, 'id'>[] = [
  { name: 'Corte', description: 'Corte na tesoura ou máquina, lavagem e finalização com pomada.', category: 'cabelo', durationMin: 30, priceCents: 4500, includedInPlans: true, active: true, order: 1 },
  { name: 'Degradê navalhado', description: 'Fade com acabamento na navalha e risca opcional.', category: 'cabelo', durationMin: 45, priceCents: 5500, includedInPlans: true, active: true, order: 2 },
  { name: 'Corte infantil', description: 'Até 12 anos, com paciência e capricho.', category: 'cabelo', durationMin: 30, priceCents: 4000, includedInPlans: false, active: true, order: 3 },
  { name: 'Barba', description: 'Toalha quente, navalha e balm hidratante.', category: 'barba', durationMin: 30, priceCents: 3500, includedInPlans: true, active: true, order: 4 },
  { name: 'Barboterapia', description: 'Esfoliação, vapor de ozônio, toalha quente e massagem facial.', category: 'barba', durationMin: 45, priceCents: 5000, includedInPlans: false, active: true, order: 5 },
  { name: 'Corte + barba', description: 'O combo completo: corte, barba na navalha e finalização.', category: 'combos', durationMin: 60, priceCents: 7000, includedInPlans: true, active: true, order: 6 },
  { name: 'Corte + sobrancelha', description: 'Corte com alinhamento de sobrancelha na navalha.', category: 'combos', durationMin: 40, priceCents: 5500, includedInPlans: false, active: true, order: 7 },
  { name: 'Sobrancelha', description: 'Alinhamento na navalha ou pinça.', category: 'acabamentos', durationMin: 10, priceCents: 1500, includedInPlans: false, active: true, order: 8 },
  { name: 'Pezinho', description: 'Contorno e nuca entre um corte e outro.', category: 'acabamentos', durationMin: 15, priceCents: 1500, includedInPlans: false, active: true, order: 9 },
  { name: 'Pigmentação de barba', description: 'Preenche falhas e uniformiza a cor da barba.', category: 'acabamentos', durationMin: 20, priceCents: 3000, includedInPlans: false, active: true, order: 10 },
];

const MONTHLY = 14990; // TODO(cliente)

// TODO(cliente): prices and benefits are placeholders derived from the brief's rules.
export const SEED_PLANS: (Omit<Plan, 'id'> & { id: string })[] = [
  {
    id: 'mensal',
    name: 'Mensal',
    period: 'monthly',
    priceCents: MONTHLY,
    monthlyEquivalentCents: MONTHLY,
    cutsPerMonth: 4,
    benefits: ['4 cortes por mês', 'Prioridade na agenda', 'Cancele quando quiser'],
    highlight: false,
    active: true,
    order: 1,
  },
  {
    id: 'semestral',
    name: 'Semestral',
    period: 'semiannual',
    priceCents: Math.round(MONTHLY * 6 * 0.9),
    monthlyEquivalentCents: Math.round(MONTHLY * 0.9),
    cutsPerMonth: 4,
    benefits: ['4 cortes por mês', '10% de desconto sobre 6 mensalidades', 'Prioridade na agenda'],
    highlight: false,
    active: true,
    order: 2,
  },
  {
    id: 'anual',
    name: 'Anual',
    period: 'annual',
    priceCents: Math.round(MONTHLY * 12 * 0.8),
    monthlyEquivalentCents: Math.round(MONTHLY * 0.8),
    cutsPerMonth: 4,
    benefits: [
      '4 cortes por mês',
      'Uma barba por mês inclusa',
      '20% de desconto sobre 12 mensalidades',
      'Prioridade na agenda',
    ],
    highlight: true,
    active: true,
    order: 3,
  },
];

export const PERIOD_MONTHS: Record<Plan['period'], number> = { monthly: 1, semiannual: 6, annual: 12 };

export const DEFAULT_TEMPLATE: WeeklyTemplate = {
  sun: [],
  mon: [],
  tue: [
    { start: '09:00', end: '12:00' },
    { start: '13:00', end: '20:00' },
  ],
  wed: [
    { start: '09:00', end: '12:00' },
    { start: '13:00', end: '20:00' },
  ],
  thu: [
    { start: '09:00', end: '12:00' },
    { start: '13:00', end: '20:00' },
  ],
  fri: [
    { start: '09:00', end: '12:00' },
    { start: '13:00', end: '20:00' },
  ],
  sat: [
    { start: '08:00', end: '12:00' },
    { start: '13:00', end: '18:00' },
  ],
};
