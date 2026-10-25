import { ButtonLink } from '@/components/ui/Button';
import { LogoMark } from '@/components/ui/Logo';
import { Halo } from '@/components/ui/Orbs';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';

export default function NotFoundPage() {
  useDocumentMeta({ title: 'Página não encontrada', noindex: true });
  return (
    <main className="relative grid min-h-svh place-items-center overflow-hidden px-6 text-center">
      <Halo className="left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2" />
      <div className="relative max-w-sm">
        <LogoMark className="mx-auto mb-6 w-12" />
        <p className="tabular font-label text-[64px] leading-none text-gold-500">404</p>
        <h1 className="font-label mt-4 text-[22px] text-text-100">Essa cadeira está vazia</h1>
        <p className="mt-3 text-[16px] text-text-400">A página que você procurou não existe ou mudou de endereço.</p>
        <div className="mt-8 flex flex-col gap-3">
          <ButtonLink to="/agendar">Agendar horário</ButtonLink>
          <ButtonLink to="/" variant="ghost">
            Voltar ao início
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
