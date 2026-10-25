import type { DocumentReference, Transaction } from 'firebase-admin/firestore';
import {
  cancelAppointmentSchema,
  barberUpdateStatusSchema,
  createAppointmentSchema,
  getAvailableSlotsSchema,
  rescheduleAppointmentSchema,
} from '../../shared/schemas';
import { endTime, generateSlots, lockSlices } from '../../shared/slots';
import { addDaysToDateKey, cycleKey, shopNow, shopTimeToDate } from '../../shared/time';
import type {
  Appointment,
  AppointmentService,
  Barber,
  PaymentMode,
  Service,
  ShopSettings,
  Subscription,
} from '../../shared/types';
import { OCCUPYING, buildAvailability, recomputeAvailability } from './availability';
import { FieldValue, Timestamp, db } from './lib/admin';
import { type Caller, callable, fail } from './lib/callable';
import { findActiveSubscription, getBarber, getProfile, getServices, getSettings } from './lib/data';
import { notifyUser } from './notify';
import { gateway } from './payments/gateway';

const LOCK_STEP = 15;

function assertBookable(date: string, start: string, settings: ShopSettings) {
  const now = shopNow();
  const last = addDaysToDateKey(now.date, settings.bookingWindowDays - 1);
  if (date < now.date || date > last) {
    fail('failed-precondition', 'out-of-window', `Agendamos com até ${settings.bookingWindowDays} dias de antecedência.`);
  }
  const startAt = shopTimeToDate(date, start);
  if (startAt.getTime() < Date.now() + settings.minAdvanceMin * 60_000) {
    fail('failed-precondition', 'too-soon', 'Esse horário já passou ou está muito próximo. Escolha outro.');
  }
}

function assertBarberDoesAll(barber: Barber, services: Service[]) {
  if (!barber.active) fail('failed-precondition', 'barber-inactive', 'Este barbeiro não está atendendo no momento.');
  if (!services.every((s) => barber.serviceIds.includes(s.id))) {
    fail('failed-precondition', 'barber-service', 'Este barbeiro não faz todos os serviços escolhidos.');
  }
}

const lockRefs = (barberId: string, date: string, start: string, durationMin: number) =>
  lockSlices(start, durationMin, LOCK_STEP).map((hhmm) => db.doc(`slotLocks/${barberId}_${date}_${hhmm}`));

/**
 * Inside a transaction: re-validates the slot against fresh availability and claims every 15-minute
 * slice it occupies. Any existing lock means someone else got there first.
 */
async function claimSlot(
  tx: Transaction,
  barber: Barber,
  date: string,
  start: string,
  durationMin: number,
  settings: ShopSettings,
  appointmentId: string,
  ignoreAppointmentId?: string,
): Promise<DocumentReference[]> {
  const availability = await buildAvailability(barber, date, tx);
  if (ignoreAppointmentId) {
    // Rescheduling inside the same day: the old booking must not block its own new slot.
    const old = await tx.get(db.doc(`appointments/${ignoreAppointmentId}`));
    const o = old.data();
    if (o && o.barberId === barber.id && o.date === date) {
      availability.busy = availability.busy.filter((b) => !(b.start === o.start && b.end === o.end));
    }
  }
  const slots = generateSlots(availability, { durationMin, now: shopNow(), minAdvanceMin: settings.minAdvanceMin });
  if (!slots.includes(start)) fail('already-exists', 'slot-taken', 'Esse horário acabou de ser reservado. Escolha outro.');

  const refs = lockRefs(barber.id, date, start, durationMin + barber.bufferMin);
  const locks = await Promise.all(refs.map((r) => tx.get(r)));
  for (const l of locks) {
    if (l.exists && l.get('appointmentId') !== ignoreAppointmentId) {
      fail('already-exists', 'slot-taken', 'Esse horário acabou de ser reservado. Escolha outro.');
    }
  }
  return refs.map((r) => {
    tx.set(r, { appointmentId, createdAt: FieldValue.serverTimestamp() });
    return r;
  });
}

export const getAvailableSlots = callable(
  getAvailableSlotsSchema,
  async ({ barberId, date, serviceIds }) => {
    const [settings, services] = await Promise.all([getSettings(), getServices(serviceIds)]);
    const durationMin = services.reduce((sum, s) => sum + s.durationMin, 0);
    const barbers =
      barberId === 'any'
        ? (await db.collection('barbers').where('active', '==', true).get()).docs.map(
            (d) => ({ id: d.id, ...d.data() }) as Barber,
          )
        : [await getBarber(barberId)];
    const result: { barberId: string; slots: string[] }[] = [];
    for (const b of barbers.filter((b) => services.every((s) => b.serviceIds.includes(s.id)))) {
      const availability = await buildAvailability(b, date);
      result.push({
        barberId: b.id,
        slots: generateSlots(availability, { durationMin, now: shopNow(), minAdvanceMin: settings.minAdvanceMin }),
      });
    }
    return { durationMin, barbers: result };
  },
  { public: true },
);

interface PlanCoverage {
  subscription: Subscription | null;
  services: AppointmentService[];
  dueAtShopCents: number;
}

async function planCoverage(clientId: string, services: Service[], paymentMode: PaymentMode): Promise<PlanCoverage> {
  const lines = services.map((s) => ({ id: s.id, name: s.name, durationMin: s.durationMin, priceCents: s.priceCents }));
  const total = lines.reduce((sum, s) => sum + s.priceCents, 0);
  if (paymentMode !== 'plan') {
    return { subscription: null, services: lines, dueAtShopCents: paymentMode === 'pay_at_shop' ? total : 0 };
  }
  const sub = await findActiveSubscription(clientId);
  if (!sub || sub.status !== 'active' || sub.currentPeriodEnd.toMillis() < Date.now()) {
    fail('failed-precondition', 'no-plan', 'Você não tem um plano ativo. Escolha outra forma de pagamento.');
  }
  if (!services.some((s) => s.includedInPlans)) {
    fail('failed-precondition', 'not-covered', 'Nenhum dos serviços escolhidos está incluso no plano.');
  }
  const covered = lines.map((l, i) => ({ ...l, coveredByPlan: services[i]!.includedInPlans }));
  return {
    subscription: sub,
    services: covered,
    dueAtShopCents: covered.filter((l) => !l.coveredByPlan).reduce((s, l) => s + l.priceCents, 0),
  };
}

async function assertClientLimits(clientId: string, date: string, start: string, end: string, settings: ShopSettings, ignoreId?: string) {
  const future = await db
    .collection('appointments')
    .where('clientId', '==', clientId)
    .where('status', '==', 'confirmed')
    .where('startAt', '>=', Timestamp.now())
    .get();
  const others = future.docs.filter((d) => d.id !== ignoreId);
  if (others.length >= settings.maxFutureAppointments) {
    fail(
      'failed-precondition',
      'too-many',
      `Você já tem ${others.length} agendamentos marcados. Cancele ou aguarde um deles para agendar outro.`,
    );
  }
  const clash = others.some((d) => d.get('date') === date && d.get('start') < end && start < d.get('end'));
  if (clash) fail('failed-precondition', 'overlap', 'Você já tem um atendimento nesse horário.');
}

/** Picks the barber with the earliest availability for "Sem preferência" at the requested time. */
async function resolveBarber(barberId: string, date: string, start: string, services: Service[], settings: ShopSettings): Promise<Barber> {
  if (barberId !== 'any') return getBarber(barberId);
  const durationMin = services.reduce((sum, s) => sum + s.durationMin, 0);
  const snap = await db.collection('barbers').where('active', '==', true).orderBy('order').get();
  for (const d of snap.docs) {
    const b = { id: d.id, ...d.data() } as Barber;
    if (!services.every((s) => b.serviceIds.includes(s.id))) continue;
    const slots = generateSlots(await buildAvailability(b, date), { durationMin, now: shopNow(), minAdvanceMin: settings.minAdvanceMin });
    if (slots.includes(start)) return b;
  }
  fail('already-exists', 'slot-taken', 'Esse horário acabou de ser reservado. Escolha outro.');
}

export const createAppointment = callable(createAppointmentSchema, async (input, caller) => {
  const [settings, services, profile] = await Promise.all([
    getSettings(),
    getServices(input.serviceIds),
    getProfile(caller.uid),
  ]);
  const barber = await resolveBarber(input.barberId, input.date, input.start, services, settings);
  assertBarberDoesAll(barber, services);
  assertBookable(input.date, input.start, settings);

  const durationMin = services.reduce((sum, s) => sum + s.durationMin, 0);
  const totalCents = services.reduce((sum, s) => sum + s.priceCents, 0);
  const end = endTime(input.start, durationMin);
  await assertClientLimits(caller.uid, input.date, input.start, end, settings);

  const paid = input.paymentMode === 'card_mock' || input.paymentMode === 'pix_mock';
  if (paid && !caller.emailVerified) {
    fail('failed-precondition', 'email-unverified', 'Confirme seu e-mail para pagar online. Enviamos o link para sua caixa de entrada.');
  }

  const coverage = await planCoverage(caller.uid, services, input.paymentMode);
  const ref = db.collection('appointments').doc();

  // Card: charge before the transaction; refund if the slot is lost.
  let paymentId: string | null = null;
  let chargeRef: string | null = null;
  if (input.paymentMode === 'card_mock') {
    const pmSnap = input.paymentMethodId
      ? await db.doc(`users/${caller.uid}/paymentMethods/${input.paymentMethodId}`).get()
      : null;
    if (!pmSnap?.exists) fail('failed-precondition', 'no-card', 'Escolha um cartão salvo para pagar.');
    const result = await gateway.charge({
      token: pmSnap.get('token'),
      amountCents: totalCents,
      description: `Classe A - ${services.map((s) => s.name).join(' + ')}`,
    });
    const payRef = db.collection('payments').doc();
    await payRef.set({
      clientId: caller.uid,
      appointmentId: ref.id,
      amountCents: totalCents,
      method: 'card_mock',
      status: result.status,
      description: services.map((s) => s.name).join(' + '),
      gatewayRef: result.gatewayRef,
      declineReason: result.status === 'declined' ? result.declineReason : null,
      createdAt: FieldValue.serverTimestamp(),
    });
    if (result.status === 'declined') fail('failed-precondition', result.declineReason, result.message);
    paymentId = payRef.id;
    chargeRef = result.gatewayRef;
  }

  try {
    await db.runTransaction(async (tx) => {
      // All reads first (Firestore transactions require reads before writes).
      const pixRef = input.paymentMode === 'pix_mock' && input.pixChargeId ? db.doc(`pixCharges/${input.pixChargeId}`) : null;
      const pix = pixRef ? await tx.get(pixRef) : null;
      const subRef = coverage.subscription ? db.doc(`subscriptions/${coverage.subscription.id}`) : null;
      const sub = subRef ? await tx.get(subRef) : null;
      const prior = await tx.get(
        db.collection('appointments').where('barberId', '==', barber.id).where('clientId', '==', caller.uid).where('status', '==', 'completed').limit(1),
      );
      await claimSlot(tx, barber, input.date, input.start, durationMin, settings, ref.id);

      if (input.paymentMode === 'pix_mock') {
        if (!pix?.exists || pix.get('clientId') !== caller.uid) fail('failed-precondition', 'pix-missing', 'Gere o PIX antes de confirmar.');
        if (pix.get('status') !== 'approved') fail('failed-precondition', 'pix-pending', 'O PIX ainda não foi pago.');
        if (pix.get('consumed')) fail('failed-precondition', 'pix-used', 'Este PIX já foi usado em outro agendamento.');
        if (pix.get('amountCents') !== totalCents) fail('failed-precondition', 'pix-amount', 'O valor do PIX não confere com o agendamento.');
        tx.update(pixRef!, { consumed: true, appointmentId: ref.id });
        tx.update(db.doc(`payments/${pix.get('paymentId')}`), { appointmentId: ref.id });
        paymentId = pix.get('paymentId');
      }

      if (sub) {
        const s = sub.data() as Subscription;
        const cycle = cycleKey(shopNow().date);
        const used = s.usage?.cycle === cycle ? s.usage.cutsUsed : 0;
        if (s.cutsPerMonth != null && used >= s.cutsPerMonth) {
          fail('resource-exhausted', 'plan-exhausted', 'Os cortes do seu plano neste mês acabaram. Escolha outra forma de pagamento.');
        }
        tx.update(subRef!, { usage: { cycle, cutsUsed: used + 1 } });
      }

      const appointment: Omit<Appointment, 'id' | 'startAt' | 'createdAt'> & Record<string, unknown> = {
        clientId: caller.uid,
        clientName: profile.name,
        clientPhone: profile.phone,
        barberId: barber.id,
        barberName: barber.displayName,
        services: coverage.services,
        date: input.date,
        start: input.start,
        end,
        durationMin,
        totalCents,
        dueAtShopCents: coverage.dueAtShopCents,
        status: 'confirmed',
        paymentMode: input.paymentMode,
        paymentId,
        subscriptionId: coverage.subscription?.id ?? null,
        firstVisit: prior.empty,
        notes: input.notes || null,
        cancelReason: null,
        cancelledAt: null,
        reminders: {},
        usageCycle: coverage.subscription ? cycleKey(shopNow().date) : null,
      };
      tx.create(ref, {
        ...appointment,
        startAt: Timestamp.fromDate(shopTimeToDate(input.date, input.start)),
        createdAt: FieldValue.serverTimestamp(),
      });
    });
  } catch (e) {
    if (chargeRef && paymentId) {
      await gateway.refund({ gatewayRef: chargeRef, amountCents: totalCents });
      await db.doc(`payments/${paymentId}`).update({ status: 'refunded' });
    }
    throw e;
  }

  await recomputeAvailability(barber.id, input.date);
  void notifyUser(
    caller.uid,
    'Agendamento confirmado',
    `${services.map((s) => s.name).join(' + ')} com ${barber.displayName} em ${input.date.split('-').reverse().join('/')} às ${input.start}.`,
    '/cliente/agendamentos',
  );
  return { id: ref.id, barberId: barber.id, barberName: barber.displayName, date: input.date, start: input.start, end };
});

/** Cancels inside a transaction: deletes its locks and returns plan usage (all reads before writes). */
async function cancelInTx(
  id: string,
  check: (a: Appointment) => void,
  patch: Record<string, unknown>,
  refundPlan: (a: Appointment) => boolean,
): Promise<Appointment> {
  let appt!: Appointment;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(db.doc(`appointments/${id}`));
    if (!snap.exists) fail('not-found', 'not-found', 'Agendamento não encontrado.');
    appt = { id: snap.id, ...(snap.data() as Omit<Appointment, 'id'>) };
    check(appt);
    // Gather all lock reads first.
    const refs = lockRefs(appt.barberId, appt.date, appt.start, appt.durationMin + 60);
    const locks = await Promise.all(refs.map((r) => tx.get(r)));
    let sub = null;
    if (refundPlan(appt) && appt.paymentMode === 'plan' && appt.subscriptionId) sub = await tx.get(db.doc(`subscriptions/${appt.subscriptionId}`));
    locks.forEach((l, i) => {
      if (l.exists && l.get('appointmentId') === appt.id) tx.delete(refs[i]!);
    });
    if (sub?.exists) {
      const usage = sub.get('usage') as Subscription['usage'];
      const cycle = (appt as Appointment & { usageCycle?: string }).usageCycle;
      if (usage && usage.cycle === cycle && usage.cutsUsed > 0) tx.update(sub.ref, { 'usage.cutsUsed': usage.cutsUsed - 1 });
    }
    tx.update(snap.ref, { ...patch, cancelledAt: FieldValue.serverTimestamp() });
  });
  return appt;
}

async function refundCard(appt: Appointment) {
  if (appt.paymentMode !== 'card_mock' && appt.paymentMode !== 'pix_mock') return;
  if (!appt.paymentId) return;
  const pay = await db.doc(`payments/${appt.paymentId}`).get();
  if (pay.get('status') !== 'approved') return;
  await gateway.refund({ gatewayRef: pay.get('gatewayRef'), amountCents: pay.get('amountCents') });
  await pay.ref.update({ status: 'refunded' });
}

function withinPolicy(appt: Appointment, settings: ShopSettings): boolean {
  return appt.startAt.toMillis() - Date.now() >= settings.cancellationPolicyHours * 3_600_000;
}

export const cancelAppointment = callable(cancelAppointmentSchema, async ({ id, reason }, caller) => {
  const settings = await getSettings();
  const appt = await cancelInTx(
    id,
    (a) => {
      if (a.clientId !== caller.uid) fail('permission-denied', 'forbidden', 'Este agendamento não é seu.');
      if (a.status !== 'confirmed') fail('failed-precondition', 'not-active', 'Este agendamento já foi encerrado.');
      if (!withinPolicy(a, settings)) {
        fail(
          'failed-precondition',
          'policy',
          `Cancelamentos pelo app vão até ${settings.cancellationPolicyHours} h antes. Fale com a barbearia pelo WhatsApp.`,
        );
      }
    },
    { status: 'cancelled_by_client', cancelReason: reason || null },
    () => true,
  );
  await refundCard(appt);
  await recomputeAvailability(appt.barberId, appt.date);
  return { ok: true };
});

export const rescheduleAppointment = callable(rescheduleAppointmentSchema, async ({ id, newSlot }, caller) => {
  const settings = await getSettings();
  const oldSnap = await db.doc(`appointments/${id}`).get();
  if (!oldSnap.exists) fail('not-found', 'not-found', 'Agendamento não encontrado.');
  const old = { id: oldSnap.id, ...(oldSnap.data() as Omit<Appointment, 'id'>) };
  if (old.clientId !== caller.uid) fail('permission-denied', 'forbidden', 'Este agendamento não é seu.');
  if (old.status !== 'confirmed') fail('failed-precondition', 'not-active', 'Este agendamento já foi encerrado.');
  if (!withinPolicy(old, settings)) {
    fail('failed-precondition', 'policy', `Reagendamentos pelo app vão até ${settings.cancellationPolicyHours} h antes. Fale com a barbearia pelo WhatsApp.`);
  }
  const services = await getServices(old.services.map((s) => s.id));
  const barber = await resolveBarber(newSlot.barberId, newSlot.date, newSlot.start, services, settings);
  assertBarberDoesAll(barber, services);
  assertBookable(newSlot.date, newSlot.start, settings);
  const end = endTime(newSlot.start, old.durationMin);
  await assertClientLimits(caller.uid, newSlot.date, newSlot.start, end, settings, old.id);

  const ref = db.collection('appointments').doc();
  await db.runTransaction(async (tx) => {
    const oldLockRefs = lockRefs(old.barberId, old.date, old.start, old.durationMin + 60);
    const oldLocks = await Promise.all(oldLockRefs.map((r) => tx.get(r)));
    await claimSlot(tx, barber, newSlot.date, newSlot.start, old.durationMin, settings, ref.id, old.id);
    oldLocks.forEach((l, i) => {
      // A new lock on the same path was just written by claimSlot; only drop the old ones it did not reuse.
      if (l.exists && l.get('appointmentId') === old.id) {
        const path = oldLockRefs[i]!.path;
        const reused = lockRefs(barber.id, newSlot.date, newSlot.start, old.durationMin + barber.bufferMin).some((r) => r.path === path);
        if (!reused) tx.delete(oldLockRefs[i]!);
      }
    });
    const { id: _old, ...rest } = old;
    void _old;
    tx.create(ref, {
      ...rest,
      barberId: barber.id,
      barberName: barber.displayName,
      date: newSlot.date,
      start: newSlot.start,
      end,
      startAt: Timestamp.fromDate(shopTimeToDate(newSlot.date, newSlot.start)),
      rescheduledFrom: old.id,
      reminders: {},
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.update(oldSnap.ref, {
      status: 'cancelled_by_client',
      cancelReason: 'Reagendado pelo cliente',
      rescheduledTo: ref.id,
      cancelledAt: FieldValue.serverTimestamp(),
    });
  });
  await Promise.all([recomputeAvailability(old.barberId, old.date), recomputeAvailability(barber.id, newSlot.date)]);
  void notifyUser(caller.uid, 'Horário remarcado', `Seu atendimento foi para ${newSlot.date.split('-').reverse().join('/')} às ${newSlot.start}.`, '/cliente/agendamentos');
  return { id: ref.id };
});

export const barberUpdateAppointmentStatus = callable(
  barberUpdateStatusSchema,
  async ({ id, status, reason }, caller: Caller) => {
    const isAdmin = caller.roles.includes('admin');
    const check = (a: Appointment) => {
      if (a.barberId !== caller.uid && !isAdmin) fail('permission-denied', 'forbidden', 'Este atendimento não é da sua agenda.');
      if (status === 'cancelled_by_barber' && a.status !== 'confirmed') {
        fail('failed-precondition', 'not-active', 'Só dá para cancelar atendimentos confirmados.');
      }
      if (status !== 'cancelled_by_barber' && !['confirmed', 'completed', 'no_show'].includes(a.status)) {
        fail('failed-precondition', 'not-active', 'Este atendimento foi cancelado.');
      }
    };
    if (status === 'cancelled_by_barber') {
      const appt = await cancelInTx(id, check, { status, cancelReason: reason }, () => true);
      await refundCard(appt);
      await recomputeAvailability(appt.barberId, appt.date);
      await notifyUser(
        appt.clientId,
        'Seu atendimento foi cancelado',
        `${appt.barberName} precisou cancelar o horário de ${appt.date.split('-').reverse().join('/')} às ${appt.start}. Motivo: ${reason}. Escolha um novo horário no app.`,
        '/agendar',
      );
      return { ok: true };
    }
    const ref = db.doc(`appointments/${id}`);
    const snap = await ref.get();
    if (!snap.exists) fail('not-found', 'not-found', 'Atendimento não encontrado.');
    const appt = { id: snap.id, ...(snap.data() as Omit<Appointment, 'id'>) };
    check(appt);
    if (appt.startAt.toMillis() > Date.now() + 30 * 60_000) {
      fail('failed-precondition', 'too-early', 'Só dá para marcar como concluído ou falta a partir do horário do atendimento.');
    }
    await ref.update({ status, statusUpdatedAt: FieldValue.serverTimestamp() });
    return { ok: true };
  },
  { roles: ['barber', 'admin'] },
);

export { OCCUPYING };
