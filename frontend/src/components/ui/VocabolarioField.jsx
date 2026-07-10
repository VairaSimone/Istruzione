import { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useVocabolario } from '../../hooks/useImpostazioniScuola';
import TextField from './TextField';
import Select from './Select';

/**
 * CAMPO DI VOCABOLARIO — il cuore della genericità della piattaforma.
 *
 * Classi, livelli e materie non sono più ENUM cablati nel codice: ogni scuola
 * definisce il proprio vocabolario in `impostazioni.didattica`. Da qui due
 * comportamenti, decisi a runtime:
 *
 *   - vocabolario VALORIZZATO → il campo è un <select> con le sole voci
 *     ammesse. È la scuola a dettare la nomenclatura, e il backend la fa
 *     rispettare (422 fuori vocabolario);
 *   - vocabolario VUOTO → il campo è un <input> a testo libero. È il default di
 *     una scuola nuova: nessuno la costringe a usare le classi di un'altra.
 *
 * L'admin non ha una scuola propria e non riceve alcun vocabolario: per lui il
 * campo è sempre a testo libero, e la validazione avviene lato server sulla
 * scuola di destinazione.
 *
 * Compatibile con react-hook-form: `{...register('livello')}`.
 *
 * @param {'classiDisponibili'|'livelliDisponibili'|'materieDisponibili'} vocabolario
 * @param {string} [placeholder] testo della option vuota (select) o del campo
 * @param {boolean} [consentiVuoto] mostra l'option "nessuno" anche col vocabolario
 */
const VocabolarioField = forwardRef(
  (
    {
      vocabolario,
      label,
      error,
      hint,
      required = false,
      placeholder,
      consentiVuoto = true,
      maxLength,
      ...rest
    },
    ref
  ) => {
    const { t } = useTranslation();
    const voci = useVocabolario(vocabolario);

    if (voci.length === 0) {
      return (
        <TextField
          ref={ref}
          label={label}
          required={required}
          error={error}
          hint={hint ?? t('vocabolario.testoLiberoHint')}
          placeholder={placeholder}
          maxLength={maxLength}
          {...rest}
        />
      );
    }

    return (
      <Select
        ref={ref}
        label={label}
        required={required}
        error={error}
        placeholder={
          placeholder ?? (consentiVuoto ? t('vocabolario.nessuno') : undefined)
        }
        {...rest}
      >
        {voci.map((voce) => (
          <option key={voce} value={voce}>
            {voce}
          </option>
        ))}
      </Select>
    );
  }
);

VocabolarioField.displayName = 'VocabolarioField';

export default VocabolarioField;
