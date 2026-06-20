import { useForm } from 'react-hook-form';
import { CLASSI, ROLE_OPTIONS } from '../../../constants/domain';
import TextField from '../../../components/ui/TextField';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';
import styles from './UsersFilterBar.module.css';

/**
 * Filtri per GET /gestione/utenti. Rispecchiano i parametri di query
 * REALMENTE supportati da `authService.getUtentiPerInsegnante`
 * (?ruolo=, ?classe=, ?nome=) — non sono inventati: confermati leggendo
 * il sorgente del backend, anche se non esplicitati nella documentazione.
 */
const UsersFilterBar = ({ onFilterChange, currentFilters }) => {
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
          label="Cerca per nome o cognome"
          placeholder="Es. Tanaka"
          {...register('nome')}
        />
      </div>
      <div className={styles.fieldNarrow}>
        <Select label="Ruolo" placeholder="Tutti" {...register('ruolo')}>
          {ROLE_OPTIONS.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </Select>
      </div>
      <div className={styles.fieldNarrow}>
        <Select label="Classe" placeholder="Tutte" {...register('classe')}>
          {CLASSI.map((classe) => (
            <option key={classe} value={classe}>
              {classe}
            </option>
          ))}
        </Select>
      </div>
      <div className={styles.actions}>
        <Button type="submit" size="sm">
          Filtra
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={handleReset}>
          Reimposta
        </Button>
      </div>
    </form>
  );
};

export default UsersFilterBar;
