/**
 * Normalizza un errore Axios proveniente dal backend in un oggetto consistente.
 *
 * Il backend può rispondere in due formati distinti per gli errori, a seconda
 * della fonte (vedi middleware/validate.js vs errorHandler.js):
 *
 *  - 422 da express-validator: { status, code: 'VALIDATION_ERROR', message, errori: [{campo, messaggio}] }
 *  - Tutti gli altri (AppError, Sequelize, JWT...): { status, code, message }
 *
 * Questa funzione unifica entrambi in: { message, code, fieldErrors, statusCode }
 * dove `message` è il messaggio GREZZO del backend (in italiano) e `fieldErrors`
 * è null se non si tratta di un errore di validazione per-campo.
 *
 * NOTA i18n: la traduzione del messaggio destinato all'utente NON avviene qui
 * (questa è una utility pura, senza accesso al contesto React). Per ottenere
 * un messaggio già localizzato usare `getApiErrorMessage(t, error)`.
 */
export const parseApiError = (error) => {
  if (!error?.response) {
    return {
      message: null,
      code: 'NETWORK_ERROR',
      fieldErrors: null,
      statusCode: null,
    };
  }

  const { data, status } = error.response;

  const fieldErrors = Array.isArray(data?.errori)
    ? data.errori.reduce((acc, curr) => {
        acc[curr.campo] = curr.messaggio;
        return acc;
      }, {})
    : null;

  return {
    message: data?.message || null,
    code: data?.code || null,
    fieldErrors,
    statusCode: status,
  };
};
