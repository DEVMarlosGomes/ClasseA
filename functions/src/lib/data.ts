import type { Transaction } from 'firebase-admin/firestore';
import { DEFAULT_SETTINGS } from '../../../shared/defaults';
import type { Barber, Service, ShopSettings, Subscription, UserProfile } from '../../../shared/types';
import { db } from './admin';
import { fail } from './callable';

export async function getSettings(): Promise<ShopSettings> {
  const snap = await db.doc('settings/shop').get();
  return { ...DEFAULT_SETTINGS, ...(snap.data() as Partial<ShopSettings> | undefined) };
}

export async function getBarber(barberId: string, tx?: Transaction): Promise<Barber> {
  const ref = db.doc(`barbers/${barberId}`);
  const snap = tx ? await tx.get(ref) : await ref.get();
  if (!snap.exists) fail('not-found', 'barber-not-found', 'Barbeiro não encontrado.');
  return { id: snap.id, ...(snap.data() as Omit<Barber, 'id'>) };
}

export async function getServices(ids: string[]): Promise<Service[]> {
  const unique = [...new Set(ids)];
  const snaps = await db.getAll(...unique.map((id) => db.doc(`services/${id}`)));
  const services = snaps.map((s) => {
    if (!s.exists || s.data()?.active !== true) fail('not-found', 'service-unavailable', 'Um dos serviços escolhidos não está mais disponível.');
    return { id: s.id, ...(s.data() as Omit<Service, 'id'>) };
  });
  return services.sort((a, b) => a.order - b.order);
}

export async function getProfile(uid: string): Promise<UserProfile> {
  const snap = await db.doc(`users/${uid}`).get();
  if (!snap.exists) fail('failed-precondition', 'profile-missing', 'Complete seu cadastro para continuar.');
  return snap.data() as UserProfile;
}

export async function findActiveSubscription(clientId: string): Promise<Subscription | null> {
  const snap = await db
    .collection('subscriptions')
    .where('clientId', '==', clientId)
    .where('status', 'in', ['active', 'past_due'])
    .limit(1)
    .get();
  const doc = snap.docs[0];
  return doc ? ({ id: doc.id, ...doc.data() } as Subscription) : null;
}

export function randomId(prefix: string, len = 10): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `${prefix}${out}`;
}
