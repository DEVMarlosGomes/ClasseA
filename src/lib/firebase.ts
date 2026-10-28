import { type FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';

/**
 * Firebase is loaded on demand: the landing page only pulls Firestore (for live availability),
 * Auth and Functions are fetched when a screen needs them. Every loader is memoised.
 */

const env = import.meta.env;
export const USE_EMULATORS = env.VITE_USE_EMULATORS === 'true';
/**
 * Spark (free) plan: no Cloud Functions or Storage. The callables run in the browser (src/lib/spark),
 * roles live in roles/{uid} instead of custom claims and photos are stored inline in Firestore.
 * Test environments only: firestore.spark.rules trusts signed-in clients far more than production.
 */
export const SPARK =
  env.VITE_SPARK === 'true' ||
  (env.VITE_SPARK !== 'false' && env.VITE_FIREBASE_PROJECT_ID === 'classea-97dd2');
export const FUNCTIONS_REGION = 'southamerica-east1';
const EMULATOR_HOST = typeof location !== 'undefined' ? location.hostname : '127.0.0.1';

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || undefined,
};

export function firebaseApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

function once<T>(fn: () => Promise<T>): () => Promise<T> {
  let p: Promise<T> | null = null;
  return () => {
    if (!p) {
      p = fn().catch((e) => {
        p = null;
        throw e;
      });
    }
    return p;
  };
}

/** App Check (reCAPTCHA Enterprise) in production; skipped against the emulators. */
const loadAppCheck = once(async () => {
  const key = env.VITE_RECAPTCHA_ENTERPRISE_KEY;
  if (USE_EMULATORS || !key) return null;
  const { initializeAppCheck, ReCaptchaEnterpriseProvider } = await import('firebase/app-check');
  return initializeAppCheck(firebaseApp(), {
    provider: new ReCaptchaEnterpriseProvider(key),
    isTokenAutoRefreshEnabled: true,
  });
});

export const loadFirestore = once(async () => {
  await loadAppCheck();
  const m = await import('firebase/firestore');
  let db;
  try {
    db = m.initializeFirestore(firebaseApp(), {
      // Persistent cache keeps the barber agenda and the client's next bookings readable offline.
      localCache: m.persistentLocalCache({ tabManager: m.persistentMultipleTabManager() }),
      ignoreUndefinedProperties: true,
    });
  } catch {
    db = m.getFirestore(firebaseApp());
  }
  if (USE_EMULATORS) {
    try {
      m.connectFirestoreEmulator(db, EMULATOR_HOST, 8080);
    } catch {
      // Already connected (HMR).
    }
  }
  return { ...m, db };
});

/** Small, online-only client for public one-shot reads on the landing page. */
export const loadFirestoreLite = once(async () => {
  await loadAppCheck();
  const m = await import('firebase/firestore/lite');
  const db = m.getFirestore(firebaseApp());
  if (USE_EMULATORS) {
    try {
      m.connectFirestoreEmulator(db, EMULATOR_HOST, 8080);
    } catch {
      // Already connected (HMR).
    }
  }
  return { ...m, db };
});

export const loadAuth = once(async () => {
  await loadAppCheck();
  const m = await import('firebase/auth');
  const auth = m.getAuth(firebaseApp());
  auth.languageCode = 'pt-BR';
  if (USE_EMULATORS && !auth.emulatorConfig) {
    m.connectAuthEmulator(auth, `http://${EMULATOR_HOST}:9099`, { disableWarnings: true });
  }
  return { ...m, auth };
});

export const loadFunctions = once(async () => {
  await loadAppCheck();
  const m = await import('firebase/functions');
  const fns = m.getFunctions(firebaseApp(), FUNCTIONS_REGION);
  if (USE_EMULATORS) {
    try {
      m.connectFunctionsEmulator(fns, EMULATOR_HOST, 5001);
    } catch {
      // Already connected.
    }
  }
  return { ...m, fns };
});

export const loadStorage = once(async () => {
  await loadAppCheck();
  const m = await import('firebase/storage');
  const storage = m.getStorage(firebaseApp());
  if (USE_EMULATORS) {
    try {
      m.connectStorageEmulator(storage, EMULATOR_HOST, 9199);
    } catch {
      // Already connected.
    }
  }
  return { ...m, storage };
});

export type FirestoreKit = Awaited<ReturnType<typeof loadFirestore>>;
