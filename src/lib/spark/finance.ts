import {
  commissionPctFor,
  computeCommission,
  estimateFee,
  financeSettings,
  onlinePaidCents,
  periodOf,
  planCoveredCents,
} from '@shared/finance';
import { settleAppointmentSchema } from '@shared/schemas';
import type { Appointment, Barber, FinanceSettings } from '@shared/types';
import { fail, kit } from './core';
import { handler } from './registry';

/**
 * Spark mirror of functions/src/finance.ts (same rules, from @shared/finance). In Spark the browser
 * writes the commission, so the rules can only check who writes, not the numbers: real financial
 * integrity needs the Blaze backend (Functions).
 */
export const settleAppointment = handler(
  settleAppointmentSchema,
  async (input, caller) => {
    const { db, doc, runTransaction, serverTimestamp } = await kit();
    const anyAgenda = caller.roles.includes('admin') || caller.roles.includes('reception');
    const apptRef = doc(db, `appointments/${input.id}`);
    const commissionRef = doc(db, `commissions/${input.id}`);

    await runTransaction(db, async (tx) => {
      const apptSnap = await tx.get(apptRef);
      if (!apptSnap.exists()) fail('not-found', 'not-found', 'Atendimento não encontrado.');
      const appt = { id: apptSnap.id, ...(apptSnap.data() as Omit<Appointment, 'id'>) };
      if (appt.barberId !== caller.uid && !anyAgenda) fail('permission-denied', 'forbidden', 'Este atendimento não é da sua agenda.');
      if (appt.settlement) fail('failed-precondition', 'already-settled', 'Este atendimento já teve baixa.');
      if (appt.status !== 'confirmed' && appt.status !== 'completed') {
        fail('failed-precondition', 'not-active', 'Só dá baixa em atendimento confirmado ou concluído.');
      }
      if (appt.startAt.toMillis() > Date.now() + 30 * 60_000) {
        fail('failed-precondition', 'too-early', 'A baixa só pode ser feita a partir do horário do atendimento.');
      }
      // In Spark the staff may read settings/finance (percentages and fee table only, no revenue);
      // in production only the owner and the Functions read it.
      const settingsSnap = await tx.get(doc(db, 'settings/finance'));
      const settings: FinanceSettings = financeSettings(settingsSnap.data() as Partial<FinanceSettings> | undefined);
      const barber = (await tx.get(doc(db, `barbers/${appt.barberId}`))).data() as Barber | undefined;

      if (appt.dueAtShopCents > 0 && !input.method) fail('invalid-argument', 'method', 'Informe como o cliente pagou.');
      const platform = input.method === 'cash' ? ('none' as const) : input.platform;
      const shop =
        appt.dueAtShopCents > 0 && input.method
          ? { method: input.method, platform, receivedCents: input.receivedCents, feeCents: estimateFee(settings, platform, input.method, input.receivedCents) }
          : null;
      const onlineCents = onlinePaidCents(appt);
      // InfinitePay (real) carries its fee; simulated payments (*_mock) have none.
      const online =
        onlineCents <= 0
          ? null
          : appt.paymentMode === 'online'
            ? { platform: 'infinitepay' as const, receivedCents: onlineCents, feeCents: estimateFee(settings, 'infinitepay', appt.onlineMethod ?? 'credit', onlineCents) }
            : { platform: 'none' as const, receivedCents: onlineCents, feeCents: 0 };
      const covered = planCoveredCents(appt);
      const calc = computeCommission({ shop, online, planCoveredCents: covered }, commissionPctFor(barber, settings), settings);

      tx.update(apptRef, {
        status: 'completed',
        statusUpdatedAt: serverTimestamp(),
        closure: null,
        settlement: {
          shop,
          online,
          planCoveredCents: covered,
          receivedCents: calc.receivedCents,
          feeCents: calc.feeCents,
          paidAt: serverTimestamp(),
          registeredBy: caller.uid,
          registeredByName: caller.name ?? caller.email ?? '',
        },
      });
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
        settledAt: serverTimestamp(),
      });
    });
    return { ok: true };
  },
  { roles: ['barber', 'admin', 'reception'] },
);
