import {
  CalendarDays,
  Crown,
  FileText,
  LogOut,
  ReceiptText,
  Scissors,
  Settings,
  UserRoundCog,
} from 'lucide-react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { Logo } from '@/components/ui/Logo';
import { Orbs } from '@/components/ui/Orbs';
import { SideNav, type TabBarItem } from '@/components/ui/TabBar';
import { useAuth } from '@/features/auth/AuthProvider';
import { RequireRole } from '@/features/auth/RequireRole';
import { cn } from '@/lib/cn';

const items: TabBarItem[] = [
  { to: '/admin', label: 'Agenda', icon: CalendarDays, end: true },
  { to: '/admin/barbeiros', label: 'Barbeiros', icon: UserRoundCog },
  { to: '/admin/servicos', label: 'Serviços', icon: Scissors },
  { to: '/admin/planos', label: 'Planos', icon: Crown },
  { to: '/admin/assinaturas', label: 'Assinaturas', icon: ReceiptText },
  { to: '/admin/documentos', label: 'Documentos', icon: FileText },
  { to: '/admin/configuracoes', label: 'Configurações', icon: Settings },
];

export default function AdminLayout() {
  return (
    <RequireRole role="admin">
      <AdminShell />
    </RequireRole>
  );
}

function AdminShell() {
  const { roles, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-svh">
      <Orbs intensity={0.25} />
      <header
        className="sticky top-0 z-40 border-b border-white/5 bg-ink-950/90 backdrop-blur-xl md:hidden"
        style={{ paddingTop: 'var(--safe-top)' }}
      >
        <div className="flex h-14 items-center justify-between px-4">
          <Logo className="w-20" />
          <span className="font-label text-[12px] tracking-[0.14em] text-gold-500">PAINEL DO DONO</span>
        </div>
        <nav aria-label="Painel administrativo" className="scrollbar-none overflow-x-auto px-3 pb-2">
          <ul className="flex min-w-max gap-1">
            {items.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    cn(
                      'flex min-h-11 items-center gap-2 rounded-full border px-3 text-[13px]',
                      isActive
                        ? 'border-gold-700 bg-gold-500/15 text-gold-400'
                        : 'border-transparent text-text-400',
                    )
                  }
                >
                  <Icon className="size-4" strokeWidth={1.6} aria-hidden="true" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <div className="mx-auto flex max-w-7xl gap-8 px-4 pb-16 pt-5 sm:px-6 md:py-8">
        <aside className="hidden w-60 shrink-0 md:block">
          <div className="sticky top-8">
            <Logo className="mb-2 w-32" />
            <p className="font-label mb-8 text-[12px] tracking-[0.14em] text-gold-500">PAINEL DO DONO</p>
            <SideNav items={items} ariaLabel="Painel administrativo" />
            {roles.includes('barber') && (
              <Link to="/barbeiro" className="mt-4 flex min-h-12 items-center px-4 text-[15px] text-gold-400">
                Abrir área do barbeiro
              </Link>
            )}
            <button
              onClick={() => void signOut().then(() => navigate('/barbeiro/login'))}
              className="mt-6 flex min-h-12 items-center gap-3 px-4 text-[15px] text-text-400 hover:text-text-100"
            >
              <LogOut className="size-5" strokeWidth={1.5} aria-hidden="true" />
              Sair
            </button>
          </div>
        </aside>
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
