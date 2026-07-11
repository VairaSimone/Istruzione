import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import VoceChip from './VoceChip';
import {
  chiaveGiorno,
  costruisciGriglia,
  intestazioniGiorni,
} from '../calendarioDate';
import styles from './Calendario.module.css';

const MAX_CHIP = 3;

/**
 * Griglia mensile del calendario. Riceve le voci del feed e le distribuisce
 * nelle celle-giorno. Le voci arrivano già ordinate cronologicamente dal
 * backend; qui vengono solo raggruppate per giorno.
 */
const CalendarioMese = ({ mese, voci = [], onSelezionaVoce, onSelezionaGiorno }) => {
  const { i18n } = useTranslation();
  const settimane = useMemo(() => costruisciGriglia(mese), [mese]);
  const intestazioni = useMemo(() => intestazioniGiorni(i18n.language), [i18n.language]);
  const oggiKey = chiaveGiorno(new Date());

  const vociPerGiorno = useMemo(() => {
    const mappa = new Map();
    for (const voce of voci) {
      const k = chiaveGiorno(voce.dataInizio);
      if (!mappa.has(k)) mappa.set(k, []);
      mappa.get(k).push(voce);
    }
    return mappa;
  }, [voci]);

  return (
    <div className={styles.calendar}>
      <div className={styles.weekHeader}>
        {intestazioni.map((g, i) => (
          <div key={i} className={styles.weekHeaderCell}>
            {g}
          </div>
        ))}
      </div>

      {settimane.map((settimana, si) => (
        <div key={si} className={styles.week}>
          {settimana.map((giorno) => {
            const key = chiaveGiorno(giorno);
            const delMese = giorno.getMonth() === mese.getMonth();
            const vociGiorno = vociPerGiorno.get(key) || [];
            const visibili = vociGiorno.slice(0, MAX_CHIP);
            const extra = vociGiorno.length - visibili.length;

            const classi = [
              styles.day,
              delMese ? '' : styles.dayOutside,
              key === oggiKey ? styles.dayToday : '',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <div
                key={key}
                className={classi}
                role="button"
                tabIndex={0}
                onClick={() => onSelezionaGiorno(giorno, vociGiorno)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelezionaGiorno(giorno, vociGiorno);
                  }
                }}
              >
                <span className={styles.dayNumber}>{giorno.getDate()}</span>
                <div className={styles.dayEvents}>
                  {visibili.map((voce) => (
                    <VoceChip
                      key={`${voce.tipoVoce}-${voce.id}`}
                      voce={voce}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelezionaVoce(voce);
                      }}
                    />
                  ))}
                  {extra > 0 && <span className={styles.more}>+{extra}</span>}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default CalendarioMese;
