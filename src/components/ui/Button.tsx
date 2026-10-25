import { motion, useReducedMotion } from 'framer-motion';
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { cn } from '@/lib/cn';
import { haptic } from '@/lib/motion';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 font-label whitespace-nowrap rounded-[var(--radius-control)] transition-[background-color,border-color,color,box-shadow,opacity] duration-200 ease-brand disabled:pointer-events-none disabled:opacity-45 select-none';

const variants: Record<Variant, string> = {
  primary:
    'gold-metal sheen text-ink-950 shadow-[0_6px_24px_-6px_rgba(233,181,66,0.45),inset_0_1px_0_rgba(255,255,255,0.4)] hover:shadow-[0_10px_32px_-6px_rgba(233,181,66,0.6),inset_0_1px_0_rgba(255,255,255,0.5)]',
  secondary:
    'glass !rounded-[var(--radius-control)] text-text-100 hover:border-[var(--gold-hairline-strong)] hover:text-gold-400',
  ghost: 'text-text-100 hover:text-gold-400 hover:bg-white/[0.04]',
  danger: 'border border-danger/50 bg-danger/10 text-[#f4a49d] hover:bg-danger/20 hover:border-danger',
};

const sizes: Record<Size, string> = {
  sm: 'h-11 px-4 text-[14px] tracking-[0.1em]',
  md: 'h-12 px-5 text-[16px]',
  lg: 'h-14 px-7 text-[18px]',
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  block?: boolean;
}

export type ButtonProps = CommonProps & Omit<ComponentPropsWithoutRef<typeof motion.button>, 'children'> & {
  children?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, iconRight, block, className, children, disabled, onPointerDown, ...rest },
  ref,
) {
  const reduced = useReducedMotion();
  return (
    <motion.button
      ref={ref}
      whileTap={reduced ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.15 }}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      onPointerDown={(e) => {
        if (variant === 'primary') haptic();
        onPointerDown?.(e);
      }}
      className={cn(base, variants[variant], sizes[size], block && 'w-full', className)}
      {...rest}
    >
      {loading ? <Spinner className="size-4" /> : icon}
      {children}
      {!loading && iconRight}
    </motion.button>
  );
});

export type ButtonLinkProps = CommonProps & LinkProps & { children?: ReactNode };

export function ButtonLink({ variant = 'primary', size = 'md', icon, iconRight, block, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link
      onPointerDown={() => variant === 'primary' && haptic()}
      className={cn(base, variants[variant], sizes[size], block && 'w-full', 'active:scale-[0.98] transition-transform', className)}
      {...rest}
    >
      {icon}
      {children}
      {iconRight}
    </Link>
  );
}

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', extra?: string): string {
  return cn(base, variants[variant], sizes[size], extra);
}
