import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import type { Role } from '@shared/types';
import { ButtonLink } from '@/components/ui/Button';
import { LogoMark } from '@/components/ui/Logo';
import { Halo } from '@/components/ui/Orbs';
import { FullPageLoader } from '@/components/ui/RazorLoader';
import { useAuthNow } from './AuthProvider';

const LOGIN_FOR: Record<Role, string> = { client: '/entrar', barber: '/barbeiro/login', admin: '/barbeiro/login' };

export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { ready, user, roles, profilePending } = useAuthNow();
  const location = useLocation();

  if (!ready || profilePending) return <FullPageLoader />;
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`${LOGIN_FOR[role]}?next=${next}`} replace />;
  }
  // A signed-in user with no roles yet (e.g. Google sign-in without profile) completes sign-up first.
  if (roles.length === 0 && role === 'client') return <Navigate to="/cadastro?completar=1" replace />;
  if (!roles.includes(role)) return <Forbidden role={role} />;
  return <>{children}</>;
}

export function Forbidden({ role }: { role: Role }) {
  const staff = role !== 'client';
  return (
    <main className="relative grid min-h-svh place-items-center overflow-hidden px-6 text-center">
      <Halo className="left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2" />
      <div className="relative max-w-sm">
        <LogoMark className="mx-auto mb-6 w-12" />
        <h1 className="font-label text-[28px] text-text-100">
          {staff ? 'Área exclusiva da equipe' : 'Acesso restrito'}
        </h1>
        <p className="mt-3 text-[16px] text-text-400">
          {staff
            ? 'Esta área é exclusiva da equipe Classe A.'
            : 'Esta área é para clientes. Entre com a sua conta de cliente para continuar.'}
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <ButtonLink to="/">Voltar ao site</ButtonLink>
          <ButtonLink to="/agendar" variant="ghost">
            Agendar horário
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
