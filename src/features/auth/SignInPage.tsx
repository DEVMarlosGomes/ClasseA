import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { AuthShell } from './AuthShell';
import { useAuthNow } from './AuthProvider';
import { SignInForm } from './forms';

export function safeNext(next: string | null, fallback: string): string {
  // Only same-origin relative paths; never an absolute URL from the query string.
  return next && next.startsWith('/') && !next.startsWith('//') ? next : fallback;
}

export default function SignInPage() {
  useDocumentMeta({ title: 'Entrar', noindex: true });
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { ready, user, roles } = useAuthNow();
  const next = safeNext(params.get('next'), '/cliente');

  useEffect(() => {
    if (ready && user && roles.length) navigate(roles.includes('client') ? next : roles.includes('barber') ? '/barbeiro' : '/admin', { replace: true });
  }, [ready, user, roles, next, navigate]);

  return (
    <AuthShell
      title="Entrar"
      subtitle="Acesse seus agendamentos e seu plano."
      footer={
        <>
          Ainda não tem conta?{' '}
          <Link to={`/cadastro${params.get('next') ? `?next=${encodeURIComponent(next)}` : ''}`} className="text-gold-400 underline">
            Criar conta
          </Link>
        </>
      }
    >
      <SignInForm onSuccess={() => navigate(next, { replace: true })} onNeedsProfile={() => navigate('/cadastro?completar=1')} />
    </AuthShell>
  );
}
