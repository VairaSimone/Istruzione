'use strict';

const { validationResult } = require('express-validator');
const AppError = require('../utils/AppError');

/**
 * Middleware da usare dopo i validator di express-validator.
 * Se ci sono errori di validazione, restituisce 422 con lista errori.
 * Altrimenti chiama next() e il controller procede.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    // Mappa gli errori in un formato pulito: { campo: 'messaggio' }
    const erroriFormattati = errors.array().map((err) => ({
      campo: err.path,
      messaggio: err.msg,
      valore: err.value,
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
