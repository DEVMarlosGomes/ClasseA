import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: 'glass' | 'gold' | 'panel';
  interactive?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { tone = 'glass', interactive, className, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        tone === 'panel' ? 'panel' : 'glass',
        tone === 'gold' && 'glass-gold',
        interactive &&
          'transition-[border-color,transform] duration-250 ease-brand hover:-translate-y-0.5 hover:border-[var(--gold-hairline-strong)]',
        className,
      )}
      {...rest}
    />
  );
});
