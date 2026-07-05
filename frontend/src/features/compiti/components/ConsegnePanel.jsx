import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useConsegne } from '../../../hooks/useCompiti';
import { STATO_STUDENTE_TONE } from '../statoTone';
import ValutaModal from './ValutaModal';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import Spinner from '../../../components/ui/Spinner';
import styles from './Compiti.module.css';

/**
 * Elenca lo stato di ogni studente destinatario del compito (assegnato /
 * in scadenza / scaduto / completato) con azione di valutazione.
 */
const ConsegnePanel = ({ compito }) => {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useConsegne(compito.id);
  const [rigaAttiva, setRigaAttiva] = useState(null);

  const consegne = data?.consegne ?? [];

  return (
    <Card>
      <h3 className={styles.panelTitle}>{t('compiti.detail.submissionsTitle')}</h3>

      {isLoading && <Spinner />}
      {isError && <p className={styles.emptyText}>{t('compiti.detail.submissionsError')}</p>}

      {!isLoading && !isError && consegne.length === 0 && (
        <p className={styles.emptyText}>{t('compiti.detail.noSubmissions')}</p>
      )}

      {consegne.length > 0 && (
        <ul className={styles.memberList}>
          {consegne.map((riga) => (
            <li key={riga.studente.id} className={styles.memberRow}>
              <div className={styles.assegnInfo}>
                <span className={styles.memberName}>
                  {riga.studente.nome} {riga.studente.cognome}
                </span>
                <Badge tone={STATO_STUDENTE_TONE[riga.stato] || 'neutral'}>
                  {t(`compiti.statiStudente.${riga.stato}`)}
                </Badge>
                {riga.consegna?.punteggioOttenuto != null && (
                  <span className={styles.mutedSmall}>
                    {t('compiti.detail.score', {
                      punteggio: riga.consegna.punteggioOttenuto,
                      max: compito.punteggioMassimo,
                    })}
                  </span>
                )}
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setRigaAttiva(riga)}
                disabled={!riga.consegna}
                title={!riga.consegna ? t('compiti.detail.notSubmittedYet') : undefined}
              >
                {t('compiti.detail.grade')}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <ValutaModal
        isOpen={Boolean(rigaAttiva)}
        onClose={() => setRigaAttiva(null)}
        compitoId={compito.id}
        riga={rigaAttiva}
        punteggioMassimo={compito.punteggioMassimo}
      />
    </Card>
  );
};

export default ConsegnePanel;
