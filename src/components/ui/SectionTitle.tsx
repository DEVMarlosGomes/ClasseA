import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** "— SERVIÇOS —": spaced caps between two gold rules, like "— BARBEARIA —" on the sign. */
export function SectionTitle({
  children,
  as: Tag = 'h2',
  align = 'center',
  className,
  id,
}: {
  children: ReactNode;
  as?: 'h1' | 'h2' | 'h3';
  align?: 'center' | 'left';
  className?: string;
  id?: string;
}) {
  return (
    <Tag
      id={id}
      className={cn(
        'font-label flex items-center gap-4 text-[22px] text-gold-500 sm:text-[28px]',
        align === 'center' ? 'justify-center text-center' : 'justify-start',
        className,
      )}
    >
      <span aria-hidden="true" className="h-px w-8 shrink-0 bg-gold-600 sm:w-12" />
      <span className="tracking-[0.18em]">{children}</span>
      <span aria-hidden="true" className="h-px w-8 shrink-0 bg-gold-600 sm:w-12" />
    </Tag>
  );
}
