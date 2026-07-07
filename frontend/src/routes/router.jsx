import { createBrowserRouter } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import ProtectedRoute from './ProtectedRoute';
import PublicOnlyRoute from './PublicOnlyRoute';
import { ROUTES } from '../constants/routes';
import { ROLES } from '../constants/domain';

import HomePage from '../pages/HomePage';
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/RegisterPage';
import ForgotPasswordPage from '../pages/ForgotPasswordPage';
import ResetPasswordPage from '../pages/ResetPasswordPage';
import VerifyEmailPage from '../pages/VerifyEmailPage';
import VerifyEmailChangePage from '../pages/VerifyEmailChangePage';
import DashboardPage from '../pages/DashboardPage';
import ProfilePage from '../pages/ProfilePage';
import QuizPage from '../pages/QuizPage';
import AuleListPage from '../pages/AuleListPage';
import AulaDetailPage from '../pages/AulaDetailPage';
import CompitiListPage from '../pages/CompitiListPage';
import CompitoDetailPage from '../pages/CompitoDetailPage';
import CompitiStudentePage from '../pages/CompitiStudentePage';
import CompitoStudenteDetailPage from '../pages/CompitoStudenteDetailPage';
import CorsiListPage from '../pages/CorsiListPage';
import CorsoDetailPage from '../pages/CorsoDetailPage';
import CorsiStudentePage from '../pages/CorsiStudentePage';
import CorsoStudenteDetailPage from '../pages/CorsoStudenteDetailPage';
import TeacherDashboardPage from '../pages/TeacherDashboardPage';
import MessaggiPage from '../pages/MessaggiPage';
import MessaggioDetailPage from '../pages/MessaggioDetailPage';
import UsersManagementPage from '../pages/UsersManagementPage';
import NotFoundPage from '../pages/NotFoundPage';
import ForbiddenPage from '../pages/ForbiddenPage';
import InvitesManagementPage from '../pages/InvitesManagementPage';
import ScuoleManagementPage from '../pages/ScuoleManagementPage';
export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      // ── Route pubbliche, sempre accessibili ──────────────
      { path: ROUTES.HOME, element: <HomePage /> },
      { path: ROUTES.VERIFY_EMAIL, element: <VerifyEmailPage /> },
      { path: ROUTES.VERIFY_EMAIL_CHANGE, element: <VerifyEmailChangePage /> },
      { path: ROUTES.NOT_FOUND, element: <NotFoundPage /> },
      { path: ROUTES.FORBIDDEN, element: <ForbiddenPage /> },

      // ── Route pubbliche SOLO per utenti non autenticati ──
      {
        element: <PublicOnlyRoute />,
        children: [
          { path: ROUTES.LOGIN, element: <LoginPage /> },
          { path: ROUTES.REGISTER, element: <RegisterPage /> },
          { path: ROUTES.FORGOT_PASSWORD, element: <ForgotPasswordPage /> },
          { path: ROUTES.RESET_PASSWORD, element: <ResetPasswordPage /> },
        ],
      },

      // ── Route protette, qualsiasi utente autenticato ─────
      {
        element: <ProtectedRoute />,
        children: [
          { path: ROUTES.DASHBOARD, element: <DashboardPage /> },
          { path: ROUTES.PROFILE, element: <ProfilePage /> },
          { path: ROUTES.QUIZ, element: <QuizPage /> },
          { path: ROUTES.COMPITI_STUDENTE, element: <CompitiStudentePage /> },
          {
            path: ROUTES.COMPITO_STUDENTE_DETAIL,
            element: <CompitoStudenteDetailPage />,
          },
          { path: ROUTES.CORSI_STUDENTE, element: <CorsiStudentePage /> },
          { path: ROUTES.CORSO_STUDENTE_DETAIL, element: <CorsoStudenteDetailPage /> },
          { path: ROUTES.MESSAGGI, element: <MessaggiPage /> },
          { path: ROUTES.MESSAGGIO_DETAIL, element: <MessaggioDetailPage /> },
        ],
      },
      // ── Route protette, insegnante o admin ───────────────
      {
        element: <ProtectedRoute allowedRoles={[ROLES.INSEGNANTE, ROLES.ADMIN]} />,
        children: [
          { path: ROUTES.AULE, element: <AuleListPage /> },
          { path: ROUTES.AULA_DETAIL, element: <AulaDetailPage /> },
          { path: ROUTES.COMPITI, element: <CompitiListPage /> },
          { path: ROUTES.COMPITO_DETAIL, element: <CompitoDetailPage /> },
          { path: ROUTES.CORSI, element: <CorsiListPage /> },
          { path: ROUTES.CORSO_DETAIL, element: <CorsoDetailPage /> },
          { path: ROUTES.TEACHER_DASHBOARD, element: <TeacherDashboardPage /> },
          { path: ROUTES.USERS_MANAGEMENT, element: <UsersManagementPage /> },
          { path: ROUTES.INVITES_MANAGEMENT, element: <InvitesManagementPage /> },
        ],
      },

      // ── Route protette, solo ruolo admin ────────────
      {
        element: <ProtectedRoute allowedRoles={[ROLES.ADMIN]} />,
        children: [{ path: ROUTES.SCUOLE_MANAGEMENT, element: <ScuoleManagementPage /> }],
      },

      // ── Catch-all ─────────────────────────────────────────
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
