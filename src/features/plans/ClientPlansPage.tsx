import { motion } from 'framer-motion';
import { CreditCard, QrCode } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { BRAND_LABEL } from '@shared/cards';
import { PERIOD_MONTHS } from '@shared/defaults';
import { formatBRL } from '@shared/money';
import type { CardBrand, Payment, Plan } from '@shared/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/EmptyState';
import { Sheet } from '@/components/ui/Sheet';
import { Skeleton } from '@/components/ui/Skeleton';
import { SuccessCheck } from '@/components/ui/SuccessCheck';
import { Switch } from '@/components/ui/Switch';
import { toast } from '@/components/ui/Toast';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useLiveQuery } from '@/hooks/useFirestore';
import { call, errorMessage } from '@/lib/api';
import { usePlans } from '@/lib/catalog';
import { cn } from '@/lib/cn';
import { formatInstant } from '@/lib/dates';
import { EASE } from '@/lib/motion';
import { useAuth } from '@/features/auth/AuthProvider';
import { CardForm } from '@/features/payments/CardForm';
import { DemoNotice } from '@/features/payments/DemoNotice';
import { PixPanel } from '@/features/payments/PixPanel';
import { PlanCard, PERIOD_LABEL, planSavings } from './PlanCard';
import { useMyPaymentMethods, useMySubscription } from './hooks';

type Step = 'method' | 'review' | 'done';

function SubscribeSheet({ plan, monthly, onClose }: { plan: Plan | null; monthly?: Plan; onClose: () => void }) {
  const { user } = useAuth();
  const cards = useMyPaymentMethods(user?.uid);
  const [step, setStep] = useState<Step>('method');
  const [method, setMethod] = useState<'card_mock' | 'pix_mock'>('card_mock');
  const [cardId, setCardId] = useState<string | null>(null);
  const [pixId, setPixId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [declined, setDeclined] = useState<string | null>(null);

  useEffect(() => {
    if (plan) {
      setStep('method');
      setPixId(null);
      setDeclined(null);
    }
  }, [plan]);
  useEffect(() => {
    if (!cardId && cards.data?.length) setCardId((cards.data.find((c) => c.isDefault) ?? cards.data[0])!.id);
  }, [cards.data, cardId]);

  if (!plan) return null;
  const months = PERIOD_MONTHS[plan.period];
  const savings = planSavings(plan, monthly);
  const canReview = method === 'card_mock' ? !!cardId : !!pixId;

  const confirm = async () => {
    setBusy(true);
    setDeclined(null);
    try {
      await call('subscribePlan', {
        planId: plan.id,
        method,
        paymentMethodId: method === 'card_mock' ? cardId : undefined,
        pixChargeId: method === 'pix_mock' ? pixId : undefined,
      });
      setStep('done');
    } catch (e) {
      setDeclined(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={!!plan}
      onOpenChange={(o) => !o && onClose()}
      title={step === 'done' ? 'Plano ativo' : `Assinar plano ${plan.name}`}
      description={step === 'method' ? 'Escolha como pagar.' : step === 'review' ? 'Confira antes de confirmar.' : undefined}
      footer={
        step === 'method' ? (
          <Button block size="lg" disabled={!canReview} onClick={() => setStep('review')}>
            Revisar assinatura
          </Button>
        ) : step === 'review' ? (
          <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
            <Button variant="ghost" onClick={() => setStep('method')}>
              Voltar
            </Button>
            <Button block size="lg" loading={busy} onClick={confirm}>
              Confirmar assinatura
            </Button>
          </div>
        ) : (
          <Button block size="lg" onClick={onClose}>
            Ver meu plano
          </Button>
        )
      }
    >
      {step === 'method' && (
        <div className="space-y-4">
          <DemoNotice />
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Forma de pagamento">
            {(
              [
                ['card_mock', 'Cartão', CreditCard],
                ['pix_mock', 'PIX', QrCode],
              ] as const
            ).map(([m, label, Icon]) => (
              <button
                key={m}
                role="radio"
                aria-checked={method === m}
                onClick={() => setMethod(m)}
                className={cn(
                  'flex min-h-14 items-center justify-center gap-2 rounded-[14px] border text-[15px] font-bold',
                  method === m ? 'border-gold-500 bg-gold-500/10 text-gold-400' : 'border-ink-600 text-text-100 hover:border-gold-700',
                )}
              >
                <Icon className="size-5" strokeWidth={1.5} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
          {method === 'card_mock' ? (
            adding || (cards.data && cards.data.length === 0) ? (
              <CardForm
                submitLabel="Salvar cartão"
                onSaved={(c) => {
                  setCardId(c.id);
                  setAdding(false);
                }}
              />
            ) : (
              <ul className="space-y-2" role="radiogroup" aria-label="Cartões salvos">
                {cards.loading && <Skeleton className="h-14 rounded-[14px]" />}
                {cards.data?.map((c) => (
                  <li key={c.id}>
                    <button
                      role="radio"
                      aria-checked={cardId === c.id}
                      onClick={() => setCardId(c.id)}
                      className={cn(
                        'tabular flex min-h-14 w-full items-center justify-between rounded-[14px] border px-4',
                        cardId === c.id ? 'border-gold-500 text-text-100' : 'border-ink-600 text-text-400',
                      )}
                    >
                      {BRAND_LABEL[c.brand as CardBrand]} final {c.last4}
                      {c.isDefault && <Badge tone="gold">Padrão</Badge>}
                    </button>
                  </li>
                ))}
                <li>
                  <button onClick={() => setAdding(true)} className="font-label min-h-11 text-[14px] text-gold-400 underline">
                    Usar outro cartão
                  </button>
                </li>
              </ul>
            )
          ) : pixId ? (
            <p className="rounded-[14px] border border-success/40 bg-success/10 p-4 text-[14px] text-text-100">PIX aprovado. Revise e confirme.</p>
          ) : (
            <PixPanel request={{ purpose: 'subscription', planId: plan.id }} onPaid={setPixId} />
          )}
        </div>
      )}

      {step === 'review' && (
        <div className="space-y-4">
          <DemoNotice />
          <dl className="panel divide-y divide-white/5 px-5 text-[15px]">
            {[
              ['Plano', `${plan.name} · ${plan.cutsPerMonth == null ? 'cortes ilimitados' : `${plan.cutsPerMonth} cortes por mês`}`],
              ['Valor total', `${formatBRL(plan.priceCents)} ${PERIOD_LABEL[plan.period]}`],
              ['Equivale a', `${formatBRL(plan.monthlyEquivalentCents)} por mês${savings ? ` · ${savings}% de economia` : ''}`],
              ['Cobrança', `Hoje, ${method === 'card_mock' ? 'no cartão' : 'via PIX (já aprovado)'}`],
              [
                'Renovação',
                method === 'card_mock'
                  ? `Automática a cada ${months === 1 ? 'mês' : `${months} meses`}, com aviso 3 dias antes`
                  : 'Manual (PIX não renova sozinho)',
              ],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-3">
                <dt className="text-text-400">{k}</dt>
                <dd className="tabular text-right text-text-100">{v}</dd>
              </div>
            ))}
          </dl>
          <ul className="list-disc space-y-1.5 pl-5 text-[14px] leading-relaxed text-text-400 marker:text-gold-600">
            <li>Os cortes renovam todo mês e não acumulam. O plano cobre só os serviços inclusos.</li>
            <li>Cancelar um agendamento no prazo devolve o corte; faltar consome o corte.</li>
            <li>Você pode desligar a renovação quando quiser e mantém o acesso até o fim do período.</li>
            <li>Direito de arrependimento: desista em até 7 dias e receba o valor de volta.</li>
          </ul>
          {declined && (
            <p role="alert" className="rounded-[14px] border border-danger/40 bg-danger/10 p-4 text-[14px] text-[#f4a49d]">
              {declined}
            </p>
          )}
        </div>
      )}

      {step === 'done' && (
        <div className="flex flex-col items-center py-6 text-center">
          <SuccessCheck />
          <p className="font-label mt-6 text-[22px] text-text-100">Bem-vindo ao plano {plan.name}</p>
          <p className="mt-2 max-w-[34ch] text-[15px] text-text-400">Seus cortes já estão disponíveis. Agende escolhendo "Usar meu plano".</p>
        </div>
      )}
    </Sheet>
  );
}

function ManagePlan() {
  const { user } = useAuth();
  const { sub, usage } = useMySubscription(user?.uid);
  const plans = usePlans();
  const [busy, setBusy] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const payments = useLiveQuery<Payment>(user && sub ? `subpay:${sub.id}` : null, ({ db, collection, query, where, orderBy, limit }) =>
    query(collection(db, 'payments'), where('clientId', '==', user!.uid), where('subscriptionId', '==', sub!.id), orderBy('createdAt', 'desc'), limit(12)),
  );
  if (!sub) return null;
  const pct = usage?.total ? Math.min(100, (usage.used / usage.total) * 100) : 0;
  const withinWithdrawal = Date.now() - sub.startedAt.toMillis() <= 7 * 86_400_000;
  const pending = plans.data?.find((p) => p.id === sub.pendingPlanId);

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try {
      await fn();
      toast.success(ok);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-label text-[14px] text-gold-500">Seu plano</p>
          <h2 className="font-label text-[32px] leading-tight text-text-100">{sub.planName}</h2>
        </div>
        {sub.status === 'past_due' ? <Badge tone="danger">Pagamento pendente</Badge> : sub.autoRenew ? <Badge tone="success">Renovação automática</Badge> : <Badge tone="neutral">Sem renovação</Badge>}
      </div>
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div>
          <p className="tabular text-[16px] text-text-100">
            {usage?.total != null ? `${usage.used} de ${usage.total} cortes usados neste mês` : 'Cortes ilimitados'}
          </p>
          {usage?.total != null && (
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-700">
              <motion.div className="gold-metal h-full origin-left" initial={{ scaleX: 0 }} animate={{ scaleX: pct / 100 }} transition={{ duration: 0.8, ease: EASE }} />
            </div>
          )}
          <p className="tabular mt-3 text-[14px] text-text-400">
            Ciclo atual: {formatInstant(sub.currentPeriodStart.toDate(), 'dd/MM/yyyy')} a {formatInstant(sub.currentPeriodEnd.toDate(), 'dd/MM/yyyy')}
          </p>
          {pending && <p className="mt-2 text-[14px] text-gold-400">Muda para {pending.name} na próxima renovação.</p>}
        </div>
        <div className="space-y-2">
          <Switch
            label="Renovação automática"
            description={sub.autoRenew ? 'Renova no cartão cadastrado no fim do período.' : `Seu acesso vai até ${formatInstant(sub.currentPeriodEnd.toDate(), 'dd/MM/yyyy')}.`}
            checked={sub.autoRenew}
            disabled={busy === 'renew'}
            onCheckedChange={(v) =>
              void run('renew', () => call('setAutoRenew', { subscriptionId: sub.id, autoRenew: v }), v ? 'Renovação ligada.' : 'Renovação desligada. Você mantém o acesso até o fim do período.')
            }
          />
          <div className="flex flex-wrap gap-2 pt-2">
            {plans.data
              ?.filter((p) => p.id !== sub.planId)
              .map((p) => (
                <Button
                  key={p.id}
                  size="sm"
                  variant="secondary"
                  loading={busy === p.id}
                  onClick={() => void run(p.id, () => call('changePlan', { planId: p.id }), `Troca para ${p.name} agendada para a próxima renovação.`)}
                >
                  Trocar para {p.name}
                </Button>
              ))}
          </div>
          <button onClick={() => setCancelOpen(true)} className="font-label min-h-11 text-[13px] text-[#f4a49d] underline">
            Cancelar assinatura
          </button>
        </div>
      </div>

      <div className="stitch my-6" role="presentation" />
      <h3 className="font-label text-[14px] text-text-400">Cobranças do plano</h3>
      <ul className="mt-3 divide-y divide-white/5 text-[14px]">
        {payments.data?.map((p) => (
          <li key={p.id} className="tabular flex items-center justify-between gap-3 py-3">
            <span className="text-text-100">{p.createdAt ? formatInstant(p.createdAt.toDate(), 'dd/MM/yyyy') : '—'}</span>
            <span className="text-text-400">{p.description}</span>
            <span className="flex items-center gap-2">
              {formatBRL(p.amountCents)}
              <Badge tone={p.status === 'approved' ? 'success' : p.status === 'refunded' ? 'neutral' : 'danger'}>
                {p.status === 'approved' ? 'Aprovado' : p.status === 'refunded' ? 'Estornado' : 'Recusado'}
              </Badge>
            </span>
          </li>
        ))}
        {payments.data?.length === 0 && <li className="py-3 text-text-400">Nenhuma cobrança ainda.</li>}
      </ul>

      <Sheet
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancelar assinatura?"
        size="sm"
        description={
          withinWithdrawal
            ? 'Você está dentro dos 7 dias do direito de arrependimento: o plano é encerrado agora e o valor é estornado.'
            : `A renovação é desligada e você continua com o plano até ${formatInstant(sub.currentPeriodEnd.toDate(), 'dd/MM/yyyy')}.`
        }
        footer={
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="secondary" onClick={() => setCancelOpen(false)}>
              Manter plano
            </Button>
            <Button
              variant="danger"
              loading={busy === 'cancel'}
              onClick={() =>
                void run('cancel', () => call('cancelSubscription', { subscriptionId: sub.id }), withinWithdrawal ? 'Assinatura cancelada e valor estornado.' : 'Renovação desligada.').then(() =>
                  setCancelOpen(false),
                )
              }
            >
              Cancelar assinatura
            </Button>
          </div>
        }
      >
        <DemoNotice />
      </Sheet>
    </Card>
  );
}

export default function ClientPlansPage() {
  useDocumentMeta({ title: 'Planos', noindex: true });
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const { sub, loading } = useMySubscription(user?.uid);
  const plans = usePlans();
  const monthly = useMemo(() => plans.data?.find((p) => p.period === 'monthly'), [plans.data]);
  const [selected, setSelected] = useState<Plan | null>(null);

  useEffect(() => {
    const id = params.get('plano');
    if (id && plans.data && !loading && !sub) {
      setSelected(plans.data.find((p) => p.id === id) ?? null);
      setParams({}, { replace: true });
    }
  }, [params, plans.data, loading, sub, setParams]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-label text-[36px] leading-tight text-text-100">Planos</h1>
        <p className="mt-2 max-w-[52ch] text-[16px] text-text-400">Corte em dia com valor fixo. Os cortes renovam todo mês.</p>
      </div>
      {loading ? <Skeleton className="h-64 rounded-[20px]" /> : <ManagePlan />}
      {plans.isError ? (
        <ErrorState onRetry={() => void plans.refetch()} />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-3">
          {plans.isLoading
            ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-[420px] rounded-[20px]" />)
            : plans.data?.map((p) => (
                <li key={p.id}>
                  <PlanCard
                    plan={p}
                    monthly={monthly}
                    current={sub?.planId === p.id}
                    action={
                      sub ? null : (
                        <Button block variant={p.highlight ? 'primary' : 'secondary'} onClick={() => setSelected(p)}>
                          Assinar
                        </Button>
                      )
                    }
                  />
                </li>
              ))}
        </ul>
      )}
      <SubscribeSheet plan={selected} monthly={monthly} onClose={() => setSelected(null)} />
    </div>
  );
}
