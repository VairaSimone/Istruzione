import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as configService from '../services/configService';
import * as scuoleService from '../services/scuoleService';
import { queryKeys } from '../constants/queryKeys';
import { getScuolaSlug, setScuolaSlug } from '../api/tenant';
import { FUNZIONALITA_PREDEFINITE } from '../constants/funzionalita';
import { useAuthStore, selectIsAuthenticated, selectIsAdmin } from '../store/authStore';

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
      nomeBreve: impostazioni.identita?.nomeBreve || null,
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
      // Avviso pubblico (banner) configurabile dalla scuola.
      comunicazioni: impostazioni.comunicazioni ?? {},
      // Homepage pubblica personalizzabile: servita sul dominio della scuola.
      // `attiva: false` (o assente) ⇒ la HomePage ricade sul layout standard.
      homepage: impostazioni.homepage ?? {},
      piattaforma,
      scuola,
    };
  }, [data, isLoading, isError]);
};

/**
 * Scuola dell'UTENTE AUTENTICATO (`GET /api/scuole/mia`).
 *
 * Il backend la ricava da `req.user.scuola_id`: è l'unica fonte che non dipende
 * da dominio, `?scuola=` o localStorage. Per l'admin risponde `null` — è
 * trasversale e non ha un tenant proprio — quindi la query non parte nemmeno.
 */
export const useMiaScuola = () => {
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const isAdmin = useAuthStore(selectIsAdmin);
  return useQuery({
    queryKey: queryKeys.scuole.mia,
    queryFn: scuoleService.getMiaScuola,
    enabled: isAuthenticated && !isAdmin,
    staleTime: CINQUE_MINUTI,
    refetchOnWindowFocus: false,
    retry: 1,
  });
};

/**
 * Sezioni attive nel CONTESTO CORRENTE, con lo stato di caricamento.
 *
 * ─────────────────────────────────────────────
 * PERCHÉ NON BASTA `useConfig()`
 * ─────────────────────────────────────────────
 * `GET /api/config` è PUBBLICO e risolve il tenant da dominio / `X-Scuola` /
 * scuola predefinita — mai da `req.user`. Su un deploy multi-scuola a dominio
 * condiviso, chi arriva su `/login` senza `?scuola=` e senza una scelta
 * precedente in localStorage riceve le funzionalità della scuola PREDEFINITA.
 * Dopo il login continuava a vederle: menu e route della scuola sbagliata.
 * Finché il gate era rotto (l'array trattato come mappa) non si notava, perché
 * non nascondeva comunque nulla.
 *
 * Ora la fonte cambia con il contesto:
 *
 *   - NON autenticato → `/api/config` (è tutto ciò che esiste, ed è giusto:
 *     serve solo a vestire la pagina di login);
 *   - ADMIN           → i default del registro. È trasversale alle scuole e nel
 *     backend bypassa sempre `richiediFunzionalita`: nascondergli una sezione
 *     perché una scuola qualsiasi l'ha spenta sarebbe un errore;
 *   - STUDENTE/INSEGNANTE → `/api/scuole/mia`, cioè la PROPRIA scuola.
 *
 * Durante il caricamento si ricade sui DEFAULT: meglio una voce di menu in più
 * per una frazione di secondo che far sparire mezza applicazione a ogni
 * refresh. Il gate autorevole resta il backend (403 `FEATURE_DISABLED`).
 *
 * @returns {{ funzionalita: Object<string, boolean>, isLoading: boolean }}
 */
export const useFunzionalitaContesto = () => {
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const isAdmin = useAuthStore(selectIsAdmin);
  const config = useConfig();
  const mia = useMiaScuola();

  return useMemo(() => {
    if (isAdmin) return { funzionalita: FUNZIONALITA_PREDEFINITE, isLoading: false };

    if (isAuthenticated) {
      return {
        funzionalita: mia.data?.impostazioni?.funzionalita ?? FUNZIONALITA_PREDEFINITE,
        isLoading: mia.isLoading,
      };
    }

    return {
      funzionalita: config.data?.funzionalita ?? FUNZIONALITA_PREDEFINITE,
      isLoading: config.isLoading,
    };
  }, [isAdmin, isAuthenticated, mia.data, mia.isLoading, config.data, config.isLoading]);
};

/** Mappa `{ chiave: boolean }` delle sezioni attive nel contesto corrente. */
export const useFunzionalita = () => useFunzionalitaContesto().funzionalita;

/** `true` se la sezione indicata è attiva nel contesto corrente. */
export const useFunzionalitaAttiva = (chiave) => {
  const funzionalita = useFunzionalita();
  if (!chiave) return true;
  return funzionalita[chiave] !== false;
};

/**
 * Allinea il TENANT ATTIVO alla scuola dell'utente appena autenticato.
 *
 * Le funzionalità le prende già `useFunzionalitaContesto` dalla fonte giusta,
 * ma restava il BRANDING: nome, logo e colori continuavano ad arrivare da
 * `/api/config`, cioè dalla scuola predefinita. `setScuolaSlug` era chiamata in
 * un unico punto (`ScuolaSwitcher`, pre-login) e mai dopo il login.
 *
 * Qui, appena `/api/scuole/mia` risponde, se lo slug attivo è diverso da quello
 * della propria scuola lo si corregge e si invalida `/api/config`: la chiave di
 * cache dipende dallo slug, quindi il branding viene rifatto da solo.
 *
 * No-op quando la build è dedicata a una scuola (`VITE_SCUOLA_SLUG`):
 * `setScuolaSlug` rifiuta e ritorna `false`.
 *
 * Da montare una sola volta, al boot dell'app.
 */
export const useAllineaTenantUtente = () => {
  const queryClient = useQueryClient();
  const { data: scuola } = useMiaScuola();
  const slugUtente = scuola?.slug ?? null;

  useEffect(() => {
    if (!slugUtente || slugUtente === getScuolaSlug()) return;
    if (setScuolaSlug(slugUtente)) {
      queryClient.invalidateQueries({ queryKey: queryKeys.config.all });
    }
  }, [slugUtente, queryClient]);
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
