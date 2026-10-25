import { CalendarCheck, CalendarPlus, Crown, House, LogOut, UserRound } from 'lucide-react';
import { Link, Outlet, useNavigate } from 'react-router';
import { Logo } from '@/components/ui/Logo';
import { Orbs } from '@/components/ui/Orbs';
import { SideNav, TabBar, type TabBarItem } from '@/components/ui/TabBar';
import { useAuth } from '@/features/auth/AuthProvider';
import { RequireRole } from '@/features/auth/RequireRole';
import { VerifyEmailBanner } from './VerifyEmailBanner';

const ITEMS: TabBarItem[] = [
  { to: '/cliente', label: 'Início', icon: House, end: true },
  { to: '/agendar', label: 'Agendar', icon: CalendarPlus },
  { to: '/cliente/agendamentos', label: 'Agenda', icon: CalendarCheck },
  { to: '/cliente/planos', label: 'Planos', icon: Crown },
  { to: '/cliente/perfil', label: 'Perfil', icon: UserRound },
];

export default function ClientLayout() {
  return (
    <RequireRole role="client">
      <ClientShell />
    </RequireRole>
  );
}

function ClientShell() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="min-h-svh">
      <Orbs intensity={0.45} />
      <header
        className="sticky top-0 z-30 border-b border-white/5 bg-ink-950/75 backdrop-blur-xl md:hidden"
        style={{ paddingTop: 'var(--safe-top)' }}
      >
        <div className="flex h-14 items-center justify-between px-4">
          <Link to="/" aria-label="Voltar ao site">
            <Logo className="w-20" />
          </Link>
        </div>
      </header>
      <div className="mx-auto flex max-w-6xl gap-10 px-4 pb-32 pt-4 sm:px-6 md:pb-16 md:pt-10">
        <aside className="hidden w-60 shrink-0 md:block">
          <div className="sticky top-10">
            <Link to="/" aria-label="Voltar ao site">
              <Logo className="mb-10 w-32" />
            </Link>
            <SideNav items={ITEMS} ariaLabel="Área do cliente" />
            <button
              onClick={() => void signOut().then(() => navigate('/'))}
              className="mt-8 flex min-h-12 items-center gap-3 px-4 text-[15px] text-text-400 hover:text-text-100"
            >
              <LogOut className="size-5" strokeWidth={1.5} aria-hidden="true" />
              Sair
            </button>
          </div>
        </aside>
        <main className="min-w-0 flex-1">
          <VerifyEmailBanner />
          <Outlet />
        </main>
      </div>
      <TabBar items={ITEMS} ariaLabel="Área do cliente" />
    </div>
  );
}
