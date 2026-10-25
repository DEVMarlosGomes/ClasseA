import { motion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { Appointment } from '@shared/types';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { usePlans, useShopSettings } from '@/lib/catalog';
import { formatInstant } from '@/lib/dates';
import { EASE } from '@/lib/motion';
import { formatBRL } from '@shared/money';
import { useAuth } from '@/features/auth/AuthProvider';
import { useMySubscription } from '@/features/plans/hooks';
import { AppointmentActions, AppointmentSummary, splitAppointments, useMyAppointments, useRepeat } from './appointments';

function useCountdown(target: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.max(0, target - now);
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (d > 0) return `em ${d} ${d === 1 ? 'dia' : 'dias'} e ${h} h`;
  if (h > 0) return `em ${h} h e ${m} min`;
  return m > 0 ? `em ${m} min` : 'agora';
}

function NextAppointment({ appt }: { appt: Appointment }) {
  const { data: settings } = useShopSettings();
  const countdown = useCountdown(appt.startAt.toMillis());
  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-label text-[14px] text-gold-500">Próximo atendimento</h2>
        <span className="tabular text-[13px] text-text-400">{countdown}</span>
      </div>
      <AppointmentSummary appt={appt} />
      <AppointmentActions appt={appt} settings={settings} />
    </Card>
  );
}

function PlanCardSummary() {
  const { user } = useAuth();
  const { sub, usage, loading } = useMySubscription(user?.uid);
  const plans = usePlans();
  if (loading) return <Skeleton className="h-40 rounded-[20px]" />;
  if (!sub) {
    const annual = plans.data?.find((p) => p.highlight) ?? plans.data?.[0];
    if (!annual) return null;
    return (
      <Card tone="gold" className="p-5 sm:p-6">
        <h2 className="font-label text-[14px] text-gold-500">Plano {annual.name}</h2>
        <p className="mt-2 text-[18px] text-text-100">
          Corte em dia por <strong className="tabular text-gold-400">{formatBRL(annual.monthlyEquivalentCents)}</strong> por mês.
        </p>
        <p className="mt-1 text-[14px] text-text-400">{annual.benefits.slice(0, 2).join(' · ')}</p>
        <ButtonLink to={`/cliente/planos?plano=${annual.id}`} size="sm" className="mt-5">
          Conhecer o plano
        </ButtonLink>
      </Card>
    );
  }
  const pct = usage?.total ? Math.min(100, (usage.used / usage.total) * 100) : 0;
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-label text-[14px] text-gold-500">Plano {sub.planName}</h2>
        {sub.status === 'past_due' ? <Badge tone="danger">Pagamento pendente</Badge> : <Badge tone="success">Ativo</Badge>}
      </div>
      <p className="tabular mt-3 text-[16px] text-text-100">
        {usage?.total != null ? `${usage.used} de ${usage.total} cortes usados neste mês` : 'Cortes ilimitados neste mês'}
      </p>
      {usage?.total != null && (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-700" role="progressbar" aria-valuenow={usage.used} aria-valuemin={0} aria-valuemax={usage.total} aria-label="Uso do plano no ciclo">
          <motion.div className="gold-metal h-full origin-left rounded-full" initial={{ scaleX: 0 }} animate={{ scaleX: pct / 100 }} transition={{ duration: 0.8, ease: EASE }} />
        </div>
      )}
      <p className="mt-3 text-[14px] text-text-400">
        {sub.autoRenew ? 'Renova em ' : 'Vale até '}
        {formatInstant(sub.currentPeriodEnd.toDate(), "dd/MM/yyyy")}
      </p>
      <Link to="/cliente/planos" className="font-label mt-4 inline-flex min-h-11 items-center text-[14px] text-gold-400 underline">
        Gerenciar plano
      </Link>
    </Card>
  );
}

export default function ClientHomePage() {
  useDocumentMeta({ title: 'Início', noindex: true });
  const { user, profile } = useAuth();
  const appts = useMyAppointments(user?.uid);
  const repeat = useRepeat();
  const { upcoming, history } = splitAppointments(appts.data);
  const last = history.find((a) => a.status === 'completed');
  const first = (profile?.name ?? user?.displayName ?? '').split(' ')[0];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[14px] text-text-400">Bem-vindo de volta</p>
        <h1 className="font-label text-[36px] leading-tight text-text-100">{first ? `Olá, ${first}` : 'Olá'}</h1>
      </div>

      {appts.error ? (
        <ErrorState />
      ) : appts.loading ? (
        <Skeleton className="h-56 rounded-[20px]" />
      ) : upcoming[0] ? (
        <NextAppointment appt={upcoming[0]} />
      ) : (
        <Card className="p-2">
          <EmptyState
            title="Nenhum horário marcado"
            description="Escolha o serviço, o barbeiro e o horário em menos de um minuto."
            action={<ButtonLink to="/agendar">Agendar horário</ButtonLink>}
          />
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <PlanCardSummary />
        {last && (
          <Card tone="panel" className="flex flex-col p-5 sm:p-6">
            <h2 className="font-label text-[14px] text-gold-500">Repetir último atendimento</h2>
            <p className="mt-3 text-[16px] text-text-100">{last.services.map((s) => s.name).join(' + ')}</p>
            <p className="text-[14px] text-text-400">com {last.barberName}</p>
            <button
              onClick={() => repeat(last)}
              className="font-label mt-auto inline-flex min-h-11 items-center gap-2 self-start pt-4 text-[14px] text-gold-400"
            >
              <RotateCcw className="size-4" strokeWidth={1.75} />
              Escolher dia
            </button>
          </Card>
        )}
      </div>
    </div>
  );
}
