import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatBRL } from '@shared/money';
import { Button } from '@/components/ui/Button';
import { RazorLoader } from '@/components/ui/RazorLoader';
import { SuccessCheck } from '@/components/ui/SuccessCheck';
import { toast } from '@/components/ui/Toast';
import { call, errorMessage } from '@/lib/api';
import { DemoNotice } from './DemoNotice';

interface PixCharge {
  id: string;
  payload: string;
  amountCents: number;
  expiresAt: string;
}

type Purpose = { purpose: 'appointment'; serviceIds: string[] } | { purpose: 'subscription'; planId: string };

/** Simulated PIX: fictitious BR Code + QR, 10-minute countdown and a "simulate approval" button. */
export function PixPanel({ request, onPaid }: { request: Purpose; onPaid: (chargeId: string) => void }) {
  const [charge, setCharge] = useState<PixCharge | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState(600);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [paid, setPaid] = useState(false);
  const key = JSON.stringify(request);

  useEffect(() => {
    let cancelled = false;
    setCharge(null);
    setError(null);
    call<Purpose, PixCharge>('createPixCharge', request)
      .then(async (c) => {
        if (cancelled) return;
        setCharge(c);
        const QR = await import('qrcode');
        setQr(await QR.toDataURL(c.payload, { margin: 1, width: 240, color: { dark: '#050505', light: '#F5F1E8' } }));
      })
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!charge) return;
    const tick = () => setLeft(Math.max(0, Math.round((new Date(charge.expiresAt).getTime() - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [charge]);

  if (error) return <p role="alert" className="text-[14px] text-[#f4a49d]">{error}</p>;
  if (!charge) return <RazorLoader label="Gerando PIX" className="py-8" />;

  if (paid)
    return (
      <div className="flex flex-col items-center py-4 text-center">
        <SuccessCheck size={80} />
        <p className="font-label mt-4 text-[18px] text-text-100">PIX aprovado</p>
      </div>
    );

  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  const expired = left === 0;

  return (
    <div className="space-y-4">
      <DemoNotice />
      <div className="flex flex-col items-center gap-3">
        <div className="rounded-[16px] bg-text-100 p-3">
          {qr ? <img src={qr} alt="QR Code do PIX (fictício)" width={200} height={200} className={expired ? 'opacity-20' : ''} /> : <div className="size-[200px]" />}
        </div>
        <p className="tabular text-[22px] font-bold text-gold-500">{formatBRL(charge.amountCents)}</p>
        <p className="tabular text-[14px] text-text-400" aria-live="polite">
          {expired ? 'Este PIX expirou. Gere outro.' : `Expira em ${mm}:${ss}`}
        </p>
      </div>
      <div className="rounded-[12px] border border-ink-600 bg-ink-800 p-3">
        <p className="font-label text-[11px] text-text-400">PIX copia e cola</p>
        <p className="mt-1 break-all font-mono text-[12px] leading-relaxed text-text-100/80">{charge.payload}</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          variant="secondary"
          icon={copied ? <Check className="size-4" /> : <Copy className="size-4" strokeWidth={1.75} />}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(charge.payload);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              toast.error('Não foi possível copiar. Selecione o código e copie manualmente.');
            }
          }}
        >
          {copied ? 'Copiado' : 'Copiar código'}
        </Button>
        <Button
          loading={confirming}
          disabled={expired}
          onClick={async () => {
            setConfirming(true);
            try {
              const res = await call<{ chargeId: string }, { status: string }>('confirmMockPix', { chargeId: charge.id });
              if (res.status === 'approved') {
                setPaid(true);
                onPaid(charge.id);
              } else toast.error('Este PIX expirou. Gere outro.');
            } catch (e) {
              toast.error(errorMessage(e));
            } finally {
              setConfirming(false);
            }
          }}
        >
          Simular pagamento aprovado
        </Button>
      </div>
    </div>
  );
}
