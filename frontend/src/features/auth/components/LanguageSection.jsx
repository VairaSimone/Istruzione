import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../../store/authStore';
import { useUpdateLanguage } from '../../../hooks/useProfileMutations';
import { parseApiError } from '../../../utils/parseApiError';
import { LINGUA_OPTIONS } from '../../../constants/domain';
import Card from '../../../components/ui/Card';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';
import styles from './ProfileSections.module.css';

const LanguageSection = () => {
  const user = useAuthStore((state) => state.user);
  const updateLanguageMutation = useUpdateLanguage();

  const { register, handleSubmit } = useForm({
    defaultValues: { lingua: user?.lingua || 'it' },
  });

  const onSubmit = async (values) => {
    try {
      await updateLanguageMutation.mutateAsync(values);
      toast.success('Lingua aggiornata con successo.');
    } catch (error) {
      toast.error(parseApiError(error).message);
    }
  };

  return (
    <Card>
      <h2 className={styles.sectionTitle}>Lingua di preferenza</h2>
      <p className={styles.sectionDescription}>
        Determina la lingua usata nelle email automatiche inviate dalla piattaforma.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className={styles.inlineForm}>
        <div className={styles.inlineFormField}>
          <Select label="Lingua" {...register('lingua')}>
            {LINGUA_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
        <div className={styles.inlineFormButton}>
          <Button type="submit" isLoading={updateLanguageMutation.isPending}>
            Salva
          </Button>
        </div>
      </form>
    </Card>
  );
};

export default LanguageSection;
