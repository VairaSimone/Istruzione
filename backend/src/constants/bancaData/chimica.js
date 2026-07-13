'use strict';

/**
 * BANCA DATI — Chimica: elementi della tavola periodica.
 *
 * Ogni voce ha simbolo, nome italiano, numero atomico (come stringa) e nome
 * inglese (nella spiegazione). Simboli e numeri atomici sono dati fissi e
 * verificabili (IUPAC). Il motore genera domande simbolo↔nome e numero→simbolo.
 */

const E = (simbolo, numero, nome, nomeEn) => ({
  id: `chimica.${simbolo}`,
  sezione: 'elementi',
  campi: { simbolo, nome, numero: String(numero) },
  spiegazione: { it: `Numero atomico ${numero}.`, en: `${nomeEn} — atomic number ${numero}.` },
});

module.exports = {
  codice: 'chimica',
  materia: 'Chimica',
  categoria: 'Tavola periodica',
  nome: { it: 'Chimica — Elementi', en: 'Chemistry — Elements' },
  descrizione: {
    it: 'Simboli, nomi e numeri atomici degli elementi della tavola periodica.',
    en: 'Symbols, names and atomic numbers of the periodic table elements.',
  },
  campi: {
    simbolo: { it: 'Simbolo', en: 'Symbol' },
    nome: { it: 'Nome', en: 'Name' },
    numero: { it: 'Numero atomico', en: 'Atomic number' },
  },
  modalita: [
    {
      codice: 'simbolo-nome',
      promptCampo: 'simbolo',
      rispostaCampo: 'nome',
      nome: { it: 'Simbolo → Nome', en: 'Symbol → Name' },
      istruzione: { it: "Scegli il nome dell'elemento.", en: 'Choose the element name.' },
    },
    {
      codice: 'nome-simbolo',
      promptCampo: 'nome',
      rispostaCampo: 'simbolo',
      nome: { it: 'Nome → Simbolo', en: 'Name → Symbol' },
      istruzione: { it: 'Scegli il simbolo corretto.', en: 'Choose the correct symbol.' },
    },
    {
      codice: 'numero-simbolo',
      promptCampo: 'numero',
      rispostaCampo: 'simbolo',
      nome: { it: 'Numero atomico → Simbolo', en: 'Atomic number → Symbol' },
      istruzione: { it: 'Scegli il simbolo corretto.', en: 'Choose the correct symbol.' },
    },
  ],
  sezioni: [{ codice: 'elementi', nome: { it: 'Elementi chimici', en: 'Chemical elements' } }],
  voci: [
    E('H', 1, 'Idrogeno', 'Hydrogen'),
    E('He', 2, 'Elio', 'Helium'),
    E('Li', 3, 'Litio', 'Lithium'),
    E('Be', 4, 'Berillio', 'Beryllium'),
    E('B', 5, 'Boro', 'Boron'),
    E('C', 6, 'Carbonio', 'Carbon'),
    E('N', 7, 'Azoto', 'Nitrogen'),
    E('O', 8, 'Ossigeno', 'Oxygen'),
    E('F', 9, 'Fluoro', 'Fluorine'),
    E('Ne', 10, 'Neon', 'Neon'),
    E('Na', 11, 'Sodio', 'Sodium'),
    E('Mg', 12, 'Magnesio', 'Magnesium'),
    E('Al', 13, 'Alluminio', 'Aluminium'),
    E('Si', 14, 'Silicio', 'Silicon'),
    E('P', 15, 'Fosforo', 'Phosphorus'),
    E('S', 16, 'Zolfo', 'Sulfur'),
    E('Cl', 17, 'Cloro', 'Chlorine'),
    E('Ar', 18, 'Argon', 'Argon'),
    E('K', 19, 'Potassio', 'Potassium'),
    E('Ca', 20, 'Calcio', 'Calcium'),
    E('Ti', 22, 'Titanio', 'Titanium'),
    E('Cr', 24, 'Cromo', 'Chromium'),
    E('Mn', 25, 'Manganese', 'Manganese'),
    E('Fe', 26, 'Ferro', 'Iron'),
    E('Co', 27, 'Cobalto', 'Cobalt'),
    E('Ni', 28, 'Nichel', 'Nickel'),
    E('Cu', 29, 'Rame', 'Copper'),
    E('Zn', 30, 'Zinco', 'Zinc'),
    E('Br', 35, 'Bromo', 'Bromine'),
    E('Ag', 47, 'Argento', 'Silver'),
    E('Sn', 50, 'Stagno', 'Tin'),
    E('I', 53, 'Iodio', 'Iodine'),
    E('Pt', 78, 'Platino', 'Platinum'),
    E('Au', 79, 'Oro', 'Gold'),
    E('Hg', 80, 'Mercurio', 'Mercury'),
    E('Pb', 82, 'Piombo', 'Lead'),
    E('U', 92, 'Uranio', 'Uranium'),
  ],
};
