'use strict';

const catchAsync = require('../utils/catchAsync');
const certificatoService = require('../services/certificatoService');

/**
 * CertificatoController — livello sottile tra route e certificatoService.
 * Gestisce: rilascio, elenco, dettaglio, revoca, download PDF, verifica
 * pubblica e le risorse (logo/firma) del modello.
 */

// ═════════════════════ RILASCIO (insegnante/admin) ═════════════════════

// POST /api/certificati
exports.emetti = catchAsync(async (req, res) => {
  const { utenteId, corsoId, nomeCorso, esito, dataCompletamento, titolo } = req.body;

  const certificato = await certificatoService.emettiCertificato({
    dati: { utenteId, corsoId, nomeCorso, esito, dataCompletamento, titolo },
    richiedente: req.user,
  });

  res.status(201).json({
    status: 'success',
    message: 'Certificato rilasciato con successo.',
    data: { certificato: certificato.toPublicJSON() },
  });
});

// ═════════════════════ LETTURE (studente + staff) ═════════════════════

// GET /api/certificati
exports.elenco = catchAsync(async (req, res) => {
  const { utenteId, corsoId, stato, q, scuolaId, page, limit } = req.query;

  const { certificati, paginazione } = await certificatoService.elencoCertificati({
    richiedente: req.user,
    filtri: { utenteId, corsoId, stato, q, scuolaId, page, limit },
  });

  res.status(200).json({
    status: 'success',
    results: certificati.length,
    data: { certificati },
    paginazione,
  });
});

// GET /api/certificati/:id
exports.dettaglio = catchAsync(async (req, res) => {
  const certificato = await certificatoService.dettaglioCertificato({
    certificatoId: req.params.id,
    richiedente: req.user,
  });

  res.status(200).json({
    status: 'success',
    data: { certificato: certificato.toPublicJSON() },
  });
});

// GET /api/certificati/:id/pdf
exports.scaricaPdf = catchAsync(async (req, res) => {
  const { buffer, filename } = await certificatoService.generaPdf({
    certificatoId: req.params.id,
    richiedente: req.user,
  });

  const nomeAscii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, "'");
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Length', buffer.length);
  res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${nomeAscii}"; filename*=UTF-8''${encodeURIComponent(filename)}`
  );
  res.status(200).end(buffer);
});

// ═════════════════════ REVOCA (insegnante/admin) ═════════════════════

// POST /api/certificati/:id/revoca
exports.revoca = catchAsync(async (req, res) => {
  const certificato = await certificatoService.revocaCertificato({
    certificatoId: req.params.id,
    motivo: req.body.motivo,
    richiedente: req.user,
  });

  res.status(200).json({
    status: 'success',
    message: 'Certificato revocato con successo.',
    data: { certificato: certificato.toPublicJSON() },
  });
});

// ═════════════════════ VERIFICA PUBBLICA (nessuna auth) ═════════════════════

// GET /api/certificati/verifica/:codice
exports.verifica = catchAsync(async (req, res) => {
  const risultato = await certificatoService.verificaPubblica({ codice: req.params.codice });

  res.status(200).json({
    status: 'success',
    data: { certificato: risultato },
  });
});

// ═════════════════════ RISORSE DEL MODELLO (logo/firma) ═════════════════════

// POST /api/certificati/risorse   (upload immagine → id da salvare nel modello)
exports.caricaRisorsa = catchAsync(async (req, res) => {
  const file = await certificatoService.caricaRisorsa({
    file: req.file,
    richiedente: req.user,
  });

  res.status(201).json({
    status: 'success',
    message: 'Risorsa caricata con successo.',
    data: { file },
  });
});

// GET /api/certificati/risorse/:fileId   (anteprima logo/firma, solo staff)
exports.serviRisorsa = catchAsync(async (req, res) => {
  return certificatoService.serviRisorsa({
    req,
    res,
    fileId: req.params.fileId,
    richiedente: req.user,
  });
});
