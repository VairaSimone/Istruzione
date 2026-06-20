'use strict';

const { validationResult } = require('express-validator');

/**
 * Middleware da usare dopo i validator di express-validator.
 * Se ci sono errori di validazione, restituisce 422 con la lista degli errori.
 *
 * IMPORTANTE: non viene MAI restituito il valore inviato dal client
 * (`err.value`), per evitare di rispedire dati sensibili in chiaro
 * (es. la password fallita nella validazione di registrazione/login).
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const erroriFormattati = errors.array().map((err) => ({
      campo: err.path,
      messaggio: err.msg,
    }));

    return res.status(422).json({
      status: 'fail',
      code: 'VALIDATION_ERROR',
      message: 'Dati di input non validi',
      errori: erroriFormattati,
    });
  }

  next();
};

module.exports = validate;