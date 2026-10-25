import { FlaskConical } from 'lucide-react';

/** Fixed, discreet strip on every payment screen. */
export function DemoNotice() {
  return (
    <p className="flex items-center gap-2 rounded-[12px] border border-gold-700/50 bg-gold-500/[0.06] px-3 py-2 text-[13px] text-text-100/85">
      <FlaskConical className="size-4 shrink-0 text-gold-500" strokeWidth={1.5} aria-hidden="true" />
      Ambiente de demonstração. Nenhuma cobrança real é feita.
    </p>
  );
}
