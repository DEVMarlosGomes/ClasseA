import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import type { z } from 'zod';
import { signInSchema } from '@shared/schemas';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LogoMark } from '@/components/ui/Logo';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { AuthShell } from '@/features/auth/AuthShell';
import { authErrorMessage, useAuthNow } from '@/features/auth/AuthProvider';
import { safeNext } from '@/features/auth/SignInPage';

export default function BarberLoginPage() {
  useDocumentMeta({ title: 'Área do Barbeiro', noindex: true });
  const { ready, user, roles, signIn, signOut } = useAuthNow();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [shown, setShown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.input<typeof signInSchema>>({ resolver: zodResolver(signInSchema), defaultValues: { email: '', password: '' } });
  const staff = roles.includes('barber') || roles.includes('admin');
  const target = safeNext(params.get('next'), roles.includes('barber') ? '/barbeiro' : '/admin');

  useEffect(() => {
    if (ready && user && staff) navigate(target, { replace: true });
  }, [ready, user, staff, target, navigate]);

  if (ready && user && roles.length > 0 && !staff) {
    return (
      <AuthShell title="Área do Barbeiro">
        <div className="text-center">
          <LogoMark className="mx-auto w-8" />
          <p className="mt-4 text-[16px] text-text-100">Esta área é exclusiva da equipe Classe A.</p>
          <div className="mt-6 grid gap-2">
            <ButtonLink to="/">Voltar ao site</ButtonLink>
            <Button variant="ghost" onClick={() => void signOut()}>
              Entrar com outra conta
            </Button>
          </div>
        </div>
      </AuthShell>
    );
  }

  const submit = form.handleSubmit(async ({ email, password }) => {
    setError(null);
    try {
      await signIn(email, password);
    } catch (e) {
      setError(authErrorMessage(e));
    }
  });

  return (
    <AuthShell title="Área do Barbeiro" subtitle="Acesso exclusivo da equipe.">
      <form onSubmit={submit} noValidate className="space-y-3">
        <Input label="E-mail" type="email" inputMode="email" autoComplete="username" {...form.register('email')} error={form.formState.errors.email?.message} />
        <Input
          label="Senha"
          type={shown ? 'text' : 'password'}
          autoComplete="current-password"
          {...form.register('password')}
          error={form.formState.errors.password?.message}
          trailing={
            <button type="button" onClick={() => setShown((s) => !s)} className="grid size-11 place-items-center text-text-400" aria-label={shown ? 'Ocultar senha' : 'Mostrar senha'}>
              {shown ? <EyeOff className="size-5" strokeWidth={1.5} /> : <Eye className="size-5" strokeWidth={1.5} />}
            </button>
          }
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
        <Button type="submit" block size="lg" loading={form.formState.isSubmitting || (!!user && !ready)}>
          Entrar
        </Button>
      </form>
    </AuthShell>
  );
}
