import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import type { Role, UserProfile } from '@shared/types';
import { useLiveDoc } from '@/hooks/useFirestore';
import { call } from '@/lib/api';
import { loadAuth } from '@/lib/firebase';

export interface CompleteProfileInput {
  name: string;
  phone: string;
  birthDate?: string;
  ageDeclaration: 'adult' | 'guardian';
  acceptTerms: true;
  marketingOptIn: boolean;
}

interface AuthState {
  /** false until Firebase Auth has restored (or ruled out) a session. */
  ready: boolean;
  user: User | null;
  roles: Role[];
  /** True between account creation and the profile/claims being written by completeProfile. */
  profilePending: boolean;
  profile: (UserProfile & { id: string }) | null | undefined;
  hasRole: (role: Role) => boolean;
  /** Loads Firebase Auth now instead of waiting for the idle callback. */
  ensure: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, profile: CompleteProfileInput) => Promise<void>;
  signInWithGoogle: () => Promise<{ needsProfile: boolean }>;
  completeProfile: (profile: CompleteProfileInput) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  sendVerification: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

function rolesFromClaims(claims: Record<string, unknown>): Role[] {
  const roles = claims.roles;
  if (Array.isArray(roles)) return roles.filter((r): r is Role => r === 'client' || r === 'barber' || r === 'admin');
  return [];
}

const AUTH_ERRORS: Record<string, string> = {
  'auth/invalid-credential': 'E-mail ou senha incorretos.',
  'auth/wrong-password': 'E-mail ou senha incorretos.',
  'auth/user-not-found': 'E-mail ou senha incorretos.',
  'auth/email-already-in-use': 'Já existe uma conta com este e-mail. Tente entrar.',
  'auth/weak-password': 'Escolha uma senha mais forte, com pelo menos 8 caracteres.',
  'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
  'auth/network-request-failed': 'Sem conexão. Verifique sua internet.',
  'auth/popup-closed-by-user': 'A janela do Google foi fechada antes de concluir.',
  'auth/invalid-email': 'E-mail inválido.',
  'auth/user-disabled': 'Esta conta foi desativada.',
};

export function authErrorMessage(e: unknown): string {
  const code = (e as { code?: string }).code ?? '';
  return AUTH_ERRORS[code] ?? (e instanceof Error && !code ? e.message : 'Não foi possível entrar agora. Tente de novo.');
}

export function AuthProvider({ children, eager = false }: { children: ReactNode; eager?: boolean }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [profilePending, setProfilePending] = useState(false);
  const started = useRef(false);
  const refreshedFor = useRef<string | null>(null);

  const start = useCallback(() => {
    if (started.current) return;
    started.current = true;
    void loadAuth().then(({ auth, onIdTokenChanged }) => {
      onIdTokenChanged(auth, async (u) => {
        setUser(u);
        if (u) {
          let token = await u.getIdTokenResult();
          // A cached token may predate the claims set by completeProfile/setUserRole: refresh once.
          if (rolesFromClaims(token.claims).length === 0 && refreshedFor.current !== u.uid) {
            refreshedFor.current = u.uid;
            token = await u.getIdTokenResult(true);
          }
          setRoles(rolesFromClaims(token.claims));
        } else {
          setRoles([]);
        }
        setReady(true);
      });
    });
  }, []);

  useEffect(() => {
    if (eager) return start();
    // Keep Auth out of the landing's critical path: restore the session once the page is idle.
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(start, { timeout: 2500 });
    else setTimeout(start, 1200);
  }, [eager, start]);

  const profileState = useLiveDoc<UserProfile & { id: string }>(user ? `users/${user.uid}` : null);

  const refresh = useCallback(async () => {
    const { auth } = await loadAuth();
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    const token = await auth.currentUser.getIdTokenResult(true);
    setRoles(rolesFromClaims(token.claims));
    setUser(auth.currentUser);
  }, []);

  const completeProfile = useCallback(
    async (profile: CompleteProfileInput) => {
      await call('completeProfile', profile);
      await refresh();
    },
    [refresh],
  );

  const value = useMemo<AuthState>(
    () => ({
      ready,
      user,
      roles,
      profilePending,
      profile: user ? profileState.data : null,
      hasRole: (r) => roles.includes(r),
      ensure: start,
      signIn: async (email, password) => {
        start();
        const { auth, signInWithEmailAndPassword } = await loadAuth();
        await signInWithEmailAndPassword(auth, email, password);
      },
      signUp: async (email, password, profile) => {
        start();
        setProfilePending(true);
        try {
          const { auth, createUserWithEmailAndPassword, sendEmailVerification, updateProfile } = await loadAuth();
          const cred = await createUserWithEmailAndPassword(auth, email, password);
          await updateProfile(cred.user, { displayName: profile.name });
          await completeProfile(profile);
          void sendEmailVerification(cred.user).catch(() => undefined);
        } finally {
          setProfilePending(false);
        }
      },
      signInWithGoogle: async () => {
        start();
        const { auth, GoogleAuthProvider, signInWithPopup } = await loadAuth();
        const cred = await signInWithPopup(auth, new GoogleAuthProvider());
        const token = await cred.user.getIdTokenResult(true);
        return { needsProfile: rolesFromClaims(token.claims).length === 0 };
      },
      completeProfile,
      signOut: async () => {
        const { auth, signOut } = await loadAuth();
        await signOut(auth);
      },
      resetPassword: async (email) => {
        const { auth, sendPasswordResetEmail } = await loadAuth();
        await sendPasswordResetEmail(auth, email);
      },
      sendVerification: async () => {
        const { auth, sendEmailVerification } = await loadAuth();
        if (auth.currentUser) await sendEmailVerification(auth.currentUser);
      },
      refresh,
    }),
    [ready, user, roles, profilePending, profileState.data, start, completeProfile, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}

/** Like useAuth, but starts loading Firebase Auth immediately (for screens that need the session). */
export function useAuthNow(): AuthState {
  const auth = useAuth();
  useEffect(() => auth.ensure(), [auth]);
  return auth;
}
