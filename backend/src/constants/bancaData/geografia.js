'use strict';

/**
 * BANCA DATI — Geografia: capitali europee.
 *
 * Ogni voce associa un paese europeo alla sua capitale (nomi in italiano). Il
 * motore genera domande paese→capitale e capitale→paese. Dati verificabili.
 */

const P = (id, paese, capitale) => ({
  id: `geografia.${id}`,
  sezione: 'europa',
  campi: { paese, capitale },
});

module.exports = {
  codice: 'geografia',
  materia: 'Geografia',
  categoria: 'Capitali europee',
  nome: { it: 'Geografia — Capitali europee', en: 'Geography — European capitals' },
  descrizione: {
    it: 'Le capitali degli Stati europei.',
    en: 'The capital cities of European states.',
  },
  campi: {
    paese: { it: 'Paese', en: 'Country' },
    capitale: { it: 'Capitale', en: 'Capital' },
  },
  modalita: [
    {
      codice: 'paese-capitale',
      promptCampo: 'paese',
      rispostaCampo: 'capitale',
      nome: { it: 'Paese → Capitale', en: 'Country → Capital' },
      istruzione: { it: 'Scegli la capitale corretta.', en: 'Choose the correct capital.' },
    },
    {
      codice: 'capitale-paese',
      promptCampo: 'capitale',
      rispostaCampo: 'paese',
      nome: { it: 'Capitale → Paese', en: 'Capital → Country' },
      istruzione: { it: 'Scegli il paese corretto.', en: 'Choose the correct country.' },
    },
  ],
  sezioni: [{ codice: 'europa', nome: { it: 'Europa', en: 'Europe' } }],
  voci: [
    P('italia', 'Italia', 'Roma'),
    P('francia', 'Francia', 'Parigi'),
    P('germania', 'Germania', 'Berlino'),
    P('spagna', 'Spagna', 'Madrid'),
    P('portogallo', 'Portogallo', 'Lisbona'),
    P('regno-unito', 'Regno Unito', 'Londra'),
    P('irlanda', 'Irlanda', 'Dublino'),
    P('paesi-bassi', 'Paesi Bassi', 'Amsterdam'),
    P('belgio', 'Belgio', 'Bruxelles'),
    P('lussemburgo', 'Lussemburgo', 'Lussemburgo'),
    P('svizzera', 'Svizzera', 'Berna'),
    P('austria', 'Austria', 'Vienna'),
    P('danimarca', 'Danimarca', 'Copenaghen'),
    P('svezia', 'Svezia', 'Stoccolma'),
    P('norvegia', 'Norvegia', 'Oslo'),
    P('finlandia', 'Finlandia', 'Helsinki'),
    P('islanda', 'Islanda', 'Reykjavík'),
    P('polonia', 'Polonia', 'Varsavia'),
    P('rep-ceca', 'Repubblica Ceca', 'Praga'),
    P('slovacchia', 'Slovacchia', 'Bratislava'),
    P('ungheria', 'Ungheria', 'Budapest'),
    P('romania', 'Romania', 'Bucarest'),
    P('bulgaria', 'Bulgaria', 'Sofia'),
    P('grecia', 'Grecia', 'Atene'),
    P('croazia', 'Croazia', 'Zagabria'),
    P('slovenia', 'Slovenia', 'Lubiana'),
    P('serbia', 'Serbia', 'Belgrado'),
    P('bosnia', 'Bosnia ed Erzegovina', 'Sarajevo'),
    P('montenegro', 'Montenegro', 'Podgorica'),
    P('macedonia-nord', 'Macedonia del Nord', 'Skopje'),
    P('albania', 'Albania', 'Tirana'),
    P('ucraina', 'Ucraina', 'Kiev'),
    P('bielorussia', 'Bielorussia', 'Minsk'),
    P('russia', 'Russia', 'Mosca'),
    P('estonia', 'Estonia', 'Tallinn'),
    P('lettonia', 'Lettonia', 'Riga'),
    P('lituania', 'Lituania', 'Vilnius'),
    P('moldavia', 'Moldavia', 'Chișinău'),
    P('malta', 'Malta', 'La Valletta'),
    P('cipro', 'Cipro', 'Nicosia'),
    P('andorra', 'Andorra', 'Andorra la Vella'),
    P('san-marino', 'San Marino', 'San Marino'),
    P('liechtenstein', 'Liechtenstein', 'Vaduz'),
    P('turchia', 'Turchia', 'Ankara'),
  ],
};
