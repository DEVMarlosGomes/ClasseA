import type { ZodType, ZodTypeDef } from 'zod';
import type { Role } from '@shared/types';
import { ApiError } from '../api';
import { type Caller, currentCaller, fail } from './core';

interface Options {
  roles?: Role[];
  /** Allow calls without a signed-in user. */
  public?: boolean;
}

export interface Handler {
  run(input: unknown): Promise<unknown>;
}

/** Mirrors functions/src/lib/callable.ts: auth, role check, Zod validation, friendly errors. */
export function handler<I, O>(
  schema: ZodType<I, ZodTypeDef, unknown>,
  fn: (input: I, caller: Caller) => Promise<O>,
  options: Options = {},
): Handler {
  return {
    async run(input) {
      const caller = await currentCaller();
      if (!caller && !options.public)
        fail('permission-denied', 'unauthenticated', 'Entre na sua conta para continuar.');
      if (options.roles && !options.roles.some((r) => caller?.roles.includes(r))) {
        fail('permission-denied', 'forbidden', 'Você não tem permissão para fazer isso.');
      }
      const parsed = schema.safeParse(input ?? {});
      if (!parsed.success)
        fail('invalid-argument', 'invalid', parsed.error.issues[0]?.message ?? 'Dados inválidos.');
      try {
        return await fn(
          parsed.data,
          caller ?? { uid: '', email: undefined, emailVerified: false, roles: [], name: undefined },
        );
      } catch (e) {
        if (e instanceof ApiError) throw e;
        const code = (e as { code?: string }).code ?? '';
        console.error('spark handler failed', e);
        if (code === 'permission-denied')
          throw new ApiError('Você não tem permissão para fazer isso.', 'forbidden', 'permission-denied');
        if (code === 'unavailable')
          throw new ApiError(
            'Sem conexão com o servidor. Verifique sua internet e tente de novo.',
            'unavailable',
            'unavailable',
          );
        if (code === 'auth/requires-recent-login') {
          throw new ApiError(
            'Por segurança, saia e entre de novo na sua conta antes de repetir esta ação.',
            'recent-login',
            'failed-precondition',
          );
        }
        throw new ApiError(
          'Algo deu errado do nosso lado. Tente de novo em instantes.',
          'internal',
          'internal',
        );
      }
    },
  };
}
