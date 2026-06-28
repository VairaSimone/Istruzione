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
import UsersManagementPage from '../pages/UsersManagementPage';
import NotFoundPage from '../pages/NotFoundPage';
import ForbiddenPage from '../pages/ForbiddenPage';
import TeacherRequestPage from '../pages/TeacherRequestPage';
import InvitesManagementPage from '../pages/InvitesManagementPage';
import AdminTeacherRequestsPage from '../pages/AdminTeacherRequestsPage';
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
           { path: ROUTES.TEACHER_REQUEST, element: <TeacherRequestPage /> },
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
        ],
      },
      // ── Route protette, insegnante o admin ───────────────
      {
        element: <ProtectedRoute allowedRoles={[ROLES.INSEGNANTE, ROLES.ADMIN]} />,
        children: [
          { path: ROUTES.USERS_MANAGEMENT, element: <UsersManagementPage /> },
          { path: ROUTES.INVITES_MANAGEMENT, element: <InvitesManagementPage /> },
        ],
      },

      // ── Route protette, solo ruolo insegnante ────────────
      {
        element: <ProtectedRoute allowedRoles={[ROLES.ADMIN]} />,
        children: [
          { path: ROUTES.ADMIN_TEACHER_REQUESTS, element: <AdminTeacherRequestsPage /> },
        ],
      },

      // ── Catch-all ─────────────────────────────────────────
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
