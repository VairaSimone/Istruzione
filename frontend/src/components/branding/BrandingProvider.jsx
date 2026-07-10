import { useEffect } from 'react';
import { useBranding } from '../../hooks/useConfig';
import { useThemeStore, THEMES } from '../../store/themeStore';
import { scalaBrand } from '../../utils/colore';

/**
 * BRANDING PROVIDER — l'app si veste della scuola attiva.
 *
 * Non renderizza nulla: applica al documento ciò che `GET /api/config`
 * restituisce, in modo che la stessa build serva scuole diverse senza alcuna
 * ricompilazione.
 *
 *  1. COLORI  → i token cromatici del design system vengono sovrascritti su
 *     `<html>` con `style.setProperty`. I token derivati (hover, velature) sono
 *     calcolati da `utils/colore.js`: la scuola dichiara tre colori, non dodici.
 *     Le derivazioni dipendono dal tema attivo, perciò l'effetto si riesegue a
 *     ogni cambio di tema.
 *
 *  2. IDENTITÀ → `<title>`, `<meta name="description">` e favicon.
 *
 *  3. TEMA    → se la scuola dichiara un tema predefinito (`chiaro`|`scuro`) e
 *     l'utente NON ha ancora espresso una preferenza propria, si adotta quello
 *     della scuola. La scelta dell'utente, una volta fatta, vince sempre: il
 *     branding suggerisce, non impone.
 *
 * I token cromatici SEMANTICI (successo, errore, avviso) non vengono toccati:
 * il verde del successo deve restare verde anche in una scuola con brand rosso.
 */

/** Token del design system pilotati dal colore PRIMARIO della scuola. */
const applicaPrimario = (root, scala) => {
  root.style.setProperty('--color-seal', scala.base);
  root.style.setProperty('--color-seal-dark', scala.forte);
  root.style.setProperty('--color-seal-soft', scala.tenue);
  root.style.setProperty('--color-brand-primary', scala.base);
  root.style.setProperty('--color-brand-primary-contrast', scala.testo);
};

/** Il colore SECONDARIO non ha un token storico: ne introduciamo uno dedicato. */
const applicaSecondario = (root, scala) => {
  root.style.setProperty('--color-brand-secondary', scala.base);
  root.style.setProperty('--color-brand-secondary-strong', scala.forte);
  root.style.setProperty('--color-brand-secondary-soft', scala.tenue);
  root.style.setProperty('--color-brand-secondary-contrast', scala.testo);
};

/** L'ACCENTO pilota focus ring e dettagli (storicamente l'oro del tema). */
const applicaAccento = (root, scala) => {
  root.style.setProperty('--color-gold', scala.base);
  root.style.setProperty('--color-gold-text', scala.forte);
  root.style.setProperty('--color-brand-accent', scala.base);
};

const rimuoviToken = (root, nomi) => nomi.forEach((n) => root.style.removeProperty(n));

const TOKEN_GESTITI = [
  '--color-seal',
  '--color-seal-dark',
  '--color-seal-soft',
  '--color-brand-primary',
  '--color-brand-primary-contrast',
  '--color-brand-secondary',
  '--color-brand-secondary-strong',
  '--color-brand-secondary-soft',
  '--color-brand-secondary-contrast',
  '--color-gold',
  '--color-gold-text',
  '--color-brand-accent',
];

/** Aggiorna (o crea) il <link rel="icon"> del documento. */
const applicaFavicon = (href) => {
  if (!href) return;
  let link = document.querySelector("link[rel~='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = href;
};

/** Aggiorna (o crea) la meta description. */
const applicaDescrizione = (testo) => {
  if (!testo) return;
  let meta = document.querySelector("meta[name='description']");
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'description';
    document.head.appendChild(meta);
  }
  meta.content = testo;
};

const BrandingProvider = ({ children }) => {
  const branding = useBranding();
  const theme = useThemeStore((state) => state.theme);
  const hasExplicitPreference = useThemeStore((state) => state.hasExplicitPreference);
  const setTheme = useThemeStore((state) => state.setTheme);

  const { colorePrimario, coloreSecondario, coloreAccento, temaPredefinito } =
    branding.aspetto ?? {};

  // ── 1. Colori ──
  useEffect(() => {
    const root = document.documentElement;
    // Ripartiamo puliti: una scuola che rimuove un colore torna al design system.
    rimuoviToken(root, TOKEN_GESTITI);

    const primario = scalaBrand(colorePrimario, theme);
    const secondario = scalaBrand(coloreSecondario, theme);
    const accento = scalaBrand(coloreAccento, theme);

    if (primario) applicaPrimario(root, primario);
    if (secondario) applicaSecondario(root, secondario);
    if (accento) applicaAccento(root, accento);

    return () => rimuoviToken(root, TOKEN_GESTITI);
  }, [colorePrimario, coloreSecondario, coloreAccento, theme]);

  // ── 2. Identità del documento ──
  useEffect(() => {
    if (branding.nome) {
      document.title = branding.slogan
        ? `${branding.nome} — ${branding.slogan}`
        : branding.nome;
    }
    applicaDescrizione(branding.descrizione);
    applicaFavicon(branding.faviconUrl);
  }, [branding.nome, branding.slogan, branding.descrizione, branding.faviconUrl]);

  // ── 3. Tema predefinito della scuola ──
  // Si applica UNA sola volta, e solo se l'utente non ha già scelto. `sistema`
  // (o valore assente) lascia in piedi il comportamento di default dello store,
  // che segue `prefers-color-scheme` in tempo reale.
  useEffect(() => {
    if (hasExplicitPreference) return;
    if (temaPredefinito === 'chiaro') setTheme(THEMES.LIGHT, { implicito: true });
    else if (temaPredefinito === 'scuro') setTheme(THEMES.DARK, { implicito: true });
  }, [temaPredefinito, hasExplicitPreference, setTheme]);

  return children ?? null;
};

export default BrandingProvider;
