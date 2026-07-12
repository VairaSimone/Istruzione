import { lazy } from 'react';

/**
 * Pagine caricate in modo LAZY (code splitting a livello di route).
 *
 * Isolate qui, separate da `router.jsx`, per due motivi:
 *   1. ogni pagina diventa un chunk a sé, scaricato solo quando la sua route
 *      viene visitata: il bundle iniziale non le include più;
 *   2. `router.jsx` esporta `router` (un valore, non un componente): tenere le
 *      dichiarazioni dei componenti in un modulo che esporta SOLO componenti
 *      mantiene pulito il boundary di react-refresh.
 *
 * Il confine <Suspense> che copre queste pagine vive in AppLayout, intorno
 * all'<Outlet>.
 */

export const HomePage = lazy(() => import('../pages/HomePage'));
export const LoginPage = lazy(() => import('../pages/LoginPage'));
export const RegisterPage = lazy(() => import('../pages/RegisterPage'));
export const ForgotPasswordPage = lazy(() => import('../pages/ForgotPasswordPage'));
export const PrivacyPolicyPage = lazy(() => import('../pages/PrivacyPolicyPage'));
export const CookiePolicyPage = lazy(() => import('../pages/CookiePolicyPage'));
export const TerminiPage = lazy(() => import('../pages/TerminiPage'));
export const DichiarazioneAccessibilitaPage = lazy(() =>
  import('../pages/DichiarazioneAccessibilitaPage')
);
export const ResetPasswordPage = lazy(() => import('../pages/ResetPasswordPage'));
export const VerifyEmailPage = lazy(() => import('../pages/VerifyEmailPage'));
export const VerifyEmailChangePage = lazy(() => import('../pages/VerifyEmailChangePage'));
export const DashboardPage = lazy(() => import('../pages/DashboardPage'));
export const ProfilePage = lazy(() => import('../pages/ProfilePage'));
export const QuizPage = lazy(() => import('../pages/QuizPage'));
export const QuizGestioneListPage = lazy(() => import('../pages/QuizGestioneListPage'));
export const QuizGestioneDetailPage = lazy(() => import('../pages/QuizGestioneDetailPage'));
export const AuleListPage = lazy(() => import('../pages/AuleListPage'));
export const AulaDetailPage = lazy(() => import('../pages/AulaDetailPage'));
export const CompitiListPage = lazy(() => import('../pages/CompitiListPage'));
export const CompitoDetailPage = lazy(() => import('../pages/CompitoDetailPage'));
export const CompitiStudentePage = lazy(() => import('../pages/CompitiStudentePage'));
export const CompitoStudenteDetailPage = lazy(() =>
  import('../pages/CompitoStudenteDetailPage')
);
export const CorsiListPage = lazy(() => import('../pages/CorsiListPage'));
export const CorsoDetailPage = lazy(() => import('../pages/CorsoDetailPage'));
export const CorsiStudentePage = lazy(() => import('../pages/CorsiStudentePage'));
export const CorsoStudenteDetailPage = lazy(() =>
  import('../pages/CorsoStudenteDetailPage')
);
export const TeacherDashboardPage = lazy(() => import('../pages/TeacherDashboardPage'));
export const MessaggiPage = lazy(() => import('../pages/MessaggiPage'));
export const MessaggioDetailPage = lazy(() => import('../pages/MessaggioDetailPage'));
export const CalendarioPage = lazy(() => import('../pages/CalendarioPage'));
export const CertificatiListPage = lazy(() => import('../pages/CertificatiListPage'));
export const CertificatiStudentePage = lazy(() =>
  import('../pages/CertificatiStudentePage')
);
export const VerificaCertificatoPage = lazy(() =>
  import('../pages/VerificaCertificatoPage')
);
export const UsersManagementPage = lazy(() => import('../pages/UsersManagementPage'));
export const NotFoundPage = lazy(() => import('../pages/NotFoundPage'));
export const ForbiddenPage = lazy(() => import('../pages/ForbiddenPage'));
export const InvitesManagementPage = lazy(() => import('../pages/InvitesManagementPage'));
export const ScuoleManagementPage = lazy(() => import('../pages/ScuoleManagementPage'));
export const ImpostazioniScuolaPage = lazy(() => import('../pages/ImpostazioniScuolaPage'));
