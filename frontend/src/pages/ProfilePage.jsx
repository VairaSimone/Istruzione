import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import LanguageSection from '../features/auth/components/LanguageSection';
import ChangeEmailSection from '../features/auth/components/ChangeEmailSection';
import DeleteAccountSection from '../features/auth/components/DeleteAccountSection';
import styles from './ProfilePage.module.css';

const ProfilePage = () => {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);

  if (!user) return null;

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <h1 className={styles.title}>{t('profile.title')}</h1>
        <p className={styles.subtitle}>{t('profile.subtitle')}</p>
      </header>

      <Card>
        <h2 className={styles.sectionTitle}>{t('profile.infoTitle')}</h2>
        <dl className={styles.infoGrid}>
          <div>
            <dt>{t('profile.fullName')}</dt>
            <dd>
              {user.nome} {user.cognome}
            </dd>
          </div>
          <div>
            <dt>{t('profile.email')}</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>{t('profile.age')}</dt>
            <dd>{t('profile.ageValue', { age: user.eta })}</dd>
          </div>
          <div>
            <dt>{t('profile.classe')}</dt>
            <dd>{t(`classi.${user.classe}`)}</dd>
          </div>
          <div>
            <dt>{t('profile.role')}</dt>
            <dd>
              <Badge tone={user.ruolo === 'insegnante' ? 'gold' : 'seal'}>
                {t(`roles.${user.ruolo}`)}
              </Badge>
            </dd>
          </div>
          <div>
            <dt>{t('profile.emailVerified')}</dt>
            <dd>
              <Badge tone={user.email_verificata ? 'matcha' : 'danger'}>
                {user.email_verificata
                  ? t('profile.verified')
                  : t('profile.notVerified')}
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
