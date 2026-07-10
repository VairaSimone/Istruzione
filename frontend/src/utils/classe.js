/**
 * Etichetta leggibile della CLASSE di un utente.
 *
 * La classe non è più un ENUM di piattaforma con una traduzione per ciascun
 * valore (`classi.Prima`, `classi.Seconda`…): è testo libero definito dalla
 * scuola. Va quindi mostrata così com'è — «Prima», «A1», «Gruppo serale» —
 * senza passare dall'i18n, che non può conoscere in anticipo le classi di una
 * scuola che non esisteva quando le traduzioni sono state scritte.
 *
 * Resta tradotto l'unico caso strutturale: l'assenza di classe, che identifica
 * gli insegnanti.
 *
 * @param {Function} t funzione di traduzione di react-i18next
 * @param {?string} classe valore persistito (può essere null)
 * @param {string} [vuoto] testo da usare quando la classe è assente
 */
export const etichettaClasse = (t, classe, vuoto) => {
  if (classe === null || classe === undefined || classe === '') {
    return vuoto ?? t('classi.null');
  }
  return classe;
};
