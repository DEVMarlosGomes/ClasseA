import { z } from 'zod';
import { expiryValid, luhnValid, onlyDigits } from './cards';
import { isHHmm, toMinutes } from './time';

/** Generic messages in pt-BR; field-specific messages are set on each schema. */
z.setErrorMap((issue, ctx) => {
  if (issue.code === z.ZodIssueCode.invalid_type) {
    return { message: issue.received === 'undefined' || issue.received === 'null' ? 'Campo obrigatório' : 'Valor inválido' };
  }
  if (issue.code === z.ZodIssueCode.too_small) return { message: 'Valor muito curto' };
  if (issue.code === z.ZodIssueCode.too_big) return { message: 'Valor muito longo' };
  return { message: ctx.defaultError };
});

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida');
const hhmm = z.string().refine(isHHmm, 'Horário inválido');

export const timeRangeSchema = z
  .object({ start: hhmm, end: hhmm.or(z.literal('24:00')) })
  .refine((r) => (r.end === '24:00' ? 1440 : toMinutes(r.end)) > toMinutes(r.start), {
    message: 'O início precisa ser antes do fim',
  });

/** Brazilian mobile: (11) 91234-5678 or +5511912345678 → +5511912345678 (idempotent). */
export const brPhoneSchema = z
  .string()
  .transform((v) => {
    const d = onlyDigits(v);
    return d.length === 13 && d.startsWith('55') ? d.slice(2) : d;
  })
  .refine((d) => /^(\d{2})9\d{8}$/.test(d), 'Informe um celular com DDD, ex.: (11) 91234-5678')
  .transform((d) => `+55${d}`);

export const passwordSchema = z
  .string()
  .min(8, 'A senha precisa ter pelo menos 8 caracteres')
  .max(128, 'Senha longa demais');

export const signUpSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'Informe seu nome completo')
    .max(80, 'Nome longo demais')
    .refine((v) => v.split(/\s+/).length >= 2, 'Informe nome e sobrenome'),
  phone: brPhoneSchema,
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  password: passwordSchema,
  birthDate: z
    .string()
    .optional()
    .refine((v) => !v || /^\d{2}\/\d{2}\/\d{4}$/.test(v), 'Use o formato DD/MM/AAAA'),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'É preciso aceitar para criar a conta' }) }),
  ageDeclaration: z.enum(['adult', 'guardian'], {
    errorMap: () => ({ message: 'Confirme sua idade ou a autorização do responsável' }),
  }),
  marketingOptIn: z.boolean().default(false),
});
export type SignUpInput = z.input<typeof signUpSchema>;

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  password: z.string().min(1, 'Informe a senha'),
});

export const paymentModeSchema = z.enum(['plan', 'pay_at_shop', 'card_mock', 'pix_mock']);

export const getAvailableSlotsSchema = z.object({
  barberId: z.string().min(1),
  date: dateKey,
  serviceIds: z.array(z.string().min(1)).min(1).max(6),
});

export const createAppointmentSchema = z.object({
  barberId: z.string().min(1),
  date: dateKey,
  start: hhmm,
  serviceIds: z.array(z.string().min(1)).min(1).max(6),
  paymentMode: paymentModeSchema,
  paymentMethodId: z.string().nullish(),
  pixChargeId: z.string().nullish(),
  notes: z.string().trim().max(200, 'Até 200 caracteres').nullish(),
});
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

export const cancelAppointmentSchema = z.object({
  id: z.string().min(1),
  reason: z.string().trim().max(200).nullish(),
});

export const rescheduleAppointmentSchema = z.object({
  id: z.string().min(1),
  newSlot: z.object({ barberId: z.string().min(1), date: dateKey, start: hhmm }),
});

export const barberUpdateStatusSchema = z
  .object({
    id: z.string().min(1),
    status: z.enum(['completed', 'no_show', 'cancelled_by_barber']),
    reason: z.string().trim().max(200).optional(),
  })
  .refine((v) => v.status !== 'cancelled_by_barber' || (v.reason && v.reason.length >= 3), {
    message: 'Informe o motivo do cancelamento',
    path: ['reason'],
  });

/**
 * What the browser sends to the mock gateway. The CVV is validated client-side and never sent.
 * In a real integration this is replaced by the gateway SDK token.
 */
export const addPaymentMethodSchema = z.object({
  number: z
    .string()
    .transform(onlyDigits)
    .refine(luhnValid, 'Número de cartão inválido'),
  holderName: z.string().trim().min(3, 'Nome como está no cartão').max(60),
  expMonth: z.number().int().min(1).max(12),
  expYear: z.number().int().min(0).max(99),
  makeDefault: z.boolean().default(false),
}).refine((v) => expiryValid(v.expMonth, v.expYear), { message: 'Cartão vencido', path: ['expMonth'] });

export const subscribePlanSchema = z.object({
  planId: z.string().min(1),
  method: z.enum(['card_mock', 'pix_mock']),
  paymentMethodId: z.string().nullish(),
  pixChargeId: z.string().nullish(),
});

export const changePlanSchema = z.object({ planId: z.string().min(1) });
export const cancelSubscriptionSchema = z.object({ subscriptionId: z.string().min(1) });
export const setAutoRenewSchema = z.object({ subscriptionId: z.string().min(1), autoRenew: z.boolean() });

export const createPixChargeSchema = z.object({
  purpose: z.enum(['appointment', 'subscription']),
  planId: z.string().optional(),
  serviceIds: z.array(z.string()).optional(),
});

export const pixChargeIdSchema = z.object({ chargeId: z.string().min(1) });

export const setUserRoleSchema = z.object({
  uid: z.string().min(1),
  roles: z.array(z.enum(['client', 'barber', 'admin'])).min(1),
});

export const createBarberSchema = z.object({
  displayName: z.string().trim().min(2).max(40),
  email: z.string().trim().toLowerCase().email(),
  bio: z.string().trim().max(240).default(''),
  specialties: z.array(z.string().trim().min(1)).max(6).default([]),
  serviceIds: z.array(z.string()).default([]),
});

export const deleteMyAccountSchema = z.object({ confirmation: z.literal('EXCLUIR') });

export const barberDaySchema = z.object({
  status: z.enum(['open', 'closed']),
  blocks: z.array(timeRangeSchema.and(z.object({ reason: z.string().max(40).nullable().optional() }))).max(96),
  extraOpenings: z.array(timeRangeSchema).max(12),
});

export const consentLogSchema = z.object({
  type: z.enum(['cookies', 'terms', 'privacy', 'marketing']),
  version: z.string().min(1).max(20),
  choices: z.record(z.boolean()),
});
