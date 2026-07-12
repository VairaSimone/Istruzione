import { useTranslation } from 'react-i18next';
import PaginaLegale from '../components/shared/PaginaLegale';
import { contenutoLegale } from '../constants/legaleContenuti';
import { useBranding } from '../hooks/useConfig';
import styles from '../components/shared/PaginaLegale.module.css';

/**
 * Dichiarazione di accessibilità (European Accessibility Act). Oltre al testo
 * versionato, espone un MECCANISMO DI SEGNALAZIONE delle barriere: un contatto
 * email a cui gli utenti possono segnalare problemi di accessibilità. L'indirizzo
 * è quello di contatto della scuola (branding); in assenza, viene mostrata
 * un'indicazione a rivolgersi alla segreteria.
 */
const DichiarazioneAccessibilitaPage = () => {
  const { t, i18n } = useTranslation();
  const lingua = (i18n.language || 'it').slice(0, 2);
  const branding = useBranding();
  const emailContatto = branding?.contatti?.email || null;

  const mailto = emailContatto
    ? `mailto:${emailContatto}?subject=${encodeURIComponent(t('accessibilita.segnalaOggetto'))}`
    : null;

  return (
    <PaginaLegale contenuto={contenutoLegale('accessibilita', lingua)}>
      <div className={styles.reportBox}>
        <h2>{t('accessibilita.segnalaTitolo')}</h2>
        <p className={styles.paragraph}>{t('accessibilita.segnalaTesto')}</p>
        {mailto ? (
          <a className={styles.reportLink} href={mailto}>
            {emailContatto}
          </a>
        ) : (
          <p className={styles.paragraph}>{t('accessibilita.segnalaFallback')}</p>
        )}
      </div>
    </PaginaLegale>
  );
};

export default DichiarazioneAccessibilitaPage;
