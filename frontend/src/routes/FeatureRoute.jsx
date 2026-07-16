import { Navigate, Outlet } from 'react-router-dom';
import { useFunzionalitaContesto } from '../hooks/useConfig';
import { useAuthStore, selectIsAdmin } from '../store/authStore';
import { ROUTES } from '../constants/routes';
import Spinner from '../components/ui/Spinner';

/**
 * GUARD DI SEZIONE.
 *
 * Una scuola può disattivare intere sezioni (quiz, corsi, compiti, messaggi…).
 * Nascondere la voce di menu non basta: chi conosce l'URL ci arriverebbe
 * comunque e vedrebbe una pagina rotta, con una manciata di 403 dalle chiamate
 * API. Questo componente intercetta la navigazione prima del render.
 *
 * Il controllo è di sola cortesia — la difesa vera è nel backend, che risponde
 * `403 FEATURE_DISABLED` su ogni route della sezione (middleware
 * `richiediFunzionalita`). Qui evitiamo solo un'esperienza sgradevole.
 *
 * L'ADMIN è trasversale alle scuole e non ha una propria configurazione: passa
 * sempre, coerentemente col backend.
 *
 * La fonte delle funzionalità è `useFunzionalitaContesto`, non `useConfig`: per
 * un utente autenticato vale la SUA scuola, non il tenant pubblico risolto da
 * dominio/slug. Anche `isLoading` viene da lì, altrimenti si deciderebbe con i
 * dati della scuola sbagliata mentre `/api/scuole/mia` è ancora in volo.
 *
 * @param {string} funzionalita chiave del registro (`constants/funzionalita.js`)
 */
const FeatureRoute = ({ funzionalita }) => {
  const isAdmin = useAuthStore(selectIsAdmin);
  const { funzionalita: mappa, isLoading } = useFunzionalitaContesto();
  const attiva = !funzionalita || mappa[funzionalita] !== false;

  // Finché la configurazione non è arrivata non sappiamo nulla: attendere è
  // meglio che rimbalzare l'utente su /403 e poi riportarlo indietro.
  if (isLoading) return <Spinner size="lg" />;

  if (!isAdmin && !attiva) {
    return <Navigate to={ROUTES.FORBIDDEN} replace state={{ funzionalita }} />;
  }

  return <Outlet />;
};

export default FeatureRoute;
