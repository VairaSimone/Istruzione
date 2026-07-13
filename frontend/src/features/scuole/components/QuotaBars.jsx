import { useTranslation } from 'react-i18next';
import styles from './QuotaBars.module.css';

/**
 * QuotaBars — resa presentazionale dell'occupazione quota di una scuola.
 *
 * Riceve l'oggetto `quota` così com'è restituito dal backend
 * (`{ storage, utenti, insegnanti }`) e disegna tre barre «usato / limite».
 * Non fa fetch: la sorgente dati è responsabilità del chiamante (pannello staff
 * o modale admin). Le quote illimitate mostrano un tratteggio tenue e la dicitura
 * «Illimitato», senza percentuale.
 */

/** Formatta un valore in GB in modo compatto (fino a 2 decimali, senza zeri inutili). */
const formattaGb = (gb) => {
  if (gb === null || gb === undefined) return null;
  const n = Number(gb);
  if (!Number.isFinite(n)) return null;
  if (n === 0) return '0';
  // Mostra 2 decimali sotto i 10 GB, altrimenti 1, e toglie gli zeri finali.
  const decimali = n < 10 ? 2 : 1;
  return n.toFixed(decimali).replace(/\.?0+$/, '');
};

const classeSoglia = (percentuale, styleModule) => {
  if (percentuale === null || percentuale === undefined) return '';
  if (percentuale >= 95) return styleModule.danger;
  if (percentuale >= 75) return styleModule.warn;
  return '';
};

const Barra = ({ label, valoreTesto, percentuale, illimitato }) => (
  <div className={styles.row}>
    <div className={styles.head}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{valoreTesto}</span>
    </div>
    <div className={[styles.track, illimitato ? styles.unlimited : ''].join(' ')}>
      {!illimitato && (
        <div
          className={[styles.fill, classeSoglia(percentuale, styles)].join(' ')}
          style={{ width: `${Math.min(100, Math.max(2, percentuale ?? 0))}%` }}
        />
      )}
    </div>
  </div>
);

const QuotaBars = ({ quota }) => {
  const { t } = useTranslation();
  if (!quota) return null;

  const { storage, utenti, insegnanti } = quota;

  const testoStorage = storage.illimitato
    ? t('scuole.quota.illimitato')
    : t('scuole.quota.valoreGb', {
        usato: formattaGb(storage.usatoGb) ?? '0',
        limite: formattaGb(storage.limiteGb) ?? '0',
      });

  const testoConteggio = (sezione) =>
    sezione.illimitato
      ? t('scuole.quota.illimitato')
      : t('scuole.quota.valoreConteggio', { usato: sezione.occupati, limite: sezione.limite });

  return (
    <div className={styles.wrap}>
      <Barra
        label={t('scuole.quota.storage')}
        valoreTesto={testoStorage}
        percentuale={storage.percentuale}
        illimitato={storage.illimitato}
      />
      <Barra
        label={t('scuole.quota.utenti')}
        valoreTesto={testoConteggio(utenti)}
        percentuale={utenti.percentuale}
        illimitato={utenti.illimitato}
      />
      <Barra
        label={t('scuole.quota.insegnanti')}
        valoreTesto={testoConteggio(insegnanti)}
        percentuale={insegnanti.percentuale}
        illimitato={insegnanti.illimitato}
      />
    </div>
  );
};

export default QuotaBars;
