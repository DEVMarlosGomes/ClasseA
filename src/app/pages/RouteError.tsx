import { isRouteErrorResponse, useRouteError } from 'react-router';
import { ButtonLink } from '@/components/ui/Button';
import { LogoMark } from '@/components/ui/Logo';

export function RouteError() {
  const error = useRouteError();
  const chunkFailed = error instanceof Error && /dynamically imported module|Loading chunk/i.test(error.message);
  const status = isRouteErrorResponse(error) ? error.status : null;
  return (
    <main className="grid min-h-svh place-items-center px-6 text-center">
      <div className="max-w-sm">
        <LogoMark className="mx-auto mb-6 w-10" />
        <h1 className="font-label text-[28px] text-text-100">
          {status === 404 ? 'Página não encontrada' : 'Algo saiu do lugar'}
        </h1>
        <p className="mt-3 text-[16px] text-text-400">
          {chunkFailed
            ? 'Saiu uma versão nova do app ou a conexão caiu. Recarregue a página para continuar.'
            : 'Tivemos um problema ao abrir esta tela. Tente de novo ou volte para o início.'}
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <button onClick={() => location.reload()} className="font-label min-h-11 text-[14px] text-gold-400 underline">
            Recarregar
          </button>
          <ButtonLink to="/" variant="secondary">
            Voltar ao início
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
