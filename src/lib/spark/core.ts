import type { Transaction } from 'firebase/firestore';
import {
  DECLINE_MESSAGES,
  type MockCardOutcome,
  detectBrand,
  mockOutcomeFor,
  onlyDigits,
} from '@shared/cards';
import { DEFAULT_SETTINGS } from '@shared/defaults';
import { computeDayAvailability } from '@shared/slots';
import type {
  AppointmentStatus,
  AvailabilityPublic,
  Barber,
  BarberDay,
  CardBrand,
  Role,
  Service,
  ShopSettings,
  Subscription,
  UserProfile,
} from '@shared/types';
import { ApiError } from '../api';
import { type FirestoreKit, loadAuth, loadFirestore } from '../firebase';

/**
 * Browser-side port of functions/src for the Spark plan. Same names, inputs, outputs and pt-BR
 * messages as the callables, so screens do not know which backend answered.
 */

export type Kit = FirestoreKit;
export const kit = loadFirestore;

export function fail(
  code:
    | 'failed-precondition'
    | 'invalid-argument'
    | 'permission-denied'
    | 'not-found'
    | 'already-exists'
    | 'resource-exhausted',
  reason: string,
  message: string,
): never {
  throw new ApiError(message, reason, code);
}

export interface Caller {
  uid: string;
  email: string | undefined;
  emailVerified: boolean;
  roles: Role[];
  name: string | undefined;
}

export async function getRoles(uid: string): Promise<Role[]> {
  const { db, doc, getDoc } = await kit();
  const snap = await getDoc(doc(db, `roles/${uid}`));
  return (snap.get('roles') as Role[] | undefined) ?? [];
}

export async function currentCaller(): Promise<Caller | null> {
  const { auth } = await loadAuth();
  const u = auth.currentUser;
  if (!u) return null;
  return {
    uid: u.uid,
    email: u.email ?? undefined,
    emailVerified: u.emailVerified,
    roles: await getRoles(u.uid),
    name: u.displayName ?? undefined,
  };
}

export function primaryRole(roles: Iterable<Role>): Role {
  const set = new Set(roles);
  return set.has('admin') ? 'admin' : set.has('barber') ? 'barber' : 'client';
}

export const userAgent = () => (typeof navigator !== 'undefined' ? navigator.userAgent : '').slice(0, 300);

// ---------- data ----------

export async function getSettings(): Promise<ShopSettings> {
  const { db, doc, getDoc } = await kit();
  const snap = await getDoc(doc(db, 'settings/shop'));
  return { ...DEFAULT_SETTINGS, ...(snap.data() as Partial<ShopSettings> | undefined) };
}

export async function getBarber(barberId: string): Promise<Barber> {
  const { db, doc, getDoc } = await kit();
  const snap = await getDoc(doc(db, `barbers/${barberId}`));
  if (!snap.exists()) fail('not-found', 'barber-not-found', 'Barbeiro não encontrado.');
  return { id: snap.id, ...(snap.data() as Omit<Barber, 'id'>) };
}

export async function getServices(ids: string[]): Promise<Service[]> {
  const { db, doc, getDoc } = await kit();
  const snaps = await Promise.all([...new Set(ids)].map((id) => getDoc(doc(db, `services/${id}`))));
  const services = snaps.map((s) => {
    if (!s.exists() || s.get('active') !== true)
      fail('not-found', 'service-unavailable', 'Um dos serviços escolhidos não está mais disponível.');
    return { id: s.id, ...(s.data() as Omit<Service, 'id'>) };
  });
  return services.sort((a, b) => a.order - b.order);
}

export async function getProfile(uid: string): Promise<UserProfile> {
  const { db, doc, getDoc } = await kit();
  const snap = await getDoc(doc(db, `users/${uid}`));
  if (!snap.exists()) fail('failed-precondition', 'profile-missing', 'Complete seu cadastro para continuar.');
  return snap.data() as UserProfile;
}

export async function findActiveSubscription(clientId: string): Promise<Subscription | null> {
  const { db, collection, query, where, limit, getDocs } = await kit();
  const snap = await getDocs(
    query(
      collection(db, 'subscriptions'),
      where('clientId', '==', clientId),
      where('status', 'in', ['active', 'past_due']),
      limit(1),
    ),
  );
  const d = snap.docs[0];
  return d ? ({ id: d.id, ...d.data() } as Subscription) : null;
}

export function randomId(prefix: string, len = 10): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return prefix + Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

// ---------- availability ----------

/** Statuses that keep a slot occupied. */
export const OCCUPYING: AppointmentStatus[] = ['confirmed', 'completed', 'no_show'];

/**
 * Clients cannot read other people's appointments, so the occupied ranges of each barber/day are
 * mirrored without PII in dayBusy/{barberId_date}.busy.{appointmentId}, written in the same
 * transaction that claims or frees the slot.
 */
export const dayKey = (barberId: string, date: string) => `${barberId}_${date}`;

type Busy = Record<string, { start: string; end: string }>;

export async function buildAvailability(
  barber: Barber,
  date: string,
  tx?: Transaction,
): Promise<AvailabilityPublic & { busyById: Busy }> {
  const { db, doc, getDoc } = await kit();
  const dayRef = doc(db, `barbers/${barber.id}/days/${date}`);
  const busyRef = doc(db, `dayBusy/${dayKey(barber.id, date)}`);
  const [daySnap, busySnap] = tx
    ? await Promise.all([tx.get(dayRef), tx.get(busyRef)])
    : await Promise.all([getDoc(dayRef), getDoc(busyRef)]);
  const day = daySnap.exists() ? (daySnap.data() as BarberDay) : null;
  const busyById = ((busySnap.exists() ? busySnap.get('busy') : null) ?? {}) as Busy;
  return { ...computeDayAvailability(barber, date, day, Object.values(busyById)), busyById };
}

/** Rebuilds the PII-free public projection for one barber/day (the onWrite triggers in Functions). */
export async function recomputeAvailability(barberId: string, date: string): Promise<void> {
  const { db, doc, getDoc, setDoc, serverTimestamp } = await kit();
  const snap = await getDoc(doc(db, `barbers/${barberId}`));
  if (!snap.exists()) return;
  const barber = { id: snap.id, ...(snap.data() as Omit<Barber, 'id'>) };
  const { busyById: _b, ...availability } = await buildAvailability(barber, date);
  void _b;
  await setDoc(doc(db, `availabilityPublic/${dayKey(barberId, date)}`), {
    ...availability,
    updatedAt: serverTimestamp(),
  });
}

/** Template or interval changes: refresh every already-materialised future day of that barber. */
export async function recomputeBarberFuture(barberId: string): Promise<void> {
  const { db, collection, query, where, getDocs } = await kit();
  const today = new Date().toISOString().slice(0, 10);
  const docs = await getDocs(
    query(
      collection(db, 'availabilityPublic'),
      where('barberId', '==', barberId),
      where('date', '>=', today),
    ),
  );
  await Promise.all(docs.docs.map((d) => recomputeAvailability(barberId, d.get('date') as string)));
}

// ---------- notifications ----------

/** In-app inbox only: e-mail (Trigger Email) and WhatsApp need server code. */
export async function notifyUser(uid: string, title: string, body: string, link?: string): Promise<void> {
  try {
    const { db, collection, addDoc, serverTimestamp } = await kit();
    await addDoc(collection(db, `users/${uid}/notifications`), {
      title,
      body,
      link: link ?? null,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch {
    // Notifications never fail the action that triggered them.
  }
}

// ---------- mock payment gateway (same behaviour as functions/src/payments/gateway.ts) ----------

export type ChargeResult =
  | { status: 'approved'; gatewayRef: string }
  | {
      status: 'declined';
      gatewayRef: string;
      declineReason: Exclude<MockCardOutcome, 'approved'>;
      message: string;
    };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const latency = () => 800 + Math.floor(Math.random() * 700);

function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
  }
  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}

const emv = (id: string, value: string) => `${id}${String(value.length).padStart(2, '0')}${value}`;

export const gateway = {
  async tokenizeCard(card: { number: string }): Promise<{ token: string; brand: CardBrand; last4: string }> {
    await sleep(latency());
    const digits = onlyDigits(card.number);
    return {
      token: `mock_tok_${mockOutcomeFor(digits)}_${randomId('', 16)}`,
      brand: detectBrand(digits),
      last4: digits.slice(-4),
    };
  },
  async charge(input: { token: string; amountCents: number; description: string }): Promise<ChargeResult> {
    await sleep(latency());
    const gatewayRef = randomId('MOCK-');
    const outcome = (/^mock_tok_([a-z_]+?)_[A-Z0-9]+$/.exec(input.token)?.[1] ??
      'approved') as MockCardOutcome;
    if (outcome === 'approved') return { status: 'approved', gatewayRef };
    return { status: 'declined', gatewayRef, declineReason: outcome, message: DECLINE_MESSAGES[outcome] };
  },
  async refund(input: { gatewayRef: string; amountCents: number }) {
    await sleep(latency() / 2);
    return { status: 'refunded' as const, gatewayRef: input.gatewayRef };
  },
  async createPix(input: { amountCents: number; description: string }) {
    await sleep(latency() / 2);
    const gatewayRef = randomId('MOCK-PIX-');
    const body =
      emv('00', '01') +
      emv('26', emv('00', 'br.gov.bcb.pix') + emv('01', 'demo@classeabarbearia.invalid')) +
      emv('52', '0000') +
      emv('53', '986') +
      emv('54', (input.amountCents / 100).toFixed(2)) +
      emv('58', 'BR') +
      emv('59', 'CLASSE A DEMO') +
      emv('60', 'SAO PAULO') +
      emv('62', emv('05', gatewayRef.replace(/-/g, '').slice(0, 25))) +
      '6304';
    return { gatewayRef, payload: body + crc16(body), expiresAt: new Date(Date.now() + 10 * 60 * 1000) };
  },
};
