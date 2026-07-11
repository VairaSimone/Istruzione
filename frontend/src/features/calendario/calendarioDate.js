/**
 * Helper di date per il calendario, isolati in un modulo NON-componente (come
 * `features/compiti/statoTone.js`) così i file dei componenti esportano solo il
 * componente e non fanno scattare la regola react-refresh.
 */

/** Chiave giorno locale "YYYY-MM-DD" (coerente tra celle e raggruppamento voci). */
export const chiaveGiorno = (data) => {
  const d = data instanceof Date ? data : new Date(data);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Costruisce la griglia (settimane Lun→Dom) che copre il mese indicato. */
export const costruisciGriglia = (mese) => {
  const primo = new Date(mese.getFullYear(), mese.getMonth(), 1);
  // Offset per far iniziare la settimana di lunedì (getDay: 0=Dom..6=Sab).
  const offset = (primo.getDay() + 6) % 7;
  const inizio = new Date(primo);
  inizio.setDate(primo.getDate() - offset);

  const celle = [];
  const cursore = new Date(inizio);
  // Fino a 6 settimane coprono qualsiasi mese; ci fermiamo prima se il mese è
  // finito e la settimana è completa.
  for (let i = 0; i < 42; i += 1) {
    celle.push(new Date(cursore));
    cursore.setDate(cursore.getDate() + 1);
    if (i >= 27 && i % 7 === 6) {
      const ultimo = celle[celle.length - 1];
      if (ultimo.getMonth() !== mese.getMonth()) break;
    }
  }

  const settimane = [];
  for (let i = 0; i < celle.length; i += 7) settimane.push(celle.slice(i, i + 7));
  return settimane;
};

/**
 * Finestra temporale [da, a] (ISO) che copre l'INTERA griglia visibile del
 * mese, non solo il mese: così il feed include anche le voci dei giorni di
 * spillover mostrati nelle prime/ultime celle.
 */
export const finestraGrigliaMese = (mese) => {
  const settimane = costruisciGriglia(mese);
  const primaCella = settimane[0][0];
  const ultimaSettimana = settimane[settimane.length - 1];
  const ultimaCella = ultimaSettimana[ultimaSettimana.length - 1];

  const da = new Date(primaCella.getFullYear(), primaCella.getMonth(), primaCella.getDate(), 0, 0, 0);
  const a = new Date(
    ultimaCella.getFullYear(),
    ultimaCella.getMonth(),
    ultimaCella.getDate(),
    23,
    59,
    59
  );
  return { da: da.toISOString(), a: a.toISOString() };
};

/** Etichette brevi dei giorni (Lun→Dom) nella lingua attiva. */
export const intestazioniGiorni = (lang) => {
  // 2024-01-01 è un lunedì: iteriamo 7 giorni per ottenere Lun..Dom.
  const base = new Date(2024, 0, 1);
  const fmt = new Intl.DateTimeFormat(lang, { weekday: 'short' });
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return fmt.format(d);
  });
};

/** Etichetta "mese anno" (es. "luglio 2026") nella lingua attiva. */
export const etichettaMese = (mese, lang) =>
  new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric' }).format(mese);
