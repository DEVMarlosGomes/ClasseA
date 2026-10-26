import { CalendarRange, Clock3, LogOut, UserRound, Users } from 'lucide-react';
import { Link, Outlet, useNavigate } from 'react-router';
import { Logo } from '@/components/ui/Logo';
import { Orbs } from '@/components/ui/Orbs';
import { SideNav, TabBar, type TabBarItem } from '@/components/ui/TabBar';
import { useAuth } from '@/features/auth/AuthProvider';
import { RequireRole } from '@/features/auth/RequireRole';
import { todayKey } from '@/lib/dates';
import { useBarberAppointments } from './hooks';

export default function BarberLayout() {
  return (
    <RequireRole role="barber">
      <BarberShell />
    </RequireRole>
  );
}

function BarberShell() {
  const { user, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const today = todayKey();
  const appts = useBarberAppointments(user?.uid, today, today);
  const now = Date.now();
  const remaining = appts.data?.filter((a) => a.status === 'confirmed' && a.startAt.toMillis() + a.durationMin * 60_000 > now).length ?? 0;

  const items: TabBarItem[] = [
    { to: '/barbeiro', label: 'Hoje', icon: Clock3, end: true, badge: remaining || undefined },
    { to: '/barbeiro/agenda', label: 'Agenda', icon: CalendarRange },
    { to: '/barbeiro/clientes', label: 'Clientes', icon: Users },
    { to: '/barbeiro/perfil', label: 'Perfil', icon: UserRound },
  ];

  return (
    <div className="min-h-svh">
      <Orbs intensity={0.35} />
      <header className="sticky top-0 z-30 border-b border-white/5 bg-ink-950/80 backdrop-blur-xl md:hidden" style={{ paddingTop: 'var(--safe-top)' }}>
        <div className="flex h-14 items-center justify-between px-4">
          <Logo className="w-20" />
          <span className="font-label text-[12px] text-gold-500">Equipe</span>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl gap-8 px-4 pb-32 pt-4 sm:px-6 md:pb-12 md:pt-8">
        <aside className="hidden w-56 shrink-0 md:block">
          <div className="sticky top-8">
            <Logo className="mb-2 w-32" />
            <p className="font-label mb-8 text-[12px] text-gold-500">Área do Barbeiro</p>
            <SideNav items={items} ariaLabel="Área do barbeiro" />
            {roles.includes('admin') && (
              <Link to="/admin" className="mt-4 flex min-h-12 items-center px-4 text-[15px] text-gold-400">
                Painel do dono
              </Link>
            )}
            <button onClick={() => void signOut().then(() => navigate('/barbeiro/login'))} className="mt-6 flex min-h-12 items-center gap-3 px-4 text-[15px] text-text-400 hover:text-text-100">
              <LogOut className="size-5" strokeWidth={1.5} aria-hidden="true" />
              Sair
            </button>
          </div>
        </aside>
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
      <TabBar items={items} ariaLabel="Área do barbeiro" />
    </div>
  );
}
