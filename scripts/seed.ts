/**
 * Seeds the local Emulator Suite: admin, 3 barbers, demo clients, services, plans, settings,
 * legal documents, weekly templates and 20 sample appointments.
 *
 *   npm run emulators   (in another terminal)
 *   npm run seed
 *
 * Emulator-only test accounts (never use in production) — password for all: ClasseA#2026
 *   dono@classea.test       admin
 *   rafael@classea.test     barber (also sees the admin panel? no — barber only)
 *   diego@classea.test      barber
 *   thiago@classea.test     barber
 *   cliente@classea.test    client with an active annual plan and a saved test card
 */
import { readFileSync } from 'node:fs';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { DEFAULT_SETTINGS, DEFAULT_TEMPLATE, LEGAL_VERSIONS, SEED_PLANS, SEED_SERVICES } from '../shared/defaults';
import { computeDayAvailability, endTime, generateSlots, lockSlices } from '../shared/slots';
import { addDaysToDateKey, cycleKey, shopNow, shopTimeToDate } from '../shared/time';
import type { Barber, Role } from '../shared/types';

const PROJECT = process.env.GCLOUD_PROJECT ?? 'demo-classe-a';
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
if (!PROJECT.startsWith('demo-') && process.env.SEED_ALLOW_REAL !== 'true') {
  console.error('Refusing to seed a non-demo project. Set SEED_ALLOW_REAL=true if you really mean it.');
  process.exit(1);
}

initializeApp({ projectId: PROJECT });
const db = getFirestore();
const auth = getAuth();
const PASSWORD = 'ClasseA#2026';

async function upsertUser(email: string, name: string, roles: Role[], phone: string) {
  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch {
    user = await auth.createUser({ email, password: PASSWORD, displayName: name, emailVerified: true });
  }
  await auth.setCustomUserClaims(user.uid, { roles });
  await db.doc(`users/${user.uid}`).set({
    name,
    email,
    phone,
    birthDate: null,
    role: roles.includes('admin') ? 'admin' : roles.includes('barber') ? 'barber' : 'client',
    roles,
    avatarUrl: null,
    consents: {
      termsVersion: LEGAL_VERSIONS.terms,
      privacyVersion: LEGAL_VERSIONS.privacy,
      acceptedAt: FieldValue.serverTimestamp(),
      marketingOptIn: false,
      marketingAt: null,
      ageDeclaration: 'adult',
    },
    createdAt: FieldValue.serverTimestamp(),
    deletedAt: null,
  });
  return user.uid;
}

async function main() {
  console.log(`Seeding ${PROJECT}…`);
  // Start from a clean emulator so re-running the seed never duplicates data.
  await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  const today = shopNow().date;

  await db.doc('settings/shop').set(DEFAULT_SETTINGS);

  for (const type of ['privacy', 'terms', 'cookies'] as const) {
    const markdown = readFileSync(new URL(`../shared/legal/${type}.md`, import.meta.url), 'utf8');
    await db.doc(`legalDocs/${type}`).set({ currentVersion: LEGAL_VERSIONS[type] });
    await db.doc(`legalDocs/${type}/versions/${LEGAL_VERSIONS[type]}`).set({
      version: LEGAL_VERSIONS[type],
      effectiveAt: today,
      markdown,
    });
  }

  const serviceIds: Record<string, string> = {};
  for (const s of SEED_SERVICES) {
    const id = s.name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    serviceIds[s.name] = id;
    await db.doc(`services/${id}`).set(s);
  }
  for (const { id, ...p } of SEED_PLANS) await db.doc(`plans/${id}`).set(p);

  await upsertUser('dono@classea.test', 'Dono Classe A', ['admin'], '+5511900000001');

  // TODO(cliente): real barber names, photos and specialties.
  const barberDefs = [
    { email: 'rafael@classea.test', name: 'Rafael', specialties: ['Degradê', 'Navalha'], all: true },
    { email: 'diego@classea.test', name: 'Diego', specialties: ['Barba', 'Barboterapia'], all: true },
    { email: 'thiago@classea.test', name: 'Thiago', specialties: ['Corte clássico', 'Infantil'], all: false },
  ];
  const barbers: Barber[] = [];
  for (const [i, b] of barberDefs.entries()) {
    const uid = await upsertUser(b.email, b.name, ['barber'], `+551190000001${i}`);
    const allIds = Object.values(serviceIds);
    const barber: Barber = {
      id: uid,
      uid,
      displayName: b.name,
      bio: `Barbeiro da Classe A. Especialista em ${b.specialties.join(' e ').toLowerCase()}.`,
      photoUrl: null,
      specialties: b.specialties,
      serviceIds: b.all ? allIds : allIds.filter((id) => !['barboterapia', 'pigmentacao-de-barba'].includes(id)),
      active: true,
      order: i + 1,
      weeklyTemplate: DEFAULT_TEMPLATE,
      slotIntervalMin: 30,
      bufferMin: 0,
    };
    const { id: _id, ...doc } = barber;
    void _id;
    await db.doc(`barbers/${uid}`).set(doc);
    barbers.push(barber);
  }

  const clientDefs = [
    ['cliente@classea.test', 'João Pereira', '+5511987654321'],
    ['marcos@classea.test', 'Marcos Lima', '+5511976543210'],
    ['lucas@classea.test', 'Lucas Andrade', '+5511965432109'],
    ['bruno@classea.test', 'Bruno Costa', '+5511954321098'],
    ['felipe@classea.test', 'Felipe Rocha', '+5511943210987'],
  ] as const;
  const clients: { uid: string; name: string; phone: string }[] = [];
  for (const [email, name, phone] of clientDefs) clients.push({ uid: await upsertUser(email, name, ['client'], phone), name, phone });

  // João: annual plan with a saved test card (4242).
  const joao = clients[0]!;
  const pmRef = db.doc(`users/${joao.uid}/paymentMethods/seed-card`);
  await pmRef.set({
    brand: 'visa',
    last4: '4242',
    holderName: 'JOAO PEREIRA',
    expMonth: 12,
    expYear: 2030,
    isDefault: true,
    token: 'mock_tok_approved_SEEDSEEDSEEDSEED',
    createdAt: FieldValue.serverTimestamp(),
  });
  const annual = SEED_PLANS.find((p) => p.id === 'anual')!;
  const started = new Date(Date.now() - 20 * 86_400_000);
  const subEnd = new Date(started.getTime() + 365 * 86_400_000);
  await db.doc('subscriptions/seed-annual').set({
    clientId: joao.uid,
    planId: annual.id,
    planName: annual.name,
    period: annual.period,
    status: 'active',
    startedAt: Timestamp.fromDate(started),
    currentPeriodStart: Timestamp.fromDate(started),
    currentPeriodEnd: Timestamp.fromDate(subEnd),
    autoRenew: true,
    paymentMethodId: 'seed-card',
    pendingPlanId: null,
    cutsPerMonth: annual.cutsPerMonth,
    usage: { cycle: cycleKey(today), cutsUsed: 1 },
    lastPaymentId: 'seed-annual-payment',
    createdAt: FieldValue.serverTimestamp(),
  });
  await db.doc('payments/seed-annual-payment').set({
    clientId: joao.uid,
    subscriptionId: 'seed-annual',
    appointmentId: null,
    amountCents: annual.priceCents,
    method: 'card_mock',
    status: 'approved',
    description: `Plano ${annual.name}`,
    gatewayRef: 'MOCK-SEED0001',
    createdAt: Timestamp.fromDate(started),
  });

  // 20 appointments: 12 in the past two weeks, 8 in the coming days.
  const svc = (name: string) => {
    const s = SEED_SERVICES.find((x) => x.name === name)!;
    return { id: serviceIds[name]!, name: s.name, durationMin: s.durationMin, priceCents: s.priceCents };
  };
  const combos = [['Corte'], ['Corte + barba'], ['Barba'], ['Degradê navalhado'], ['Corte', 'Sobrancelha']];
  const busy = new Map<string, { start: string; end: string }[]>();
  let created = 0;

  async function bookOne(date: string, past: boolean, i: number): Promise<boolean> {
    const barber = barbers[i % barbers.length]!;
    const pick = combos[i % combos.length]!.map(svc);
    if (!pick.every((p) => barber.serviceIds.includes(p.id))) return false;
    const key = `${barber.id}|${date}`;
    const avail = computeDayAvailability(barber, date, null, busy.get(key) ?? []);
    const duration = pick.reduce((sum, x) => sum + x.durationMin, 0);
    const slots = generateSlots(avail, { durationMin: duration, now: past ? undefined : shopNow(), minAdvanceMin: 60 });
    const start = slots[(i * 5) % Math.max(1, slots.length)];
    if (!start) return false;
    const client = clients[i % clients.length]!;
    const end = endTime(start, duration);
    const status = past ? (i % 6 === 5 ? 'no_show' : 'completed') : 'confirmed';
    const usePlan = client.uid === joao.uid;
    const ref = db.collection('appointments').doc();
    await ref.set({
      clientId: client.uid,
      clientName: client.name,
      clientPhone: client.phone,
      barberId: barber.id,
      barberName: barber.displayName,
      services: pick.map((p) => ({ ...p, coveredByPlan: usePlan && SEED_SERVICES.find((x) => x.name === p.name)!.includedInPlans })),
      date,
      start,
      end,
      startAt: Timestamp.fromDate(shopTimeToDate(date, start)),
      durationMin: duration,
      totalCents: pick.reduce((sum, x) => sum + x.priceCents, 0),
      dueAtShopCents: usePlan ? 0 : pick.reduce((sum, x) => sum + x.priceCents, 0),
      status,
      paymentMode: usePlan ? 'plan' : 'pay_at_shop',
      paymentId: null,
      subscriptionId: usePlan ? 'seed-annual' : null,
      usageCycle: usePlan ? cycleKey(date) : null,
      firstVisit: past && i < clients.length,
      notes: i % 4 === 0 ? 'Prefiro máquina 2 nas laterais.' : null,
      cancelReason: null,
      cancelledAt: null,
      reminders: {},
      createdAt: FieldValue.serverTimestamp(),
    });
    if (status === 'confirmed') {
      for (const hhmm of lockSlices(start, duration + barber.bufferMin, 15)) {
        await db.doc(`slotLocks/${barber.id}_${date}_${hhmm}`).set({ appointmentId: ref.id, createdAt: FieldValue.serverTimestamp() });
      }
    }
    busy.set(key, [...(busy.get(key) ?? []), { start, end }]);
    created++;
    return true;
  }

  // 12 past appointments (completed / no-show), then 8 upcoming ones.
  let i = 0;
  for (let offset = -1; created < 12 && offset > -30; offset--) {
    for (let k = 0; k < 2 && created < 12; k++) await bookOne(addDaysToDateKey(today, offset), true, i++);
  }
  for (let offset = 0; created < 20 && offset < 30; offset++) {
    for (let k = 0; k < 2 && created < 20; k++) await bookOne(addDaysToDateKey(today, offset), false, i++);
  }

  // Materialise public availability for the next 14 days (Functions triggers keep it fresh afterwards).
  for (const barber of barbers) {
    for (let i = 0; i < 14; i++) {
      const date = addDaysToDateKey(today, i);
      const a = computeDayAvailability(barber, date, null, busy.get(`${barber.id}|${date}`) ?? []);
      await db.doc(`availabilityPublic/${barber.id}_${date}`).set({ ...a, updatedAt: FieldValue.serverTimestamp() });
    }
  }

  // Barber client books.
  const appts = await db.collection('appointments').get();
  const book = new Map<string, { name: string; phone: string; visits: number; noShows: number; last: Timestamp | null; counts: Record<string, number> }>();
  for (const d of appts.docs) {
    const a = d.data();
    const k = `${a.barberId}|${a.clientId}`;
    const e = book.get(k) ?? { name: a.clientName, phone: a.clientPhone, visits: 0, noShows: 0, last: null as Timestamp | null, counts: {} as Record<string, number> };
    if (a.status === 'completed') {
      e.visits++;
      if (!e.last || a.startAt.toMillis() > e.last.toMillis()) e.last = a.startAt;
    }
    if (a.status === 'no_show') e.noShows++;
    for (const s of a.services) e.counts[s.name] = (e.counts[s.name] ?? 0) + 1;
    book.set(k, e);
  }
  for (const [k, e] of book) {
    const [barberId, clientId] = k.split('|');
    await db.doc(`barberClients/${barberId}/clients/${clientId}`).set({
      clientId,
      name: e.name,
      phone: e.phone,
      visits: e.visits,
      noShows: e.noShows,
      lastVisitAt: e.last,
      favoriteServices: Object.entries(e.counts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n]) => n),
      serviceCounts: e.counts,
      hasActivePlan: clientId === joao.uid,
      privateNotes: clientId === joao.uid ? 'Máquina 2 nas laterais, risca do lado esquerdo.' : '',
    });
  }

  console.log(`Done: ${barbers.length} barbers, ${clients.length} clients, ${created} appointments.`);
  console.log(`Test password for every seeded account: ${PASSWORD}`);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
