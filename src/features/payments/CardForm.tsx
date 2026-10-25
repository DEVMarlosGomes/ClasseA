import { useState } from 'react';
import { BRAND_LABEL, cvvLength, detectBrand, expiryValid, luhnValid, onlyDigits } from '@shared/cards';
import { Button } from '@/components/ui/Button';
import { Checkbox, Input, MaskedInput } from '@/components/ui/Input';
import { call, errorMessage } from '@/lib/api';
import { CardVisual } from './CardVisual';
import { DemoNotice } from './DemoNotice';

export interface SavedCard {
  id: string;
  brand: string;
  last4: string;
}

/** Adds a card through the mock gateway. Only what the mock needs is sent; the CVV never leaves the browser. */
export function CardForm({ onSaved, submitLabel = 'Salvar cartão' }: { onSaved: (card: SavedCard) => void; submitLabel?: string }) {
  const [number, setNumber] = useState('');
  const [holder, setHolder] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [makeDefault, setMakeDefault] = useState(true);
  const [cvvFocus, setCvvFocus] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const brand = detectBrand(number);
  const cvvLen = cvvLength(brand);
  const numberMask = brand === 'amex' ? '0000 000000 00000' : '0000 0000 0000 0000';

  const validate = () => {
    const e: Record<string, string> = {};
    if (!luhnValid(number)) e.number = 'Confira o número do cartão.';
    if (holder.trim().length < 3) e.holder = 'Escreva o nome como está no cartão.';
    const [mm, yy] = expiry.split('/').map(Number);
    if (!mm || yy === undefined || Number.isNaN(yy) || !expiryValid(mm, yy)) e.expiry = 'Validade inválida ou vencida.';
    if (onlyDigits(cvv).length !== cvvLen) e.cvv = `O código tem ${cvvLen} dígitos.`;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setServerError(null);
    if (!validate()) return;
    const [mm, yy] = expiry.split('/').map(Number);
    setBusy(true);
    try {
      // CVV validated above and intentionally not included.
      const res = await call<unknown, SavedCard>('addPaymentMethod', {
        number: onlyDigits(number),
        holderName: holder.trim(),
        expMonth: mm,
        expYear: yy,
        makeDefault,
      });
      setCvv('');
      onSaved(res);
    } catch (e) {
      setServerError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <DemoNotice />
      <CardVisual number={number} holder={holder} expiry={expiry} brand={brand} flipped={cvvFocus} cvvLength={cvvLen} />
      <MaskedInput
        label="Número do cartão"
        mask={numberMask}
        inputMode="numeric"
        autoComplete="cc-number"
        value={number}
        onValueChange={setNumber}
        error={errors.number}
        hint={brand !== 'unknown' ? BRAND_LABEL[brand] : 'Visa, Mastercard, Elo, Amex ou Hipercard'}
      />
      <Input
        label="Nome impresso no cartão"
        autoComplete="cc-name"
        value={holder}
        onChange={(e) => setHolder(e.target.value)}
        error={errors.holder}
      />
      <div className="grid grid-cols-2 gap-3">
        <MaskedInput
          label="Validade (MM/AA)"
          mask="00/00"
          inputMode="numeric"
          autoComplete="cc-exp"
          value={expiry}
          onValueChange={setExpiry}
          error={errors.expiry}
        />
        <MaskedInput
          label="CVV"
          mask={'0'.repeat(cvvLen)}
          inputMode="numeric"
          autoComplete="cc-csc"
          value={cvv}
          onValueChange={setCvv}
          onFocus={() => setCvvFocus(true)}
          onBlur={() => setCvvFocus(false)}
          error={errors.cvv}
        />
      </div>
      <Checkbox checked={makeDefault} onChange={(e) => setMakeDefault(e.target.checked)} label="Usar como cartão padrão" />
      {serverError && (
        <p role="alert" className="rounded-[12px] border border-danger/40 bg-danger/10 px-4 py-3 text-[14px] text-[#f4a49d]">
          {serverError}
        </p>
      )}
      <Button type="submit" block size="lg" loading={busy}>
        {submitLabel}
      </Button>
    </form>
  );
}
