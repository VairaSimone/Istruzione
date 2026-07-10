import { useTranslation } from 'react-i18next';
import TextField from '../../../components/ui/TextField';
import LinkListEditor from './LinkListEditor';
import styles from './Impostazioni.module.css';

/**
 * Editor della sezione SOCIAL: un URL per ciascuna rete riconosciuta più una
 * lista libera `altri` per tutto il resto (Mastodon, Discord, un blog…).
 *
 * Le reti riconosciute sono un elenco chiuso lato backend, ma la presenza di
 * `altri` fa sì che nessuna scuola resti tagliata fuori: la piattaforma non
 * pretende di conoscere in anticipo dove una scuola comunica.
 */
const RETI = ['facebook', 'instagram', 'x', 'linkedin', 'youtube', 'tiktok', 'telegram'];

const SocialEditor = ({ valore = {}, onChange }) => {
  const { t } = useTranslation();
  const social = valore && typeof valore === 'object' ? valore : {};

  const aggiorna = (rete, url) => {
    const prossimo = { ...social };
    if (url.trim() === '') delete prossimo[rete];
    else prossimo[rete] = url;
    onChange(prossimo);
  };

  return (
    <div className={styles.sezioneCorpo}>
      <div className={styles.griglia}>
        {RETI.map((rete) => (
          <TextField
            key={rete}
            label={t(`impostazioni.social.${rete}`)}
            placeholder="https://…"
            value={social[rete] ?? ''}
            onChange={(e) => aggiorna(rete, e.target.value)}
          />
        ))}
      </div>

      <LinkListEditor
        label={t('impostazioni.social.altri')}
        descrizione={t('impostazioni.social.altriHint')}
        valore={social.altri ?? []}
        onChange={(altri) => onChange({ ...social, altri })}
      />
    </div>
  );
};

export default SocialEditor;
