import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../constants/routes';
import { useBranding } from '../hooks/useConfig';
import BrandLogo from '../components/branding/BrandLogo';
import Button from '../components/ui/Button';
import styles from './HomePage.module.css';

/**
 * Pagina di ingresso pubblica.
 *
 * Tutto ciò che si vede appartiene alla SCUOLA, non alla materia: marchio,
 * nome, slogan, descrizione e — se caricata — un'immagine di copertina.
 * Il glifo 日本語 che campeggiava qui prima della generalizzazione è stato
 * rimosso: era il biglietto da visita di un corso di giapponese, non di una
 * piattaforma didattica.
 *
 * Se la scuola non ha compilato nulla, si ricade sull'identità della
 * piattaforma e sui testi generici dell'i18n: la pagina resta presentabile.
 */
const HomePage = () => {
  const { t } = useTranslation();
  const branding = useBranding();

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
