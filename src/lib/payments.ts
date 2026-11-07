import { SPARK } from './firebase';

const env = import.meta.env;

/**
 * Real online payments (InfinitePay checkout) are on only with the Functions backend and
 * VITE_ONLINE_PAYMENTS=infinitepay. In the Spark test mode the browser could fake a confirmation,
 * so the simulated card/PIX stay there instead.
 */
export const ONLINE_PAYMENTS = !SPARK && env.VITE_ONLINE_PAYMENTS === 'infinitepay';

/** Mercado Pago public key (safe in the browser). Recurring plans use its Card Payment Brick. */
export const MP_PUBLIC_KEY: string = env.VITE_MP_PUBLIC_KEY ?? '';

/** Recurring plans charged by Mercado Pago (needs PAYMENTS_PROVIDER=mercadopago in the Functions). */
export const RECURRING_MP =
  !SPARK && env.VITE_RECURRING_PAYMENTS === 'mercadopago' && MP_PUBLIC_KEY.length > 0;

/** Any real gateway on: hide the demo notice and the simulated test cards. */
export const REAL_PAYMENTS = ONLINE_PAYMENTS || RECURRING_MP;
