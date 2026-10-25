import { createBrowserRouter, type RouteObject } from 'react-router';
import { RootLayout } from './layouts/RootLayout';
import { RouteError } from './pages/RouteError';

type Lazy = () => Promise<{ default: React.ComponentType }>;

/** Lazy route with code splitting; the module's default export is the page. */
const page = (load: Lazy): Pick<RouteObject, 'lazy'> => ({
  lazy: async () => ({ Component: (await load()).default }),
});

const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    errorElement: <RouteError />,
    HydrateFallback: () => null,
    children: [
      { index: true, ...page(() => import('@/features/landing/LandingPage')) },
      { path: 'agendar', ...page(() => import('@/features/booking/BookingPage')) },
      { path: 'entrar', ...page(() => import('@/features/auth/SignInPage')) },
      { path: 'cadastro', ...page(() => import('@/features/auth/SignUpPage')) },
      { path: 'recuperar-senha', ...page(() => import('@/features/auth/ResetPasswordPage')) },
      { path: 'privacidade', ...page(() => import('@/features/legal/PrivacyPage')) },
      { path: 'termos', ...page(() => import('@/features/legal/TermsPage')) },
      { path: 'cookies', ...page(() => import('@/features/legal/CookiesPage')) },
      {
        path: 'cliente',
        ...page(() => import('@/features/client/ClientLayout')),
        children: [
          { index: true, ...page(() => import('@/features/client/ClientHomePage')) },
          { path: 'agendamentos', ...page(() => import('@/features/client/ClientAppointmentsPage')) },
          { path: 'planos', ...page(() => import('@/features/plans/ClientPlansPage')) },
          { path: 'pagamentos', ...page(() => import('@/features/payments/ClientPaymentsPage')) },
          { path: 'perfil', ...page(() => import('@/features/client/ClientProfilePage')) },
        ],
      },
      { path: 'barbeiro/login', ...page(() => import('@/features/barber/BarberLoginPage')) },
      {
        path: 'barbeiro',
        ...page(() => import('@/features/barber/BarberLayout')),
        children: [
          { index: true, ...page(() => import('@/features/barber/BarberTodayPage')) },
          { path: 'agenda', ...page(() => import('@/features/barber/BarberAgendaPage')) },
          { path: 'clientes', ...page(() => import('@/features/barber/BarberClientsPage')) },
          { path: 'clientes/:id', ...page(() => import('@/features/barber/BarberClientDetailPage')) },
          { path: 'perfil', ...page(() => import('@/features/barber/BarberProfilePage')) },
        ],
      },
      {
        path: 'admin',
        ...page(() => import('@/features/admin/AdminLayout')),
        children: [
          { index: true, ...page(() => import('@/features/admin/AdminAgendaPage')) },
          { path: 'barbeiros', ...page(() => import('@/features/admin/AdminBarbersPage')) },
          { path: 'servicos', ...page(() => import('@/features/admin/AdminServicesPage')) },
          { path: 'planos', ...page(() => import('@/features/admin/AdminPlansPage')) },
          { path: 'assinaturas', ...page(() => import('@/features/admin/AdminSubscriptionsPage')) },
          { path: 'documentos', ...page(() => import('@/features/admin/AdminLegalPage')) },
          { path: 'configuracoes', ...page(() => import('@/features/admin/AdminSettingsPage')) },
        ],
      },
      ...(import.meta.env.DEV
        ? [{ path: 'design-system', ...page(() => import('@/features/design-system/DesignSystemPage')) }]
        : []),
      { path: 'offline', ...page(() => import('./pages/OfflinePage')) },
      { path: '*', ...page(() => import('./pages/NotFoundPage')) },
    ],
  },
];

export const router = createBrowserRouter(routes);
