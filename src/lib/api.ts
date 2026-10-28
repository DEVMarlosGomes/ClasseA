import { SPARK, loadFunctions } from './firebase';

/** Error raised by our callables, with a friendly pt-BR message and a machine-readable reason. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly reason: string,
    readonly code: string,
  ) {
    super(message);
  }
}

const FALLBACK: Record<string, string> = {
  unauthenticated: 'Entre na sua conta para continuar.',
  'permission-denied': 'Você não tem permissão para fazer isso.',
  unavailable: 'Sem conexão com o servidor. Verifique sua internet e tente de novo.',
  'deadline-exceeded': 'O servidor demorou para responder. Tente de novo.',
  internal: 'Algo deu errado do nosso lado. Tente de novo em instantes.',
};

export async function call<I, O>(name: string, input: I): Promise<O> {
  if (SPARK) {
    const { callSpark } = await import('./spark');
    return callSpark<O>(name, JSON.parse(JSON.stringify(input ?? {})));
  }
  const { fns, httpsCallable } = await loadFunctions();
  try {
    // The callable encoder turns undefined into null; drop empty keys so optional fields stay optional.
    const clean = JSON.parse(JSON.stringify(input ?? {})) as I;
    const res = await httpsCallable<I, O>(fns, name)(clean);
    return res.data;
  } catch (e) {
    const err = e as { code?: string; message?: string; details?: { reason?: string; message?: string } };
    const code = (err.code ?? 'internal').replace(/^functions\//, '');
    const reason = err.details?.reason ?? code;
    const message =
      err.details?.message ??
      (code === 'failed-precondition' || code === 'invalid-argument' ? err.message : undefined);
    throw new ApiError(message || FALLBACK[code] || FALLBACK.internal!, reason, code);
  }
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return FALLBACK.internal!;
}
