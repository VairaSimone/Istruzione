import { useTranslation } from 'react-i18next';
import Button from '../ui/Button';
import styles from './Pagination.module.css';

/**
 * Controlli di paginazione riutilizzabili. Puramente presentazionale: riceve lo
 * stato corrente e notifica il cambio pagina al chiamante, che possiede la
 * verità (stato React / React Query). Non conosce come i dati vengono
 * recuperati.
 *
 * Riusa le chiavi i18n già presenti nel progetto (`common.previous`,
 * `common.next`, `common.pageOf`) e la variante `secondary`, allineandosi al
 * pattern di paginazione già usato in CompitiListPage/CorsiListPage.
 *
 * @param {number}   paginaCorrente   pagina attiva (1-based)
 * @param {number}   totalePagine     numero totale di pagine
 * @param {boolean}  [isFetching]     disabilita i controlli durante il fetch
 * @param {(pagina:number)=>void} onPageChange
 */
const Pagination = ({
  paginaCorrente,
  totalePagine,
  isFetching = false,
  onPageChange,
}) => {
  const { t } = useTranslation();

  // Una sola pagina (o nessun dato): non c'è nulla da paginare.
  if (!totalePagine || totalePagine <= 1) return null;

  const puoIndietro = paginaCorrente > 1 && !isFetching;
  const puoAvanti = paginaCorrente < totalePagine && !isFetching;

  return (
    <nav
      className={styles.pagination}
      aria-label={t('common.pageOf', { page: paginaCorrente, total: totalePagine })}
    >
      <Button
        variant="secondary"
        size="sm"
        disabled={!puoIndietro}
        onClick={() => onPageChange(paginaCorrente - 1)}
      >
        {t('common.previous')}
      </Button>

      <span className={styles.pageInfo} aria-live="polite">
        {t('common.pageOf', { page: paginaCorrente, total: totalePagine })}
      </span>

      <Button
        variant="secondary"
        size="sm"
        disabled={!puoAvanti}
        onClick={() => onPageChange(paginaCorrente + 1)}
      >
        {t('common.next')}
      </Button>
    </nav>
  );
};

export default Pagination;
