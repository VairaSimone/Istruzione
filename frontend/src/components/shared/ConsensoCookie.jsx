import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  useConsensoStore,
  selectDeciso,
  selectConsenso,
  CATEGORIE_COOKIE,
} from '../../store/consensoStore';
import { ROUTES } from '../../constants/routes';
import Button from '../ui/Button';
import Checkbox from '../ui/Checkbox';
import styles from './ConsensoCookie.module.css';

/**
 * Banner di consenso cookie (Provvedimento Garante 10/06/2021).
 *
 * Regole rispettate:
 *  - i cookie non necessari restano DISATTIVI finché l'utente non li attiva;
 *  - «Rifiuta» è presentato con lo stesso rilievo di «Accetta» (nessuna dark
 *    pattern, niente accettazione implicita da scroll o da chiusura);
 *  - il consenso granulare è disponibile tramite «Personalizza».
 *
 * Montato una sola volta in AppLayout: si mostra finché non è stata effettuata
 * una scelta (o quando l'utente riapre la gestione dal footer/cookie policy).
 */
const ConsensoCookie = () => {
  const { t } = useTranslation();
  const deciso = useConsensoStore(selectDeciso);
  const consensoSalvato = useConsensoStore(selectConsenso);
  const accettaTutti = useConsensoStore((s) => s.accettaTutti);
  const rifiutaNonNecessari = useConsensoStore((s) => s.rifiutaNonNecessari);
  const salvaPreferenze = useConsensoStore((s) => s.salvaPreferenze);

  const [personalizza, setPersonalizza] = useState(false);
  const [bozza, setBozza] = useState(consensoSalvato);

  if (deciso) return null;

  const toggleCategoria = (categoria) =>
    setBozza((prev) => ({ ...prev, [categoria]: !prev[categoria] }));

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="false"
      aria-labelledby="consenso-cookie-titolo"
      aria-describedby="consenso-cookie-testo"
    >
      <div className={styles.banner}>
        <div className={styles.testoBox}>
          <h2 id="consenso-cookie-titolo" className={styles.titolo}>
            {t('cookie.bannerTitolo')}
          </h2>
          <p id="consenso-cookie-testo" className={styles.testo}>
            {t('cookie.bannerTesto')}{' '}
            <Link to={ROUTES.COOKIE} className={styles.link}>
              {t('cookie.bannerLink')}
            </Link>
          </p>
        </div>

        {personalizza && (
          <fieldset className={styles.preferenze}>
            <legend className={styles.legend}>{t('cookie.preferenzeTitolo')}</legend>

            <Checkbox
              label={t('cookie.catNecessari')}
              hint={t('cookie.catNecessariHint')}
              checked
              disabled
              readOnly
            />
            {CATEGORIE_COOKIE.map((cat) => (
              <Checkbox
                key={cat}
                label={t(`cookie.cat_${cat}`)}
                hint={t(`cookie.cat_${cat}_hint`)}
                checked={bozza[cat]}
                onChange={() => toggleCategoria(cat)}
              />
            ))}
          </fieldset>
        )}

        <div className={styles.azioni}>
          {personalizza ? (
            <Button variant="primary" onClick={() => salvaPreferenze(bozza)}>
              {t('cookie.salva')}
            </Button>
          ) : (
            <Button
              variant="secondary"
              onClick={() => {
                setBozza(consensoSalvato);
                setPersonalizza(true);
              }}
            >
              {t('cookie.personalizza')}
            </Button>
          )}
          {/* Rifiuta con lo stesso rilievo visivo di Accetta. */}
          <Button variant="secondary" onClick={rifiutaNonNecessari}>
            {t('cookie.rifiuta')}
          </Button>
          <Button variant="primary" onClick={accettaTutti}>
            {t('cookie.accetta')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ConsensoCookie;
