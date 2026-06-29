import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './WritingCanvas.module.css';

/**
 * WritingCanvas — esercizio di scrittura su schermo (HTML5 Canvas).
 *
 * Permette di "disegnare" un singolo glifo kana con dito/mouse/penna (Pointer
 * Events, quindi mobile/tablet inclusi) e fornisce una validazione BASILARE
 * della forma di ogni tratto:
 *
 *   - i tratti attesi provengono dal backend (path KanjiVG nel viewBox 109);
 *   - per il RENDERING di guida/fantasma si usa `Path2D` con la scala del canvas;
 *   - per la VALIDAZIONE si campiona il tratto atteso (getPointAtLength su un
 *     <path> SVG nascosto) e lo si confronta col tratto disegnato dopo averli
 *     ri-campionati a un numero fisso di punti: si misura la distanza media e
 *     la vicinanza del punto di partenza (quest'ultima impone implicitamente la
 *     DIREZIONE corretta del tratto, scartando i tratti disegnati al contrario).
 *
 * È volutamente "basilare" (come da requisito): non è un riconoscitore di
 * grafia, ma un aiuto allo studio dell'ordine e della forma dei tratti.
 *
 * Il genitore dovrebbe montare questo componente con `key={carattere}` così da
 * ripartire da zero al cambio di carattere.
 *
 * @param {{carattere:string, strokes:string[]}} componente
 * @param {string}   viewBox            es. '0 0 109 109'
 * @param {() => void} [onCompletato]   invocato quando tutti i tratti sono ok
 */

const N_CAMPIONI = 24; // punti di ri-campionamento per il confronto
const SOGLIA_DISTANZA = 0.17; // distanza media massima (coord. normalizzate 0..1)
const SOGLIA_PARTENZA = 0.3; // distanza massima del punto iniziale (direzione)
const LUNGHEZZA_MINIMA = 0.05; // sotto questa lunghezza il tratto è ignorato (tap)

// Parsea la dimensione nativa dal viewBox ('0 0 109 109' → 109).
const dimensioneViewBox = (viewBox) => {
  const parti = String(viewBox).trim().split(/\s+/).map(Number);
  return parti.length === 4 && parti[2] > 0 ? parti[2] : 109;
};

// Ri-campiona una polilinea in `n` punti equidistanti per lunghezza d'arco.
const ricampiona = (punti, n) => {
  if (punti.length === 0) return [];
  if (punti.length === 1) return Array.from({ length: n }, () => ({ ...punti[0] }));

  const distanze = [0];
  let totale = 0;
  for (let i = 1; i < punti.length; i += 1) {
    totale += Math.hypot(punti[i].x - punti[i - 1].x, punti[i].y - punti[i - 1].y);
    distanze.push(totale);
  }
  if (totale === 0) return Array.from({ length: n }, () => ({ ...punti[0] }));

  const out = [];
  for (let k = 0; k < n; k += 1) {
    const bersaglio = (k / (n - 1)) * totale;
    let i = 1;
    while (i < distanze.length && distanze[i] < bersaglio) i += 1;
    const d0 = distanze[i - 1];
    const d1 = distanze[i];
    const tloc = d1 - d0 === 0 ? 0 : (bersaglio - d0) / (d1 - d0);
    out.push({
      x: punti[i - 1].x + (punti[i].x - punti[i - 1].x) * tloc,
      y: punti[i - 1].y + (punti[i].y - punti[i - 1].y) * tloc,
    });
  }
  return out;
};

// Lunghezza d'arco totale di una polilinea.
const lunghezzaPolilinea = (punti) => {
  let totale = 0;
  for (let i = 1; i < punti.length; i += 1) {
    totale += Math.hypot(punti[i].x - punti[i - 1].x, punti[i].y - punti[i - 1].y);
  }
  return totale;
};

const WritingCanvas = ({ componente, viewBox = '0 0 109 109', onCompletato }) => {
  const { t } = useTranslation();

  const VIEW = dimensioneViewBox(viewBox);
  const strokes = componente?.strokes || [];

  const canvasRef = useRef(null);
  const pathNascostoRef = useRef(null); // <path> SVG per il campionamento
  const contenitoreRef = useRef(null);

  // Stato di disegno (in ref: muta ad alta frequenza, niente re-render).
  const trattoCorrenteRef = useRef([]); // punti in coordinate VIEW
  const trattiCompletatiRef = useRef([]); // array di polilinee accettate
  const disegnandoRef = useRef(false);
  const latoLogicoRef = useRef(0); // px CSS del lato (quadrato)

  // Stato visibile (guida UI).
  const [indiceTratto, setIndiceTratto] = useState(0);
  const [feedback, setFeedback] = useState('idle'); // 'idle' | 'ok' | 'wrong'
  const [completato, setCompletato] = useState(false);

  const indiceTrattoRef = useRef(0);
  indiceTrattoRef.current = indiceTratto;

  // Campiona un tratto atteso (path `d`) in `n` punti, coordinate VIEW.
  const campionaAtteso = useCallback((d, n) => {
    const path = pathNascostoRef.current;
    if (!path) return [];
    path.setAttribute('d', d);
    let len;
    try {
      len = path.getTotalLength();
    } catch {
      return [];
    }
    if (!Number.isFinite(len) || len === 0) return [];
    const out = [];
    for (let k = 0; k < n; k += 1) {
      const p = path.getPointAtLength((k / (n - 1)) * len);
      out.push({ x: p.x, y: p.y });
    }
    return out;
  }, []);

  // ── Disegno completo del canvas ────────────────────────────────
  const ridisegna = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const lato = latoLogicoRef.current;
    if (!lato) return;

    const scala = lato / VIEW;
    ctx.clearRect(0, 0, lato, lato);

    // Sfondo + riquadro guida 米.
    ctx.save();
    ctx.strokeStyle = 'rgba(150,150,150,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(1, 1, lato - 2, lato - 2);
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.moveTo(lato / 2, 0);
    ctx.lineTo(lato / 2, lato);
    ctx.moveTo(0, lato / 2);
    ctx.lineTo(lato, lato / 2);
    ctx.stroke();
    ctx.restore();

    // Fantasma: forma completa in trasparenza.
    ctx.save();
    ctx.scale(scala, scala);
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(120,120,120,0.22)';
    strokes.forEach((d) => ctx.stroke(new Path2D(d)));

    // Guida del tratto corrente (tratteggio accentato) se non completato.
    const idx = indiceTrattoRef.current;
    if (!completato && strokes[idx]) {
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = 'rgba(201,64,42,0.55)'; // hanko
      ctx.lineWidth = 3;
      ctx.stroke(new Path2D(strokes[idx]));
      ctx.setLineDash([]);
    }
    ctx.restore();

    // Tratti dell'utente già accettati (in matcha).
    const disegnaPolilinea = (punti, colore, larghezza) => {
      if (punti.length < 2) return;
      ctx.save();
      ctx.scale(scala, scala);
      ctx.lineWidth = larghezza;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = colore;
      ctx.beginPath();
      ctx.moveTo(punti[0].x, punti[0].y);
      for (let i = 1; i < punti.length; i += 1) ctx.lineTo(punti[i].x, punti[i].y);
      ctx.stroke();
      ctx.restore();
    };

    trattiCompletatiRef.current.forEach((p) => disegnaPolilinea(p, '#3d5a4c', 5));

    // Tratto in corso: colore in base al feedback.
    const coloreCorrente =
      feedback === 'wrong' ? '#b3261e' : feedback === 'ok' ? '#3d5a4c' : '#1a1a1a';
    disegnaPolilinea(trattoCorrenteRef.current, coloreCorrente, 5);
  }, [VIEW, strokes, completato, feedback]);

  // ── Dimensionamento responsive (dpr + ResizeObserver) ──────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const contenitore = contenitoreRef.current;
    if (!canvas || !contenitore) return undefined;

    const adatta = () => {
      const lato = Math.max(1, Math.floor(contenitore.clientWidth));
      latoLogicoRef.current = lato;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(lato * dpr);
      canvas.height = Math.round(lato * dpr);
      canvas.style.height = `${lato}px`;
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ridisegna();
    };

    adatta();
    const ro = new ResizeObserver(adatta);
    ro.observe(contenitore);
    return () => ro.disconnect();
  }, [ridisegna]);

  // Ridisegna quando cambiano gli stati visibili.
  useEffect(() => {
    ridisegna();
  }, [ridisegna, indiceTratto, feedback, completato]);

  // ── Conversione coordinate evento → VIEW ───────────────────────
  const puntoDaEvento = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scala = VIEW / rect.width;
    return {
      x: (e.clientX - rect.left) * scala,
      y: (e.clientY - rect.top) * scala,
    };
  };

  // ── Validazione basilare di un tratto ──────────────────────────
  const validaTratto = (puntiUtente) => {
    const idx = indiceTrattoRef.current;
    const dAtteso = strokes[idx];
    if (!dAtteso) return false;

    const atteso = campionaAtteso(dAtteso, N_CAMPIONI);
    if (atteso.length === 0) return false;

    const utente = ricampiona(puntiUtente, N_CAMPIONI);

    // Distanza media punto-a-punto (normalizzata sul lato del viewBox).
    let somma = 0;
    for (let i = 0; i < N_CAMPIONI; i += 1) {
      somma += Math.hypot(utente[i].x - atteso[i].x, utente[i].y - atteso[i].y);
    }
    const distanzaMedia = somma / N_CAMPIONI / VIEW;

    // Vicinanza del punto di partenza ⇒ impone la direzione corretta.
    const distPartenza = Math.hypot(utente[0].x - atteso[0].x, utente[0].y - atteso[0].y) / VIEW;

    return distanzaMedia <= SOGLIA_DISTANZA && distPartenza <= SOGLIA_PARTENZA;
  };

  // ── Gestione Pointer Events ────────────────────────────────────
  const onPointerDown = (e) => {
    if (completato) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    disegnandoRef.current = true;
    trattoCorrenteRef.current = [puntoDaEvento(e)];
    if (feedback !== 'idle') setFeedback('idle');
  };

  const onPointerMove = (e) => {
    if (!disegnandoRef.current) return;
    e.preventDefault();
    trattoCorrenteRef.current.push(puntoDaEvento(e));
    ridisegna();
  };

  const onPointerUp = (e) => {
    if (!disegnandoRef.current) return;
    e.preventDefault();
    disegnandoRef.current = false;

    const punti = trattoCorrenteRef.current;
    const lunghezzaNorm = lunghezzaPolilinea(punti) / VIEW;

    // Tap o tratto troppo corto: ignora silenziosamente.
    if (punti.length < 3 || lunghezzaNorm < LUNGHEZZA_MINIMA) {
      trattoCorrenteRef.current = [];
      ridisegna();
      return;
    }

    if (validaTratto(punti)) {
      trattiCompletatiRef.current = [...trattiCompletatiRef.current, punti];
      trattoCorrenteRef.current = [];
      const nuovoIndice = indiceTrattoRef.current + 1;
      setFeedback('ok');
      if (nuovoIndice >= strokes.length) {
        setIndiceTratto(nuovoIndice);
        setCompletato(true);
        onCompletato?.();
      } else {
        setIndiceTratto(nuovoIndice);
      }
    } else {
      // Tratto errato: lampeggia in rosso, poi rimuovi il tentativo.
      setFeedback('wrong');
      ridisegna();
      setTimeout(() => {
        trattoCorrenteRef.current = [];
        setFeedback('idle');
      }, 550);
    }
  };

  // ── Reset / Annulla ────────────────────────────────────────────
  const azzera = () => {
    trattiCompletatiRef.current = [];
    trattoCorrenteRef.current = [];
    setIndiceTratto(0);
    setFeedback('idle');
    setCompletato(false);
  };

  const annullaUltimo = () => {
    if (trattiCompletatiRef.current.length === 0) return;
    trattiCompletatiRef.current = trattiCompletatiRef.current.slice(0, -1);
    setIndiceTratto((i) => Math.max(0, i - 1));
    setCompletato(false);
    setFeedback('idle');
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.canvasBox} ref={contenitoreRef}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={(e) => disegnandoRef.current && onPointerUp(e)}
        />
        {completato && (
          <div className={styles.completato} role="status">
            <span className={styles.completatoBadge}>{t('quiz.writing.completed')}</span>
          </div>
        )}
      </div>

      {/* <path> nascosto usato solo per campionare i tratti attesi. */}
      <svg width="0" height="0" className={styles.hiddenSvg} aria-hidden="true">
        <path ref={pathNascostoRef} d="" />
      </svg>

      <div className={styles.barra}>
        <span
          className={[
            styles.stato,
            feedback === 'ok' ? styles.statoOk : '',
            feedback === 'wrong' ? styles.statoWrong : '',
          ].join(' ')}
          role="status"
        >
          {completato
            ? t('quiz.writing.allStrokesDone')
            : feedback === 'wrong'
              ? t('quiz.writing.retryStroke')
              : t('quiz.writing.strokeProgress', {
                  current: Math.min(indiceTratto + 1, strokes.length),
                  total: strokes.length,
                })}
        </span>

        <div className={styles.azioni}>
          <button
            type="button"
            className={styles.azione}
            onClick={annullaUltimo}
            disabled={trattiCompletatiRef.current.length === 0}
          >
            {t('quiz.writing.undo')}
          </button>
          <button type="button" className={styles.azione} onClick={azzera}>
            {t('quiz.writing.clear')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WritingCanvas;
