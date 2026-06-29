import { useTranslation } from 'react-i18next';
import { useSpeech } from '../../hooks/useSpeech';
import styles from './PronunciationButton.module.css';

/**
 * Pulsante di pronuncia (Text-to-Speech) di un kana o di una parola.
 *
 * Singola responsabilità: dato un `testo` giapponese, riprodurne la pronuncia
 * tramite la Web Speech API (hook `useSpeech`). La logica vocale è interamente
 * nell'hook; qui resta solo il rendering + gli stati (attivo, non supportato).
 *
 * Degrada con grazia: se il browser non supporta la sintesi vocale o manca una
 * voce giapponese, il pulsante è disabilitato con un tooltip esplicativo.
 *
 * @param {string}  testo            testo giapponese da pronunciare (es. 'か')
 * @param {('sm'|'md'|'lg')} [size]  dimensione del pulsante
 * @param {string}  [label]          aria-label/tooltip personalizzato
 */
const PronunciationButton = ({ testo, size = 'md', label }) => {
  const { t } = useTranslation();
  const { supportato, voceGiapponeseDisponibile, parlando, parla } = useSpeech();

  const disponibile = supportato && voceGiapponeseDisponibile;

  const titolo = !supportato
    ? t('quiz.audio.unsupported')
    : !voceGiapponeseDisponibile
      ? t('quiz.audio.noVoice')
      : label || t('quiz.audio.listen');

  return (
    <button
      type="button"
      className={[styles.button, styles[size], parlando ? styles.active : ''].join(' ')}
      onClick={() => disponibile && parla(testo)}
      disabled={!disponibile || !testo}
      title={titolo}
      aria-label={titolo}
    >
      <svg
        className={styles.icon}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M11 5,6 9H2v6h4l5 4V5z" />
        {/* Onde sonore: animate quando è in riproduzione (vedi CSS). */}
        <path className={styles.wave1} d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        <path className={styles.wave2} d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      </svg>
    </button>
  );
};

export default PronunciationButton;
