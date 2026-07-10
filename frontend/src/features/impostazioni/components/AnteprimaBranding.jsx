import { useTranslation } from 'react-i18next';
import Card from '../../../components/ui/Card';
import { scalaBrand, isColoreValido } from '../../../utils/colore';
import { useTheme } from '../../../hooks/useTheme';
import styles from './Impostazioni.module.css';

/**
 * Anteprima del branding, calcolata sulla BOZZA e non su ciò che è salvato.
 *
 * Serve a rispondere subito alla sola domanda che conta mentre si sceglie un
 * colore: «come starà sui pulsanti?». Le tinte mostrate sono le stesse che il
 * `BrandingProvider` applicherà ai token del design system, derivate con la
 * medesima funzione — non un'approssimazione fatta a occhio.
 *
 * L'anteprima riflette il tema attivo: lo stesso primario si comporta in modo
 * diverso su carta e su inchiostro.
 */
const Pastiglia = ({ etichetta, colore, tema }) => {
  const { t } = useTranslation();
  const scala = isColoreValido(colore) ? scalaBrand(colore, tema) : null;

  if (!scala) {
    return (
      <div className={styles.anteprimaVoce}>
        <span className={styles.anteprimaEtichetta}>{etichetta}</span>
        <span className={styles.anteprimaAssente}>{t('impostazioni.anteprima.assente')}</span>
      </div>
    );
  }

  return (
    <div className={styles.anteprimaVoce}>
      <span className={styles.anteprimaEtichetta}>{etichetta}</span>
      <div className={styles.anteprimaCampioni}>
        <span
          className={styles.anteprimaBottone}
          style={{ background: scala.base, color: scala.testo }}
        >
          {t('impostazioni.anteprima.bottone')}
        </span>
        <span
          className={styles.anteprimaBottone}
          style={{ background: scala.forte, color: scala.testo }}
        >
          {t('impostazioni.anteprima.hover')}
        </span>
        <span
          className={styles.anteprimaVelatura}
          style={{ background: scala.tenue, borderColor: scala.base }}
        >
          {t('impostazioni.anteprima.velatura')}
        </span>
      </div>
    </div>
  );
};

const AnteprimaBranding = ({ impostazioni }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();

  const aspetto = impostazioni?.aspetto ?? {};
  const identita = impostazioni?.identita ?? {};

  return (
    <Card className={styles.anteprima}>
      <header className={styles.sezioneHead}>
        <h2 className={styles.sezioneTitolo}>{t('impostazioni.anteprima.titolo')}</h2>
        <p className={styles.sezioneDescrizione}>{t('impostazioni.anteprima.descrizione')}</p>
      </header>

      <div className={styles.anteprimaIdentita}>
        {identita.logoUrl ? (
          <img
            src={identita.logoUrl}
            alt=""
            className={styles.anteprimaLogo}
            // Un URL sbagliato non deve lasciare l'icona rotta del browser.
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : null}
        <div>
          <p className={styles.anteprimaNome}>
            {identita.nomeVisualizzato || t('impostazioni.anteprima.nomeAssente')}
          </p>
          {identita.slogan && <p className={styles.anteprimaSlogan}>{identita.slogan}</p>}
        </div>
      </div>

      <div className={styles.anteprimaGriglia}>
        <Pastiglia
          etichetta={t('impostazioni.campi.aspetto.colorePrimario')}
          colore={aspetto.colorePrimario}
          tema={theme}
        />
        <Pastiglia
          etichetta={t('impostazioni.campi.aspetto.coloreSecondario')}
          colore={aspetto.coloreSecondario}
          tema={theme}
        />
        <Pastiglia
          etichetta={t('impostazioni.campi.aspetto.coloreAccento')}
          colore={aspetto.coloreAccento}
          tema={theme}
        />
      </div>
    </Card>
  );
};

export default AnteprimaBranding;
