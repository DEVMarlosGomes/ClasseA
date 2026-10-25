import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { useId } from 'react';
import { NavLink } from 'react-router';
import { cn } from '@/lib/cn';
import { EASE } from '@/lib/motion';

export interface TabBarItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  badge?: number;
}

/** Bottom navigation for the client and barber areas (mobile). */
export function TabBar({ items, ariaLabel }: { items: TabBarItem[]; ariaLabel: string }) {
  const group = useId();
  return (
    <nav
      aria-label={ariaLabel}
      className="glass pb-safe fixed inset-x-0 bottom-0 z-40 !rounded-none !border-x-0 !border-b-0 px-2 pt-1.5 md:hidden"
    >
      <ul className="mx-auto flex max-w-md">
        {items.map(({ to, label, icon: Icon, end, badge }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className="relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-[14px]"
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId={`tabbar-${group}`}
                      transition={{ duration: 0.25, ease: EASE }}
                      className="absolute top-1 h-8 w-14 rounded-full bg-gold-500/15 ring-1 ring-gold-500/40"
                    />
                  )}
                  <span className="relative">
                    <Icon
                      className={cn('relative size-[22px]', isActive ? 'text-gold-400' : 'text-text-400')}
                      strokeWidth={1.5}
                      aria-hidden="true"
                    />
                    {badge ? (
                      <span className="tabular absolute -right-2.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-gold-500 px-1 text-[11px] font-bold text-ink-950">
                        {badge}
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={cn('relative text-[12px] font-medium', isActive ? 'text-gold-400' : 'text-text-400')}
                  >
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Desktop sidebar mirror of the TabBar. */
export function SideNav({ items, ariaLabel }: { items: TabBarItem[]; ariaLabel: string }) {
  const group = useId();
  return (
    <nav aria-label={ariaLabel} className="hidden md:block">
      <ul className="flex flex-col gap-1">
        {items.map(({ to, label, icon: Icon, end, badge }) => (
          <li key={to}>
            <NavLink to={to} end={end} className="relative isolate flex min-h-12 items-center gap-3 rounded-[14px] px-4">
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId={`side-${group}`}
                      transition={{ duration: 0.25, ease: EASE }}
                      className="absolute inset-0 -z-10 rounded-[14px] bg-gold-500/12 ring-1 ring-gold-500/35"
                    />
                  )}
                  <Icon
                    className={cn('size-5', isActive ? 'text-gold-400' : 'text-text-400')}
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                  <span className={cn('text-[16px] font-medium', isActive ? 'text-gold-400' : 'text-text-100')}>
                    {label}
                  </span>
                  {badge ? (
                    <span className="tabular ml-auto grid h-6 min-w-6 place-items-center rounded-full bg-gold-500 px-1.5 text-[12px] font-bold text-ink-950">
                      {badge}
                    </span>
                  ) : null}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
