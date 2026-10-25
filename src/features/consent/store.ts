import { create } from 'zustand';
import type { CookieChoices } from '@shared/types';
import { LEGAL_VERSIONS } from '@shared/defaults';

export const CONSENT_KEY = 'ca_consent';
const ANON_KEY = 'ca_anon';
const TWELVE_MONTHS = 365 * 24 * 60 * 60 * 1000;

interface StoredConsent {
  version: string;
  choices: CookieChoices;
  decidedAt: number;
}

function read(): StoredConsent | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredConsent;
    // Ask again after 12 months or when the cookie policy version changes.
    if (parsed.version !== LEGAL_VERSIONS.cookies || Date.now() - parsed.decidedAt > TWELVE_MONTHS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function anonymousId(): string {
  try {
    let id = localStorage.getItem(ANON_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    return 'anon-unavailable';
  }
}

interface ConsentState {
  consent: StoredConsent | null;
  preferencesOpen: boolean;
  decide: (choices: Omit<CookieChoices, 'necessary'>) => void;
  openPreferences: () => void;
  closePreferences: () => void;
}

export const useConsent = create<ConsentState>((set) => ({
  consent: typeof window === 'undefined' ? null : read(),
  preferencesOpen: false,
  decide: (choices) => {
    const consent: StoredConsent = {
      version: LEGAL_VERSIONS.cookies,
      choices: { necessary: true, ...choices },
      decidedAt: Date.now(),
    };
    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
    } catch {
      // Storage blocked: the choice still applies for this session.
    }
    set({ consent, preferencesOpen: false });
  },
  openPreferences: () => set({ preferencesOpen: true }),
  closePreferences: () => set({ preferencesOpen: false }),
}));

export const openCookiePreferences = () => useConsent.getState().openPreferences();
