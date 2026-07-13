'use strict';

/**
 * BANCA DATI (mini) — Matematica: simboli e notazione.
 *
 * Esempio di "mini quiz": una banca piccola ma completa. Ogni voce associa un
 * simbolo matematico al suo nome/significato. Il motore genera domande
 * simbolo→nome e nome→simbolo. Notazione standard.
 */

const S = (id, simbolo, nome) => ({
  id: `matSimboli.${id}`,
  sezione: 'simboli',
  campi: { simbolo, nome },
});

module.exports = {
  codice: 'matematica-simboli',
  materia: 'Matematica',
  categoria: 'Simboli e notazione',
  nome: { it: 'Matematica — Simboli', en: 'Mathematics — Symbols' },
  descrizione: {
    it: 'Simboli matematici e logici e il loro significato (mini quiz).',
    en: 'Mathematical and logical symbols and their meaning (mini quiz).',
  },
  campi: {
    simbolo: { it: 'Simbolo', en: 'Symbol' },
    nome: { it: 'Significato', en: 'Meaning' },
  },
  modalita: [
    {
      codice: 'simbolo-nome',
      promptCampo: 'simbolo',
      rispostaCampo: 'nome',
      nome: { it: 'Simbolo → Significato', en: 'Symbol → Meaning' },
      istruzione: { it: 'Scegli il significato corretto.', en: 'Choose the correct meaning.' },
    },
    {
      codice: 'nome-simbolo',
      promptCampo: 'nome',
      rispostaCampo: 'simbolo',
      nome: { it: 'Significato → Simbolo', en: 'Meaning → Symbol' },
      istruzione: { it: 'Scegli il simbolo corretto.', en: 'Choose the correct symbol.' },
    },
  ],
  sezioni: [{ codice: 'simboli', nome: { it: 'Simboli matematici', en: 'Mathematical symbols' } }],
  voci: [
    S('somma', '∑', 'Sommatoria'),
    S('prodotto', '∏', 'Produttoria'),
    S('integrale', '∫', 'Integrale'),
    S('radice', '√', 'Radice quadrata'),
    S('infinito', '∞', 'Infinito'),
    S('diverso', '≠', 'Diverso da'),
    S('circa', '≈', 'Circa uguale a'),
    S('minore-uguale', '≤', 'Minore o uguale a'),
    S('maggiore-uguale', '≥', 'Maggiore o uguale a'),
    S('appartiene', '∈', 'Appartiene (a un insieme)'),
    S('sottoinsieme', '⊂', 'È sottoinsieme di'),
    S('unione', '∪', 'Unione'),
    S('intersezione', '∩', 'Intersezione'),
    S('vuoto', '∅', 'Insieme vuoto'),
    S('per-ogni', '∀', 'Per ogni'),
    S('esiste', '∃', 'Esiste'),
    S('implica', '⇒', 'Implica'),
    S('sse', '⇔', 'Se e solo se'),
    S('pi', 'π', 'Pi greco'),
    S('perpendicolare', '⊥', 'Perpendicolare a'),
  ],
};
