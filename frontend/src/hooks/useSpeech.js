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
 * @returns {{
 *   supportato: boolean,
 *   voceGiapponeseDisponibile: boolean,
 *   parlando: boolean,
 *   parla: (testo: string) => void,
 *   ferma: () => void
 * }}
 */
export const useSpeech = () => {
  const supportato =
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof window.SpeechSynthesisUtterance !== 'undefined';

  const [vociPronte, setVociPronte] = useState(false);
  const [parlando, setParlando] = useState(false);

  // Voce giapponese selezionata (ref: non deve causare re-render quando cambia).
  const voceRef = useRef(null);
  const utterRef = useRef(null);

  // Risoluzione della voce giapponese tra quelle disponibili.
  const risolviVoce = useCallback(() => {
    if (!supportato) return;
    const voci = window.speechSynthesis.getVoices();
    if (!voci || voci.length === 0) return;

    const giapponese =
      voci.find((v) => v.lang === 'ja-JP') ||
      voci.find((v) => v.lang && v.lang.toLowerCase().startsWith('ja'));

    voceRef.current = giapponese || null;
    setVociPronte(true);
  }, [supportato]);

  useEffect(() => {
    if (!supportato) return undefined;

    risolviVoce();
    // Su molti browser le voci arrivano dopo il primo getVoices().
    window.speechSynthesis.addEventListener('voiceschanged', risolviVoce);

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', risolviVoce);
      // Interrompe eventuali pronunce ancora in coda allo smontaggio.
      window.speechSynthesis.cancel();
    };
  }, [supportato, risolviVoce]);

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
      if (voceRef.current) utter.voice = voceRef.current;

      utter.onstart = () => setParlando(true);
      utter.onend = () => setParlando(false);
      utter.onerror = () => setParlando(false);

      utterRef.current = utter;
      window.speechSynthesis.speak(utter);
    },
    [supportato]
  );

  return {
    supportato,
    voceGiapponeseDisponibile: Boolean(voceRef.current),
    // Esposto perché la disponibilità voci può cambiare dopo il primo render.
    vociPronte,
    parlando,
    parla,
    ferma,
  };
};
