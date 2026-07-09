import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useDeleteDomanda } from '../../../hooks/useQuizGestione';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';
import { MAX_DOMANDE_PER_QUIZ } from '../../../constants/quizGestione';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import DomandaFormModal from './DomandaFormModal';
import styles from './QuizGestione.module.css';

/**
 * Elenco e gestione delle domande di un quiz PERSONALIZZATO.
 *
 * Vista dello staff: mostra le soluzioni (opzione corretta evidenziata,
 * risposta attesa delle domande aperte). Lo studente non le riceve mai: il
 * backend le omette da `/quiz/generate` e corregge lato server.
 */
const DomandeQuizPanel = ({ quiz }) => {
  const { t } = useTranslation();
  const deleteDomanda = useDeleteDomanda();
  const [domandaInModifica, setDomandaInModifica] = useState(null);
  const [isCreateOpen, setCreateOpen] = useState(false);

  const domande = quiz.domande ?? [];
  const limiteRaggiunto = domande.length >= MAX_DOMANDE_PER_QUIZ;

  const handleDelete = async (domandaId) => {
    if (!window.confirm(t('quizGestione.domanda.deleteConfirm'))) return;
    try {
      await deleteDomanda.mutateAsync({ id: quiz.id, domandaId });
      toast.success(t('quizGestione.toast.domandaDeleted'));
    } catch (err) {
      toast.error(getApiErrorMessage(t, err));
    }
  };

  return (
    <Card>
      <div className={styles.panelHeader}>
        <div>
          <h3 className={styles.panelTitle}>{t('quizGestione.domande.title')}</h3>
          <p className={styles.mutedSmall}>
            {t('quizGestione.domande.count', { n: domande.length })}
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)} disabled={limiteRaggiunto}>
          {t('quizGestione.domande.add')}
        </Button>
      </div>

      {domande.length === 0 ? (
        <p className={styles.emptyText}>{t('quizGestione.domande.empty')}</p>
      ) : (
        <ul className={styles.domandaList}>
          {domande.map((domanda, indice) => (
            <li key={domanda.id} className={styles.domandaItem}>
              <div className={styles.domandaHead}>
                <div className={styles.domandaTitleWrap}>
                  <span className={styles.domandaOrdine}>{indice + 1}.</span>
                  <span className={styles.domandaTitle}>{domanda.testo}</span>
                </div>
                <div className={styles.domandaActions}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDomandaInModifica(domanda)}
                  >
                    {t('common.edit')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(domanda.id)}
                    isLoading={
                      deleteDomanda.isPending &&
                      deleteDomanda.variables?.domandaId === domanda.id
                    }
                  >
                    {t('common.delete')}
                  </Button>
                </div>
              </div>

              <div className={styles.domandaMeta}>
                <Badge tone="neutral">{t(`quizGestione.domanda.tipi.${domanda.tipo}`)}</Badge>
                {domanda.caseSensitive && (
                  <Badge tone="gold">{t('quizGestione.domanda.caseSensitiveBadge')}</Badge>
                )}
              </div>

              {domanda.tipo === 'risposta_breve' ? (
                <div className={styles.opzioneList}>
                  <span className={[styles.opzioneRow, styles.opzioneCorretta].join(' ')}>
                    {domanda.rispostaCorretta}
                  </span>
                  {domanda.risposteAlternative?.length > 0 && (
                    <span className={styles.opzioneRow}>
                      {t('quizGestione.domanda.alternativeLabel')}{' '}
                      {domanda.risposteAlternative.join(' · ')}
                    </span>
                  )}
                </div>
              ) : (
                <ul className={styles.opzioneList}>
                  {(domanda.opzioni ?? []).map((opzione) => (
                    <li
                      key={opzione.id}
                      className={[
                        styles.opzioneRow,
                        opzione.corretta ? styles.opzioneCorretta : '',
                      ].join(' ')}
                    >
                      <span aria-hidden="true">{opzione.corretta ? '✓' : '·'}</span>
                      {opzione.testo}
                    </li>
                  ))}
                </ul>
              )}

              {domanda.spiegazione && (
                <p className={styles.spiegazione}>{domanda.spiegazione}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      <DomandaFormModal
        isOpen={isCreateOpen}
        onClose={() => setCreateOpen(false)}
        quizId={quiz.id}
      />
      <DomandaFormModal
        isOpen={Boolean(domandaInModifica)}
        onClose={() => setDomandaInModifica(null)}
        quizId={quiz.id}
        domanda={domandaInModifica}
      />
    </Card>
  );
};

export default DomandeQuizPanel;
