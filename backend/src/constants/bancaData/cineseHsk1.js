'use strict';

/**
 * BANCA DATI — Cinese (mandarino), livello base HSK 1.
 *
 * Ogni voce associa un CARATTERE (hanzi) al suo PINYIN (con segni tonali, non
 * numeri) e al suo significato in italiano. Il motore genera due direzioni:
 * carattere → pinyin (pronuncia) e carattere → significato.
 *
 * ATTENZIONE ALLA CORRETTEZZA (priorità assoluta per contenuti linguistici):
 *   - il pinyin è riportato con i DIACRITICI tonali (es. hǎo, non hao3);
 *   - il tono indicato è quello del carattere in ISOLAMENTO (la lettura
 *     canonica del dizionario), non quello eventualmente modificato dai sandhi
 *     tonali nel discorso (es. 不 è `bù`, la variante `bú` prima di 4° tono è un
 *     fenomeno contestuale che non si insegna come lettura di base);
 *   - sono stati esclusi gli omofoni ambigui (es. 她 `tā`, omofono di 他) per
 *     non generare due voci con la stessa risposta pinyin nella stessa sezione.
 *
 * Selezione: caratteri fondamentali del vocabolario HSK 1, scelti perché
 * univoci e privi di letture multiple problematiche a livello base.
 */

const V = (id, sezione, hanzi, pinyin, significato, spiegazione) => ({
  id: `cinese-hsk1.${id}`,
  sezione,
  campi: { hanzi, pinyin, significato },
  ...(spiegazione ? { spiegazione } : {}),
});

module.exports = {
  codice: 'cinese-hsk1',
  materia: 'Cinese',
  categoria: 'Caratteri HSK 1',
  lingua: 'zh',
  nome: { it: 'Cinese — Caratteri HSK 1', en: 'Chinese — HSK 1 characters' },
  descrizione: {
    it: 'Caratteri fondamentali del mandarino (HSK 1): pinyin con toni e significato.',
    en: 'Fundamental Mandarin characters (HSK 1): toned pinyin and meaning.',
  },
  campi: {
    hanzi: { it: 'Carattere', en: 'Character' },
    pinyin: { it: 'Pinyin', en: 'Pinyin' },
    significato: { it: 'Significato', en: 'Meaning' },
  },
  modalita: [
    {
      codice: 'hanzi-pinyin',
      promptCampo: 'hanzi',
      rispostaCampo: 'pinyin',
      nome: { it: 'Carattere → Pinyin', en: 'Character → Pinyin' },
      istruzione: {
        it: 'Scegli il pinyin corretto (con il tono giusto).',
        en: 'Choose the correct pinyin (with the right tone).',
      },
    },
    {
      codice: 'hanzi-significato',
      promptCampo: 'hanzi',
      rispostaCampo: 'significato',
      nome: { it: 'Carattere → Significato', en: 'Character → Meaning' },
      istruzione: { it: 'Scegli il significato corretto.', en: 'Choose the correct meaning.' },
    },
  ],
  sezioni: [
    { codice: 'numeri', nome: { it: 'Numeri', en: 'Numbers' } },
    { codice: 'persone', nome: { it: 'Persone e famiglia', en: 'People and family' } },
    { codice: 'verbi', nome: { it: 'Verbi comuni', en: 'Common verbs' } },
    { codice: 'natura-cose', nome: { it: 'Natura e oggetti', en: 'Nature and objects' } },
    { codice: 'aggettivi', nome: { it: 'Aggettivi e quantità', en: 'Adjectives and quantity' } },
  ],
  voci: [
    // ── Numeri ──
    V('uno', 'numeri', '一', 'yī', 'uno'),
    V('due', 'numeri', '二', 'èr', 'due'),
    V('tre', 'numeri', '三', 'sān', 'tre'),
    V('quattro', 'numeri', '四', 'sì', 'quattro'),
    V('cinque', 'numeri', '五', 'wǔ', 'cinque'),
    V('sei', 'numeri', '六', 'liù', 'sei'),
    V('sette', 'numeri', '七', 'qī', 'sette'),
    V('otto', 'numeri', '八', 'bā', 'otto'),
    V('nove', 'numeri', '九', 'jiǔ', 'nove'),
    V('dieci', 'numeri', '十', 'shí', 'dieci'),
    V('zero', 'numeri', '零', 'líng', 'zero'),
    V('cento', 'numeri', '百', 'bǎi', 'cento'),

    // ── Persone e famiglia ──
    V('io', 'persone', '我', 'wǒ', 'io'),
    V('tu', 'persone', '你', 'nǐ', 'tu'),
    V('lui', 'persone', '他', 'tā', 'lui', {
      it: 'Terza persona (lui). La forma femminile 她 si pronuncia allo stesso modo.',
      en: 'Third person (he). The feminine form 她 is pronounced the same way.',
    }),
    V('persona', 'persone', '人', 'rén', 'persona'),
    V('uomo', 'persone', '男', 'nán', 'uomo'),
    V('donna', 'persone', '女', 'nǚ', 'donna'),
    V('papa', 'persone', '爸', 'bà', 'papà', {
      it: 'Nell’uso quotidiano è raddoppiato: 爸爸 bàba.',
      en: 'In everyday use it is doubled: 爸爸 bàba.',
    }),
    V('mamma', 'persone', '妈', 'mā', 'mamma', {
      it: 'Nell’uso quotidiano è raddoppiato: 妈妈 māma.',
      en: 'In everyday use it is doubled: 妈妈 māma.',
    }),

    // ── Verbi comuni ──
    V('essere', 'verbi', '是', 'shì', 'essere'),
    V('avere', 'verbi', '有', 'yǒu', 'avere'),
    V('mangiare', 'verbi', '吃', 'chī', 'mangiare'),
    V('bere', 'verbi', '喝', 'hē', 'bere'),
    V('guardare', 'verbi', '看', 'kàn', 'guardare', {
      it: 'Guardare/vedere; con un testo significa anche “leggere” (看书).',
      en: 'To watch/look; with a text it also means “to read” (看书).',
    }),
    V('ascoltare', 'verbi', '听', 'tīng', 'ascoltare'),
    V('parlare', 'verbi', '说', 'shuō', 'parlare'),
    V('venire', 'verbi', '来', 'lái', 'venire'),
    V('andare', 'verbi', '去', 'qù', 'andare'),
    V('amare', 'verbi', '爱', 'ài', 'amare'),
    V('studiare', 'verbi', '学', 'xué', 'studiare'),
    V('scrivere', 'verbi', '写', 'xiě', 'scrivere'),

    // ── Natura e oggetti ──
    V('acqua', 'natura-cose', '水', 'shuǐ', 'acqua'),
    V('fuoco', 'natura-cose', '火', 'huǒ', 'fuoco'),
    V('montagna', 'natura-cose', '山', 'shān', 'montagna'),
    V('sole', 'natura-cose', '日', 'rì', 'sole', {
      it: 'Sole; anche “giorno” in parole composte (es. 生日 compleanno).',
      en: 'Sun; also “day” in compounds (e.g. 生日 birthday).',
    }),
    V('luna', 'natura-cose', '月', 'yuè', 'luna', {
      it: 'Luna; anche “mese” (es. 一月 gennaio).',
      en: 'Moon; also “month” (e.g. 一月 January).',
    }),
    V('cielo', 'natura-cose', '天', 'tiān', 'cielo', {
      it: 'Cielo; anche “giorno” nel senso di giornata (es. 今天 oggi).',
      en: 'Sky; also “day” (e.g. 今天 today).',
    }),
    V('casa', 'natura-cose', '家', 'jiā', 'casa'),
    V('libro', 'natura-cose', '书', 'shū', 'libro'),
    V('te', 'natura-cose', '茶', 'chá', 'tè'),
    V('denaro', 'natura-cose', '钱', 'qián', 'denaro'),
    V('automobile', 'natura-cose', '车', 'chē', 'automobile'),
    V('centro', 'natura-cose', '中', 'zhōng', 'centro', {
      it: 'Centro/mezzo; in 中国 forma il nome della Cina (“Paese di mezzo”).',
      en: 'Middle/center; in 中国 it forms the name of China (“Middle Kingdom”).',
    }),

    // ── Aggettivi e quantità ──
    V('grande', 'aggettivi', '大', 'dà', 'grande'),
    V('piccolo', 'aggettivi', '小', 'xiǎo', 'piccolo'),
    V('buono', 'aggettivi', '好', 'hǎo', 'buono', {
      it: 'Buono/bene; nel saluto 你好 significa “ciao”.',
      en: 'Good/well; in the greeting 你好 it means “hello”.',
    }),
    V('molto', 'aggettivi', '多', 'duō', 'molto'),
    V('poco', 'aggettivi', '少', 'shǎo', 'poco'),
    V('alto', 'aggettivi', '高', 'gāo', 'alto'),
    V('no', 'aggettivi', '不', 'bù', 'no', {
      it: 'Negazione (“non”). Davanti a un 4° tono si legge bú per sandhi tonale.',
      en: 'Negation (“not”). Before a 4th tone it is read bú due to tone sandhi.',
    }),
  ],
};
