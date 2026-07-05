import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDashboardDocente } from '../hooks/useDashboardDocente';
import { useAuleList } from '../hooks/useAule';
import { formatDate } from '../utils/datetime';
import StatCard from '../features/dashboard/components/StatCard';
import RankingList from '../features/dashboard/components/RankingList';
import Select from '../components/ui/Select';
import Badge from '../components/ui/Badge';
import Spinner from '../components/ui/Spinner';
import styles from '../features/dashboard/components/Dashboard.module.css';

const GIORNI_OPZIONI = [7, 30, 90, 365];
const ALL = 'ALL';

/** Cruscotto aggregato del docente: per singola aula o globale. */
const TeacherDashboardPage = () => {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const aulaSel = searchParams.get('aula') || ALL;
  const giorni = Number(searchParams.get('giorni')) || 30;

  const { data: auleData } = useAuleList({});
  const aule = auleData?.classi ?? [];

  const classeId = aulaSel === ALL ? undefined : aulaSel;
  const { data, isLoading, isError } = useDashboardDocente({ classeId, giorni });

  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value === null || value === undefined || value === '') next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  };

  const kanjiChar = (k) => (
    <>
      <span className={styles.rankChar}>{k.kanji}</span>
      {k.livelloJLPT && <Badge tone="neutral">{k.livelloJLPT}</Badge>}
    </>
  );
  const kanaChar = (k) => <span className={styles.rankChar}>{k.kana}</span>;

  const lists = useMemo(() => {
    if (!data) return null;
    const { kanji, kana, classifica } = data;
    return {
      piuSbagliati: kanji.piuSbagliati.map((k) => ({
        id: k.kanji,
        label: kanjiChar(k),
        right: t('teacherDashboard.errori', { n: k.errori }),
      })),
      piuStudiati: kanji.piuStudiati.map((k) => ({
        id: k.kanji,
        label: kanjiChar(k),
        right: t('teacherDashboard.tentativi', { n: k.tentativi }),
      })),
      maiCompletati: kanji.maiCompletati.map((k) => ({
        id: k.kanji,
        label: kanjiChar(k),
        right: t('teacherDashboard.tentativi', { n: k.tentativi }),
      })),
      hiragana: kana.hiraganaProblematici.map((k) => ({
        id: k.kana,
        label: kanaChar(k),
        right: t('teacherDashboard.errori', { n: k.errori }),
      })),
      katakana: kana.katakanaProblematici.map((k) => ({
        id: k.kana,
        label: kanaChar(k),
        right: t('teacherDashboard.errori', { n: k.errori }),
      })),
      migliori: classifica.migliori.map((s) => ({
        id: s.id,
        label: `${s.nome} ${s.cognome}`,
        right: t('teacherDashboard.xpProgresso', { xp: s.xp, prog: s.progressoPercento }),
      })),
      inDifficolta: classifica.inDifficolta.map((s) => ({
        id: s.id,
        label: `${s.nome} ${s.cognome}`,
        right: t('teacherDashboard.erroriPercento', { n: s.tassoErrorePercento }),
      })),
      inattivi: classifica.inattivi.map((s) => ({
        id: s.id,
        label: `${s.nome} ${s.cognome}`,
        right: s.ultimaAttivita ? formatDate(s.ultimaAttivita, i18n.language) : t('teacherDashboard.mai'),
      })),
    };
  }, [data, i18n.language, t]);

  const g = data?.generali;
  const q = data?.quiz;

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>{t('teacherDashboard.title')}</h1>
          <p className={styles.pageSubtitle}>{t('teacherDashboard.subtitle')}</p>
        </div>
      </div>

      <div className={styles.controls}>
        <Select
          label={t('teacherDashboard.aulaLabel')}
          value={aulaSel}
          onChange={(e) => setParam('aula', e.target.value === ALL ? null : e.target.value)}
        >
          <option value={ALL}>{t('teacherDashboard.allClassrooms')}</option>
          {aule.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nome}
            </option>
          ))}
        </Select>
        <Select
          label={t('teacherDashboard.periodLabel')}
          value={String(giorni)}
          onChange={(e) => setParam('giorni', e.target.value)}
        >
          {GIORNI_OPZIONI.map((d) => (
            <option key={d} value={d}>
              {t('teacherDashboard.lastDays', { n: d })}
            </option>
          ))}
        </Select>
      </div>

      {isLoading && <Spinner size="lg" />}
      {isError && <p className={styles.emptyText}>{t('teacherDashboard.loadError')}</p>}

      {data && g && (
        <>
          {/* Generali */}
          <div className={styles.statGrid}>
            <StatCard value={g.studentiTotali} label={t('teacherDashboard.studentiTotali')} />
            <StatCard value={g.studentiAttivi} label={t('teacherDashboard.studentiAttivi')} />
            <StatCard value={g.studentiInattivi} label={t('teacherDashboard.studentiInattivi')} />
            <StatCard value={g.progressoMedioPercento} suffix="%" label={t('teacherDashboard.progressoMedio')} />
            <StatCard value={g.percentualeSuccessoMedia} suffix="%" label={t('teacherDashboard.successoMedio')} />
            <StatCard value={g.eserciziCompletati} label={t('teacherDashboard.eserciziCompletati')} />
            <StatCard value={g.giorniStudioMedi} label={t('teacherDashboard.giorniStudioMedi')} />
          </div>

          {/* Quiz */}
          <h2 className={styles.sectionTitle}>{t('teacherDashboard.quizSection')}</h2>
          <div className={styles.statGrid}>
            <StatCard value={q.quizCompletati} label={t('teacherDashboard.quizCompletati')} />
            <StatCard value={q.mediaVoti} label={t('teacherDashboard.mediaVoti')} />
            <StatCard value={q.mediaErrori} label={t('teacherDashboard.mediaErrori')} />
            <StatCard value={q.percentualeSuccesso} suffix="%" label={t('teacherDashboard.successoQuiz')} />
          </div>
          {q.tempoMedioDisponibile === false && (
            <p className={styles.note}>{t('teacherDashboard.tempoNota')}</p>
          )}

          {/* Kanji */}
          <h2 className={styles.sectionTitle}>{t('teacherDashboard.kanjiSection')}</h2>
          <div className={styles.panelGrid}>
            <RankingList
              title={t('teacherDashboard.kanjiPiuSbagliati')}
              items={lists.piuSbagliati}
              emptyText={t('teacherDashboard.noData')}
            />
            <RankingList
              title={t('teacherDashboard.kanjiPiuStudiati')}
              items={lists.piuStudiati}
              emptyText={t('teacherDashboard.noData')}
            />
            <RankingList
              title={t('teacherDashboard.kanjiMaiCompletati')}
              items={lists.maiCompletati}
              emptyText={t('teacherDashboard.noData')}
            />
          </div>

          {/* Kana */}
          <h2 className={styles.sectionTitle}>{t('teacherDashboard.kanaSection')}</h2>
          <div className={styles.panelGrid}>
            <RankingList
              title={t('teacherDashboard.hiraganaProblematici')}
              items={lists.hiragana}
              emptyText={t('teacherDashboard.noData')}
            />
            <RankingList
              title={t('teacherDashboard.katakanaProblematici')}
              items={lists.katakana}
              emptyText={t('teacherDashboard.noData')}
            />
          </div>

          {/* Classifiche */}
          <h2 className={styles.sectionTitle}>{t('teacherDashboard.classificaSection')}</h2>
          <div className={styles.panelGrid}>
            <RankingList
              title={t('teacherDashboard.migliori')}
              items={lists.migliori}
              emptyText={t('teacherDashboard.noData')}
            />
            <RankingList
              title={t('teacherDashboard.inDifficolta')}
              items={lists.inDifficolta}
              emptyText={t('teacherDashboard.noData')}
            />
            <RankingList
              title={t('teacherDashboard.inattivi')}
              items={lists.inattivi}
              emptyText={t('teacherDashboard.noData')}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default TeacherDashboardPage;
