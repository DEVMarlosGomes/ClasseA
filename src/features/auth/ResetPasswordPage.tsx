import { zodResolver } from '@hookform/resolvers/zod';
import { MailCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { AuthShell } from './AuthShell';
import { useAuthNow } from './AuthProvider';

const schema = z.object({ email: z.string().trim().toLowerCase().email('E-mail inválido') });

export default function ResetPasswordPage() {
  useDocumentMeta({ title: 'Recuperar senha', noindex: true });
  const { resetPassword } = useAuthNow();
  const [sent, setSent] = useState(false);
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { email: '' } });

  const submit = form.handleSubmit(async ({ email }) => {
    try {
      await resetPassword(email);
    } catch {
      // Same answer whether or not the e-mail exists, so accounts cannot be enumerated.
    }
    setSent(true);
  });

  return (
    <AuthShell
      title="Recuperar senha"
      subtitle={sent ? undefined : 'Enviamos um link para você criar uma nova senha.'}
      footer={
        <Link to="/entrar" className="text-gold-400 underline">
          Voltar para entrar
        </Link>
      }
    >
      {sent ? (
        <div className="flex flex-col items-center py-4 text-center" role="status">
          <MailCheck className="size-10 text-gold-500" strokeWidth={1.25} aria-hidden="true" />
          <p className="mt-4 text-[16px] text-text-100">Se houver uma conta com esse e-mail, o link chega em instantes.</p>
          <p className="mt-2 text-[14px] text-text-400">Confira também a caixa de spam.</p>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4">
          <Input label="E-mail" type="email" inputMode="email" autoComplete="email" {...form.register('email')} error={form.formState.errors.email?.message} />
          <Button type="submit" block size="lg" loading={form.formState.isSubmitting}>
            Enviar link
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
