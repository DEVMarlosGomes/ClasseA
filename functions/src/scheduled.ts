import { logger } from 'firebase-functions/v2';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { SHOP_TZ } from '../../shared/time';
import { REGION, Timestamp, db } from './lib/admin';
import { notifyUser } from './notify';
import { processSubscriptions } from './payments';

export const dailySubscriptions = onSchedule({ schedule: '5 0 * * *', timeZone: SHOP_TZ, region: REGION }, async () => {
  const stats = await processSubscriptions();
  logger.info('subscriptions processed', stats);
});

/** Sends the 24 h and 2 h reminders. Runs every 15 minutes with a 15-minute window per reminder. */
export async function sendReminders(now = new Date()): Promise<number> {
  let sent = 0;
  for (const [key, hours, label] of [
    ['h24', 24, 'amanhã'],
    ['h2', 2, 'daqui a 2 horas'],
  ] as const) {
    const from = new Date(now.getTime() + hours * 3_600_000 - 15 * 60_000);
    const to = new Date(now.getTime() + hours * 3_600_000 + 15 * 60_000);
    const snap = await db
      .collection('appointments')
      .where('status', '==', 'confirmed')
      .where('startAt', '>=', Timestamp.fromDate(from))
      .where('startAt', '<=', Timestamp.fromDate(to))
      .get();
    for (const d of snap.docs) {
      if (d.get(`reminders.${key}`)) continue;
      await d.ref.update({ [`reminders.${key}`]: true });
      await notifyUser(
        d.get('clientId'),
        `Lembrete: seu horário é ${label}`,
        `${d.get('services').map((s: { name: string }) => s.name).join(' + ')} com ${d.get('barberName')} às ${d.get('start')}. Se não puder ir, cancele pelo app.`,
        '/cliente/agendamentos',
      );
      sent++;
    }
  }
  return sent;
}

export const appointmentReminders = onSchedule({ schedule: 'every 15 minutes', timeZone: SHOP_TZ, region: REGION }, async () => {
  const sent = await sendReminders();
  logger.info('reminders sent', { sent });
});
