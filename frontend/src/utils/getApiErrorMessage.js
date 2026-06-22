import { parseApiError } from './parseApiError';

/**
 * Restituisce un messaggio di errore GIÀ LOCALIZZATO a partire da un errore
 * Axios, applicando la seguente priorità:
 *
 *  1. errore di rete (nessuna response)  -> errors.network
 *  2. `code` machine-readable noto        -> errors.codes.<CODE>
 *  3. messaggio grezzo del backend        -> usato così com'è (fallback)
 *  4. nessuna informazione utile          -> errors.unexpected
 *
 * Il backend espone un `code` per quasi tutti gli AppError: mappando il code
 * sulle traduzioni del frontend evitiamo di mostrare testi non localizzati,
 * pur mantenendo come ultima rete di sicurezza il messaggio del server.
 *
 * @param {Function} t  funzione di traduzione di react-i18next
 * @param {Error}    error errore Axios
 */
export const getApiErrorMessage = (t, error) => {
  const parsed = parseApiError(error);

  if (parsed.code === 'NETWORK_ERROR') {
    return t('errors.network');
  }

  if (parsed.code) {
    const key = `errors.codes.${parsed.code}`;
    const translated = t(key, { defaultValue: '' });
    if (translated) {
      return translated;
    }
  }

  return parsed.message || t('errors.unexpected');
};
