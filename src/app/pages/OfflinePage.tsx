import { WifiOff } from 'lucide-react';
import { LogoMark } from '@/components/ui/Logo';

export default function OfflinePage() {
  return (
    <main className="grid min-h-svh place-items-center px-6 text-center">
      <div className="max-w-sm">
        <LogoMark className="mx-auto mb-6 w-10" />
        <WifiOff className="mx-auto size-8 text-gold-500" strokeWidth={1.5} aria-hidden="true" />
        <h1 className="font-label mt-4 text-[22px] text-text-100">Você está sem conexão</h1>
        <p className="mt-3 text-[16px] text-text-400">
          Sua agenda continua disponível para consulta. Para agendar ou alterar horários, conecte-se à internet.
        </p>
        <button onClick={() => location.reload()} className="font-label mt-8 min-h-11 text-[14px] text-gold-400 underline">
          Tentar de novo
        </button>
      </div>
    </main>
  );
}
