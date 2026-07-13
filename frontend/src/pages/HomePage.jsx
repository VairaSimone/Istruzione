import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../constants/routes';
import { useBranding } from '../hooks/useConfig';
import BrandLogo from '../components/branding/BrandLogo';
import Button from '../components/ui/Button';
import HomepagePubblica from '../features/homepage/components/HomepagePubblica';
import styles from './HomePage.module.css';

/**
 * Pagina di ingresso pubblica.
 *
 * Se la scuola ha ATTIVATO la propria homepage (`impostazioni.homepage.attiva`),
 * viene mostrata quella: hero, sezioni e form di contatto curati dalla scuola.
 * È il caso tipico dei DOMINI PERSONALIZZATI, dove l'host identifica la scuola e
 * il branding (compresa la homepage) arriva già risolto da `GET /api/config`.
 *
 * Altrimenti si ricade sul layout standard: marchio, nome, slogan e accesso.
 * Se la scuola non ha compilato nulla, subentrano l'identità della piattaforma
 * e i testi generici dell'i18n, così la pagina resta comunque presentabile.
 */
const HomePage = () => {
  const { t } = useTranslation();
  const branding = useBranding();

  // Homepage personalizzata: prevale quando la scuola l'ha attivata.
  if (branding.homepage?.attiva) {
    return <HomepagePubblica branding={branding} />;
  }

  const sottotitolo = branding.slogan || branding.descrizione || t('home.subtitle');

  return (
    <div className={styles.hero}>
      {branding.immagineHeroUrl && (
        <img
          src={branding.immagineHeroUrl}
          alt=""
          className={styles.heroImage}
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      )}

      <BrandLogo size="lg" className={styles.heroMark} />

      <h1 className={styles.title}>{branding.nome}</h1>
      <p className={styles.subtitle}>{sottotitolo}</p>

      <div className={styles.actions}>
        <Link to={ROUTES.LOGIN}>
          <Button size="lg">{t('home.login')}</Button>
        </Link>
      </div>

      <p className={styles.note}>{t('home.studentInviteNote')}</p>
    </div>
  );
};

export default HomePage;
