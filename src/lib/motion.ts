import type { Transition, Variants } from 'framer-motion';

export const EASE = [0.22, 1, 0.36, 1] as const;

export const DUR = { micro: 0.15, ui: 0.25, section: 0.45, hero: 0.8 } as const;

export const ui: Transition = { duration: DUR.ui, ease: EASE };
export const section: Transition = { duration: DUR.section, ease: EASE };

export const rise: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: section },
};

export const riseReduced: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: DUR.ui } },
};

export const stagger = (reduced: boolean | null): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: reduced ? 0 : 0.06 } },
});

/** Horizontal slide for wizard steps; `direction` is +1 forward, -1 back. */
export const slide: Variants = {
  enter: (direction: number) => ({ x: direction * 48, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { duration: DUR.ui, ease: EASE } },
  exit: (direction: number) => ({ x: direction * -48, opacity: 0, transition: { duration: DUR.micro, ease: EASE } }),
};

export const fade: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1, transition: { duration: DUR.ui } },
  exit: { opacity: 0, transition: { duration: DUR.micro } },
};

export function haptic(ms = 10): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator && matchMedia('(pointer: coarse)').matches) {
    try {
      navigator.vibrate(ms);
    } catch {
      // Some browsers throw when vibration is blocked by permissions policy.
    }
  }
}
