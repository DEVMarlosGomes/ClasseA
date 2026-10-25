import { type CallableRequest, HttpsError, onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import type { ZodType, ZodTypeDef } from 'zod';
import type { Role } from '../../../shared/types';
import { IS_EMULATOR, REGION } from './admin';

export interface Caller {
  uid: string;
  email: string | undefined;
  emailVerified: boolean;
  roles: Role[];
  name: string | undefined;
}

interface Options {
  roles?: Role[];
  /** Allow calls without a signed-in user. */
  public?: boolean;
}

/** Friendly, typed failure. `reason` lets the UI react (e.g. slot-taken sends the user back to step 4). */
export function fail(
  code: 'failed-precondition' | 'invalid-argument' | 'permission-denied' | 'not-found' | 'already-exists' | 'resource-exhausted',
  reason: string,
  message: string,
): never {
  throw new HttpsError(code, message, { reason, message });
}

/**
 * Callable with App Check (production), Zod validation and role checks.
 * Validation messages are already in pt-BR because the schemas are shared with the front-end.
 */
export function callable<I, O>(
  schema: ZodType<I, ZodTypeDef, unknown>,
  handler: (input: I, caller: Caller, req: CallableRequest) => Promise<O>,
  options: Options = {},
) {
  return onCall(
    { region: REGION, enforceAppCheck: !IS_EMULATOR, cors: true, memory: '256MiB', timeoutSeconds: 30 },
    async (req) => {
      if (!req.auth && !options.public) fail('permission-denied', 'unauthenticated', 'Entre na sua conta para continuar.');
      const roles = (Array.isArray(req.auth?.token.roles) ? req.auth?.token.roles : []) as Role[];
      if (options.roles && !options.roles.some((r) => roles.includes(r))) {
        fail('permission-denied', 'forbidden', 'Você não tem permissão para fazer isso.');
      }
      const parsed = schema.safeParse(req.data ?? {});
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        fail('invalid-argument', 'invalid', first?.message ?? 'Dados inválidos.');
      }
      const caller: Caller = {
        uid: req.auth?.uid ?? '',
        email: req.auth?.token.email,
        emailVerified: req.auth?.token.email_verified === true,
        roles,
        name: req.auth?.token.name as string | undefined,
      };
      try {
        return await handler(parsed.data, caller, req);
      } catch (e) {
        if (e instanceof HttpsError) throw e;
        logger.error('callable failed', { error: e instanceof Error ? e.message : String(e) });
        throw new HttpsError('internal', 'Algo deu errado do nosso lado. Tente de novo em instantes.', {
          reason: 'internal',
        });
      }
    },
  );
}
