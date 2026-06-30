import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '../../../components/ui/Card';
import Spinner from '../../../components/ui/Spinner';
import { useHeatmap } from '../../../hooks/useHeatmap';
import styles from './ActivityHeatmap.module.css';

/**
 * ActivityHeatmap — griglia dei contributi in stile GitHub
 * (GET /statistiche/heatmap).
 *
 * Il backend restituisce solo i giorni CON attività (con `livello` 0-4 già
 * calcolato). Qui si ricostruisce il calendario completo da `dal` a `al`,
 * trattando i giorni mancanti come livello 0, e lo si dispone in colonne
 * settimanali (domenica→sabato), come la griglia dei contributi.
 *
 * @param {number} [giorni=182]  ampiezza della finestra in giorni
 */

// 'YYYY-MM-DD' (UTC) da Date.
const fmt = (d) => d.toISOString().slice(0, 10);

// Date UTC (mezzanotte) da 'YYYY-MM-DD'.
const parse = (s) => {
  const [a, m, g] = String(s).split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, g));
};

const ActivityHeatmap = ({ giorni = 182 }) => {
  const { t, i18n } = useTranslation();
  const { data, isLoading, isError } = useHeatmap(giorni);

  // Ricostruisce le settimane (colonne) con padding iniziale alla domenica.
  const settimane = useMemo(() => {
    if (!data) return [];

    const perGiorno = new Map((data.giorni || []).map((g) => [g.giorno, g]));
    const inizio = parse(data.dal);
    const fine = parse(data.al);

    // Allinea l'inizio alla domenica precedente (getUTCDay: 0 = domenica).
    const inizioAllineato = new Date(inizio);
    inizioAllineato.setUTCDate(inizioAllineato.getUTCDate() - inizioAllineato.getUTCDay());

    const celle = [];
    for (
      let d = new Date(inizioAllineato);
      d.getTime() <= fine.getTime();
      d.setUTCDate(d.getUTCDate() + 1)
    ) {
      const key = fmt(d);
      const dentroFinestra = d.getTime() >= inizio.getTime();
      const voce = perGiorno.get(key) || null;
      celle.push({
        key,
        data: new Date(d),
        vuotaPad: !dentroFinestra, // padding prima di `dal`: cella invisibile
        livello: dentroFinestra ? (voce ? voce.livello : 0) : -1,
        voce,
      });
    }

    // Raggruppa in settimane da 7 (colonne).
    const cols = [];
    for (let i = 0; i < celle.length; i += 7) cols.push(celle.slice(i, i + 7));
    return cols;
  }, [data]);

  if (isError) return null;

  if (isLoading || !data) {
    return (
      <Card className={styles.card}>
        <h3 className={styles.titolo}>{t('quiz.heatmap.title')}</h3>
        <Spinner label={t('common.loading')} />
      </Card>
    );
  }

  const formattaData = (d) =>
    d.toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'it-IT', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });

  const tooltip = (cella) => {
    const dataStr = formattaData(cella.data);
    if (!cella.voce) return t('quiz.heatmap.tooltipEmpty', { date: dataStr });
    return t('quiz.heatmap.tooltip', {
      date: dataStr,
      quiz: cella.voce.quizCompletati,
      answers: cella.voce.risposteTotali,
      strokes: cella.voce.trattiValidati,
    });
  };

  const { riepilogo } = data;

  return (
    <Card className={styles.card}>
      <div className={styles.header}>
        <h3 className={styles.titolo}>{t('quiz.heatmap.title')}</h3>
        <p className={styles.sottotitolo}>
          {t('quiz.heatmap.summary', {
            active: riepilogo?.giorniAttivi ?? 0,
            xp: riepilogo?.totaleXp ?? 0,
          })}
        </p>
      </div>

      <div className={styles.grigliaScroll}>
        <div className={styles.griglia} role="img" aria-label={t('quiz.heatmap.title')}>
          {settimane.map((sett, ci) => (
            <div key={ci} className={styles.colonna}>
              {sett.map((cella) =>
                cella.livello === -1 ? (
                  <span key={cella.key} className={[styles.cella, styles.pad].join(' ')} />
                ) : (
                  <span
                    key={cella.key}
                    className={[styles.cella, styles[`liv${cella.livello}`]].join(' ')}
                    title={tooltip(cella)}
                  />
                )
              )}
            </div>
          ))}
        </div>
      </div>

      <div className={styles.legenda}>
        <span className={styles.legendaTesto}>{t('quiz.heatmap.less')}</span>
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} className={[styles.cella, styles[`liv${l}`]].join(' ')} />
        ))}
        <span className={styles.legendaTesto}>{t('quiz.heatmap.more')}</span>
      </div>
    </Card>
  );
};

export default ActivityHeatmap;
