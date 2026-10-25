import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { Orbs } from '@/components/ui/Orbs';
import { Stepper } from '@/components/ui/Stepper';
import { toast } from '@/components/ui/Toast';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { ApiError, call, errorMessage } from '@/lib/api';
import { fade, slide } from '@/lib/motion';
import { useAuth } from '@/features/auth/AuthProvider';
import { BookingSummary } from './BookingSummary';
import { type BookingResult, STEPS, type StepIndex, useBooking } from './store';
import { BarberStep } from './steps/BarberStep';
import { DayStep } from './steps/DayStep';
import { IdentifyStep } from './steps/IdentifyStep';
import { PaymentStep } from './steps/PaymentStep';
import { ReviewStep } from './steps/ReviewStep';
import { ServiceStep } from './steps/ServiceStep';
import { SuccessStep } from './steps/SuccessStep';
import { TimeStep } from './steps/TimeStep';

const TITLES = [
  'Escolha o serviço',
  'Escolha o barbeiro',
  'Escolha o dia',
  'Escolha o horário',
  'Identificação',
  'Forma de pagamento',
  'Revise e confirme',
];

/** Applies ?servico=&barbeiro=&data= deep links once, skipping steps they already answer. */
function useDeepLinks() {
  const [params, setParams] = useSearchParams();
  const hydrate = useBooking((s) => s.hydrate);
  const reset = useBooking((s) => s.reset);
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const servico = params.get('servico');
    const barbeiro = params.get('barbeiro');
    const data = params.get('data');
    const reagendar = params.get('reagendar');
    const state = useBooking.getState();
    if (state.step === 7 || servico || barbeiro || data || reagendar) reset();
    if (!servico && !barbeiro && !data && !reagendar) return;
    const serviceIds = servico ? servico.split(',') : [];
    const date = data && /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : null;
    const step: StepIndex = !serviceIds.length ? 0 : !barbeiro ? 1 : !date ? 2 : 3;
    hydrate({ serviceIds, barberId: barbeiro, date, step, rescheduleId: reagendar });
    setParams({}, { replace: true });
  }, [params, hydrate, reset, setParams]);
}

export default function BookingPage() {
  useDocumentMeta({ title: 'Agendar horário', description: 'Escolha serviço, barbeiro, dia e horário. Confirmação na hora.' });
  useDeepLinks();
  const reduced = useReducedMotion();
  const navigate = useNavigate();
  const { user, roles, ensure, refresh, sendVerification } = useAuth();
  const b = useBooking();
  const [submitting, setSubmitting] = useState(false);
  const signedIn = !!user && roles.length > 0;
  const rescheduling = !!b.rescheduleId;

  useEffect(() => ensure(), [ensure]);

  const next = useCallback(() => {
    const s = useBooking.getState();
    let to = (s.step + 1) as StepIndex;
    if (to === 4 && signedIn) to = 5;
    if (to === 5 && s.rescheduleId) to = 6;
    s.goTo(to);
  }, [signedIn]);

  const back = () => {
    let to = (b.step - 1) as StepIndex;
    if (to === 5 && rescheduling) to = 3;
    if (to === 4 && signedIn) to = 3;
    if (to < 0) return navigate(-1);
    b.goTo(to);
  };

  const autoAdvance = () => setTimeout(next, reduced ? 0 : 220);

  const canAdvance = (() => {
    switch (b.step) {
      case 0:
        return b.serviceIds.length > 0;
      case 1:
        return !!b.barberId;
      case 2:
        return !!b.date;
      case 3:
        return !!b.start;
      case 4:
        return signedIn;
      case 5:
        if (b.paymentMode === 'card_mock') return !!b.paymentMethodId;
        if (b.paymentMode === 'pix_mock') return !!b.pixChargeId;
        return !!b.paymentMode;
      default:
        return true;
    }
  })();

  const confirm = async () => {
    if (!b.barberId || !b.date || !b.start) return;
    setSubmitting(true);
    try {
      if (b.rescheduleId) {
        await call<unknown, { id: string }>('rescheduleAppointment', {
          id: b.rescheduleId,
          newSlot: { barberId: b.barberId, date: b.date, start: b.start },
        });
        toast.success('Horário remarcado.');
        b.reset();
        navigate('/cliente/agendamentos');
        return;
      }
      const result = await call<unknown, BookingResult>('createAppointment', {
        barberId: b.barberId,
        date: b.date,
        start: b.start,
        serviceIds: b.serviceIds,
        paymentMode: b.paymentMode,
        paymentMethodId: b.paymentMode === 'card_mock' ? b.paymentMethodId : undefined,
        pixChargeId: b.paymentMode === 'pix_mock' ? b.pixChargeId : undefined,
        notes: b.notes || undefined,
      });
      b.finish(result);
    } catch (e) {
      if (e instanceof ApiError && e.reason === 'slot-taken') b.slotTaken();
      else if (e instanceof ApiError && e.reason === 'email-unverified') {
        // After clicking the e-mail link the token must be refreshed before trying again.
        void refresh();
        toast.error(e.message, {
          duration: 10000,
          action: { label: 'Reenviar e-mail', onClick: () => void sendVerification().then(() => toast.info('E-mail de confirmação reenviado.')) },
        });
      } else toast.error(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const action =
    b.step === 7 ? null : b.step === 6 ? (
      <Button block size="lg" loading={submitting} onClick={confirm}>
        {rescheduling ? 'Confirmar remarcação' : 'Confirmar agendamento'}
      </Button>
    ) : b.step === 4 ? null : (
      <Button block size="lg" disabled={!canAdvance} onClick={next}>
        Continuar
      </Button>
    );

  const variants = reduced ? fade : slide;

  return (
    <div className="min-h-svh pb-48 lg:pb-16">
      <Orbs intensity={0.5} />
      <header className="sticky top-0 z-30 border-b border-white/5 bg-ink-950/80 backdrop-blur-xl" style={{ paddingTop: 'var(--safe-top)' }}>
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" aria-label="Voltar ao site">
            <Logo className="w-24" />
          </Link>
          <Link
            to="/"
            className="grid size-11 place-items-center rounded-full text-text-400 hover:bg-white/5 hover:text-text-100"
            aria-label="Sair do agendamento"
          >
            <X className="size-5" strokeWidth={1.75} />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-4 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10 lg:pt-8">
        <div className="min-w-0">
          {b.step < 7 && (
            <Stepper
              steps={TITLES.map((t, i) => (rescheduling && i === 0 ? 'Remarcar' : t))}
              current={b.step}
              onBack={b.step > 0 ? back : undefined}
            />
          )}
          <h1 className="sr-only">{rescheduling ? 'Remarcar atendimento' : 'Agendar horário'}</h1>
          <div className="relative mt-6 overflow-x-clip">
            <AnimatePresence mode="wait" custom={b.direction} initial={false}>
              <motion.section
                key={b.step}
                custom={b.direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                aria-label={b.step < 7 ? STEPS[b.step as 0] : 'Confirmado'}
              >
                {b.step === 0 && <ServiceStep />}
                {b.step === 1 && <BarberStep onPicked={autoAdvance} />}
                {b.step === 2 && <DayStep onPicked={autoAdvance} />}
                {b.step === 3 && <TimeStep onPicked={() => undefined} />}
                {b.step === 4 && <IdentifyStep onDone={next} />}
                {b.step === 5 && <PaymentStep />}
                {b.step === 6 && <ReviewStep />}
                {b.step === 7 && <SuccessStep />}
              </motion.section>
            </AnimatePresence>
          </div>
        </div>
        {b.step < 7 && (
          <div className="hidden lg:block">
            <BookingSummary variant="panel" action={action} />
          </div>
        )}
      </main>
      {b.step < 7 && action && <BookingSummary variant="bar" action={action} />}
    </div>
  );
}
