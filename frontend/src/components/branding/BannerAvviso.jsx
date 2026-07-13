import { useTranslation } from 'react-i18next';
import { useBranding } from '../../hooks/useConfig';
import styles from './BannerAvviso.module.css';

/**
 * BANNER DI AVVISO della scuola.
 *
 * Striscia informativa configurata in `impostazioni.comunicazioni` e servita
 * dalla vista pubblica (`GET /api/config`). Compare solo se la scuola l'ha
 * attivata e ha scritto un testo; altrimenti non rende nulla. È volutamente
 * NON chiudibile: è una comunicazione istituzionale (iscrizioni, chiusure,
 * manutenzioni), non una notifica personale.
 *
 * Il tono (`avvisoTipo`) sceglie colore e icona; il testo può contenere ritorni
 * a capo (resi con `white-space: pre-line`). Un eventuale link d'azione apre in
 * una nuova scheda se assoluto, resta nell'app se relativo.
 */
const ICONE = {
  informazione: 'ℹ️',
  attenzione: '⚠️',
  successo: '✅',
};

const BannerAvviso = () => {
  const { t } = useTranslation();
  const branding = useBranding();
  const avviso = branding.comunicazioni ?? {};

  const attivo = avviso.avvisoAttivo === true && Boolean(avviso.avvisoTesto);
  if (!attivo) return null;

  const tipo = ICONE[avviso.avvisoTipo] ? avviso.avvisoTipo : 'informazione';
  const linkUrl = avviso.avvisoLinkUrl || null;
  const linkEtichetta = avviso.avvisoLinkEtichetta || null;
  const esterno = linkUrl ? /^https?:\/\//i.test(linkUrl) : false;

  return (
    <div
      className={[styles.banner, styles[tipo]].join(' ')}
      role="status"
      aria-label={t('avviso.aria')}
    >
      <span className={styles.icona} aria-hidden="true">
        {ICONE[tipo]}
      </span>
      <p className={styles.testo}>{avviso.avvisoTesto}</p>
      {linkUrl && linkEtichetta && (
        <a
          className={styles.azione}
          href={linkUrl}
          {...(esterno ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          {linkEtichetta}
        </a>
      )}
    </div>
  );
};

export default BannerAvviso;
