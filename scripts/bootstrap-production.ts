/**
 * One-time production bootstrap. It creates the first admin claim and the minimum catalog/settings
 * documents without adding demo clients or appointments.
 *
 * Requires Application Default Credentials (prefer `gcloud auth application-default login`) and:
 *   PRODUCTION_PROJECT_ID=... BOOTSTRAP_CONFIRM=... ADMIN_EMAIL=... ADMIN_NAME=... ADMIN_PHONE=... npm run bootstrap:production
 */
import { readFileSync } from 'node:fs';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import {
  DEFAULT_SETTINGS,
  LEGAL_VERSIONS,
  PUBLIC_BARBERS,
  SEED_PLANS,
  SEED_SERVICES,
} from '../shared/defaults';
import type { Role } from '../shared/types';

const projectId = process.env.PRODUCTION_PROJECT_ID?.trim() ?? '';
const confirmation = process.env.BOOTSTRAP_CONFIRM?.trim() ?? '';
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? '';
const name = process.env.ADMIN_NAME?.trim() ?? '';
const phone = process.env.ADMIN_PHONE?.replace(/\D/g, '') ?? '';

if (!projectId || projectId.startsWith('demo-') || confirmation !== projectId) {
  throw new Error(
    'Set PRODUCTION_PROJECT_ID and repeat the exact value in BOOTSTRAP_CONFIRM. Demo projects are refused.',
  );
}
if (!email.includes('@') || name.length < 2 || phone.length < 12) {
  throw new Error(
    'Set ADMIN_EMAIL, ADMIN_NAME and ADMIN_PHONE in Brazilian E.164 format (for example 5511999999999).',
  );
}

initializeApp({ credential: applicationDefault(), projectId });
const auth = getAuth();
const db = getFirestore();

async function createIfMissing(path: string, data: FirebaseFirestore.DocumentData) {
  const ref = db.doc(path);
  if (!(await ref.get()).exists) await ref.create(data);
}

async function main() {
  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch {
    user = await auth.createUser({ email, displayName: name, emailVerified: false });
  }

  const roles: Role[] = ['admin'];
  await auth.setCustomUserClaims(user.uid, { ...(user.customClaims ?? {}), roles });
  await db.doc(`users/${user.uid}`).set(
    {
      name,
      email,
      phone: `+${phone}`,
      role: 'admin',
      roles,
      birthDate: null,
      avatarUrl: null,
      createdAt: FieldValue.serverTimestamp(),
      deletedAt: null,
    },
    { merge: true },
  );

  await createIfMissing('settings/shop', DEFAULT_SETTINGS);
  for (const service of SEED_SERVICES) {
    const id = service.name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    await createIfMissing(`services/${id}`, service);
  }
  for (const { id, ...plan } of SEED_PLANS) await createIfMissing(`plans/${id}`, plan);
  for (const { id, ...barber } of PUBLIC_BARBERS) await createIfMissing(`barbers/${id}`, barber);
  for (const type of ['privacy', 'terms', 'cookies'] as const) {
    const markdown = readFileSync(new URL(`../shared/legal/${type}.md`, import.meta.url), 'utf8');
    await createIfMissing(`legalDocs/${type}`, { currentVersion: LEGAL_VERSIONS[type] });
    await createIfMissing(`legalDocs/${type}/versions/${LEGAL_VERSIONS[type]}`, {
      version: LEGAL_VERSIONS[type],
      effectiveAt: '2026-10-25',
      markdown,
    });
  }

  const resetLink = await auth.generatePasswordResetLink(email);
  console.log(`Production bootstrap complete for ${projectId}.`);
  console.log('Open this one-time link now to define the admin password:');
  console.log(resetLink);
  console.log(
    'Before deploying Hosting, replace every TODO(cliente) value in /admin/configuracoes and review legal documents.',
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
