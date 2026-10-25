import { Check, CreditCard, Crown, Plus, QrCode, Store } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { BRAND_LABEL } from '@shared/cards';
import { formatBRL } from '@shared/money';
import type { CardBrand, PaymentMode } from '@shared/types';
import { Sheet } from '@/components/ui/Sheet';
import { Skeleton } from '@/components/ui/Skeleton';
import { toast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';
import { useAuth } from '@/features/auth/AuthProvider';
import { CardForm } from '@/features/payments/CardForm';
import { DemoNotice } from '@/features/payments/DemoNotice';
import { PixPanel } from '@/features/payments/PixPanel';
import { useMyPaymentMethods } from '@/features/plans/hooks';
import { useBooking } from '../store';
import { useBookingData } from '../useBookingData';

function Option({
  selected,
  onClick,
  icon,
  title,
  description,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  icon: ReactNode;
  title: string;
  description: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className={cn('rounded-[18px] border transition-colors duration-150', selected ? 'border-gold-500 bg-gold-500/[0.07]' : 'border-ink-600 bg-ink-800/70')}>
      <button type="button" role="radio" aria-checked={selected} onClick={onClick} className="flex w-full items-center gap-4 p-4 text-left">
        <span className={cn('grid size-11 shrink-0 place-items-center rounded-full', selected ? 'bg-gold-500 text-ink-950' : 'bg-ink-700 text-gold-500')}>
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-bold text-text-100">{title}</span>
          <span className="block text-[14px] text-text-400">{description}</span>
        </span>
        <span aria-hidden="true" className={cn('grid size-6 place-items-center rounded-full border', selected ? 'border-transparent bg-gold-500 text-ink-950' : 'border-ink-600')}>
          {selected && <Check className="size-4" strokeWidth={2.5} />}
        </span>
      </button>
      {selected && children && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

export function PaymentStep() {
  const { user } = useAuth();
  const { planActive, planCoversSome, plan, totalCents, dueWithPlanCents } = useBookingData();
  const { paymentMode, paymentMethodId, setPayment, serviceIds, pixChargeId, setPix } = useBooking();
  const cards = useMyPaymentMethods(user?.uid);
  const [addOpen, setAddOpen] = useState(false);
  const [pixOpen, setPixOpen] = useState(false);

  const choose = (mode: PaymentMode) => {
    if (mode === 'card_mock') {
      const def = cards.data?.find((c) => c.isDefault) ?? cards.data?.[0];
      setPayment(mode, paymentMethodId ?? def?.id ?? null);
    } else setPayment(mode);
    if (mode === 'pix_mock' && !pixChargeId) setPixOpen(true);
  };

  const usage = plan.usage;

  return (
    <div role="radiogroup" aria-label="Forma de pagamento" className="space-y-3">
      {planActive && planCoversSome && (
        <Option
          selected={paymentMode === 'plan'}
          onClick={() => choose('plan')}
          icon={<Crown className="size-5" strokeWidth={1.5} />}
          title="Usar meu plano"
          description={
            <>
              {usage?.remaining != null ? `Restam ${usage.remaining} de ${usage.total} neste ciclo` : 'Uso ilimitado neste ciclo'}
              {dueWithPlanCents > 0 && ` · ${formatBRL(dueWithPlanCents)} na barbearia pelos serviços não inclusos`}
            </>
          }
        />
      )}
      <Option
        selected={paymentMode === 'pay_at_shop'}
        onClick={() => choose('pay_at_shop')}
        icon={<Store className="size-5" strokeWidth={1.5} />}
        title="Pagar na barbearia"
        description={`${formatBRL(totalCents)} no dia, em dinheiro, cartão ou PIX`}
      />
      <Option
        selected={paymentMode === 'card_mock'}
        onClick={() => choose('card_mock')}
        icon={<CreditCard className="size-5" strokeWidth={1.5} />}
        title="Pagar agora com cartão"
        description="Simulado · nenhum valor é cobrado"
      >
        <DemoNotice />
        {cards.loading ? (
          <Skeleton className="mt-3 h-14 rounded-[14px]" />
        ) : (
          <ul className="mt-3 space-y-2" role="radiogroup" aria-label="Cartões salvos">
            {cards.data?.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={paymentMethodId === c.id}
                  onClick={() => setPayment('card_mock', c.id)}
                  className={cn(
                    'tabular flex min-h-14 w-full items-center justify-between rounded-[14px] border px-4 text-[15px]',
                    paymentMethodId === c.id ? 'border-gold-500 text-text-100' : 'border-ink-600 text-text-400 hover:border-gold-700',
                  )}
                >
                  <span>
                    {BRAND_LABEL[c.brand as CardBrand]} final {c.last4}
                  </span>
                  <span className="text-[13px]">
                    {String(c.expMonth).padStart(2, '0')}/{String(c.expYear).slice(-2)}
                  </span>
                </button>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="font-label flex min-h-12 w-full items-center justify-center gap-2 rounded-[14px] border border-dashed border-gold-700 text-[14px] text-gold-400 hover:bg-gold-500/5"
              >
                <Plus className="size-4" strokeWidth={1.75} />
                Adicionar cartão
              </button>
            </li>
          </ul>
        )}
      </Option>
      <Option
        selected={paymentMode === 'pix_mock'}
        onClick={() => choose('pix_mock')}
        icon={<QrCode className="size-5" strokeWidth={1.5} />}
        title="Pagar agora com PIX"
        description={pixChargeId ? 'PIX aprovado · tudo certo' : 'Simulado · QR code fictício'}
      >
        {!pixChargeId && (
          <button type="button" onClick={() => setPixOpen(true)} className="font-label min-h-11 text-[14px] text-gold-400 underline">
            Abrir PIX
          </button>
        )}
      </Option>

      <Sheet open={addOpen} onOpenChange={setAddOpen} title="Adicionar cartão">
        <CardForm
          submitLabel="Salvar e usar este cartão"
          onSaved={(card) => {
            setPayment('card_mock', card.id);
            setAddOpen(false);
            toast.success(`Cartão final ${card.last4} salvo.`);
          }}
        />
      </Sheet>
      <Sheet open={pixOpen} onOpenChange={setPixOpen} title="Pagar com PIX" size="sm">
        {pixOpen && (
          <PixPanel
            request={{ purpose: 'appointment', serviceIds }}
            onPaid={(id) => {
              setPix(id);
              setPayment('pix_mock');
              setTimeout(() => setPixOpen(false), 900);
            }}
          />
        )}
      </Sheet>
    </div>
  );
}
