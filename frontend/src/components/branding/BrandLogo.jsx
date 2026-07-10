import { useState } from 'react';
import { useBranding } from '../../hooks/useConfig';
import { useTheme } from '../../hooks/useTheme';
import styles from './BrandLogo.module.css';

/**
 * Marchio della scuola.
 *
 * Tre livelli di degrado, dal migliore al peggiore:
 *   1. il LOGO caricato dalla scuola (versione chiara o scura secondo il tema);
 *   2. un MONOGRAMMA generato dalle iniziali del nome, sul colore primario;
 *   3. nulla, se non abbiamo nemmeno un nome.
 *
 * Il monogramma sostituisce il glifo 日 che l'header mostrava prima della
 * generalizzazione: era un marchio della materia, non della scuola. Una scuola
 * di matematica non ha alcun motivo di esibire un ideogramma giapponese.
 *
 * Un URL rotto non deve lasciare l'icona spezzata del browser: al primo errore
 * di caricamento si ricade sul monogramma.
 */
const iniziali = (nome) => {
  if (!nome) return '';
  const parole = nome
    .split(/\s+/)
    .map((p) => p.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean);

  if (parole.length === 0) return '';
  if (parole.length === 1) return parole[0].slice(0, 2).toUpperCase();
  return (parole[0][0] + parole[1][0]).toUpperCase();
};

const BrandLogo = ({ className = '', size = 'md' }) => {
  const branding = useBranding();
  const { isDark } = useTheme();
  const [erroreImmagine, setErroreImmagine] = useState(false);

  const src = (isDark && branding.logoScuroUrl) || branding.logoUrl;
  const classi = [styles.mark, styles[size], className].filter(Boolean).join(' ');

  if (src && !erroreImmagine) {
    return (
      <img
        src={src}
        alt={branding.nome || ''}
        className={[styles.logo, styles[size], className].filter(Boolean).join(' ')}
        onError={() => setErroreImmagine(true)}
      />
    );
  }

  const sigla = iniziali(branding.nome);
  if (!sigla) return null;

  return (
    <span className={classi} aria-hidden="true">
      {sigla}
    </span>
  );
};

export default BrandLogo;
