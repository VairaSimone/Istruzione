'use strict';

/**
 * Wrapper per le funzioni async dei controller.
 * Evita di scrivere try/catch in ogni controller:
 * qualsiasi errore async viene automaticamente passato a next()
 * e gestito dall'errorHandler globale.
 *
 * Uso:
 *   exports.login = catchAsync(async (req, res, next) => { ... });
 */
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

module.exports = catchAsync;
