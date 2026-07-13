import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as configService from '../services/configService';
import { queryKeys } from '../constants/queryKeys';
import { getScuolaSlug } from '../api/tenant';
import { FUNZIONALITA_PREDEFINITE } from '../constants/funzionalita';

/**
 * Hook della CONFIGURAZIONE DI PIATTAFORMA.
 *
 * `GET /api/config` è pubblico e viene interrogato al bootstrap dell'app, prima
 * ancora del login: da lì arrivano il branding della scuola (nome, logo,
 * colori, tema, footer, contatti) e la mappa delle sezioni attive.
 *
 * La configurazione cambia raramente: la teniamo in cache a lungo e non la
 * rifacciamo al focus della finestra. La chiave dipende dal tenant attivo, così
 * cambiare scuola non riusa il branding di quella precedente.
 */

const CINQUE_MINUTI = 5 * 60 * 1000;

export const useConfig = () =>
  useQuery({
    queryKey: queryKeys.config.branding(getScuolaSlug()),
    queryFn: configService.getConfig,
    staleTime: CINQUE_MINUTI,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

/**
 * Branding della scuola attiva, con i default della piattaforma già applicati.
 * Ritorna sempre un oggetto utilizzabile, anche durante il caricamento o dopo
 * un errore di rete: la UI non deve mai restare senza nome né colori.
 */
export const useBranding = () => {
  const { data, isLoading, isError } = useConfig();

  return useMemo(() => {
    const piattaforma = data?.piattaforma ?? null;
    const scuola = data?.scuola ?? null;
    const impostazioni = scuola?.impostazioni ?? {};

    return {
      isLoading,
      isError,
      // Identità della SCUOLA, con fallback sull'identità della PIATTAFORMA.
      nome:
        impostazioni.identita?.nomeVisualizzato ||
        scuola?.nome ||
        piattaforma?.nome ||
        import.meta.env.VITE_APP_NAME ||
        '',
      slogan: impostazioni.identita?.slogan || null,
      descrizione: impostazioni.identita?.descrizione || piattaforma?.descrizione || null,
      logoUrl: impostazioni.identita?.logoUrl || null,
      logoScuroUrl: impostazioni.identita?.logoScuroUrl || null,
      faviconUrl: impostazioni.identita?.faviconUrl || null,
      immagineHeroUrl: impostazioni.identita?.immagineHeroUrl || null,
      immagineCopertinaUrl: impostazioni.identita?.immagineCopertinaUrl || null,
      aspetto: impostazioni.aspetto ?? {},
      contatti: impostazioni.contatti ?? {},
      indirizzo: impostazioni.indirizzo ?? {},
      social: impostazioni.social ?? {},
      footer: impostazioni.footer ?? {},
      // Homepage pubblica personalizzabile: servita sul dominio della scuola.
      // `attiva: false` (o assente) ⇒ la HomePage ricade sul layout standard.
      homepage: impostazioni.homepage ?? {},
      piattaforma,
      scuola,
    };
  }, [data, isLoading, isError]);
};

/**
 * Mappa `{ chiave: boolean }` delle sezioni attive per la scuola corrente.
 *
 * Durante il caricamento (e in caso di errore) si ricade sui DEFAULT del
 * registro: meglio mostrare una voce di menu in più per una frazione di secondo
 * che far sparire mezza applicazione a ogni refresh. Il gate autorevole resta
 * comunque il backend, che risponde 403 `FEATURE_DISABLED`.
 */
export const useFunzionalita = () => {
  const { data } = useConfig();
  return data?.funzionalita ?? FUNZIONALITA_PREDEFINITE;
};

/** `true` se la sezione indicata è attiva per la scuola corrente. */
export const useFunzionalitaAttiva = (chiave) => {
  const funzionalita = useFunzionalita();
  if (!chiave) return true;
  return funzionalita[chiave] !== false;
};

/**
 * Catalogo completo delle funzionalità (chiave, nucleo, dipendenze, stato),
 * usato dal pannello di amministrazione per generare gli interruttori.
 */
export const useCatalogoFunzionalita = () => {
  const { data } = useConfig();
  return data?.catalogoFunzionalita ?? [];
};

/** Elenco pubblico delle scuole attive (selettore di tenant). */
export const useScuolePubbliche = () =>
  useQuery({
    queryKey: queryKeys.config.scuolePubbliche,
    queryFn: configService.getScuolePubbliche,
    staleTime: CINQUE_MINUTI,
    refetchOnWindowFocus: false,
    retry: 1,
  });

/**
 * Schema dichiarativo delle impostazioni: consente al pannello di generare i
 * campi in modo dinamico. Aggiungere un campo al backend lo fa comparire nella
 * UI senza modificare il frontend.
 */
export const useSchemaImpostazioni = (opzioni = {}) =>
  useQuery({
    queryKey: queryKeys.config.schema,
    queryFn: configService.getSchemaImpostazioni,
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: opzioni.enabled ?? true,
  });
