import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';
import { signInSchema, signUpSchema } from '@shared/schemas';
import { Button } from '@/components/ui/Button';
import { Checkbox, Input, MaskedInput } from '@/components/ui/Input';
import { RazorLoader } from '@/components/ui/RazorLoader';
import { Sheet } from '@/components/ui/Sheet';
import { toast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';
import { errorMessage } from '@/lib/api';
import { authErrorMessage, useAuthNow } from './AuthProvider';

function PasswordToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="grid size-11 place-items-center rounded-full text-text-400 hover:text-text-100"
      aria-label={shown ? 'Ocultar senha' : 'Mostrar senha'}
    >
      {shown ? <EyeOff className="size-5" strokeWidth={1.5} /> : <Eye className="size-5" strokeWidth={1.5} />}
    </button>
  );
}

export function passwordStrength(pw: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  const labels = ['Muito fraca', 'Fraca', 'Razoável', 'Boa', 'Forte'];
  return { score: score as 0 | 1 | 2 | 3 | 4, label: labels[score]! };
}

function StrengthMeter({ password }: { password: string }) {
  const { score, label } = passwordStrength(password);
  if (!password) return null;
  return (
    <div className="mt-2 px-1" aria-live="polite">
      <div className="flex gap-1" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors duration-200',
              i < score ? (score <= 1 ? 'bg-danger' : score === 2 ? 'bg-gold-600' : 'bg-gold-400') : 'bg-ink-600',
            )}
          />
        ))}
      </div>
      <p className="mt-1 text-[12px] text-text-400">Força da senha: {label}</p>
    </div>
  );
}

function GoogleButton({ onDone, label = 'Continuar com Google' }: { onDone: (needsProfile: boolean) => void; label?: string }) {
  const { signInWithGoogle } = useAuthNow();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      type="button"
      variant="secondary"
      block
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const { needsProfile } = await signInWithGoogle();
          onDone(needsProfile);
        } catch (e) {
          toast.error(authErrorMessage(e));
        } finally {
          setBusy(false);
        }
      }}
      icon={
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
          <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12s4.4 9.8 9.8 9.8c5.7 0 9.4-4 9.4-9.6 0-.6-.1-1.1-.2-1.6H12z" />
        </svg>
      }
    >
      {label}
    </Button>
  );
}

function OrDivider() {
  return (
    <div className="my-5 flex items-center gap-3 text-[12px] text-text-400" aria-hidden="true">
      <span className="h-px flex-1 bg-ink-600" />
      ou
      <span className="h-px flex-1 bg-ink-600" />
    </div>
  );
}

export function SignInForm({ onSuccess, onNeedsProfile }: { onSuccess: () => void; onNeedsProfile: () => void }) {
  const { signIn } = useAuthNow();
  const [shown, setShown] = useState(false);
  const form = useForm<z.input<typeof signInSchema>>({ resolver: zodResolver(signInSchema), defaultValues: { email: '', password: '' } });
  const [error, setError] = useState<string | null>(null);

  const submit = form.handleSubmit(async ({ email, password }) => {
    setError(null);
    try {
      await signIn(email, password);
      onSuccess();
    } catch (e) {
      setError(authErrorMessage(e));
    }
  });

  return (
    <div>
      <GoogleButton onDone={(needs) => (needs ? onNeedsProfile() : onSuccess())} />
      <OrDivider />
      <form onSubmit={submit} noValidate className="space-y-3">
        <Input label="E-mail" type="email" inputMode="email" autoComplete="email" {...form.register('email')} error={form.formState.errors.email?.message} />
        <Input
          label="Senha"
          type={shown ? 'text' : 'password'}
          autoComplete="current-password"
          {...form.register('password')}
          error={form.formState.errors.password?.message}
          trailing={<PasswordToggle shown={shown} onToggle={() => setShown((s) => !s)} />}
        />
        {error && (
          <p role="alert" className="rounded-[12px] border border-danger/40 bg-danger/10 px-4 py-3 text-[14px] text-[#f4a49d]">
            {error}
          </p>
        )}
        <div className="flex justify-end">
          <Link to="/recuperar-senha" className="min-h-11 py-3 text-[14px] text-gold-400 underline">
            Esqueci minha senha
          </Link>
        </div>
        <Button type="submit" block size="lg" loading={form.formState.isSubmitting}>
          Entrar
        </Button>
      </form>
    </div>
  );
}

function LegalModalLink({ to, children }: { to: 'termos' | 'privacidade'; children: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={(e) => { e.preventDefault(); setOpen(true); }} className="text-gold-400 underline">
        {children}
      </button>
      <LegalSheet type={to} open={open} onOpenChange={setOpen} />
    </>
  );
}

const LegalDocBody = lazy(() => import('@/features/legal/LegalDocBody'));

function LegalSheet({ type, open, onOpenChange }: { type: 'termos' | 'privacidade'; open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={type === 'termos' ? 'Termos de Uso' : 'Política de Privacidade'} size="lg">
      <Suspense fallback={<RazorLoader />}>
        {open && <LegalDocBody type={type === 'termos' ? 'terms' : 'privacy'} compact />}
      </Suspense>
    </Sheet>
  );
}

type SignUpValues = z.input<typeof signUpSchema>;

const PHONE_MASK = '(00) 00000-0000';
const DATE_MASK = '00/00/0000';

/** Sign-up (or profile completion for Google accounts when `completeOnly`). */
export function SignUpForm({ onSuccess, completeOnly = false }: { onSuccess: () => void; completeOnly?: boolean }) {
  const { signUp, completeProfile, user } = useAuthNow();
  const [shown, setShown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const schema = completeOnly ? signUpSchema.omit({ email: true, password: true }) : signUpSchema;
  const form = useForm<SignUpValues>({
    resolver: zodResolver(schema as typeof signUpSchema),
    defaultValues: {
      name: user?.displayName ?? '',
      phone: '',
      email: '',
      password: '',
      birthDate: '',
      acceptTerms: false as unknown as true,
      ageDeclaration: undefined,
      marketingOptIn: false,
    },
  });
  const password = form.watch('password') ?? '';
  const errors = form.formState.errors;

  const submit = form.handleSubmit(async (values) => {
    setError(null);
    // handleSubmit already hands over the resolver's parsed output (phone in E.164).
    const parsed = values as unknown as z.output<typeof signUpSchema>;
    const profile = {
      name: parsed.name,
      phone: parsed.phone,
      birthDate: parsed.birthDate || undefined,
      ageDeclaration: parsed.ageDeclaration,
      acceptTerms: true as const,
      marketingOptIn: parsed.marketingOptIn,
    };
    try {
      if (completeOnly) await completeProfile(profile);
      else await signUp(parsed.email, parsed.password, profile);
      onSuccess();
    } catch (e) {
      setError((e as { code?: string }).code?.startsWith('auth/') ? authErrorMessage(e) : errorMessage(e));
    }
  });

  return (
    <div>
      {!completeOnly && (
        <>
          <GoogleButton label="Criar conta com Google" onDone={(needs) => (needs ? undefined : onSuccess())} />
          <OrDivider />
        </>
      )}
      <form onSubmit={submit} noValidate className="space-y-3">
        <Input label="Nome completo" autoComplete="name" {...form.register('name')} error={errors.name?.message} />
        <Controller
          control={form.control}
          name="phone"
          render={({ field }) => (
            <MaskedInput
              label="Celular com DDD"
              mask={PHONE_MASK}
              inputMode="tel"
              autoComplete="tel-national"
              value={field.value}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              error={errors.phone?.message}
              hint="Usamos para confirmar e lembrar seu horário."
            />
          )}
        />
        {!completeOnly && (
          <>
            <Input label="E-mail" type="email" inputMode="email" autoComplete="email" {...form.register('email')} error={errors.email?.message} />
            <div>
              <Input
                label="Senha (mínimo 8 caracteres)"
                type={shown ? 'text' : 'password'}
                autoComplete="new-password"
                {...form.register('password')}
                error={errors.password?.message}
                trailing={<PasswordToggle shown={shown} onToggle={() => setShown((s) => !s)} />}
              />
              <StrengthMeter password={password} />
            </div>
          </>
        )}
        <Controller
          control={form.control}
          name="birthDate"
          render={({ field }) => (
            <MaskedInput
              label="Data de nascimento (opcional)"
              mask={DATE_MASK}
              inputMode="numeric"
              autoComplete="bday"
              value={field.value ?? ''}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              error={errors.birthDate?.message}
            />
          )}
        />

        <fieldset className="space-y-1 pt-2">
          <legend className="font-label mb-1 text-[12px] text-text-400">Idade</legend>
          {(
            [
              ['adult', 'Tenho 18 anos ou mais'],
              ['guardian', 'Tenho menos de 18 anos e meu responsável autorizou o cadastro'],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex min-h-11 cursor-pointer items-start gap-3 py-1">
              <input
                type="radio"
                value={value}
                {...form.register('ageDeclaration')}
                className="mt-0.5 size-5 shrink-0 cursor-pointer appearance-none rounded-full border border-ink-600 bg-ink-700 checked:border-[6px] checked:border-gold-500"
              />
              <span className="text-[14px] leading-relaxed text-text-100">{label}</span>
            </label>
          ))}
          {errors.ageDeclaration && (
            <p role="alert" className="text-[14px] text-[#f4a49d]">
              {errors.ageDeclaration.message}
            </p>
          )}
        </fieldset>

        <Checkbox
          {...form.register('acceptTerms')}
          error={errors.acceptTerms?.message}
          label={
            <>
              Li e aceito os <LegalModalLink to="termos">Termos de Uso</LegalModalLink> e a{' '}
              <LegalModalLink to="privacidade">Política de Privacidade</LegalModalLink>.
            </>
          }
        />
        <Checkbox {...form.register('marketingOptIn')} label="Quero receber novidades e promoções (opcional)." />

        {error && (
          <p role="alert" className="rounded-[12px] border border-danger/40 bg-danger/10 px-4 py-3 text-[14px] text-[#f4a49d]">
            {error}
          </p>
        )}
        <Button type="submit" block size="lg" loading={form.formState.isSubmitting} className="!mt-5">
          {completeOnly ? 'Concluir cadastro' : 'Criar conta'}
        </Button>
      </form>
    </div>
  );
}
