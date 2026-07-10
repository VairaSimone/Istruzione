/**
 * Utility cromatiche per il branding di scuola.
 *
 * La scuola sceglie tre colori (primario, secondario, accento). Il design
 * system, però, ha bisogno anche delle loro tinte derivate: uno stato
 * hover/active più scuro e una velatura chiarissima per gli sfondi tenui.
 * Chiederli alla scuola sarebbe scortese e fragile; li deriviamo qui.
 *
 * Si lavora in RGB con una semplice miscelazione verso nero/bianco: è
 * sufficiente per hover e velature, non pretende di essere colorimetricamente
 * corretto. Il tema scuro riceve derivazioni diverse (schiarisce invece di
 * scurire), perché su fondo scuro l'hover deve avvicinarsi alla luce.
 */

const HEX_REGEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** `#abc` → `#aabbcc`; ritorna null se il valore non è un esadecimale valido. */
const normalizzaHex = (colore) => {
  if (typeof colore !== 'string' || !HEX_REGEX.test(colore.trim())) return null;
  const hex = colore.trim().slice(1);
  if (hex.length === 3) {
    return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`.toLowerCase();
  }
  return `#${hex.toLowerCase()}`;
};

const hexToRgb = (hex) => ({
  r: parseInt(hex.slice(1, 3), 16),
  g: parseInt(hex.slice(3, 5), 16),
  b: parseInt(hex.slice(5, 7), 16),
});

const rgbToHex = ({ r, g, b }) => {
  const canale = (v) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, '0');
  return `#${canale(r)}${canale(g)}${canale(b)}`;
};

/** Miscela `colore` con `verso` nella proporzione `quota` (0 = colore, 1 = verso). */
const mescola = (colore, verso, quota) => {
  const a = hexToRgb(colore);
  const b = hexToRgb(verso);
  return rgbToHex({
    r: a.r + (b.r - a.r) * quota,
    g: a.g + (b.g - a.g) * quota,
    b: a.b + (b.b - a.b) * quota,
  });
};

/**
 * Luminanza relativa (WCAG). Serve a decidere se il testo su questo colore
 * debba essere chiaro o scuro: un brand giallo canarino non può avere etichette
 * bianche.
 */
export const luminanza = (colore) => {
  const hex = normalizzaHex(colore);
  if (!hex) return 0;
  const { r, g, b } = hexToRgb(hex);
  const canale = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canale(r) + 0.7152 * canale(g) + 0.0722 * canale(b);
};

/** Colore di testo leggibile sopra `colore` (bianco o quasi-nero). */
export const testoSu = (colore) => (luminanza(colore) > 0.55 ? '#1c1b18' : '#ffffff');

/**
 * Deriva la scala di un colore brand.
 *
 * @param {string} colore esadecimale (#rgb o #rrggbb)
 * @param {'light'|'dark'} tema tema attivo
 * @returns {{ base: string, forte: string, tenue: string, testo: string }|null}
 */
export const scalaBrand = (colore, tema = 'light') => {
  const base = normalizzaHex(colore);
  if (!base) return null;

  const scuro = tema === 'dark';

  return {
    base,
    // Hover/active: su chiaro si scurisce, su scuro si schiarisce.
    forte: scuro ? mescola(base, '#ffffff', 0.18) : mescola(base, '#000000', 0.22),
    // Velatura per sfondi tenui: quasi carta su chiaro, quasi inchiostro su scuro.
    tenue: scuro ? mescola(base, '#16140f', 0.82) : mescola(base, '#ffffff', 0.88),
    testo: testoSu(base),
  };
};

export const isColoreValido = (colore) => normalizzaHex(colore) !== null;
