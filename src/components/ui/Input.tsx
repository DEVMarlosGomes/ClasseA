import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { IMaskInput } from 'react-imask';
import { cn } from '@/lib/cn';

const field =
  'peer block w-full rounded-[var(--radius-control)] border bg-ink-700/70 px-4 pb-2 pt-6 text-[16px] text-text-100 placeholder-transparent outline-none transition-[border-color,box-shadow] duration-150 focus:border-gold-500 focus:shadow-[0_0_0_3px_rgba(233,181,66,0.15)] disabled:opacity-50';

const floatingLabel =
  'pointer-events-none absolute left-4 top-1/2 origin-left -translate-y-1/2 text-[16px] text-text-400 transition-all duration-150 peer-focus:top-4 peer-focus:text-[12px] peer-focus:text-gold-400 peer-[:not(:placeholder-shown)]:top-4 peer-[:not(:placeholder-shown)]:text-[12px]';

interface FieldShellProps {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  trailing?: ReactNode;
  children: ReactNode;
  className?: string;
}

function FieldShell({ id, label, error, hint, trailing, children, className }: FieldShellProps) {
  return (
    <div className={className}>
      <div className="relative">
        {children}
        <label htmlFor={id} className={floatingLabel}>
          {label}
        </label>
        {trailing && <div className="absolute right-2 top-1/2 -translate-y-1/2">{trailing}</div>}
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 px-1 text-[14px] text-[#f4a49d]">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 px-1 text-[12px] text-text-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'placeholder'> {
  label: string;
  error?: string;
  hint?: ReactNode;
  trailing?: ReactNode;
  wrapperClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, trailing, id, className, wrapperClassName, ...rest },
  ref,
) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <FieldShell id={inputId} label={label} error={error} hint={hint} trailing={trailing} className={wrapperClassName}>
      <input
        ref={ref}
        id={inputId}
        placeholder=" "
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        className={cn(field, error ? 'border-danger/70' : 'border-ink-600', trailing && 'pr-14', 'h-14', className)}
        {...rest}
      />
    </FieldShell>
  );
});

export interface MaskedInputProps extends Omit<InputProps, 'onChange' | 'value' | 'defaultValue'> {
  mask: string;
  value: string;
  onValueChange: (value: string) => void;
  definitions?: Record<string, RegExp>;
}

/** Floating-label input with an IMask pattern, e.g. "(00) 00000-0000". */
export const MaskedInput = forwardRef<HTMLInputElement, MaskedInputProps>(function MaskedInput(
  { label, error, hint, trailing, id, className, wrapperClassName, mask, value, onValueChange, definitions, onBlur, onFocus, name, inputMode, autoComplete, disabled },
  ref,
) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <FieldShell id={inputId} label={label} error={error} hint={hint} trailing={trailing} className={wrapperClassName}>
      <IMaskInput
        inputRef={ref}
        id={inputId}
        name={name}
        mask={mask}
        definitions={definitions}
        value={value}
        unmask={false}
        onAccept={(v: string) => onValueChange(v)}
        onBlur={onBlur}
        onFocus={onFocus}
        inputMode={inputMode}
        autoComplete={autoComplete}
        disabled={disabled}
        placeholder=" "
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        className={cn(field, error ? 'border-danger/70' : 'border-ink-600', trailing && 'pr-14', 'tabular h-14', className)}
      />
    </FieldShell>
  );
});

export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'placeholder'> {
  label: string;
  error?: string;
  hint?: ReactNode;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, id, className, ...rest },
  ref,
) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <div>
      <div className="relative">
        <textarea
          ref={ref}
          id={inputId}
          placeholder=" "
          aria-invalid={error ? true : undefined}
          className={cn(field, 'min-h-28 resize-none pt-7', error ? 'border-danger/70' : 'border-ink-600', className)}
          {...rest}
        />
        <label
          htmlFor={inputId}
          className={cn(floatingLabel, 'top-7 peer-focus:top-4 peer-[:not(:placeholder-shown)]:top-4')}
        >
          {label}
        </label>
      </div>
      {error ? (
        <p role="alert" className="mt-1.5 px-1 text-[14px] text-[#f4a49d]">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 px-1 text-[12px] text-text-400">{hint}</p>
      ) : null}
    </div>
  );
});

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  error?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, error, id, className, ...rest },
  ref,
) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <div className={className}>
      <label htmlFor={inputId} className="flex min-h-11 cursor-pointer items-start gap-3 py-1">
        <span className="relative mt-0.5 grid size-5 shrink-0 place-items-center">
          <input
            ref={ref}
            id={inputId}
            type="checkbox"
            aria-invalid={error ? true : undefined}
            className="peer size-5 cursor-pointer appearance-none rounded-[6px] border border-ink-600 bg-ink-700 transition-colors checked:border-gold-500 checked:bg-gold-500 focus-visible:outline-2 focus-visible:outline-gold-400"
            {...rest}
          />
          <svg
            viewBox="0 0 16 16"
            className="pointer-events-none absolute size-3.5 text-ink-950 opacity-0 peer-checked:opacity-100"
            aria-hidden="true"
          >
            <path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="text-[14px] leading-relaxed text-text-100">{label}</span>
      </label>
      {error && (
        <p role="alert" className="ml-8 text-[14px] text-[#f4a49d]">
          {error}
        </p>
      )}
    </div>
  );
});
