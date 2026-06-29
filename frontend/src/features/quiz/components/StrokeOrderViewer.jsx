import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './StrokeOrderViewer.module.css';

/**
 * StrokeOrderViewer — visualizzazione ANIMATA dell'ordine dei tratti.
 *
 * Dato l'elenco dei componenti grafici di un kana (per gli yōon sono due, es.
 * 'きゃ' → 'き' + 'ゃ'), disegna ogni glifo in una cella SVG e anima i tratti
 * uno alla volta, nell'ordine corretto, con la classica tecnica
 * `stroke-dasharray`/`stroke-dashoffset`.
 *
 * Niente librerie esterne: i path provengono dal backend (dati KanjiVG nel
 * viewBox nativo "0 0 109 109"). Un livello "fantasma" mostra in trasparenza la
 * forma completa del carattere; i tratti animati vengono disegnati sopra.
 *
 * Accessibilità: rispetta `prefers-reduced-motion` (mostra i tratti già
 * disegnati, con i numeri, senza animazione).
 *
 * @param {Array<{carattere:string, strokes:string[]}>} componenti
 * @param {string}  viewBox            es. '0 0 109 109'
 * @param {boolean} [numeriIniziali]   mostra i numeri dei tratti all'avvio
 */

// Durata di disegno di un singolo tratto e pausa tra un tratto e il successivo.
const DURATA_TRATTO_MS = 650;
const PAUSA_TRATTO_MS = 180;

// Lunghezza fittizia iniziale (> di qualsiasi path nel viewBox 109): mantiene i
// tratti nascosti prima che la lunghezza reale venga misurata (no "flash").
const LUNGHEZZA_FALLBACK = 1000;

// Estrae il punto iniziale (primo comando M) di un path, per posizionare il
// badge numerato del tratto. Restituisce {x,y} o null.
const puntoIniziale = (d) => {
  const m = /^[Mm]\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/.exec(d);
  if (!m) return null;
  return { x: parseFloat(m[1]), y: parseFloat(m[2]) };
};

const StrokeOrderViewer = ({ componenti = [], viewBox = '0 0 109 109', numeriIniziali = false }) => {
  const { t } = useTranslation();

  const [generazione, setGenerazione] = useState(0); // incrementa ⇒ rigioca
  const [mostraNumeri, setMostraNumeri] = useState(numeriIniziali);

  // Rilevamento prefers-reduced-motion (reattivo).
  const [riduciMovimento, setRiduciMovimento] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const aggiorna = () => setRiduciMovimento(mq.matches);
    aggiorna();
    mq.addEventListener('change', aggiorna);
    return () => mq.removeEventListener('change', aggiorna);
  }, []);

  // Indice globale progressivo dei tratti (attraverso tutti i componenti):
  // serve a sfalsare i ritardi di animazione nell'ordine di scrittura corretto.
  const componentiIndicizzati = useMemo(() => {
    let globale = 0;
    return componenti.map((comp) => ({
      ...comp,
      tratti: comp.strokes.map((d) => {
        const item = { d, indiceGlobale: globale, punto: puntoIniziale(d) };
        globale += 1;
        return item;
      }),
    }));
  }, [componenti]);

  const totaleTratti = useMemo(
    () => componenti.reduce((acc, c) => acc + c.strokes.length, 0),
    [componenti]
  );

  // Riferimenti ai path animati per misurarne la lunghezza reale.
  const pathRefs = useRef(new Map());

  // Dopo ogni (ri)render imposta la lunghezza reale come variabile CSS `--len`,
  // così dasharray/offset sono esatti e l'animazione disegna il tratto intero.
  useLayoutEffect(() => {
    pathRefs.current.forEach((el) => {
      if (!el) return;
      try {
        const len = el.getTotalLength();
        if (Number.isFinite(len) && len > 0) {
          el.style.setProperty('--len', String(len));
        }
      } catch {
        /* getTotalLength non disponibile: resta il fallback */
      }
    });
  }, [componentiIndicizzati, generazione]);

  const durataTotale = totaleTratti * (DURATA_TRATTO_MS + PAUSA_TRATTO_MS);

  return (
    <div className={styles.wrapper}>
      <div className={styles.celle}>
        {componentiIndicizzati.map((comp, ci) => (
          <div className={styles.cella} key={`${comp.carattere}-${ci}`}>
            <svg
              className={styles.svg}
              viewBox={viewBox}
              role="img"
              aria-label={t('quiz.strokeOrder.svgLabel', { char: comp.carattere })}
            >
              {/* Riquadro guida 米 (linee tratteggiate centrali) */}
              <g className={styles.guida} aria-hidden="true">
                <rect x="2" y="2" width="105" height="105" rx="3" />
                <line x1="54.5" y1="2" x2="54.5" y2="107" />
                <line x1="2" y1="54.5" x2="107" y2="54.5" />
              </g>

              {/* Livello "fantasma": forma completa in trasparenza */}
              <g className={styles.fantasma} aria-hidden="true">
                {comp.strokes.map((d, i) => (
                  <path key={`g-${i}`} d={d} />
                ))}
              </g>

              {/* Tratti animati (key su `generazione` per riavviare) */}
              <g key={generazione} className={styles.tratti}>
                {comp.tratti.map((tr, i) => {
                  const ritardo = tr.indiceGlobale * (DURATA_TRATTO_MS + PAUSA_TRATTO_MS);
                  return (
                    <path
                      key={`s-${i}`}
                      ref={(el) => {
                        const k = `${ci}-${i}-${generazione}`;
                        if (el) pathRefs.current.set(k, el);
                        else pathRefs.current.delete(k);
                      }}
                      d={tr.d}
                      className={riduciMovimento ? styles.trattoStatico : styles.trattoAnimato}
                      style={
                        riduciMovimento
                          ? { '--len': LUNGHEZZA_FALLBACK }
                          : {
                              '--len': LUNGHEZZA_FALLBACK,
                              animationDuration: `${DURATA_TRATTO_MS}ms`,
                              animationDelay: `${ritardo}ms`,
                            }
                      }
                    />
                  );
                })}
              </g>

              {/* Numeri dei tratti */}
              {mostraNumeri && (
                <g className={styles.numeri} aria-hidden="true">
                  {comp.tratti.map((tr, i) =>
                    tr.punto ? (
                      <g key={`n-${i}`} transform={`translate(${tr.punto.x},${tr.punto.y})`}>
                        <circle r="9" className={styles.numeroSfondo} />
                        <text className={styles.numeroTesto} dy="3.2">
                          {tr.indiceGlobale + 1}
                        </text>
                      </g>
                    ) : null
                  )}
                </g>
              )}
            </svg>
          </div>
        ))}
      </div>

      <div className={styles.controlli}>
        <button
          type="button"
          className={styles.controllo}
          onClick={() => setGenerazione((g) => g + 1)}
          disabled={riduciMovimento}
          title={riduciMovimento ? t('quiz.strokeOrder.replayDisabled') : t('quiz.strokeOrder.replay')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M3 3v5h5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>{t('quiz.strokeOrder.replay')}</span>
        </button>

        <button
          type="button"
          className={[styles.controllo, mostraNumeri ? styles.controlloAttivo : ''].join(' ')}
          onClick={() => setMostraNumeri((v) => !v)}
          aria-pressed={mostraNumeri}
        >
          <span>{t('quiz.strokeOrder.toggleNumbers')}</span>
        </button>
      </div>

      {/* Disegna la durata stimata: utile per evitare doppio click impaziente */}
      <span className={styles.srOnly} role="status">
        {t('quiz.strokeOrder.strokeCount', { count: totaleTratti })} · {durataTotale}ms
      </span>
    </div>
  );
};

export default StrokeOrderViewer;
