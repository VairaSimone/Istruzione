import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuleList, useAula } from '../../../hooks/useAule';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';
import styles from './Calendario.module.css';

/**
 * Selettore di un DESTINATARIO: un'AULA oppure un SINGOLO studente (di una delle
 * proprie aule). Non fa da sé la chiamata: al click di «Aggiungi» invoca
 * `onAggiungi({ classeId | utenteId, etichetta })`, lasciando al chiamante la
 * decisione (accumulare in locale nel form di creazione, oppure chiamare l'API
 * sul dettaglio di un evento esistente).
 *
 * Rispecchia la logica di `features/compiti/components/AssegnaModal.jsx`: il
 * backend accetta solo aule/studenti delle proprie aule.
 */
const SelettoreDestinatario = ({ onAggiungi, isPending = false }) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState('classe');
  const [classeId, setClasseId] = useState('');
  const [utenteId, setUtenteId] = useState('');

  const { data: auleData } = useAuleList({});
  const aule = auleData?.classi ?? [];

  const { data: aula } = useAula(mode === 'studente' ? classeId : undefined);
  const studenti = aula?.studenti ?? [];

  const handleAggiungi = () => {
    if (mode === 'classe') {
      if (!classeId) return;
      const a = aule.find((x) => x.id === classeId);
      onAggiungi({ classeId, etichetta: a?.nome ?? classeId });
    } else {
      if (!utenteId) return;
      const s = studenti.find((x) => x.id === utenteId);
      const etichetta = s ? `${s.nome} ${s.cognome}` : utenteId;
      onAggiungi({ utenteId, etichetta });
    }
    setUtenteId('');
  };

  return (
    <div className={styles.selettoreRow}>
      <div className={styles.toggle}>
        <Button
          type="button"
          variant={mode === 'classe' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setMode('classe')}
        >
          {t('calendario.destinatari.toClass')}
        </Button>
        <Button
          type="button"
          variant={mode === 'studente' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setMode('studente')}
        >
          {t('calendario.destinatari.toStudent')}
        </Button>
      </div>

      <div className={styles.selettoreControls}>
        <Select
          label={t('calendario.destinatari.aula')}
          placeholder={t('calendario.destinatari.selectAula')}
          value={classeId}
          onChange={(e) => {
            setClasseId(e.target.value);
            setUtenteId('');
          }}
        >
          {aule.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nome}
            </option>
          ))}
        </Select>

        {mode === 'studente' && classeId ? (
          <Select
            label={t('calendario.destinatari.studente')}
            placeholder={t('calendario.destinatari.selectStudente')}
            value={utenteId}
            onChange={(e) => setUtenteId(e.target.value)}
          >
            {studenti.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome} {s.cognome}
              </option>
            ))}
          </Select>
        ) : (
          <span />
        )}

        <Button
          type="button"
          size="sm"
          onClick={handleAggiungi}
          isLoading={isPending}
          disabled={mode === 'classe' ? !classeId : !utenteId}
        >
          {t('common.add')}
        </Button>
      </div>
    </div>
  );
};

export default SelettoreDestinatario;
