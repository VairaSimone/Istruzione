import { Link } from 'react-router-dom';
import { useAuthStore, selectIsTeacher } from '../store/authStore';
import { ROUTES } from '../constants/routes';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import styles from './DashboardPage.module.css';

const DashboardPage = () => {
  const user = useAuthStore((state) => state.user);
  const isTeacher = useAuthStore(selectIsTeacher);

  if (!user) return null; // ProtectedRoute garantisce che qui user esista sempre

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <h1 className={styles.title}>Ciao, {user.nome}</h1>
        <p className={styles.subtitle}>
          Ecco un riepilogo del tuo account sulla piattaforma.
        </p>
      </header>

      <div className={styles.grid}>
        <Card className={styles.summaryCard}>
          <h2 className={styles.cardTitle}>Il tuo profilo</h2>
          <dl className={styles.summaryList}>
            <div className={styles.summaryRow}>
              <dt>Ruolo</dt>
              <dd>
                <Badge tone={isTeacher ? 'gold' : 'seal'}>{user.ruolo}</Badge>
              </dd>
            </div>
            <div className={styles.summaryRow}>
              <dt>Classe</dt>
              <dd>{user.classe}</dd>
            </div>
            <div className={styles.summaryRow}>
              <dt>Email</dt>
              <dd>{user.email}</dd>
            </div>
          </dl>
          <Link to={ROUTES.PROFILE}>
            <Button variant="secondary" size="sm">
              Gestisci profilo
            </Button>
          </Link>
        </Card>

        {isTeacher && (
          <Card className={styles.summaryCard}>
            <h2 className={styles.cardTitle}>Gestione classe</h2>
            <p className={styles.cardText}>
              Visualizza l'elenco degli studenti, modifica i ruoli e gestisci gli account
              registrati sulla piattaforma.
            </p>
            <Link to={ROUTES.USERS_MANAGEMENT}>
              <Button size="sm">Vai alla gestione utenti</Button>
            </Link>
          </Card>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
