import { SPARK } from './firebase';

/**
 * Real online payments (InfinitePay checkout) are on only with the Functions backend and
 * VITE_ONLINE_PAYMENTS=infinitepay. In the Spark test mode the browser could fake a confirmation,
 * so the simulated card/PIX stay there instead.
 */
export const ONLINE_PAYMENTS = !SPARK && import.meta.env.VITE_ONLINE_PAYMENTS === 'infinitepay';
