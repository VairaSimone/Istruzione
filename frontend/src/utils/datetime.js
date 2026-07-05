/**
 * Utility per date/orari, usate dai compiti (scadenze, consegne).
 * La formattazione visibile usa la lingua attiva; le conversioni servono per
 * l'input `datetime-local` (che lavora in ora locale, senza timezone).
 */

/** Formatta una data ISO in "gg/mm/aaaa hh:mm" secondo la lingua. */
export const formatDateTime = (iso, lang = 'it') => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(lang, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/** Formatta solo la data. */
export const formatDate = (iso, lang = 'it') => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(lang);
};

/** ISO → valore per <input type="datetime-local"> (ora locale, "YYYY-MM-DDTHH:mm"). */
export const toDatetimeLocal = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
};

/** Valore di <input type="datetime-local"> → ISO (UTC). */
export const fromDatetimeLocal = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
};
