import { useAuthStore } from '../store/authStore';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import LanguageSection from '../features/auth/components/LanguageSection';
import ChangeEmailSection from '../features/auth/components/ChangeEmailSection';
import DeleteAccountSection from '../features/auth/components/DeleteAccountSection';
import styles from './ProfilePage.module.css';

const ProfilePage = () => {
  const user = useAuthStore((state) => state.user);

  if (!user) return null;

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <h1 className={styles.title}>Il tuo profilo</h1>
        <p className={styles.subtitle}>
          Gestisci le informazioni e le preferenze del tuo account.
        </p>
      </header>

      <Card>
        <h2 className={styles.sectionTitle}>Informazioni anagrafiche</h2>
        <dl className={styles.infoGrid}>
          <div>
            <dt>Nome completo</dt>
            <dd>
              {user.nome} {user.cognome}
            </dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Età</dt>
            <dd>{user.eta} anni</dd>
          </div>
          <div>
            <dt>Classe</dt>
            <dd>{user.classe}</dd>
          </div>
          <div>
            <dt>Ruolo</dt>
            <dd>
              <Badge tone={user.ruolo === 'insegnante' ? 'gold' : 'seal'}>
                {user.ruolo}
              </Badge>
            </dd>
          </div>
          <div>
            <dt>Email verificata</dt>
            <dd>
              <Badge tone={user.email_verificata ? 'matcha' : 'danger'}>
                {user.email_verificata ? 'Verificata' : 'Non verificata'}
              </Badge>
            </dd>
          </div>
        </dl>
      </Card>

      <LanguageSection />
      <ChangeEmailSection />
      <DeleteAccountSection />
    </div>
  );
};

export default ProfilePage;
