import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import it from '../locales/it/translation.json';
import en from '../locales/en/translation.json';

/**
 * Configurazione centralizzata dell'internazionalizzazione del frontend.
 *
 * Le risorse sono importate staticamente (bundle Vite) invece di essere
 * caricate via HTTP: l'inizializzazione è quindi SINCRONA e la UI è
 * disponibile immediatamente nella lingua corretta al primo render, senza
 * bisogno di <Suspense> o di un fallback di caricamento.
 *
 * Regole di rilevamento (requisito):
 *  - lingua salvata localmente (localStorage) -> ha la precedenza;
 *  - altrimenti lingua del browser/sistema (navigator);
 *  - 'it-IT' / 'it' -> 'it'; 'en-US' / 'en' -> 'en';
 *  - qualsiasi altra lingua -> fallback 'en'.
 *
 * La lingua salvata nel profilo backend (GET /me) ha priorità su quella
 * rilevata dal browser: la sincronizzazione avviene in useCurrentUser.
 */

export const SUPPORTED_LANGUAGES = ['it', 'en'];
export const DEFAULT_LANGUAGE = 'en';
export const LANGUAGE_STORAGE_KEY = 'app_lingua';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      it: { translation: it },
      en: { translation: en },
    },
    supportedLngs: SUPPORTED_LANGUAGES,
    fallbackLng: DEFAULT_LANGUAGE,
    // 'it-IT' -> 'it', 'en-GB' -> 'en'
    load: 'languageOnly',
    nonExplicitSupportedLngs: true,
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false, // React effettua già l'escaping
    },
    returnNull: false,
  });

// Normalizza eventuali lingue non supportate (es. 'fr', 'de') sul default,
// così `i18n.language` riflette sempre una lingua effettivamente caricata.
if (!SUPPORTED_LANGUAGES.includes(i18n.language)) {
  i18n.changeLanguage(DEFAULT_LANGUAGE);
}

/**
 * Restituisce la lingua attualmente attiva, garantendo che sia sempre una
 * delle lingue supportate (utile per l'invio al backend e per il switcher).
 */
export const getActiveLanguage = () =>
  SUPPORTED_LANGUAGES.includes(i18n.resolvedLanguage)
    ? i18n.resolvedLanguage
    : DEFAULT_LANGUAGE;

export default i18n;
