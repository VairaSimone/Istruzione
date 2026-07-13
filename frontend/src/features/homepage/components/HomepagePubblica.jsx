import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../../../constants/routes';
import { TIPI_RICHIESTA } from '../../../validators/contattiSchemas';
import BrandLogo from '../../../components/branding/BrandLogo';
import Button from '../../../components/ui/Button';
import ContattoForm from './ContattoForm';
import styles from './Homepage.module.css';

/**
 * HOMEPAGE PUBBLICA personalizzata dalla scuola, mostrata quando
 * `impostazioni.homepage.attiva` è vera (tipicamente sul dominio della scuola).
 *
 * Rende, con i contenuti curati dalla scuola:
 *   - una HERO (titolo, sottotitolo, immagine, pulsante d'azione);
 *   - una o più SEZIONI descrittive;
 *   - il FORM di contatto/iscrizione (se abilitato).
 *
 * Tutti i testi sono della scuola; l'i18n copre solo le etichette di sistema
 * (pulsanti, titolo del form). Se un blocco è vuoto, semplicemente non compare.
 *
 * @param {object} branding  output di `useBranding()`
 */
const HomepagePubblica = ({ branding }) => {
  const { t } = useTranslation();
  const homepage = branding.homepage ?? {};
  const hero = homepage.hero ?? {};
  const sezioni = Array.isArray(homepage.sezioni) ? homepage.sezioni : [];
  const form = homepage.form ?? {};
  const formAbilitato = form.abilitato !== false;
  const tipiRichiesta = Array.isArray(form.tipiRichiesta) && form.tipiRichiesta.length
    ? form.tipiRichiesta
    : TIPI_RICHIESTA;

  // La CTA della hero può preselezionare un tipo di richiesta e portare al form.
  const [tipoIniziale, setTipoIniziale] = useState(undefined);

  const titolo = hero.titolo || branding.nome;
  const sottotitolo = hero.sottotitolo || branding.slogan || branding.descrizione || '';
  const immagine = hero.immagineUrl || branding.immagineHeroUrl || null;

  // Azione del pulsante principale della hero.
  const tipoAzione = hero.tipoAzione || 'contatti';
  const testoAzione =
    hero.testoAzione ||
    (tipoAzione === 'accedi'
      ? t('home.login')
      : tipoAzione === 'iscriviti'
        ? t('contatti.cta.iscriviti')
        : t('contatti.cta.contatti'));

  const vaiAlForm = (tipo) => {
    setTipoIniziale(tipo);
    const nodo = document.getElementById('contatto-form');
    if (nodo) nodo.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const renderAzione = () => {
    if (tipoAzione === 'nessuna') return null;
    if (tipoAzione === 'accedi') {
      return (
        <Link to={ROUTES.LOGIN}>
          <Button size="lg">{testoAzione}</Button>
        </Link>
      );
    }
    // 'iscriviti' | 'contatti' → porta al form, preselezionando il tipo.
    const tipo = tipoAzione === 'iscriviti' ? 'iscrizione' : 'contatto';
    const disponibile = !formAbilitato || tipiRichiesta.includes(tipo);
    return (
      <Button size="lg" onClick={() => vaiAlForm(disponibile ? tipo : tipiRichiesta[0])}>
        {testoAzione}
      </Button>
    );
  };

  return (
    <div className={styles.pagina}>
      <section className={styles.heroSezione}>
        <BrandLogo size="lg" className={styles.heroMark} />
        <h1 className={styles.heroTitolo}>{titolo}</h1>
        {sottotitolo && <p className={styles.heroSottotitolo}>{sottotitolo}</p>}

        <div className={styles.heroAzioni}>
          {renderAzione()}
          <Link to={ROUTES.LOGIN} className={styles.heroAccedi}>
            {t('home.haveAccount')}
          </Link>
        </div>

        {immagine && (
          <img
            src={immagine}
            alt=""
            className={styles.heroImmagine}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        )}
      </section>

      {sezioni.length > 0 && (
        <div className={styles.sezioni}>
          {sezioni.map((sez, i) => (
            <section key={i} className={styles.sezione}>
              {sez.immagineUrl && (
                <img
                  src={sez.immagineUrl}
                  alt=""
                  className={styles.sezioneImmagine}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              )}
              <div className={styles.sezioneTesto}>
                {sez.titolo && <h2 className={styles.sezioneTitolo}>{sez.titolo}</h2>}
                {sez.testo && <p className={styles.sezioneCorpo}>{sez.testo}</p>}
              </div>
            </section>
          ))}
        </div>
      )}

      {formAbilitato && (
        <section className={styles.formSezione} aria-labelledby="contatto-titolo">
          <h2 id="contatto-titolo" className={styles.formTitolo}>
            {t('contatti.form.titolo')}
          </h2>
          <p className={styles.formIntro}>{t('contatti.form.intro', { scuola: branding.nome })}</p>
          <ContattoForm id="contatto-form" tipiRichiesta={tipiRichiesta} tipoIniziale={tipoIniziale} />
        </section>
      )}
    </div>
  );
};

export default HomepagePubblica;
