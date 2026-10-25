import { useState } from 'react';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tabs } from '@/components/ui/Tabs';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useShopSettings } from '@/lib/catalog';
import { useAuth } from '@/features/auth/AuthProvider';
import { AppointmentActions, AppointmentSummary, splitAppointments, useMyAppointments, useRepeat } from './appointments';

export default function ClientAppointmentsPage() {
  useDocumentMeta({ title: 'Meus agendamentos', noindex: true });
  const { user } = useAuth();
  const { data: settings } = useShopSettings();
  const appts = useMyAppointments(user?.uid);
  const repeat = useRepeat();
  const [tab, setTab] = useState('proximos');
  const { upcoming, history } = splitAppointments(appts.data);
  const list = tab === 'proximos' ? upcoming : history;

  return (
    <div>
      <h1 className="font-label text-[36px] leading-tight text-text-100">Agenda</h1>
      <Tabs
        className="mt-6"
        ariaLabel="Agendamentos"
        value={tab}
        onValueChange={setTab}
        items={[
          { value: 'proximos', label: `Próximos${upcoming.length ? ` (${upcoming.length})` : ''}` },
          { value: 'historico', label: 'Histórico' },
        ]}
        listClassName="max-w-sm"
      />
      <div className="mt-6">
        {appts.error ? (
          <ErrorState />
        ) : appts.loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-32 rounded-[20px]" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="panel">
            <EmptyState
              title={tab === 'proximos' ? 'Nenhum horário marcado' : 'Seu histórico aparece aqui'}
              description={tab === 'proximos' ? 'Quando você agendar, o horário aparece nesta lista.' : 'Depois do primeiro atendimento você vê tudo por aqui.'}
              action={<ButtonLink to="/agendar">Agendar horário</ButtonLink>}
            />
          </div>
        ) : (
          <ul className="panel divide-y divide-white/5">
            {list.map((a) => (
              <li key={a.id} className="p-5">
                <AppointmentSummary appt={a} />
                {tab === 'proximos' ? (
                  <AppointmentActions appt={a} settings={settings} />
                ) : (
                  a.status === 'completed' && (
                    <button onClick={() => repeat(a)} className="font-label mt-3 min-h-11 text-[13px] text-gold-400 underline">
                      Agendar de novo
                    </button>
                  )
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
