import { useTranslation } from 'react-i18next';
import PaginaLegale from '../components/shared/PaginaLegale';
import Button from '../components/ui/Button';
import { contenutoLegale } from '../constants/legaleContenuti';
import { useConsensoStore } from '../store/consensoStore';
import styles from '../components/shared/PaginaLegale.module.css';

const CookiePolicyPage = () => {
  const { t, i18n } = useTranslation();
  const lingua = (i18n.language || 'it').slice(0, 2);
  const riapri = useConsensoStore((state) => state.riapri);

  return (
    <PaginaLegale contenuto={contenutoLegale('cookie', lingua)}>
      <div className={styles.reportBox}>
        <h2>{t('cookie.gestisciTitolo')}</h2>
        <p className={styles.paragraph}>{t('cookie.gestisciTesto')}</p>
        <Button variant="secondary" onClick={riapri}>
          {t('cookie.gestisci')}
        </Button>
      </div>
    </PaginaLegale>
  );
};

export default CookiePolicyPage;
