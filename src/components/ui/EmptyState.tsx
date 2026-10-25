import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { LogoMark } from './Logo';

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-10 text-center', className)}>
      <div className="relative mb-5">
        <div aria-hidden="true" className="absolute inset-0 -z-10 scale-150 rounded-full bg-gold-500/10 blur-2xl" />
        <LogoMark className="w-10 opacity-80" />
      </div>
      <h3 className="font-label text-[18px] text-text-100">{title}</h3>
      {description && <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-text-400">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center px-6 py-10 text-center">
      <h3 className="font-label text-[18px] text-text-100">Algo não saiu como esperado</h3>
      <p className="mt-2 max-w-sm text-[14px] text-text-400">
        {message ?? 'Não foi possível carregar agora. Verifique sua conexão e tente de novo.'}
      </p>
      {onRetry && (
        <button onClick={onRetry} className="font-label mt-5 min-h-11 px-4 text-[14px] text-gold-400 underline">
          Tentar de novo
        </button>
      )}
    </div>
  );
}
