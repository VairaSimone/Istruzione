import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../../store/authStore';
import { useUpdateLanguage } from '../../../hooks/useProfileMutations';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';
import { SUPPORTED_LANGUAGES, getActiveLanguage } from '../../../i18n';
import Card from '../../../components/ui/Card';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';
import styles from './ProfileSections.module.css';

/**
 * Sezione "Lingua di preferenza" nel profilo. Oltre a persistere la scelta
 * lato backend (PATCH /me/lingua), aggiorna immediatamente l'interfaccia
 * tramite i18n.changeLanguage, senza refresh di pagina.
 */
const LanguageSection = () => {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const updateLanguageMutation = useUpdateLanguage();

  const { register, handleSubmit } = useForm({
    defaultValues: { lingua: user?.lingua || getActiveLanguage() },
  });

  const onSubmit = async (values) => {
    try {
      await updateLanguageMutation.mutateAsync(values);
      if (SUPPORTED_LANGUAGES.includes(values.lingua)) {
        await i18n.changeLanguage(values.lingua);
      }
      toast.success(t('language.updated'));
    } catch (error) {
      toast.error(getApiErrorMessage(t, error));
    }
  };

  return (
    <Card>
      <h2 className={styles.sectionTitle}>{t('profile.languageTitle')}</h2>
      <p className={styles.sectionDescription}>{t('profile.languageDescription')}</p>
      <form onSubmit={handleSubmit(onSubmit)} className={styles.inlineForm}>
        <div className={styles.inlineFormField}>
          <Select label={t('language.label')} {...register('lingua')}>
            {SUPPORTED_LANGUAGES.map((lng) => (
              <option key={lng} value={lng}>
                {t(`language.options.${lng}`)}
              </option>
            ))}
          </Select>
        </div>
        <div className={styles.inlineFormButton}>
          <Button type="submit" isLoading={updateLanguageMutation.isPending}>
            {t('profile.languageSave')}
          </Button>
        </div>
      </form>
    </Card>
  );
};

export default LanguageSection;
