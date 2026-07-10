import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTemplateQuiz } from '../../../hooks/useQuizGestione';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import Spinner from '../../../components/ui/Spinner';
import QuizFormModal from './QuizFormModal';
import styles from './QuizGestione.module.css';

/**
 * Catalogo dei TEMPLATE DI PIATTAFORMA installabili dalla scuola.
 *
 * Il quiz di giapponese (kana e kanji) non è più cablato nell'applicazione: è
 * un template che la scuola decide se installare, anche più volte con
 * configurazioni diverse (per esempio un quiz per gli hiragana e uno per i
 * katakana). Installare significa creare un quiz con quel `templateCodice`.
 *
 * Il catalogo è la fonte autorevole: nuovi template compaiono qui senza
 * modifiche al frontend.
 */
const TemplateCatalogPanel = () => {
  const { t } = useTranslation();
  const { data: templates, isLoading, isError } = useTemplateQuiz();
  const [templateDaInstallare, setTemplateDaInstallare] = useState(null);

  if (isLoading) return <Spinner />;
  if (isError || !templates || templates.length === 0) return null;

  return (
    <section className={styles.templateSection} aria-label={t('quizGestione.catalogo.title')}>
      <div className={styles.panelHeader}>
        <div>
          <h2 className={styles.panelTitle}>{t('quizGestione.catalogo.title')}</h2>
          <p className={styles.mutedSmall}>{t('quizGestione.catalogo.subtitle')}</p>
        </div>
      </div>

      <div className={styles.templateGrid}>
        {templates.map((tpl) => (
          <Card key={tpl.codice} className={styles.templateCard}>
            <div className={styles.templateHead}>
              <span className={styles.templateName}>{tpl.nome}</span>
              {tpl.materia && <Badge tone="gold">{tpl.materia}</Badge>}
              {tpl.categoria && <Badge tone="neutral">{tpl.categoria}</Badge>}
              {tpl.esempio && (
                <Badge tone="neutral">{t('quizGestione.template.esempio')}</Badge>
              )}
            </div>

            <p className={styles.templateDesc}>{tpl.descrizione}</p>

            <div className={styles.templateFoot}>
              <span className={styles.mutedSmall}>
                {tpl.installazioni > 0
                  ? t('quizGestione.catalogo.installato', { n: tpl.installazioni })
                  : t('quizGestione.catalogo.nonInstallato')}
              </span>
              <Button size="sm" onClick={() => setTemplateDaInstallare(tpl.codice)}>
                {t('quizGestione.catalogo.installa')}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <QuizFormModal
        isOpen={Boolean(templateDaInstallare)}
        onClose={() => setTemplateDaInstallare(null)}
        templates={templates}
        templateBloccato={templateDaInstallare}
      />
    </section>
  );
};

export default TemplateCatalogPanel;
