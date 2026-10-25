import { useQuery } from '@tanstack/react-query';
import type { LegalDocType, LegalDocVersion } from '@shared/types';
import { LEGAL_VERSIONS } from '@shared/defaults';
import { loadFirestore } from '@/lib/firebase';

const BUNDLED: Record<LegalDocType, () => Promise<string>> = {
  privacy: () => import('@shared/legal/privacy.md?raw').then((m) => m.default),
  terms: () => import('@shared/legal/terms.md?raw').then((m) => m.default),
  cookies: () => import('@shared/legal/cookies.md?raw').then((m) => m.default),
};

/** Current published version from legalDocs, falling back to the bundled draft. */
export function useLegalDoc(type: LegalDocType) {
  return useQuery({
    queryKey: ['legal', type],
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<LegalDocVersion> => {
      try {
        const { db, doc, getDoc } = await loadFirestore();
        const head = await getDoc(doc(db, `legalDocs/${type}`));
        const version = (head.get('currentVersion') as string | undefined) ?? LEGAL_VERSIONS[type];
        const snap = await getDoc(doc(db, `legalDocs/${type}/versions/${version}`));
        if (snap.exists()) return snap.data() as LegalDocVersion;
      } catch {
        // Offline or not seeded: fall through to the bundled copy.
      }
      return { version: LEGAL_VERSIONS[type], effectiveAt: '2026-10-25', markdown: await BUNDLED[type]() };
    },
  });
}

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function headingsOf(markdown: string): { id: string; text: string }[] {
  return [...markdown.matchAll(/^## (.+)$/gm)].map((m) => ({ id: slugify(m[1]!), text: m[1]! }));
}
