import { createBrowserRouter } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import ProtectedRoute from './ProtectedRoute';
import PublicOnlyRoute from './PublicOnlyRoute';
import FeatureRoute from './FeatureRoute';
import { ROUTES } from '../constants/routes';
import { ROLES } from '../constants/domain';
import { FUNZIONALITA } from '../constants/funzionalita';

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
import QuizGestioneListPage from '../pages/QuizGestioneListPage';
import QuizGestioneDetailPage from '../pages/QuizGestioneDetailPage';
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
import ImpostazioniScuolaPage from '../pages/ImpostazioniScuolaPage';

/**
 * Albero delle route.
 *
 * Tre livelli di guardia, applicati in quest'ordine:
 *   1. `ProtectedRoute`  → autenticazione e RUOLO (studente/insegnante/admin);
 *   2. `FeatureRoute`    → SEZIONE attiva per la scuola dell'utente;
 *   3. il backend        → l'unica difesa che conti davvero.
 *
 * Le sezioni disattivabili sono dichiarate in `constants/funzionalita.js`:
 * dashboard, profilo e messaggistica di sistema restano sempre raggiungibili.
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
          // Sempre disponibili: la dashboard e il profilo sono di nucleo.
          { path: ROUTES.DASHBOARD, element: <DashboardPage /> },
          { path: ROUTES.PROFILE, element: <ProfilePage /> },

          {
            element: <FeatureRoute funzionalita={FUNZIONALITA.QUIZ} />,
            children: [{ path: ROUTES.QUIZ, element: <QuizPage /> }],
          },
          {
            element: <FeatureRoute funzionalita={FUNZIONALITA.COMPITI} />,
            children: [
              { path: ROUTES.COMPITI_STUDENTE, element: <CompitiStudentePage /> },
              {
                path: ROUTES.COMPITO_STUDENTE_DETAIL,
                element: <CompitoStudenteDetailPage />,
              },
            ],
          },
          {
            element: <FeatureRoute funzionalita={FUNZIONALITA.CORSI} />,
            children: [
              { path: ROUTES.CORSI_STUDENTE, element: <CorsiStudentePage /> },
              { path: ROUTES.CORSO_STUDENTE_DETAIL, element: <CorsoStudenteDetailPage /> },
            ],
          },
          {
            element: <FeatureRoute funzionalita={FUNZIONALITA.MESSAGGI} />,
            children: [
              { path: ROUTES.MESSAGGI, element: <MessaggiPage /> },
              { path: ROUTES.MESSAGGIO_DETAIL, element: <MessaggioDetailPage /> },
            ],
          },
        ],
      },

      // ── Route protette, insegnante o admin ───────────────
      {
        element: <ProtectedRoute allowedRoles={[ROLES.INSEGNANTE, ROLES.ADMIN]} />,
        children: [
          // Gestione utenti e inviti non sono sezioni disattivabili: senza di
          // esse la scuola non potrebbe far entrare nessuno.
          { path: ROUTES.USERS_MANAGEMENT, element: <UsersManagementPage /> },
          { path: ROUTES.INVITES_MANAGEMENT, element: <InvitesManagementPage /> },
          { path: ROUTES.IMPOSTAZIONI_SCUOLA, element: <ImpostazioniScuolaPage /> },

          {
            element: <FeatureRoute funzionalita={FUNZIONALITA.AULE} />,
            children: [
              { path: ROUTES.AULE, element: <AuleListPage /> },
              { path: ROUTES.AULA_DETAIL, element: <AulaDetailPage /> },
            ],
          },
          {
            element: <FeatureRoute funzionalita={FUNZIONALITA.COMPITI} />,
            children: [
              { path: ROUTES.COMPITI, element: <CompitiListPage /> },
              { path: ROUTES.COMPITO_DETAIL, element: <CompitoDetailPage /> },
            ],
          },
          {
            element: <FeatureRoute funzionalita={FUNZIONALITA.CORSI} />,
            children: [
              { path: ROUTES.CORSI, element: <CorsiListPage /> },
              { path: ROUTES.CORSO_DETAIL, element: <CorsoDetailPage /> },
            ],
          },
          {
            element: <FeatureRoute funzionalita={FUNZIONALITA.QUIZ} />,
            children: [
              { path: ROUTES.QUIZ_GESTIONE, element: <QuizGestioneListPage /> },
              { path: ROUTES.QUIZ_GESTIONE_DETAIL, element: <QuizGestioneDetailPage /> },
            ],
          },
          {
            element: <FeatureRoute funzionalita={FUNZIONALITA.STATISTICHE} />,
            children: [
              { path: ROUTES.TEACHER_DASHBOARD, element: <TeacherDashboardPage /> },
            ],
          },
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
