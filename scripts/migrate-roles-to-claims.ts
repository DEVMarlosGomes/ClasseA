/**
 * Spark → Blaze: copies every roles/{uid} document into the user's Firebase Auth custom claims, which is
 * where the production rules and Functions read roles from. Keeps any claims the user already has
 * (the roles are merged, never removed) and leaves the roles/{uid} documents in place, so going back
 * to Spark still works.
 *
 * Dry run (default) only prints what would change:
 *   PRODUCTION_PROJECT_ID=classea-97dd2 npm run migrate:claims
 * Apply:
 *   PRODUCTION_PROJECT_ID=classea-97dd2 MIGRATE_CONFIRM=classea-97dd2 npm run migrate:claims
 *
 * Needs GOOGLE_APPLICATION_CREDENTIALS (service account key kept outside the repo) or gcloud ADC.
 */
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import type { Role } from '../shared/types';

const projectId = process.env.PRODUCTION_PROJECT_ID?.trim() ?? '';
const apply = process.env.MIGRATE_CONFIRM?.trim() === projectId && projectId !== '';
const KNOWN: Role[] = ['client', 'barber', 'admin', 'reception'];

if (!projectId || projectId.startsWith('demo-')) {
  throw new Error('Set PRODUCTION_PROJECT_ID (demo projects are refused).');
}
if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Emulator variables are set; unset them so this runs against production.');
}

initializeApp({ credential: applicationDefault(), projectId });
const auth = getAuth();
const db = getFirestore();

async function main() {
  const snap = await db.collection('roles').get();
  let changed = 0;
  let same = 0;
  let missing = 0;
  for (const doc of snap.docs) {
    const fromDoc = ((doc.get('roles') as unknown[]) ?? []).filter((r): r is Role => KNOWN.includes(r as Role));
    let user;
    try {
      user = await auth.getUser(doc.id);
    } catch {
      missing++;
      console.log(`- ${doc.id}: no Auth account (deleted?), skipped`);
      continue;
    }
    const current = ((user.customClaims?.roles as unknown[]) ?? []).filter((r): r is Role => KNOWN.includes(r as Role));
    const merged = [...new Set([...current, ...fromDoc])];
    if (merged.length === current.length) {
      same++;
      continue;
    }
    changed++;
    console.log(`${apply ? '✓' : '·'} ${user.email ?? doc.id}: [${current.join(', ')}] → [${merged.join(', ')}]`);
    if (apply) await auth.setCustomUserClaims(user.uid, { ...(user.customClaims ?? {}), roles: merged });
  }
  console.log(`\n${snap.size} roles documents · ${changed} ${apply ? 'updated' : 'to update'} · ${same} already ok · ${missing} without account`);
  if (!apply && changed) console.log('Dry run. Repeat with MIGRATE_CONFIRM=<project id> to apply.');
  if (apply && changed) console.log('Done. Users get the new roles on their next sign-in (or within an hour).');
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
