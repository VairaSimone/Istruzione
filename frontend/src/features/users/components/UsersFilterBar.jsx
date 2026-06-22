import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { CLASSI, ROLE_OPTIONS } from '../../../constants/domain';
import TextField from '../../../components/ui/TextField';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';
import styles from './UsersFilterBar.module.css';

/**
 * Filtri per GET /gestione/utenti. Rispecchiano i parametri di query
 * REALMENTE supportati da `authService.getUtentiPerInsegnante`
 * (?ruolo=, ?classe=, ?nome=).
 */
const UsersFilterBar = ({ onFilterChange, currentFilters }) => {
  const { t } = useTranslation();
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
      <div className={styles.fieldNarrow}>
        <Select
          label={t('users.filters.classeLabel')}
          placeholder={t('users.filters.classeAll')}
          {...register('classe')}
        >
          {CLASSI.map((classe) => (
            <option key={classe} value={classe}>
              {t(`classi.${classe}`)}
            </option>
          ))}
        </Select>
      </div>
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
