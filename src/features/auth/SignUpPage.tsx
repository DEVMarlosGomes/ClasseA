import { Link, useNavigate, useSearchParams } from 'react-router';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { AuthShell } from './AuthShell';
import { SignUpForm } from './forms';
import { safeNext } from './SignInPage';

export default function SignUpPage() {
  useDocumentMeta({ title: 'Criar conta', description: 'Crie sua conta na Classe A Barbearia para agendar e assinar planos.' });
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const completing = params.get('completar') === '1';
  const next = safeNext(params.get('next'), '/cliente');

  return (
    <AuthShell
      title={completing ? 'Complete seu cadastro' : 'Criar conta'}
      subtitle={completing ? 'Só faltam seu celular e o aceite dos termos.' : 'Leva menos de um minuto.'}
      footer={
        completing ? undefined : (
          <>
            Já tem conta?{' '}
            <Link to="/entrar" className="text-gold-400 underline">
              Entrar
            </Link>
          </>
        )
      }
    >
      <SignUpForm completeOnly={completing} onSuccess={() => navigate(next, { replace: true })} />
    </AuthShell>
  );
}
