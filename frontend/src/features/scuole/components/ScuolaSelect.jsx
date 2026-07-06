import { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useScuoleList } from '../../../hooks/useScuole';
import Select from '../../../components/ui/Select';

/**
 * <select> delle scuole, popolato via `useScuoleList` (solo admin).
 * Pensato per essere usato con react-hook-form: si passa `{...register('scuolaId')}`
 * e il componente inoltra name/ref/onChange al <select> sottostante, aggiungendo
 * le <option> con l'elenco delle scuole.
 *
 * Durante il caricamento mostra un placeholder disabilitato; in caso di elenco
 * vuoto invita a creare prima una scuola.
 */
const ScuolaSelect = forwardRef(({ label, error, required, ...rest }, ref) => {
  const { t } = useTranslation();
  const { data, isLoading } = useScuoleList();
  const scuole = data?.scuole ?? [];

  const placeholder = isLoading
    ? t('common.loading')
    : scuole.length === 0
      ? t('scuole.select.empty')
      : t('scuole.select.placeholder');

  return (
    <Select
      ref={ref}
      label={label ?? t('scuole.select.label')}
      required={required}
      error={error}
      placeholder={placeholder}
      disabled={isLoading || scuole.length === 0}
      {...rest}
    >
      {scuole.map((scuola) => (
        <option key={scuola.id} value={scuola.id}>
          {scuola.nome}
        </option>
      ))}
    </Select>
  );
});

ScuolaSelect.displayName = 'ScuolaSelect';

export default ScuolaSelect;
