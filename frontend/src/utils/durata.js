/**
 * Formattazione della durata dei video delle videolezioni.
 * L'input è in secondi (campo `video_durata_secondi` del capitolo).
 */

/**
 * Formatta una durata in secondi in "m:ss" oppure "h:mm:ss" quando supera l'ora.
 * Restituisce stringa vuota per valori mancanti o non validi.
 *
 * Esempi: 75 → "1:15", 3725 → "1:02:05".
 */
export const formatDurata = (secondiTotali) => {
  const s = Number(secondiTotali);
  if (!Number.isFinite(s) || s < 0) return '';

  const secondi = Math.floor(s % 60);
  const minuti = Math.floor((s / 60) % 60);
  const ore = Math.floor(s / 3600);
  const pad = (n) => String(n).padStart(2, '0');

  if (ore > 0) {
    return `${ore}:${pad(minuti)}:${pad(secondi)}`;
  }
  return `${minuti}:${pad(secondi)}`;
};
