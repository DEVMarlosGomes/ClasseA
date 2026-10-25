import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { PaymentMode } from '@shared/types';

export const STEPS = ['Serviço', 'Barbeiro', 'Dia', 'Horário', 'Identificação', 'Pagamento', 'Revisão'] as const;
export type StepIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7; // 7 = success

export interface BookingResult {
  id: string;
  barberId: string;
  barberName: string;
  date: string;
  start: string;
  end: string;
}

interface BookingState {
  step: StepIndex;
  direction: 1 | -1;
  serviceIds: string[];
  barberId: string | null; // 'any' = Sem preferência
  date: string | null;
  start: string | null;
  paymentMode: PaymentMode | null;
  paymentMethodId: string | null;
  pixChargeId: string | null;
  notes: string;
  /** When set, the flow reschedules this appointment instead of creating a new one. */
  rescheduleId: string | null;
  result: BookingResult | null;
  slotTakenNotice: boolean;

  goTo: (step: StepIndex) => void;
  toggleService: (id: string) => void;
  setBarber: (id: string) => void;
  setDate: (date: string) => void;
  setStart: (start: string | null) => void;
  setPayment: (mode: PaymentMode, methodId?: string | null) => void;
  setPix: (id: string | null) => void;
  setNotes: (notes: string) => void;
  hydrate: (patch: Partial<Pick<BookingState, 'serviceIds' | 'barberId' | 'date' | 'step' | 'rescheduleId'>>) => void;
  slotTaken: () => void;
  dismissSlotNotice: () => void;
  finish: (result: BookingResult) => void;
  reset: () => void;
}

const initial = {
  step: 0 as StepIndex,
  direction: 1 as 1 | -1,
  serviceIds: [] as string[],
  barberId: null,
  date: null,
  start: null,
  paymentMode: null,
  paymentMethodId: null,
  pixChargeId: null,
  notes: '',
  rescheduleId: null,
  result: null,
  slotTakenNotice: false,
};

/** Booking flow state, persisted in sessionStorage (`ca_booking`) so reloads and sign-in keep everything. */
export const useBooking = create<BookingState>()(
  persist(
    (set) => ({
      ...initial,
      goTo: (step) => set((s) => ({ step, direction: step >= s.step ? 1 : -1 })),
      toggleService: (id) =>
        set((s) => ({
          serviceIds: s.serviceIds.includes(id) ? s.serviceIds.filter((x) => x !== id) : [...s.serviceIds, id],
          // A different duration may invalidate the chosen time and barber.
          start: null,
          pixChargeId: null,
        })),
      setBarber: (barberId) => set({ barberId, start: null }),
      setDate: (date) => set({ date, start: null }),
      setStart: (start) => set({ start }),
      setPayment: (paymentMode, paymentMethodId = null) => set({ paymentMode, paymentMethodId }),
      setPix: (pixChargeId) => set({ pixChargeId }),
      setNotes: (notes) => set({ notes: notes.slice(0, 200) }),
      hydrate: (patch) => set((s) => ({ ...s, ...patch, direction: 1 })),
      slotTaken: () => set({ step: 3, direction: -1, start: null, slotTakenNotice: true }),
      dismissSlotNotice: () => set({ slotTakenNotice: false }),
      finish: (result) => set({ result, step: 7, direction: 1 }),
      reset: () => set({ ...initial }),
    }),
    {
      name: 'ca_booking',
      storage: createJSONStorage(() => {
        try {
          return sessionStorage;
        } catch {
          return { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };
        }
      }),
      partialize: ({ step, serviceIds, barberId, date, start, paymentMode, paymentMethodId, pixChargeId, notes, rescheduleId, result }) => ({
        step,
        serviceIds,
        barberId,
        date,
        start,
        paymentMode,
        paymentMethodId,
        pixChargeId,
        notes,
        rescheduleId,
        result,
      }),
    },
  ),
);
