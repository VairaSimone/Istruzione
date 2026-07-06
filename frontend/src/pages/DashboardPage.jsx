import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  useAuthStore,
  selectIsAdmin,
  selectCanManage,
  selectIsTeacher,
} from '../store/authStore';
import { ROUTES } from '../constants/routes';
import { ROLES } from '../constants/domain';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import GamificationSummary from '../features/quiz/components/GamificationSummary';
import styles from './DashboardPage.module.css';

const DashboardPage = () => {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const isAdmin = useAuthStore(selectIsAdmin);
  const canManage = useAuthStore(selectCanManage);
  const isTeacher = useAuthStore(selectIsTeacher);

  if (!user) return null; // ProtectedRoute garantisce che qui user esista sempre

  const roleTone = user.ruolo === ROLES.STUDENTE ? 'seal' : 'gold';

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <h1 className={styles.title}>{t('dashboard.greeting', { name: user.nome })}</h1>
        <p className={styles.subtitle}>{t('dashboard.subtitle')}</p>
      </header>

      <div className={styles.grid}>
        {/* PROFILO CARD */}
        <Card className={styles.summaryCard}>
          <h2 className={styles.cardTitle}>{t('dashboard.profileCardTitle')}</h2>
          <dl className={styles.summaryList}>
            <div className={styles.summaryRow}>
              <dt>{t('dashboard.labelRole')}</dt>
              <dd>
                <Badge tone={roleTone}>{t(`roles.${user.ruolo}`)}</Badge>
              </dd>
            </div>
            {user.classe && (
              <div className={styles.summaryRow}>
                <dt>{t('dashboard.labelClasse')}</dt>
                <dd>{t(`classi.${user.classe}`)}</dd>
              </div>
            )}
            <div className={styles.summaryRow}>
              <dt>{t('dashboard.labelEmail')}</dt>
              <dd>{user.email}</dd>
            </div>
          </dl>
          <Link to={ROUTES.PROFILE}>
            <Button variant="secondary" size="sm">
              {t('dashboard.manageProfile')}
            </Button>
          </Link>
        </Card>

        {/* QUIZ CARD */}
        <Card className={styles.summaryCard}>
          <h2 className={styles.cardTitle}>{t('dashboard.quizCardTitle')}</h2>
          <p className={styles.cardText}>{t('dashboard.quizCardText')}</p>
          <Link to={ROUTES.QUIZ}>
            <Button size="sm">{t('dashboard.quizCardCta')}</Button>
          </Link>
        </Card>

        {/* PROGRESSI / GAMIFICATION */}
        <GamificationSummary />

        {/* GESTIONE DOCENTE / CAN MANAGE */}
        {(canManage || isTeacher) && (
          <Card className={styles.summaryCard}>
            <h2 className={styles.cardTitle}>{t('dashboard.teacherCardTitle')}</h2>
            <p className={styles.cardText}>{t('dashboard.teacherCardText')}</p>
            <div className={styles.cardActions}>
              <Link to={ROUTES.USERS_MANAGEMENT}>
                <Button size="sm">{t('dashboard.teacherCardCta')}</Button>
              </Link>
              <Link to={ROUTES.INVITES_MANAGEMENT}>
                <Button variant="secondary" size="sm">
                  {t('dashboard.invitesCardCta')}
                </Button>
              </Link>
            </div>
          </Card>
        )}

        {/* AMMINISTRAZIONE — GESTIONE SCUOLE (admin) */}
        {isAdmin && (
          <Card className={styles.summaryCard}>
            <h2 className={styles.cardTitle}>{t('dashboard.scuoleCardTitle')}</h2>
            <p className={styles.cardText}>{t('dashboard.scuoleCardText')}</p>
            <Link to={ROUTES.SCUOLE_MANAGEMENT}>
              <Button size="sm">{t('dashboard.scuoleCardCta')}</Button>
            </Link>
          </Card>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;