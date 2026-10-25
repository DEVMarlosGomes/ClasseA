import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) initializeApp();

export const db = getFirestore();
export const auth = getAuth();
export { FieldValue, Timestamp };

export const REGION = 'southamerica-east1';
export const IS_EMULATOR = process.env.FUNCTIONS_EMULATOR === 'true';
