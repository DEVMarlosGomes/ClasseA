import type { TimeRange, WeekdayKey } from './time';

export type Role = 'client' | 'barber' | 'admin';

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
}

export type PaymentStatus = 'approved' | 'declined' | 'refunded' | 'pending';

export interface Payment {
  id: string;
  clientId: string;
  subscriptionId?: string | null;
  appointmentId?: string | null;
  amountCents: number;
  method: 'card_mock' | 'pix_mock';
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
