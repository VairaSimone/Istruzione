import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ROLE_OPTIONS } from '../../../constants/domain';
import { useVocabolario } from '../../../hooks/useImpostazioniScuola';
import TextField from '../../../components/ui/TextField';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';
import styles from './UsersFilterBar.module.css';

/**
 * Filtri per GET /gestione/utenti. Rispecchiano i parametri di query
 * REALMENTE supportati da `authService.getUtentiPerInsegnante`
 * (?ruolo=, ?classe=, ?nome=).
 *
 * Le CLASSI arrivano dal vocabolario della scuola, non da una costante: se la
 * scuola non ne ha definito alcuno il filtro per classe non ha voci da offrire
 * e viene omesso, invece di mostrare un menu di classi che nessuno usa.
 */
const UsersFilterBar = ({ onFilterChange, currentFilters }) => {
  const { t } = useTranslation();
  const classi = useVocabolario('classiDisponibili');
  const { register, handleSubmit, reset } = useForm({
    defaultValues: currentFilters,
  });

  const onSubmit = (values) => {
    // Rimuove chiavi vuote per non inviare query string superflue
    const cleaned = Object.fromEntries(
      Object.entries(values).filter(([, v]) => v !== '' && v != null)
    );
    onFilterChange(cleaned);
  };

  const handleReset = () => {
    reset({ nome: '', ruolo: '', classe: '' });
    onFilterChange({});
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={styles.bar} noValidate>
      <div className={styles.field}>
        <TextField
          label={t('users.filters.searchLabel')}
          placeholder={t('users.filters.searchPlaceholder')}
          {...register('nome')}
        />
      </div>
      <div className={styles.fieldNarrow}>
        <Select
          label={t('users.filters.roleLabel')}
          placeholder={t('users.filters.roleAll')}
          {...register('ruolo')}
        >
          {ROLE_OPTIONS.map((role) => (
            <option key={role} value={role}>
              {t(`roles.${role}`)}
            </option>
          ))}
        </Select>
      </div>
      {classi.length > 0 ? (
        <div className={styles.fieldNarrow}>
          <Select
            label={t('users.filters.classeLabel')}
            placeholder={t('users.filters.classeAll')}
            {...register('classe')}
          >
            {classi.map((classe) => (
              <option key={classe} value={classe}>
                {classe}
              </option>
            ))}
          </Select>
        </div>
      ) : (
        <div className={styles.fieldNarrow}>
          <TextField
            label={t('users.filters.classeLabel')}
            placeholder={t('users.filters.classeAll')}
            {...register('classe')}
          />
        </div>
      )}
      <div className={styles.actions}>
        <Button type="submit" size="sm">
          {t('users.filters.submit')}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={handleReset}>
          {t('users.filters.reset')}
        </Button>
      </div>
    </form>
  );
};

export default UsersFilterBar;
