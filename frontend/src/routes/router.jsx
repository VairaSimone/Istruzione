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
import UsersManagementPage from '../pages/UsersManagementPage';
import NotFoundPage from '../pages/NotFoundPage';
import ForbiddenPage from '../pages/ForbiddenPage';

/**
 * Albero delle route. Ogni route corrisponde a uno schermo reale collegato
 * a uno o più endpoint del backend (vedi mappatura endpoint -> schermate
 * nel README). Nessuna route qui sotto rappresenta funzionalità non
 * supportate dal backend.
 */
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
        ],
      },

      // ── Route protette, solo ruolo insegnante ────────────
      {
        element: <ProtectedRoute allowedRoles={[ROLES.INSEGNANTE]} />,
        children: [{ path: ROUTES.USERS_MANAGEMENT, element: <UsersManagementPage /> }],
      },

      // ── Catch-all ─────────────────────────────────────────
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
