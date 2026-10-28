import { logger } from 'firebase-functions/v2';
import { FieldValue, db } from './lib/admin';

/**
 * Notifications go to three channels:
 *  - in-app inbox (users/{uid}/notifications)
 *  - e-mail via the "Trigger Email from Firestore" extension (writes to the `mail` collection)
 *  - WhatsApp through WhatsAppNotifier, ready for a real provider (Meta Cloud API, Z-API, Twilio…)
 */
export interface WhatsAppNotifier {
  send(toE164: string, text: string): Promise<void>;
}

/** Placeholder until a provider is chosen: records that a message would be sent, without the content. */
export class NoopWhatsAppNotifier implements WhatsAppNotifier {
  async send(): Promise<void> {
    logger.info('whatsapp notifier not configured; message skipped');
  }
}

export const whatsapp: WhatsAppNotifier = new NoopWhatsAppNotifier();

interface Message {
  uid: string;
  email?: string | null;
  phone?: string | null;
  title: string;
  body: string;
  link?: string;
}

function html(title: string, body: string, link?: string): string {
  const site = process.env.SITE_URL ?? 'https://barbeariaclassea-9f2b4.web.app';
  return `<div style="background:#050505;padding:32px;font-family:Arial,sans-serif;color:#F5F1E8">
  <p style="color:#E9B542;letter-spacing:.12em;text-transform:uppercase;font-size:12px;margin:0 0 16px">Classe A Barbearia</p>
  <h1 style="font-size:22px;margin:0 0 12px">${title}</h1>
  <p style="font-size:16px;line-height:1.5;color:#d8d2c6">${body}</p>
  ${link ? `<p style="margin-top:24px"><a href="${site}${link}" style="background:#E9B542;color:#050505;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:bold">Abrir no app</a></p>` : ''}
</div>`;
}

export async function notify(m: Message): Promise<void> {
  const batch = db.batch();
  batch.set(db.collection(`users/${m.uid}/notifications`).doc(), {
    title: m.title,
    body: m.body,
    link: m.link ?? null,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });
  if (m.email) {
    batch.set(db.collection('mail').doc(), {
      to: m.email,
      message: { subject: m.title, text: m.body, html: html(m.title, m.body, m.link) },
      createdAt: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
  if (m.phone) await whatsapp.send(m.phone, `${m.title}\n${m.body}`).catch(() => undefined);
}

export async function notifyUser(uid: string, title: string, body: string, link?: string): Promise<void> {
  const snap = await db.doc(`users/${uid}`).get();
  if (!snap.exists || snap.get('deletedAt')) return;
  await notify({ uid, email: snap.get('email'), phone: snap.get('phone'), title, body, link });
}
