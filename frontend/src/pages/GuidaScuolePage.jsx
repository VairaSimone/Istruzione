import { useTranslation } from 'react-i18next';
import PaginaLegale from '../components/shared/PaginaLegale';
import { contenutoGuida } from '../constants/guidaContenuti';

/**
 * Guida per le scuole, consultabile in-app dallo staff (insegnanti e admin).
 *
 * Riusa l'impaginazione di `PaginaLegale` (un solo <h1>, sezioni con <h2>,
 * paragrafi accessibili) e il contenuto strutturato, versionato per lingua, di
 * `constants/guidaContenuti`. La rotta è protetta ai ruoli insegnante/admin in
 * `routes/router.jsx`; qui la pagina si limita a scegliere la lingua e a
 * renderizzare il contenuto.
 */
const GuidaScuolePage = () => {
  const { i18n } = useTranslation();
  const lingua = (i18n.language || 'it').slice(0, 2);

  return <PaginaLegale contenuto={contenutoGuida(lingua)} />;
};

export default GuidaScuolePage;
