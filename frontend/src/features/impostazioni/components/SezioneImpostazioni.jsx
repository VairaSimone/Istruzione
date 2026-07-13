import { useTranslation } from 'react-i18next';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import CampoImpostazione from './CampoImpostazione';
import SocialEditor from './SocialEditor';
import HomepageEditor from './HomepageEditor';
import FunzionalitaPanel from './FunzionalitaPanel';
import styles from './Impostazioni.module.css';

/**
 * Una SEZIONE del pannello impostazioni, generata dallo schema.
 *
 * Due sezioni hanno una forma propria e non si riducono a un elenco di campi:
 *   - `social`       → un oggetto di URL per rete più una lista libera;
 *   - `funzionalita` → una mappa di interruttori con nucleo e dipendenze.
 * Il backend le marca `campoUnico: true`; qui deleghiamo al loro editor.
 *
 * Tutte le altre sono elenchi di campi resi da `CampoImpostazione`, che sceglie
 * il controllo giusto guardando il tipo dichiarato. Nessun nome di campo è
 * cablato in questo file.
 *
 * Le sezioni PRIVATE (oggi solo `didattica`) portano un'etichetta: chi le
 * compila deve sapere che quei valori non finiscono nel branding pubblico.
 */
const SezioneImpostazioni = ({
  nome,
  descrittore,
  valore,
  onChange,
  catalogoFunzionalita = [],
}) => {
  const { t } = useTranslation();

  const titolo = t(`impostazioni.sezioni.${nome}.titolo`, { defaultValue: nome });
  const descrizione = t(`impostazioni.sezioni.${nome}.descrizione`, { defaultValue: '' });

  const aggiornaCampo = (campo, nuovo) => {
    // Stringa vuota ⇒ `null`: è così che il backend distingue «non toccare» da
    // «azzera esplicitamente». Senza questa conversione un campo svuotato
    // resterebbe al suo vecchio valore.
    const normalizzato = typeof nuovo === 'string' && nuovo.trim() === '' ? null : nuovo;
    onChange({ ...(valore ?? {}), [campo]: normalizzato });
  };

  const corpo = () => {
    if (nome === 'funzionalita') {
      return (
        <FunzionalitaPanel
          catalogo={catalogoFunzionalita}
          valore={valore ?? {}}
          onChange={onChange}
        />
      );
    }

    // La homepage ha una forma annidata (hero, sezioni, form, SEO): editor dedicato.
    if (nome === 'homepage') {
      return (
        <HomepageEditor valore={valore ?? {}} descrittore={descrittore} onChange={onChange} />
      );
    }

    if (nome === 'social' || descrittore.campoUnico) {
      return <SocialEditor valore={valore ?? {}} onChange={onChange} />;
    }

    return (
      <div className={styles.griglia}>
        {Object.entries(descrittore.campi ?? {}).map(([campo, d]) => (
          <div key={campo} className={d.tipo === 'vocabolario' || d.tipo === 'link' ? styles.campoLargo : undefined}>
            <CampoImpostazione
              sezione={nome}
              nome={campo}
              descrittore={d}
              valore={valore?.[campo]}
              onChange={(nuovo) => aggiornaCampo(campo, nuovo)}
            />
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card className={styles.sezione}>
      <header className={styles.sezioneHead}>
        <h2 className={styles.sezioneTitolo}>
          {titolo}
          {descrittore.pubblica === false && (
            <Badge tone="neutral">{t('impostazioni.privata')}</Badge>
          )}
        </h2>
        {descrizione && <p className={styles.sezioneDescrizione}>{descrizione}</p>}
      </header>
      {corpo()}
    </Card>
  );
};

export default SezioneImpostazioni;
