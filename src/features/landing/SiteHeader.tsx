import { motion, useMotionValueEvent, useScroll } from 'framer-motion';
import { Menu, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { ButtonLink } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { Sheet } from '@/components/ui/Sheet';
import { cn } from '@/lib/cn';
import { useAuth } from '@/features/auth/AuthProvider';

export const NAV_LINKS = [
  { href: '/#servicos', label: 'Serviços' },
  { href: '/#planos', label: 'Planos' },
  { href: '/#barbeiros', label: 'Barbeiros' },
  { href: '/#espaco', label: 'O Espaço' },
  { href: '/#contato', label: 'Contato' },
];

/** Transparent over the hero; turns to glass with a gold bottom hairline once the page scrolls. */
export function SiteHeader({ solid = false }: { solid?: boolean }) {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(solid);
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, roles } = useAuth();
  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(solid || y > 24));

  const accountHref = roles.includes('barber') ? '/barbeiro' : roles.includes('admin') ? '/admin' : '/cliente';

  return (
    <>
      <motion.header
        className={cn(
          'fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color,backdrop-filter] duration-300',
          scrolled
            ? 'border-gold-500/25 bg-[rgba(8,8,8,0.62)] backdrop-blur-xl backdrop-saturate-150'
            : 'border-transparent bg-transparent',
        )}
        style={{ paddingTop: 'var(--safe-top)' }}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:h-[72px] sm:px-6">
          <Link to="/" aria-label="Classe A Barbearia, início" className="shrink-0">
            <Logo className="w-[104px] sm:w-[124px]" />
          </Link>
          <nav aria-label="Seções" className="ml-auto hidden lg:block">
            <ul className="flex items-center gap-1">
              {NAV_LINKS.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    className="font-label rounded-full px-3 py-2 text-[14px] text-text-100/85 transition-colors hover:text-gold-400"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="ml-auto flex items-center gap-1 lg:ml-4">
            <Link
              to={user ? accountHref : '/entrar'}
              className="hidden size-11 place-items-center rounded-full text-text-100 hover:text-gold-400 sm:grid"
              aria-label={user ? 'Minha conta' : 'Entrar'}
            >
              <UserRound className="size-5" strokeWidth={1.5} />
            </Link>
            <ButtonLink to="/agendar" size="sm" className="px-4 sm:px-5">
              Agendar
            </ButtonLink>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="grid size-11 place-items-center rounded-full text-text-100 hover:text-gold-400 lg:hidden"
              aria-label="Abrir menu"
              aria-expanded={menuOpen}
            >
              <Menu className="size-6" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </motion.header>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen} title="Menu" size="sm">
        <nav aria-label="Menu principal">
          <ul className="flex flex-col">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={() => setMenuOpen(false)}
                  className="font-label flex min-h-14 items-center border-b border-white/5 text-[22px] text-text-100 hover:text-gold-400"
                >
                  {l.label}
                </a>
              </li>
            ))}
            <li>
              <Link
                to={user ? accountHref : '/entrar'}
                onClick={() => setMenuOpen(false)}
                className="font-label flex min-h-14 items-center text-[22px] text-text-100 hover:text-gold-400"
              >
                {user ? 'Minha conta' : 'Entrar'}
              </Link>
            </li>
          </ul>
          <ButtonLink to="/agendar" block size="lg" className="mt-6" onClick={() => setMenuOpen(false)}>
            Agendar horário
          </ButtonLink>
        </nav>
      </Sheet>
    </>
  );
}
