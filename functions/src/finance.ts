import {
  commissionPctFor,
  computeCommission,
  estimateFee,
  financeSettings,
  onlinePaidCents,
  periodOf,
  planCoveredCents,
} from '../../shared/finance';
import { settleAppointmentSchema } from '../../shared/schemas';
import type { Appointment, Barber, FinanceSettings, Settlement } from '../../shared/types';
import { FieldValue, db } from './lib/admin';
import { callable, fail } from './lib/callable';

/**
 * "Dar baixa": marks the visit completed and paid, and writes the barber's commission. Barbers settle
 * their own visits; the front desk and the owner settle any. One transaction, so a double tap can never
 * create two commissions. The commission % and fee rules are frozen into the commission document.
 */
export const settleAppointment = callable(
  settleAppointmentSchema,
  async (input, caller) => {
    const anyAgenda = caller.roles.includes('admin') || caller.roles.includes('reception');
    const apptRef = db.doc(`appointments/${input.id}`);
    const commissionRef = db.doc(`commissions/${input.id}`);

    return db.runTransaction(async (tx) => {
      const [apptSnap, settingsSnap] = await Promise.all([tx.get(apptRef), tx.get(db.doc('settings/finance'))]);
      if (!apptSnap.exists) fail('not-found', 'not-found', 'Atendimento não encontrado.');
      const appt = { id: apptSnap.id, ...(apptSnap.data() as Omit<Appointment, 'id'>) };
      if (appt.barberId !== caller.uid && !anyAgenda) fail('permission-denied', 'forbidden', 'Este atendimento não é da sua agenda.');
      if (appt.settlement) fail('failed-precondition', 'already-settled', 'Este atendimento já teve baixa.');
      if (appt.status !== 'confirmed' && appt.status !== 'completed') {
        fail('failed-precondition', 'not-active', 'Só dá baixa em atendimento confirmado ou concluído.');
      }
      if (appt.startAt.toMillis() > Date.now() + 30 * 60_000) {
        fail('failed-precondition', 'too-early', 'A baixa só pode ser feita a partir do horário do atendimento.');
      }
      const barberSnap = await tx.get(db.doc(`barbers/${appt.barberId}`));
      const barber = barberSnap.data() as Barber | undefined;
      const settings: FinanceSettings = financeSettings(settingsSnap.data() as Partial<FinanceSettings> | undefined);

      const dueAtShop = appt.dueAtShopCents;
      if (dueAtShop > 0 && !input.method) fail('invalid-argument', 'method', 'Informe como o cliente pagou.');
      const shop =
        dueAtShop > 0 && input.method
          ? {
              method: input.method,
              platform: input.method === 'cash' ? ('none' as const) : input.platform,
              receivedCents: input.receivedCents,
              feeCents: estimateFee(settings, input.method === 'cash' ? 'none' : input.platform, input.method, input.receivedCents),
            }
          : null;
      const onlineCents = onlinePaidCents(appt);
      // Online payments are still simulated (mock): no platform fee until InfinitePay is live.
      const online = onlineCents > 0 ? { platform: 'none' as const, receivedCents: onlineCents, feeCents: 0 } : null;
      const covered = planCoveredCents(appt);

      const pct = commissionPctFor(barber, settings);
      const calc = computeCommission({ shop, online, planCoveredCents: covered }, pct, settings);
      const byName = caller.name ?? caller.email ?? '';

      const settlement: Omit<Settlement, 'paidAt'> & { paidAt: FieldValue } = {
        shop,
        online,
        planCoveredCents: covered,
        receivedCents: calc.receivedCents,
        feeCents: calc.feeCents,
        paidAt: FieldValue.serverTimestamp(),
        registeredBy: caller.uid,
        registeredByName: byName,
      };
      tx.update(apptRef, { status: 'completed', statusUpdatedAt: FieldValue.serverTimestamp(), settlement, closure: null });
      tx.set(commissionRef, {
        appointmentId: appt.id,
        barberId: appt.barberId,
        barberName: appt.barberName,
        date: appt.date,
        period: periodOf(appt.date),
        services: appt.services.map((s) => s.name),
        receivedCents: calc.receivedCents,
        feeCents: calc.feeCents,
        deductedFeeCents: calc.deductedFeeCents,
        planCoveredCents: calc.planCoveredCents,
        baseCents: calc.baseCents,
        pct: calc.pct,
        amountCents: calc.amountCents,
        settledAt: FieldValue.serverTimestamp(),
      });
      // The front desk registers payments but never sees commissions: return nothing about them.
      return { ok: true };
    });
  },
  { roles: ['barber', 'admin', 'reception'] },
);
