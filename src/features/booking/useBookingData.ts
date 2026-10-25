import { useMemo } from 'react';
import type { Barber, Service } from '@shared/types';
import { useBarbers, useServices, useShopSettings } from '@/lib/catalog';
import { useAuth } from '@/features/auth/AuthProvider';
import { useMySubscription } from '@/features/plans/hooks';
import { useBooking } from './store';

export function eligibleBarbers(barbers: Barber[] | undefined, serviceIds: string[]): Barber[] {
  return (barbers ?? []).filter((b) => serviceIds.every((id) => b.serviceIds.includes(id)));
}

/** Everything the booking steps derive from catalogue + selection. */
export function useBookingData() {
  const services = useServices();
  const barbers = useBarbers();
  const settings = useShopSettings();
  const { user } = useAuth();
  const plan = useMySubscription(user?.uid);
  const serviceIds = useBooking((s) => s.serviceIds);
  const barberId = useBooking((s) => s.barberId);

  return useMemo(() => {
    const byId = new Map((services.data ?? []).map((s) => [s.id, s]));
    const selected = serviceIds.map((id) => byId.get(id)).filter((s): s is Service => !!s);
    const durationMin = selected.reduce((sum, s) => sum + s.durationMin, 0);
    const totalCents = selected.reduce((sum, s) => sum + s.priceCents, 0);
    const eligible = eligibleBarbers(barbers.data, serviceIds);
    const barber = barberId && barberId !== 'any' ? (barbers.data?.find((b) => b.id === barberId) ?? null) : null;
    const planActive = plan.sub?.status === 'active' && (plan.usage?.remaining == null || plan.usage.remaining > 0);
    const coveredCents = planActive ? selected.filter((s) => s.includedInPlans).reduce((sum, s) => sum + s.priceCents, 0) : 0;
    return {
      services,
      barbers,
      settings: settings.data,
      selected,
      durationMin,
      totalCents,
      eligible,
      barber,
      plan,
      planActive,
      planCoversSome: planActive && selected.some((s) => s.includedInPlans),
      dueWithPlanCents: totalCents - coveredCents,
    };
  }, [services, barbers, settings.data, serviceIds, barberId, plan]);
}
