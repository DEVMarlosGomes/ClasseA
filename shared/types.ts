import type { TimeRange, WeekdayKey } from './time';

export type Role = 'client' | 'barber' | 'admin' | 'reception';

/** Firestore Timestamp-like value; the concrete class differs between web and admin SDKs. */
export interface TimestampLike {
  toDate(): Date;
  toMillis(): number;
}

export interface Consents {
  termsVersion: string;
  privacyVersion: string;
  acceptedAt: TimestampLike;
  marketingOptIn: boolean;
  marketingAt: TimestampLike | null;
  ageDeclaration: 'adult' | 'guardian';
}

export interface UserProfile {
  name: string;
  email: string;
  phone: string; // E.164
  birthDate?: string | null;
  role: Role;
  roles?: Role[];
  avatarUrl?: string | null;
  consents?: Consents;
  createdAt: TimestampLike;
  deletedAt?: TimestampLike | null;
}

export type CardBrand = 'visa' | 'mastercard' | 'elo' | 'amex' | 'hipercard' | 'unknown';

export interface PaymentMethod {
  id: string;
  brand: CardBrand;
  last4: string;
  holderName: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
  token: string;
  createdAt: TimestampLike;
}

export type WeeklyTemplate = Record<WeekdayKey, TimeRange[]>;

export interface Barber {
  id: string;
  uid: string;
  displayName: string;
  bio: string;
  photoUrl: string | null;
  specialties: string[];
  serviceIds: string[];
  active: boolean;
  order: number;
  weeklyTemplate: WeeklyTemplate;
  slotIntervalMin: number;
  bufferMin: number;
  featured?: boolean;
  /** Commission % for this barber; null/absent = settings/finance default. 0 for the owner. */
  commissionPct?: number | null;
  roleLabel?: string;
  photoPosition?: string;
}

export interface BlockRange extends TimeRange {
  reason?: string | null;
}

export interface BarberDay {
  status: 'open' | 'closed';
  blocks: BlockRange[];
  extraOpenings: TimeRange[];
  updatedAt?: TimestampLike;
  updatedBy?: string;
}

export interface AvailabilityPublic {
  barberId: string;
  date: string;
  workingRanges: TimeRange[];
  blocked: BlockRange[];
  busy: TimeRange[];
  slotIntervalMin: number;
  bufferMin: number;
  updatedAt?: TimestampLike;
}

export type ServiceCategory = 'cabelo' | 'barba' | 'combos' | 'acabamentos';

export interface Service {
  id: string;
  name: string;
  description: string;
  category: ServiceCategory;
  durationMin: number;
  priceCents: number;
  includedInPlans: boolean;
  active: boolean;
  order: number;
}

export type AppointmentStatus =
  'confirmed' | 'completed' | 'no_show' | 'cancelled_by_client' | 'cancelled_by_barber';

export type PaymentMode = 'plan' | 'pay_at_shop' | 'card_mock' | 'pix_mock';

export interface AppointmentService {
  id: string;
  name: string;
  durationMin: number;
  priceCents: number;
  coveredByPlan?: boolean;
}

export interface Appointment {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  barberId: string;
  barberName: string;
  services: AppointmentService[];
  date: string;
  start: string;
  end: string;
  startAt: TimestampLike;
  durationMin: number;
  totalCents: number;
  dueAtShopCents: number;
  status: AppointmentStatus;
  paymentMode: PaymentMode;
  paymentId?: string | null;
  subscriptionId?: string | null;
  firstVisit?: boolean;
  notes?: string | null;
  cancelReason?: string | null;
  createdAt: TimestampLike;
  cancelledAt?: TimestampLike | null;
  reminders?: { h24?: boolean; h2?: boolean };
  /** "Baixa": what was actually received. Written only by settleAppointment. */
  settlement?: Settlement | null;
  /** Closed as not completed (e.g. client did not come), with the reason. */
  closure?: Closure | null;
}

export type PlanPeriod = 'monthly' | 'semiannual' | 'annual';

export interface Plan {
  id: string;
  name: string;
  period: PlanPeriod;
  priceCents: number;
  monthlyEquivalentCents: number;
  cutsPerMonth: number | null;
  benefits: string[];
  highlight: boolean;
  active: boolean;
  order: number;
  regularPriceCents?: number;
  savingsCents?: number;
  availabilityLabel?: string;
}

export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'expired';

export interface Subscription {
  id: string;
  clientId: string;
  planId: string;
  planName: string;
  period: PlanPeriod;
  status: SubscriptionStatus;
  startedAt: TimestampLike;
  currentPeriodStart: TimestampLike;
  currentPeriodEnd: TimestampLike;
  autoRenew: boolean;
  paymentMethodId: string | null;
  pendingPlanId?: string | null;
  cutsPerMonth: number | null;
  usage: { cycle: string; cutsUsed: number };
  cancelledAt?: TimestampLike | null;
  /** Mercado Pago preapproval id when the gateway (not our scheduler) charges the renewals. */
  gatewayRef?: string | null;
  lastPaymentId?: string | null;
}

export type PaymentStatus = 'approved' | 'declined' | 'refunded' | 'pending';

export interface Payment {
  id: string;
  clientId: string;
  subscriptionId?: string | null;
  appointmentId?: string | null;
  amountCents: number;
  /** *_mock = simulated; card/pix = real (Mercado Pago). */
  method: 'card_mock' | 'pix_mock' | 'card' | 'pix';
  status: PaymentStatus;
  description: string;
  gatewayRef: string;
  declineReason?: string | null;
  createdAt: TimestampLike;
}

export interface BarberClient {
  clientId: string;
  name: string;
  phone: string;
  visits: number;
  lastVisitAt: TimestampLike | null;
  favoriteServices: string[];
  serviceCounts?: Record<string, number>;
  hasActivePlan: boolean;
  noShows: number;
  privateNotes: string;
}

export type ConsentType = 'cookies' | 'terms' | 'privacy' | 'marketing';

export interface CookieChoices {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
}

// ---------- finance ----------

export type FeePlatform = 'infinitepay' | 'mercadopago';
export type ShopMethod = 'cash' | 'pix' | 'credit' | 'debit';

export interface SettlementPart {
  platform: FeePlatform | 'none';
  receivedCents: number;
  feeCents: number;
}

export interface Settlement {
  /** Paid at the counter (null when nothing was due there). */
  shop: (SettlementPart & { method: ShopMethod }) | null;
  /** Paid in the app before the visit. */
  online: SettlementPart | null;
  /** Table price of the services covered by the client's plan. */
  planCoveredCents: number;
  receivedCents: number;
  feeCents: number;
  paidAt: TimestampLike;
  registeredBy: string;
  registeredByName: string;
}

export interface Closure {
  reason: string;
  at: TimestampLike;
  by: string;
  byName: string;
}

/** commissions/{appointmentId}: one per settled appointment. Barbers read only their own. */
export interface Commission {
  id: string;
  appointmentId: string;
  barberId: string;
  barberName: string;
  date: string;
  /** Biweekly payout period, e.g. 2026-11-A (1–15) or 2026-11-B (16–end). */
  period: string;
  services: string[];
  receivedCents: number;
  feeCents: number;
  deductedFeeCents: number;
  planCoveredCents: number;
  baseCents: number;
  pct: number;
  amountCents: number;
  settledAt: TimestampLike;
}

export interface FinanceSettings {
  defaultCommissionPct: number;
  deductPlatformFees: boolean;
  deductFrom: FeePlatform[];
  /** Fee % per platform and method, from the owner's contracts. */
  fees: Record<FeePlatform, Partial<Record<'pix' | 'credit' | 'debit', number>>>;
}

/** payouts/{barberId}_{period}: what the owner paid a barber for one biweekly period. */
export interface Payout {
  id: string;
  barberId: string;
  period: string;
  amountCents: number;
  method: ShopMethod | 'transfer';
  note: string;
  paidAt: TimestampLike;
  registeredBy: string;
}

export interface ShopSettings {
  name: string;
  legalName: string;
  cnpj: string;
  address: {
    street: string;
    district: string;
    city: string;
    state: string;
    zip: string;
    mapsQuery: string;
    mapsUrl?: string;
  };
  whatsapp: string; // E.164 digits, e.g. 5511999999999
  instagram: string;
  email: string;
  openingHours: { days: string; hours: string }[];
  cancellationPolicyHours: number;
  bookingWindowDays: number;
  minAdvanceMin: number;
  lateToleranceMin: number;
  maxFutureAppointments: number;
  currentLegalVersions: { terms: string; privacy: string; cookies: string };
  socialProof: { label: string; value: string }[];
}

export type LegalDocType = 'privacy' | 'terms' | 'cookies';

export interface LegalDocVersion {
  version: string;
  effectiveAt: string;
  markdown: string;
}

export interface DataRequest {
  id: string;
  uid: string;
  type: 'export' | 'delete' | 'correct';
  status: 'open' | 'done';
  createdAt: TimestampLike;
  resolvedAt?: TimestampLike | null;
}
