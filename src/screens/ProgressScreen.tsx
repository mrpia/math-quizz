import { useMemo, useState } from 'react';
import { loadHistory, loadTrainingHistory } from '../storage/profileStore';
import { trackedSessions } from '../domain/stats';
import { sessionScores, trickiestPairs, errorGrid } from '../domain/progress';
import { ScoreLineChart } from '../components/ScoreLineChart';
import { TrickiestPairsList } from '../components/TrickiestPairsList';
import { ErrorHeatmap } from '../components/ErrorHeatmap';
import { useI18n } from '../i18n/I18nContext';
import './ProgressScreen.css';
import '../components/ModeToggle.css';

type Props = {
  profileId: string;
  /** Empty for the migrated profile, which never got named. */
  profileName: string;
  /** False while a single profile exists — there is nothing to disambiguate. */
  showProfile: boolean;
  onBack: () => void;
};

type View = 'test' | 'training';

export const ProgressScreen = ({
  profileId,
  profileName,
  showProfile,
  onBack,
}: Props) => {
  const { t } = useI18n();
  const [view, setView] = useState<View>('test');
  // Keyed by profile so switching re-reads instead of showing the last child's
  // curve under the new name.
  const testHistory = useMemo(
    () => trackedSessions(loadHistory(profileId)),
    [profileId],
  );
  const trainingHistory = useMemo(
    () => loadTrainingHistory(profileId),
    [profileId],
  );
  const history = view === 'test' ? testHistory : trainingHistory;

  const points = useMemo(() => sessionScores(history), [history]);
  const pairs = useMemo(() => trickiestPairs(history), [history]);
  const grid = useMemo(() => errorGrid(history), [history]);

  const VIEWS: { id: View; label: string }[] = [
    { id: 'test', label: t('progress.viewTest') },
    { id: 'training', label: t('progress.viewTraining') },
  ];

  return (
    <div className="progress">
      <header className="progress__header">
        <h2>{t('progress.title')}</h2>
        {showProfile && (
          <p className="progress__profile" aria-label={t('profiles.currentAria')}>
            <span aria-hidden="true">👤 </span>
            {profileName === '' ? t('profiles.unnamed') : profileName}
          </p>
        )}
        <button
          type="button"
          className="progress__back-btn"
          onClick={onBack}
          aria-label={t('common.backToHomeAria')}
        >
          🏠
        </button>
      </header>

      <div
        className="mode-toggle mode-toggle--two"
        role="radiogroup"
        aria-label={t('progress.viewAria')}
      >
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            role="radio"
            aria-checked={view === v.id}
            className={`mode-toggle__option${view === v.id ? ' mode-toggle__option--on' : ''}`}
            onClick={() => setView(v.id)}
          >
            {v.label}
          </button>
        ))}
      </div>

      {history.length === 0 ? (
        <p className="progress__empty">
          {view === 'training'
            ? `${t('progress.trainingEmpty')} 🎓`
            : `${t('progress.empty')} 📈`}
        </p>
      ) : (
        <>
          {view === 'test' && (
            <section className="progress__panel">
              <h3 className="progress__panel-title">{t('progress.scoreTitle')}</h3>
              <ScoreLineChart points={points} />
              <p className="progress__caption">{t('progress.scoreCaption')}</p>
            </section>
          )}

          <section className="progress__panel">
            <h3 className="progress__panel-title">{t('progress.pairsTitle')}</h3>
            <TrickiestPairsList pairs={pairs} />
            {pairs.length > 0 && (
              <p className="progress__caption">{t('progress.recencyNote')}</p>
            )}
          </section>

          <section className="progress__panel">
            <h3 className="progress__panel-title">{t('progress.tablesTitle')}</h3>
            <ErrorHeatmap grid={grid} />
          </section>
        </>
      )}
    </div>
  );
};
