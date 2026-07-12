import { createBrowserRouter } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import ProtectedRoute from './ProtectedRoute';
import PublicOnlyRoute from './PublicOnlyRoute';
import FeatureRoute from './FeatureRoute';
import { ROUTES } from '../constants/routes';
import { ROLES } from '../constants/domain';
import { FUNZIONALITA } from '../constants/funzionalita';

// ─────────────────────────────────────────────
// CODE SPLITTING — le pagine sono caricate in modo LAZY (React.lazy),
// dichiarate in `lazyPages.js`. Ogni pagina diventa un chunk separato,
// scaricato solo quando la relativa route viene visitata: il bundle iniziale
// non le contiene più. Lo shell del router (AppLayout, componenti di guardia)
// resta eager per non ritardare il primo render. Il confine <Suspense> che
// copre queste route vive in AppLayout, intorno all'<Outlet>.
// ─────────────────────────────────────────────
import {
  HomePage,
  LoginPage,
  RegisterPage,
  ForgotPasswordPage,
  PrivacyPolicyPage,
  CookiePolicyPage,
  TerminiPage,
  DichiarazioneAccessibilitaPage,
  ResetPasswordPage,
  VerifyEmailPage,
  VerifyEmailChangePage,
  DashboardPage,
  ProfilePage,
  QuizPage,
  QuizGestioneListPage,
  QuizGestioneDetailPage,
  AuleListPage,
  AulaDetailPage,
  CompitiListPage,
  CompitoDetailPage,
  CompitiStudentePage,
  CompitoStudenteDetailPage,
  CorsiListPage,
  CorsoDetailPage,
  CorsiStudentePage,
  CorsoStudenteDetailPage,
  TeacherDashboardPage,
  MessaggiPage,
  MessaggioDetailPage,
  CalendarioPage,
  CertificatiListPage,
  CertificatiStudentePage,
  VerificaCertificatoPage,
  UsersManagementPage,
  NotFoundPage,
  ForbiddenPage,
  InvitesManagementPage,
  ScuoleManagementPage,
  ImpostazioniScuolaPage,
} from './lazyPages';

/**
 * Albero delle route.
 *
 * Tre livelli di guardia, applicati in quest'ordine:
 *   1. `ProtectedRoute`  → autenticazione e RUOLO (studente/insegnante/admin);
 *   2. `FeatureRoute`    → SEZIONE attiva per la scuola dell'utente;
 *   3. il backend        → l'unica difesa che conti davvero.
 *
 * Le sezioni disattivabili sono dichiarate in `constants/funzionalita.js`.
 * Restano sempre raggiungibili SOLO le funzionalità di nucleo (`nucleo: true`):
 * il profilo e, di conseguenza, la dashboard. La messaggistica NON è di nucleo:
 * è gated qui da `FeatureRoute` e lato server da `richiediFunzionalita('messaggi')`.
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

      // Pagine legali: pubbliche e sempre raggiungibili (requisito di
      // conformità: non devono dipendere dalla configurazione della scuola).
      { path: ROUTES.PRIVACY, element: <PrivacyPolicyPage /> },
      { path: ROUTES.COOKIE, element: <CookiePolicyPage /> },
      { path: ROUTES.TERMINI, element: <TerminiPage /> },
      { path: ROUTES.ACCESSIBILITA, element: <DichiarazioneAccessibilitaPage /> },

      // Verifica pubblica di un certificato: accessibile a chiunque, anche
      // esternamente (link/QR), senza autenticazione.
      { path: ROUTES.VERIFICA_CERTIFICATO, element: <VerificaCertificatoPage /> },
      { path: ROUTES.VERIFICA_CERTIFICATO_CODICE, element: <VerificaCertificatoPage /> },

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
          {
            // Calendario condiviso: accessibile a studenti e insegnanti.
            element: <FeatureRoute funzionalita={FUNZIONALITA.CALENDARIO} />,
            children: [{ path: ROUTES.CALENDARIO, element: <CalendarioPage /> }],
          },
          {
            // I certificati ricevuti dallo studente (scaricabili in PDF).
            element: <FeatureRoute funzionalita={FUNZIONALITA.CERTIFICAZIONI} />,
            children: [
              { path: ROUTES.CERTIFICATI_STUDENTE, element: <CertificatiStudentePage /> },
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
            element: <FeatureRoute funzionalita={FUNZIONALITA.CERTIFICAZIONI} />,
            children: [{ path: ROUTES.CERTIFICATI, element: <CertificatiListPage /> }],
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
