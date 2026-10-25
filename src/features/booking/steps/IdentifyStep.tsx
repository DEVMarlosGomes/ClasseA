import { UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { Tabs } from '@/components/ui/Tabs';
import { useAuthNow } from '@/features/auth/AuthProvider';
import { SignInForm, SignUpForm } from '@/features/auth/forms';

/** Identification happens only here, in a sheet, and brings the client right back with everything kept. */
export function IdentifyStep({ onDone }: { onDone: () => void }) {
  const { ready, user, roles, profilePending } = useAuthNow();
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<'entrar' | 'criar' | 'completar'>('entrar');

  useEffect(() => {
    if (ready && user && roles.length > 0) onDone();
    if (ready && user && roles.length === 0 && !profilePending) {
      setTab('completar');
      setOpen(true);
    }
  }, [ready, user, roles, profilePending, onDone]);

  return (
    <div className="flex flex-col items-center py-6 text-center">
      <span className="grid size-16 place-items-center rounded-full border border-gold-700/60 bg-gold-500/10">
        <UserRound className="size-7 text-gold-400" strokeWidth={1.5} aria-hidden="true" />
      </span>
      <h2 className="font-label mt-5 text-[22px] text-text-100">Quase lá</h2>
      <p className="mt-2 max-w-[36ch] text-[16px] text-text-400">
        Entre ou crie sua conta para reservar. Suas escolhas ficam guardadas.
      </p>
      <Button className="mt-6" onClick={() => setOpen(true)}>
        Entrar ou criar conta
      </Button>

      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={tab === 'completar' ? 'Complete seu cadastro' : 'Identifique-se'}
        description={tab === 'completar' ? 'Só faltam seu celular e o aceite dos termos.' : undefined}
      >
        {tab === 'completar' ? (
          <SignUpForm completeOnly onSuccess={() => setOpen(false)} />
        ) : (
          <>
            <Tabs
              ariaLabel="Entrar ou criar conta"
              value={tab}
              onValueChange={(v) => setTab(v as 'entrar' | 'criar')}
              items={[
                { value: 'entrar', label: 'Entrar' },
                { value: 'criar', label: 'Criar conta' },
              ]}
              listClassName="mb-6"
            />
            {tab === 'entrar' ? (
              <SignInForm onSuccess={() => setOpen(false)} onNeedsProfile={() => setTab('completar')} />
            ) : (
              <SignUpForm onSuccess={() => setOpen(false)} />
            )}
          </>
        )}
      </Sheet>
    </div>
  );
}
