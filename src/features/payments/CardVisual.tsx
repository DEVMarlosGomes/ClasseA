import { motion, useReducedMotion } from 'framer-motion';
import type { CardBrand } from '@shared/types';
import { BRAND_LABEL } from '@shared/cards';
import { LogoMark } from '@/components/ui/Logo';
import { EASE } from '@/lib/motion';

interface CardVisualProps {
  number: string;
  holder: string;
  expiry: string;
  brand: CardBrand;
  flipped: boolean;
  cvvLength: number;
}

function maskNumber(number: string): string {
  const d = number.replace(/\D/g, '');
  const groups = d.padEnd(16, '•').slice(0, 19).match(/.{1,4}/g) ?? [];
  return groups.join(' ');
}

/** Glass card with the razor as watermark; flips to the back while the CVV field is focused. */
export function CardVisual({ number, holder, expiry, brand, flipped, cvvLength }: CardVisualProps) {
  const reduced = useReducedMotion();
  const face = 'absolute inset-0 overflow-hidden rounded-[18px] border border-gold-500/30 [backface-visibility:hidden]';
  return (
    <div className="mx-auto w-full max-w-[340px] [perspective:1200px]" aria-hidden="true">
      <motion.div
        className="relative aspect-[1.586] w-full [transform-style:preserve-3d]"
        animate={{ rotateY: flipped ? 180 : 0, opacity: reduced && flipped ? 0.9 : 1 }}
        transition={{ duration: reduced ? 0 : 0.6, ease: EASE }}
      >
        <div
          className={`${face} bg-[linear-gradient(135deg,rgba(40,34,22,0.92),rgba(12,12,12,0.95)_55%,rgba(48,38,18,0.92))] p-5 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.08)]`}
        >
          <LogoMark className="absolute -right-6 -top-4 w-40 opacity-[0.09]" />
          <div className="flex items-start justify-between">
            <span className="h-8 w-11 rounded-[6px] bg-[linear-gradient(135deg,#f6d47a,#b8862b)] opacity-90" />
            <span className="font-label text-[14px] text-gold-400">{brand === 'unknown' ? '' : BRAND_LABEL[brand]}</span>
          </div>
          <p className="tabular mt-7 text-[19px] font-medium tracking-[0.14em] text-text-100 sm:text-[21px]">{maskNumber(number)}</p>
          <div className="mt-5 flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="font-label text-[10px] text-text-400">Nome</p>
              <p className="truncate text-[14px] uppercase tracking-wide text-text-100">{holder || 'Como no cartão'}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-label text-[10px] text-text-400">Validade</p>
              <p className="tabular text-[14px] text-text-100">{expiry || 'MM/AA'}</p>
            </div>
          </div>
        </div>
        <div className={`${face} bg-[linear-gradient(135deg,#141414,#0b0b0b)] [transform:rotateY(180deg)]`}>
          <div className="mt-6 h-10 bg-ink-950" />
          <div className="mx-5 mt-5 flex items-center justify-end rounded-[6px] bg-text-100/90 px-3 py-2">
            <span className="tabular text-[15px] font-bold tracking-[0.3em] text-ink-950">{'•'.repeat(cvvLength)}</span>
          </div>
          <p className="mx-5 mt-4 text-[11px] leading-snug text-text-400">
            Ambiente de demonstração: o código de segurança é conferido e descartado, nunca é enviado nem guardado.
          </p>
          <LogoMark className="absolute bottom-3 right-4 w-5 opacity-40" />
        </div>
      </motion.div>
    </div>
  );
}
