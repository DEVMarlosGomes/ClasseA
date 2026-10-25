import * as RT from '@radix-ui/react-tabs';
import { motion } from 'framer-motion';
import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { EASE } from '@/lib/motion';

export interface TabItem {
  value: string;
  label: ReactNode;
}

interface TabsProps {
  items: TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  children?: ReactNode;
  className?: string;
  listClassName?: string;
  ariaLabel?: string;
}

/** Segmented tabs with a gold pill that slides to the active tab. */
export function Tabs({ items, value, onValueChange, children, className, listClassName, ariaLabel }: TabsProps) {
  const group = useId();
  return (
    <RT.Root value={value} onValueChange={onValueChange} className={className}>
      <RT.List
        aria-label={ariaLabel}
        className={cn(
          'no-scrollbar flex gap-1 overflow-x-auto rounded-full border border-ink-600 bg-ink-800/80 p-1',
          listClassName,
        )}
      >
        {items.map((item) => (
          <RT.Trigger
            key={item.value}
            value={item.value}
            className={cn(
              'font-label relative isolate min-h-10 flex-1 shrink-0 whitespace-nowrap rounded-full px-4 text-[14px] transition-colors duration-150',
              value === item.value ? 'text-ink-950' : 'text-text-400 hover:text-text-100',
            )}
          >
            {value === item.value && (
              <motion.span
                layoutId={`tab-${group}`}
                transition={{ duration: 0.25, ease: EASE }}
                className="gold-metal absolute inset-0 -z-10 rounded-full"
              />
            )}
            {item.label}
          </RT.Trigger>
        ))}
      </RT.List>
      {children}
    </RT.Root>
  );
}

export const TabPanel = RT.Content;
