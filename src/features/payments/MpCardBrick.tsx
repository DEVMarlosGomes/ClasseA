import { CardPayment, initMercadoPago } from '@mercadopago/sdk-react';
import { useState } from 'react';
import { RazorLoader } from '@/components/ui/RazorLoader';
import { MP_PUBLIC_KEY } from '@/lib/payments';

let initialised = false;

export interface MpCard {
  token: string;
  last4: string;
}

/**
 * Mercado Pago Card Payment Brick: the card number, expiry and CVV are typed in Mercado Pago's own
 * secure fields; we only receive a single-use token (card_token_id) for the subscription. Credit only,
 * one installment: a recurring plan is charged in full every period.
 * Loaded lazily (React.lazy) so the Mercado Pago script never weighs on other pages.
 */
export default function MpCardBrick({
  amountCents,
  email,
  onToken,
}: {
  amountCents: number;
  email?: string;
  onToken: (card: MpCard) => void;
}) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!initialised) {
    initMercadoPago(MP_PUBLIC_KEY, { locale: 'pt-BR' });
    initialised = true;
  }
  return (
    <div>
      {!ready && !error && <RazorLoader label="Carregando pagamento seguro" className="py-6" />}
      {error && (
        <p role="alert" className="text-[14px] text-[#f4a49d]">
          {error}
        </p>
      )}
      <CardPayment
        locale="pt-BR"
        initialization={{ amount: amountCents / 100, payer: email ? { email } : undefined }}
        customization={{ paymentMethods: { types: { included: ['credit_card'] }, maxInstallments: 1 } }}
        onReady={() => setReady(true)}
        onError={() =>
          setError(
            'Não foi possível carregar o pagamento do Mercado Pago. Recarregue a página e tente de novo.',
          )
        }
        onSubmit={async (data, extra) => {
          onToken({ token: data.token, last4: extra?.lastFourDigits ?? '' });
        }}
      />
    </div>
  );
}
