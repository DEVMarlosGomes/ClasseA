import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Logo } from '@/components/ui/Logo';
import { Halo, Orbs } from '@/components/ui/Orbs';

/** Black wall, warm halo, glass card: the login screens share the hero's sign-lit mood. */
export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-4 py-12">
      <Orbs intensity={0.7} />
      <Halo className="left-1/2 top-[14%] h-56 w-[min(520px,120vw)] -translate-x-1/2" />
      <Link to="/" aria-label="Voltar ao site" className="relative mb-8">
        <Logo className="w-40 sm:w-48" priority />
      </Link>
      <div className="glass relative w-full max-w-md p-6 sm:p-8">
        <h1 className="font-label text-[28px] text-text-100">{title}</h1>
        {subtitle && <p className="mt-2 text-[15px] text-text-400">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
      {footer && <div className="relative mt-6 text-center text-[14px] text-text-400">{footer}</div>}
    </main>
  );
}
