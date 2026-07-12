import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useBranding } from '../../hooks/useConfig';
import { ROUTES } from '../../constants/routes';
import { useConsensoStore } from '../../store/consensoStore';
import styles from './Footer.module.css';

/** Reti social riconosciute, nell'ordine in cui vanno mostrate. */
const RETI = ['facebook', 'instagram', 'x', 'linkedin', 'youtube', 'tiktok', 'telegram'];

/**
 * Un link del footer. Gli URL relativi (`/privacy`) restano dentro l'app e
 * usano il router; quelli assoluti aprono una nuova scheda con `noopener`,
 * perché puntano a domini che non controlliamo.
 */
const LinkFooter = ({ etichetta, url }) => {
  if (!url) return null;

  const esterno = /^https?:\/\//i.test(url);
  if (esterno) {
    return (
      <a href={url} className={styles.link} target="_blank" rel="noopener noreferrer">
        {etichetta || url}
      </a>
    );
  }
  return (
    <Link to={url} className={styles.link}>
      {etichetta || url}
    </Link>
  );
};

/**
 * Piè di pagina della scuola.
 *
 * Prima della generalizzazione era una riga sola con il nome della piattaforma.
 * Ora tutto ciò che compare — testo, link, contatti, indirizzo, social — arriva
 * dalle impostazioni della scuola. Ogni blocco scompare se la scuola non l'ha
 * compilato: un footer con etichette vuote è peggio di un footer minimale.
 *
 * `mostraCredits` è l'unica riga che la piattaforma si riserva, e la scuola può
 * comunque disattivarla.
 */
const Footer = () => {
  const { t } = useTranslation();
  const branding = useBranding();
  const riapriConsenso = useConsensoStore((state) => state.riapri);

  const { contatti, indirizzo, social, footer, nome, piattaforma } = branding;

  const link = Array.isArray(footer?.link) ? footer.link : [];
  const altriSocial = Array.isArray(social?.altri) ? social.altri : [];
  const retiPresenti = RETI.filter((rete) => Boolean(social?.[rete]));

  const rigaIndirizzo = [
    indirizzo?.via,
    indirizzo?.cap,
    indirizzo?.citta,
    indirizzo?.provincia,
    indirizzo?.paese,
  ]
    .filter(Boolean)
    .join(', ');

  const haContatti = Boolean(contatti?.email || contatti?.telefono || contatti?.sitoWeb);
  const haSocial = retiPresenti.length > 0 || altriSocial.length > 0;
  const mostraCredits = footer?.mostraCredits !== false;

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        {footer?.testo && <p className={styles.testo}>{footer.testo}</p>}

        {link.length > 0 && (
          <nav className={styles.links} aria-label={t('footer.linkAria')}>
            {link.map((voce, i) => (
              <LinkFooter key={`${voce.url}-${i}`} etichetta={voce.etichetta} url={voce.url} />
            ))}
          </nav>
        )}

        {haContatti && (
          <div className={styles.contatti}>
            {contatti.email && (
              <a href={`mailto:${contatti.email}`} className={styles.link}>
                {contatti.email}
              </a>
            )}
            {contatti.telefono && (
              <a href={`tel:${contatti.telefono.replace(/\s+/g, '')}`} className={styles.link}>
                {contatti.telefono}
              </a>
            )}
            {contatti.sitoWeb && (
              <a
                href={contatti.sitoWeb}
                className={styles.link}
                target="_blank"
                rel="noopener noreferrer"
              >
                {contatti.sitoWeb.replace(/^https?:\/\//i, '')}
              </a>
            )}
          </div>
        )}

        {rigaIndirizzo && <p className={styles.indirizzo}>{rigaIndirizzo}</p>}

        {haSocial && (
          <nav className={styles.social} aria-label={t('footer.socialAria')}>
            {retiPresenti.map((rete) => (
              <a
                key={rete}
                href={social[rete]}
                className={styles.link}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t(`impostazioni.social.${rete}`)}
              </a>
            ))}
            {altriSocial.map((voce, i) => (
              <LinkFooter key={`altro-${i}`} etichetta={voce.etichetta} url={voce.url} />
            ))}
          </nav>
        )}

        {/* Link legali sempre presenti: obbligo di trasparenza e conformità,
            indipendente dalla configurazione della scuola. */}
        <nav className={styles.links} aria-label={t('footer.legaleAria')}>
          <Link to={ROUTES.PRIVACY} className={styles.link}>
            {t('footer.legale.privacy')}
          </Link>
          <Link to={ROUTES.COOKIE} className={styles.link}>
            {t('footer.legale.cookie')}
          </Link>
          <Link to={ROUTES.TERMINI} className={styles.link}>
            {t('footer.legale.termini')}
          </Link>
          <Link to={ROUTES.ACCESSIBILITA} className={styles.link}>
            {t('footer.legale.accessibilita')}
          </Link>
          <button type="button" className={styles.linkButton} onClick={riapriConsenso}>
            {t('footer.legale.gestisciCookie')}
          </button>
        </nav>

        <span className={styles.copyright}>
          {nome} — © {new Date().getFullYear()}
          {mostraCredits && piattaforma?.nome && nome !== piattaforma.nome && (
            <span className={styles.credits}>
              {' · '}
              {t('footer.credits', { piattaforma: piattaforma.nome })}
            </span>
          )}
        </span>
      </div>
    </footer>
  );
};

export default Footer;
