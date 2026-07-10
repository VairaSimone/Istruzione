import { useTranslation } from 'react-i18next';
import { useScuolePubbliche } from '../../hooks/useConfig';
import { getScuolaSlug, setScuolaSlug, tenantBloccato } from '../../api/tenant';
import styles from './ScuolaSwitcher.module.css';

/**
 * Selettore della SCUOLA (tenant), visibile prima del login.
 *
 * Ha senso solo in un deploy che serve più scuole dallo stesso indirizzo. Si
 * nasconde da sé quando:
 *   - la build è dedicata a una scuola (`VITE_SCUOLA_SLUG`);
 *   - il backend espone una sola scuola, o nessuna;
 *   - l'utente è autenticato (la sua scuola è quella del suo account: cambiarla
 *     dal menu non avrebbe alcun effetto e sarebbe solo fuorviante).
 *
 * Cambiare scuola ricarica la pagina. È volutamente brutale: branding, tema,
 * sezioni attive e cache di React Query dipendono tutti dal tenant, e un
 * ricaricamento è più onesto — e più sicuro — di una invalidazione parziale.
 */
const ScuolaSwitcher = ({ visibile = true }) => {
  const { t } = useTranslation();
  const { data: scuole = [] } = useScuolePubbliche();

  if (!visibile || tenantBloccato() || scuole.length < 2) return null;

  const attuale = getScuolaSlug() ?? '';

  const onChange = (event) => {
    const slug = event.target.value;
    if (!slug || slug === attuale) return;
    if (setScuolaSlug(slug)) window.location.reload();
  };

  return (
    <label className={styles.wrapper}>
      <span className={styles.srOnly}>{t('scuole.switcher.label')}</span>
      <select
        className={styles.select}
        value={attuale}
        onChange={onChange}
        aria-label={t('scuole.switcher.label')}
      >
        {attuale === '' && (
          <option value="" disabled>
            {t('scuole.switcher.placeholder')}
          </option>
        )}
        {scuole.map((scuola) => (
          <option key={scuola.slug} value={scuola.slug}>
            {scuola.nome}
          </option>
        ))}
      </select>
    </label>
  );
};

export default ScuolaSwitcher;
