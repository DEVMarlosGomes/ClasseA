import { ApiError } from '../api';
import * as account from './account';
import * as booking from './booking';
import * as payments from './payments';
import type { Handler } from './registry';
import * as staff from './staff';

const handlers: Record<string, Handler> = { ...account, ...booking, ...payments, ...staff.callables };

/** Runs a callable in the browser (Spark plan). Same contract as httpsCallable. */
export async function callSpark<O>(name: string, input: unknown): Promise<O> {
  const h = handlers[name];
  if (!h)
    throw new ApiError('Esta ação não está disponível no ambiente de testes.', 'not-implemented', 'internal');
  return (await h.run(input)) as O;
}

export { recomputeAvailability, recomputeBarberFuture } from './core';
