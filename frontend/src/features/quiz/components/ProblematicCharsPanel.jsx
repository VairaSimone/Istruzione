import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import Badge from '../../../components/ui/Badge';
import Spinner from '../../../components/ui/Spinner';
import ErrorState from '../../../components/shared/ErrorState';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';
import { useCaratteriProblematici } from '../../../hooks/useCaratteriProblematici';
import { ALFABETI_QUIZ } from '../../../constants/quizDomain';
import styles from './ProblematicCharsPanel.module.css';

/**
 * ProblematicCharsPanel — "Caratteri problematici" + Allenamento Intensivo
 * (GET /statistiche/caratteri-problematici).
 *
 * Elenca i kana su cui l'utente sbaglia di più (per risposta e/o per ordine
 * dei tratti) e offre un pulsante per avviare un quiz mirato SOLO su quelli
 * (modalità "Allenamento Intensivo": POST /statistiche/allenamento-intensivo,
 * gestito dal genitore).
 *
 * @param {(alfabeto?: string) => void} onStartIntensivo  avvia l'allenamento
 * @param {boolean} [isStarting]  pool intensivo in generazione (disabilita CTA)
 */
const FILTRO_TUTTI = 'all';

const ProblematicCharsPanel = ({ onStartIntensivo, isStarting = false }) => {
  const { t } = useTranslation();
  const [filtro, setFiltro] = useState(FILTRO_TUTTI);

  const alfabeto = filtro === FILTRO_TUTTI ? undefined : filtro;
  const { data, isLoading, isError, error, refetch } = useCaratteriProblematici({ alfabeto });

  const caratteri = data?.caratteri || [];
  const disponibile = Boolean(data?.riepilogo?.allenamentoDisponibile) && caratteri.length > 0;

  const avvia = () => {
    if (!disponibile || isStarting) return;
    onStartIntensivo?.(alfabeto);
  };

  return (
    <Card className={styles.card}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.titolo}>{t('quiz.problematic.title')}</h3>
          <p className={styles.sottotitolo}>{t('quiz.problematic.subtitle')}</p>
        </div>

        <div className={styles.segmented} role="tablist" aria-label={t('quiz.problematic.filterLegend')}>
          {[FILTRO_TUTTI, ...ALFABETI_QUIZ].map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filtro === f}
              className={[styles.segment, filtro === f ? styles.segmentActive : ''].join(' ')}
              onClick={() => setFiltro(f)}
            >
              {f === FILTRO_TUTTI ? t('quiz.problematic.filterAll') : t(`quiz.alphabets.${f}`)}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className={styles.center}>
          <Spinner label={t('common.loading')} />
        </div>
      )}

      {isError && <ErrorState message={getApiErrorMessage(t, error)} onRetry={refetch} />}

      {data && !isLoading && (
        <>
          {caratteri.length === 0 ? (
            <p className={styles.vuoto}>{t('quiz.problematic.empty')}</p>
          ) : (
            <ul className={styles.lista}>
              {caratteri.map((c) => {
                const tassoPct = Math.round((c.tassoErrore || 0) * 100);
                return (
                  <li key={`${c.tipo}:${c.kana}`} className={styles.riga}>
                    <span className={styles.kana}>{c.kana}</span>
                    <span className={styles.romaji}>{c.romaji}</span>
                    <span className={styles.stats}>
                      {c.tentativi > 0 && (
                        <Badge tone={tassoPct >= 50 ? 'danger' : 'seal'}>
                          {t('quiz.problematic.errorRate', { rate: tassoPct })}
                        </Badge>
                      )}
                      {c.erroriTratti > 0 && (
                        <Badge tone="gold">
                          {t('quiz.problematic.strokeErrors', { count: c.erroriTratti })}
                        </Badge>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          <div className={styles.azione}>
            <Button onClick={avvia} disabled={!disponibile || isStarting}>
              {isStarting
                ? t('quiz.intensive.starting')
                : t('quiz.problematic.startIntensive', { count: caratteri.length })}
            </Button>
            {!disponibile && caratteri.length === 0 && (
              <span className={styles.suggerimento}>{t('quiz.problematic.hint')}</span>
            )}
          </div>
        </>
      )}
    </Card>
  );
};

export default ProblematicCharsPanel;
