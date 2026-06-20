/**
 * Normalizza un errore Axios proveniente dal backend in un oggetto consistente.
 *
 * Il backend può rispondere in due formati distinti per gli errori, a seconda
 * della fonte (vedi middleware/validate.js vs errorHandler.js):
 *
 *  - 422 da express-validator: { status, code: 'VALIDATION_ERROR', message, errori: [{campo, messaggio, valore}] }
 *  - Tutti gli altri (AppError, Sequelize, JWT...): { status, code, message }
 *
 * Questa funzione unifica entrambi in: { message, code, fieldErrors, statusCode }
 * dove `fieldErrors` è null se non si tratta di un errore di validazione per-campo.
 */
export const parseApiError = (error) => {
  if (!error?.response) {
    return {
      message: 'Impossibile contattare il server. Verifica la connessione e riprova.',
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
    message: data?.message || 'Si è verificato un errore imprevisto. Riprova più tardi.',
    code: data?.code || null,
    fieldErrors,
    statusCode: status,
  };
};
