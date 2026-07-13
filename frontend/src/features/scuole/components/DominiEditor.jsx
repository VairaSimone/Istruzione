import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { buildDominioSchema } from '../../../validators/contattiSchemas';
import {
  useDomini,
  useAddDominio,
  useUpdateDominio,
  useDeleteDominio,
} from '../../../hooks/useDomini';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import TextField from '../../../components/ui/TextField';
import Spinner from '../../../components/ui/Spinner';
import ErrorState from '../../../components/shared/ErrorState';
import ConfirmDialog from '../../../components/shared/ConfirmDialog';
import styles from './Domini.module.css';

/**
 * Editor dei DOMINI PERSONALIZZATI di una scuola.
 *
 * Serve alle scuole per collegare un proprio dominio (`liceo-manzoni.it`) su cui
 * la piattaforma mostra la loro homepage. Un dominio funziona solo quando è
 * VERIFICATO (fail-closed):
 *   - lo STAFF può aggiungerlo/rimuoverlo, ma non verificarlo (nasce "in attesa");
 *   - l'ADMIN (mode con `scuolaId`) può anche verificarlo, dopo aver accertato
 *     il puntamento DNS.
 *
 * @param {string}  [scuolaId]  se presente ⇒ modalità admin (verifica abilitata)
 * @param {boolean} [isAdmin]   abilita i controlli di verifica
 */
const DominiEditor = ({ scuolaId, isAdmin = false }) => {
  const { t } = useTranslation();

  const dominiQuery = useDomini(scuolaId);
  const addDominio = useAddDominio();
  const updateDominio = useUpdateDominio();
  const deleteDominio = useDeleteDominio();

  const [daEliminare, setDaEliminare] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(buildDominioSchema(t)), defaultValues: { dominio: '', note: '' } });

  const domini = dominiQuery.data ?? [];

  const onAdd = async (values) => {
    try {
      await addDominio.mutateAsync({
        scuolaId,
        dominio: values.dominio,
        note: values.note || undefined,
      });
      reset({ dominio: '', note: '' });
      toast.success(t('domini.toast.aggiunto'));
    } catch (err) {
      setError('dominio', { type: 'server', message: getApiErrorMessage(t, err) });
    }
  };

  const impostaPrincipale = async (dominio) => {
    try {
      await updateDominio.mutateAsync({ scuolaId, dominioId: dominio.id, principale: true });
      toast.success(t('domini.toast.principale'));
    } catch (err) {
      toast.error(getApiErrorMessage(t, err));
    }
  };

  const verifica = async (dominio, verificato) => {
    try {
      await updateDominio.mutateAsync({ scuolaId, dominioId: dominio.id, verificato });
      toast.success(verificato ? t('domini.toast.verificato') : t('domini.toast.sospeso'));
    } catch (err) {
      toast.error(getApiErrorMessage(t, err));
    }
  };

  const confermaElimina = async () => {
    if (!daEliminare) return;
    try {
      await deleteDominio.mutateAsync({ scuolaId, dominioId: daEliminare.id });
      toast.success(t('domini.toast.rimosso'));
    } catch (err) {
      toast.error(getApiErrorMessage(t, err));
    } finally {
      setDaEliminare(null);
    }
  };

  return (
    <Card className={styles.card}>
      <header className={styles.head}>
        <h2 className={styles.titolo}>{t('domini.titolo')}</h2>
        <p className={styles.descrizione}>{t('domini.descrizione')}</p>
      </header>

      {/* Aggiunta */}
      <form className={styles.addForm} onSubmit={handleSubmit(onAdd)} noValidate>
        <TextField
          label={t('domini.campo.dominio')}
          placeholder="liceo-manzoni.it"
          {...register('dominio')}
          error={errors.dominio?.message}
          hint={t('domini.campo.dominioHint')}
        />
        <TextField
          label={t('domini.campo.note')}
          {...register('note')}
          error={errors.note?.message}
        />
        <div className={styles.addAzione}>
          <Button type="submit" isLoading={addDominio.isPending}>
            {t('domini.aggiungi')}
          </Button>
        </div>
      </form>

      {/* Elenco */}
      {dominiQuery.isLoading ? (
        <Spinner label={t('common.loading')} />
      ) : dominiQuery.isError ? (
        <ErrorState
          message={getApiErrorMessage(t, dominiQuery.error)}
          onRetry={dominiQuery.refetch}
        />
      ) : domini.length === 0 ? (
        <p className={styles.vuoto}>{t('domini.vuoto')}</p>
      ) : (
        <ul className={styles.lista}>
          {domini.map((d) => (
            <li key={d.id} className={styles.riga}>
              <div className={styles.info}>
                <span className={styles.dominio}>{d.dominio}</span>
                <span className={styles.badges}>
                  {d.principale && <Badge tone="seal">{t('domini.badge.principale')}</Badge>}
                  {d.verificato ? (
                    <Badge tone="matcha">{t('domini.badge.verificato')}</Badge>
                  ) : (
                    <Badge tone="gold">{t('domini.badge.inAttesa')}</Badge>
                  )}
                </span>
                {!d.verificato && !isAdmin && (
                  <span className={styles.attesaNota}>{t('domini.attesaNota')}</span>
                )}
              </div>
              <div className={styles.azioni}>
                {!d.principale && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => impostaPrincipale(d)}
                    isLoading={updateDominio.isPending}
                  >
                    {t('domini.azione.principale')}
                  </Button>
                )}
                {isAdmin && (
                  <Button
                    variant={d.verificato ? 'ghost' : 'secondary'}
                    size="sm"
                    onClick={() => verifica(d, !d.verificato)}
                    isLoading={updateDominio.isPending}
                  >
                    {d.verificato ? t('domini.azione.sospendi') : t('domini.azione.verifica')}
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setDaEliminare(d)}>
                  {t('common.delete')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        isOpen={Boolean(daEliminare)}
        title={t('domini.elimina.titolo')}
        description={t('domini.elimina.descrizione', { dominio: daEliminare?.dominio ?? '' })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        isLoading={deleteDominio.isPending}
        onConfirm={confermaElimina}
        onCancel={() => setDaEliminare(null)}
      />
    </Card>
  );
};

export default DominiEditor;
