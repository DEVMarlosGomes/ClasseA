import * as RS from '@radix-ui/react-switch';
import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function Switch({ checked, onCheckedChange, label, description, disabled, className }: SwitchProps) {
  const id = useId();
  return (
    <div className={cn('flex items-start justify-between gap-4 py-2', className)}>
      <label htmlFor={id} className={cn('min-w-0 flex-1', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}>
        <span className="block text-[16px] font-medium text-text-100">{label}</span>
        {description && <span className="mt-0.5 block text-[14px] leading-relaxed text-text-400">{description}</span>}
      </label>
      <RS.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className="relative mt-0.5 h-7 w-12 shrink-0 rounded-full border border-ink-600 bg-ink-700 transition-colors duration-200 data-[state=checked]:border-transparent data-[state=checked]:bg-gold-500 disabled:opacity-60"
      >
        <RS.Thumb className="block size-5 translate-x-[3px] rounded-full bg-text-100 shadow transition-transform duration-200 ease-brand data-[state=checked]:translate-x-[23px] data-[state=checked]:bg-ink-950" />
      </RS.Root>
    </div>
  );
}
