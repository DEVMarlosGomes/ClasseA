import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-classe-a',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await Promise.all([
      setDoc(doc(db, 'services/corte'), { name: 'Corte', active: true }),
      setDoc(doc(db, 'users/client-a'), { name: 'Cliente A', phone: '+5511999999999', role: 'client' }),
      setDoc(doc(db, 'users/client-b'), { name: 'Cliente B', phone: '+5511988888888', role: 'client' }),
      setDoc(doc(db, 'appointments/own'), { clientId: 'client-a', barberId: 'barber-a' }),
      setDoc(doc(db, 'appointments/other'), { clientId: 'client-b', barberId: 'barber-b' }),
      setDoc(doc(db, 'barberClients/barber-a/clients/client-a'), { privateNotes: '', name: 'Cliente A' }),
      setDoc(doc(db, 'barberClients/barber-b/clients/client-b'), { privateNotes: '', name: 'Cliente B' }),
    ]);
  });
});

afterAll(async () => env.cleanup());

describe('public catalogue', () => {
  it('allows reads and blocks writes from anonymous visitors', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(db, 'services/corte')));
    await assertFails(setDoc(doc(db, 'services/barba'), { name: 'Barba', active: true }));
  });
});

describe('client isolation', () => {
  it('allows a client to read only their own profile and appointments', async () => {
    const db = env.authenticatedContext('client-a', { roles: ['client'] }).firestore();
    await assertSucceeds(getDoc(doc(db, 'users/client-a')));
    await assertFails(getDoc(doc(db, 'users/client-b')));
    await assertSucceeds(getDoc(doc(db, 'appointments/own')));
    await assertFails(getDoc(doc(db, 'appointments/other')));
    await assertFails(setDoc(doc(db, 'appointments/new'), { clientId: 'client-a', barberId: 'barber-a' }));
  });

  it('allows only the safe profile fields with valid values', async () => {
    const db = env.authenticatedContext('client-a', { roles: ['client'] }).firestore();
    await assertSucceeds(updateDoc(doc(db, 'users/client-a'), { name: 'Cliente Atualizado', phone: '+5511977777777' }));
    await assertFails(updateDoc(doc(db, 'users/client-a'), { role: 'admin' }));
  });
});

describe('barber isolation', () => {
  it('keeps each client book private and only permits private note edits', async () => {
    const db = env.authenticatedContext('barber-a', { roles: ['barber'] }).firestore();
    await assertSucceeds(getDoc(doc(db, 'barberClients/barber-a/clients/client-a')));
    await assertFails(getDoc(doc(db, 'barberClients/barber-b/clients/client-b')));
    await assertSucceeds(updateDoc(doc(db, 'barberClients/barber-a/clients/client-a'), { privateNotes: 'Máquina 2.' }));
    await assertFails(updateDoc(doc(db, 'barberClients/barber-a/clients/client-a'), { name: 'Alterado' }));
  });

  it('allows a barber to write a validated day only for themselves', async () => {
    const db = env.authenticatedContext('barber-a', { roles: ['barber'] }).firestore();
    const day = { status: 'open', blocks: [], extraOpenings: [], updatedBy: 'barber-a', updatedAt: serverTimestamp() };
    await assertSucceeds(setDoc(doc(db, 'barbers/barber-a/days/2026-10-26'), day));
    await assertFails(setDoc(doc(db, 'barbers/barber-b/days/2026-10-26'), day));
  });
});

describe('administrator', () => {
  it('can manage catalogue and read protected business data', async () => {
    const db = env.authenticatedContext('owner', { roles: ['admin'] }).firestore();
    await assertSucceeds(setDoc(doc(db, 'services/barba'), { name: 'Barba', active: true }));
    await assertSucceeds(getDoc(doc(db, 'appointments/other')));
    await assertSucceeds(getDoc(doc(db, 'users/client-b')));
  });
});
