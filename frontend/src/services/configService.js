import apiClient from '../api/axiosClient';
import { getScuolaSlug } from '../api/tenant';

/**
 * Service layer della CONFIGURAZIONE DI PIATTAFORMA.
 * Mappa 1:1 gli endpoint di `backend/src/routes/configRoutes.js`.
 *
 * Sono endpoint PUBBLICI: il frontend li interroga al bootstrap, PRIMA del
 * login, per personalizzarsi (nome, logo, colori, tema, footer) e per sapere
 * quali sezioni la scuola ha attivato. Non contengono dati riservati: la vista
 * è filtrata lato server dallo schema delle impostazioni.
 *
 * Il tenant si risolve con lo slug: `?scuola=` esplicito oppure header
 * `X-Scuola` (aggiunto automaticamente da `axiosClient`). In mancanza di
 * entrambi il backend serve la scuola predefinita.
 */

/**
 * GET /api/config — identità della piattaforma, branding della scuola attiva e
 * catalogo delle funzionalità con il loro stato.
 *
 * @returns {Promise<{
 *   piattaforma: { nome: string, descrizione: string, versione: string },
 *   scuola: object|null,
 *   funzionalita: Record<string, boolean>,
 *   catalogoFunzionalita: Array<{ chiave: string, abilitata: boolean, nucleo: boolean }>
 * }>}
 */
export const getConfig = async () => {
  const slug = getScuolaSlug();
  const params = slug ? { scuola: slug } : {};
  const { data } = await apiClient.get('/config', { params });
  return data.data;
};

/**
 * GET /api/config/scuole — elenco pubblico delle scuole attive (slug, nome,
 * logo), per il selettore di tenant. Vuoto o singolo ⇒ il selettore si nasconde.
 */
export const getScuolePubbliche = async () => {
  const { data } = await apiClient.get('/config/scuole');
  return data.data.scuole;
};

/**
 * GET /api/config/schema — descrizione dello SCHEMA delle impostazioni, del
 * registro delle funzionalità e dei tipi di attività.
 *
 * È ciò che consente al pannello di amministrazione di generare il proprio form
 * in modo dinamico: aggiungere un campo allo schema del backend lo fa comparire
 * nella UI senza toccare il frontend.
 */
export const getSchemaImpostazioni = async () => {
  const { data } = await apiClient.get('/config/schema');
  return data.data;
};
