import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * useSpeech — sintesi vocale (Text-to-Speech) per la pronuncia dei kana/parole.
 *
 * Si appoggia alla Web Speech API del browser (`window.speechSynthesis`), senza
 * file audio da ospitare né dipendenze di rete: la pronuncia è generata dal
 * dispositivo dell'utente. Strategia:
 *   - rileva il supporto del browser;
 *   - seleziona una voce giapponese ('ja' / 'ja-JP') tra quelle disponibili;
 *   - le voci possono arrivare in modo asincrono ⇒ si ascolta `voiceschanged`;
 *   - `parla(testo)` annulla un'eventuale pronuncia in corso e ne avvia una
 *     nuova, leggermente rallentata, per facilitare l'ascolto.
 *
 * Degrada con grazia: se il browser non supporta l'API o non ha voci 'ja',
 * `supportato`/`voceGiapponeseDisponibile` lo segnalano e il chiamante può
 * disabilitare il pulsante con un messaggio adeguato.
 *
 * NOTA implementativa: la voce selezionata vive in `useState` (non in un ref),
 * così `voceGiapponeseDisponibile` è derivato in modo affidabile senza leggere
 * ref durante il render. Lo stato iniziale è calcolato in modo pigro da
 * `getVoices()`; l'aggiornamento asincrono avviene SOLO dal listener
 * `voiceschanged` (callback di un sistema esterno), evitando `setState`
 * sincrono nel corpo dell'effect.
 *
 * @returns {{
 *   supportato: boolean,
 *   voceGiapponeseDisponibile: boolean,
 *   parlando: boolean,
 *   parla: (testo: string) => void,
 *   ferma: () => void
 * }}
 */

const isSupportato = () =>
  typeof window !== 'undefined' &&
  'speechSynthesis' in window &&
  typeof window.SpeechSynthesisUtterance !== 'undefined';

/** Seleziona una voce giapponese ('ja-JP' o 'ja*') tra quelle disponibili. */
const selezionaVoceGiapponese = () => {
  if (!isSupportato()) return null;
  const voci = window.speechSynthesis.getVoices();
  if (!voci || voci.length === 0) return null;
  return (
    voci.find((v) => v.lang === 'ja-JP') ||
    voci.find((v) => v.lang && v.lang.toLowerCase().startsWith('ja')) ||
    null
  );
};

export const useSpeech = () => {
  const supportato = isSupportato();

  // Voce giapponese in STATO (non ref): inizializzazione pigra da getVoices().
  const [voceGiapponese, setVoceGiapponese] = useState(selezionaVoceGiapponese);
  const [parlando, setParlando] = useState(false);
  const utterRef = useRef(null);

  useEffect(() => {
    if (!supportato) return undefined;

    // Aggiorna la voce quando il browser segnala il cambio dell'elenco voci.
    const aggiornaVoce = () => setVoceGiapponese(selezionaVoceGiapponese());
    window.speechSynthesis.addEventListener('voiceschanged', aggiornaVoce);

    // Sollecita il caricamento delle voci: su alcuni browser (es. Chrome)
    // l'elenco è vuoto finché non lo si richiede, e in seguito emette
    // 'voiceschanged'. Nessun setState sincrono qui: l'aggiornamento arriva
    // dal listener.
    window.speechSynthesis.getVoices();

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', aggiornaVoce);
      // Interrompe eventuali pronunce ancora in coda allo smontaggio.
      window.speechSynthesis.cancel();
    };
  }, [supportato]);

  const ferma = useCallback(() => {
    if (!supportato) return;
    window.speechSynthesis.cancel();
    setParlando(false);
  }, [supportato]);

  const parla = useCallback(
    (testo) => {
      if (!supportato || !testo) return;

      // Annulla l'eventuale pronuncia in corso prima di avviarne una nuova.
      window.speechSynthesis.cancel();

      const utter = new window.SpeechSynthesisUtterance(String(testo));
      utter.lang = 'ja-JP';
      utter.rate = 0.85; // un filo più lento: aiuta lo studio della pronuncia
      utter.pitch = 1;
      if (voceGiapponese) utter.voice = voceGiapponese;

      utter.onstart = () => setParlando(true);
      utter.onend = () => setParlando(false);
      utter.onerror = () => setParlando(false);

      utterRef.current = utter;
      window.speechSynthesis.speak(utter);
    },
    [supportato, voceGiapponese]
  );

  return {
    supportato,
    voceGiapponeseDisponibile: Boolean(voceGiapponese),
    parlando,
    parla,
    ferma,
  };
};
