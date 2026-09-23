import { TableSelector } from '../components/TableSelector';
import { ModeToggle } from '../components/ModeToggle';
import { AnswerModeToggle } from '../components/AnswerModeToggle';
import { LanguageToggle } from '../components/LanguageToggle';
import { ProfileSwitcher } from '../components/ProfileSwitcher';
import type { ProfileEntry } from '../storage/profileRegistry';
import type { Settings } from '../domain/session';
import { useI18n } from '../i18n/I18nContext';
import './HomeScreen.css';

type Props = {
  settings: Settings;
  profiles: ProfileEntry[];
  activeProfileId: string;
  onSwitchProfile: (id: string) => void;
  onChange: (next: Settings) => void;
  onStart: () => void;
  onOpenSettings: () => void;
  onOpenProgress: () => void;
  onOpenInfo: () => void;
};

export const HomeScreen = ({
  settings,
  profiles,
  activeProfileId,
  onSwitchProfile,
  onChange,
  onStart,
  onOpenSettings,
  onOpenProgress,
  onOpenInfo,
}: Props) => {
  const { t } = useI18n();
  const seconds = (settings.durationPerQuestionMs / 1000)
    .toFixed(1)
    .replace('.0', '');
  const canStart = settings.selectedTables.length > 0;
  const isTraining = (settings.answerMode ?? 'screen') === 'training';
  const isList = (settings.answerMode ?? 'screen') === 'list';

  return (
    <div className="home">
      <header className="home__header">
        <h1>Math Quizz</h1>
        <div className="home__header-actions">
          <button
            type="button"
            className="home__info-btn"
            data-testid="open-about"
            onClick={onOpenInfo}
            aria-label={t('home.aboutAria')}
          >
            ℹ️
          </button>
          <button
            type="button"
            className="home__progress-btn"
            data-testid="open-progress"
            onClick={onOpenProgress}
            aria-label={t('home.resultsAria')}
          >
            📈
          </button>
          <button
            type="button"
            className="home__settings-btn"
            data-testid="open-settings"
            onClick={onOpenSettings}
            aria-label={t('home.settingsAria')}
          >
            ⚙️
          </button>
        </div>
      </header>
      <ProfileSwitcher
        profiles={profiles}
        activeId={activeProfileId}
        onSwitch={onSwitchProfile}
      />
      <LanguageToggle
        value={settings.language}
        onChange={(language) => onChange({ ...settings, language })}
      />
      <section className="home__panel">
        <TableSelector
          selected={settings.selectedTables}
          onChange={(selectedTables) => onChange({ ...settings, selectedTables })}
        />
      </section>
      <section className="home__panel">
        <h2 className="home__panel-title">{t('home.modeTitle')}</h2>
        <ModeToggle
          value={settings.mode}
          onChange={(mode) => onChange({ ...settings, mode })}
        />
      </section>
      <section className="home__panel">
        <h2 className="home__panel-title">{t('home.inputTitle')}</h2>
        <AnswerModeToggle
          value={settings.answerMode}
          onChange={(answerMode) => onChange({ ...settings, answerMode })}
        />
      </section>
      <p className="home__info">
        {isList
          ? t('home.summaryList', { count: settings.questionCount })
          : isTraining
            ? t('home.summaryTraining', { count: settings.questionCount })
            : t('home.summary', { count: settings.questionCount, seconds })}
      </p>
      {!canStart && (
        <p className="home__hint" role="status">
          {t('home.selectTableHint')}
        </p>
      )}
      <button
        type="button"
        className="home__start-btn"
        data-testid="start-session"
        onClick={onStart}
        disabled={!canStart}
      >
        {isList
          ? `📋 ${t('home.startList')}`
          : isTraining
            ? `🎓 ${t('home.startTraining')}`
            : `🚀 ${t('home.start')}`}
      </button>
    </div>
  );
};
