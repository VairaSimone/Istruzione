import { useTranslation } from 'react-i18next';
import PaginaLegale from '../components/shared/PaginaLegale';
import { contenutoLegale } from '../constants/legaleContenuti';

const TerminiPage = () => {
  const { i18n } = useTranslation();
  const lingua = (i18n.language || 'it').slice(0, 2);
  return <PaginaLegale contenuto={contenutoLegale('termini', lingua)} />;
};

export default TerminiPage;
