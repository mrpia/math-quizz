import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { SETTINGS_BOUNDS } from '../domain/session';
import type { Settings } from '../domain/session';
import {
  BACKUP_SCHEMA_URL,
  backupFileName,
  parseBackup,
  serializeBackup,
  summarizeBackup,
} from '../domain/backup';
import type { Backup, BackupProblem } from '../domain/backup';
import { downloadTextFile, readTextFile } from '../storage/fileTransfer';
import { useI18n } from '../i18n/I18nContext';
import type { TranslationKey } from '../i18n/types';
import { LanguageToggle } from '../components/LanguageToggle';
import { AdaptiveDrawToggle } from '../components/AdaptiveDrawToggle';
import { ProfileManager } from '../components/ProfileManager';
import { findProfile, profileLabel } from '../storage/profileRegistry';
import type { ProfileRegistry } from '../storage/profileRegistry';
import './SettingsScreen.css';

type Props = {
  settings: Settings;
  /** Who exists on this device, and who is active. Edited by ProfileManager. */
  registry: ProfileRegistry;
  onRegistryChange: (next: ProfileRegistry) => void;
  onSave: (next: Settings) => void;
  onClearHistory: () => void;
  /** Snapshot of one profile, ready to be written to a file. */
  onExport: (profileId: string, profileName: string) => Backup;
  /** Overwrites the named profile. May throw if the browser refuses the write. */
  onImport: (profileId: string, backup: Backup) => void;
  onBack: () => void;
};

type Notice = { kind: 'info' | 'error'; key: TranslationKey };

const IMPORT_ERRORS: Record<BackupProblem, TranslationKey> = {
  unreadable: 'settings.importErrorUnreadable',
  'not-a-backup': 'settings.importErrorFormat',
  'unsupported-version': 'settings.importErrorVersion',
  corrupt: 'settings.importErrorCorrupt',
};

const clamp = (value: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, value));

// A cleared field, or text the browser cannot read as a number yet ("4." while
// typing), reports ''. Number('') is 0, which the clamp turned into the
// minimum and saved without a word (#49), so anything that does not parse
// keeps the value already saved.
const readNumber = (raw: string, fallback: number) => {
  const value = Number(raw);
  return raw.trim() !== '' && Number.isFinite(value) ? value : fallback;
};

const SECONDS_MIN = SETTINGS_BOUNDS.durationPerQuestionMs.min / 1000;
const SECONDS_MAX = SETTINGS_BOUNDS.durationPerQuestionMs.max / 1000;

export const SettingsScreen = ({
  settings,
  registry,
  onRegistryChange,
  onSave,
  onClearHistory,
  onExport,
  onImport,
  onBack,
}: Props) => {
  // Held as the text in the field, not as numbers: a number state turns an
  // emptied field into 0, and React then writes that 0 back into it.
  const [seconds, setSeconds] = useState(String(settings.durationPerQuestionMs / 1000));
  const [count, setCount] = useState(String(settings.questionCount));
  const [partial, setPartial] = useState(String(settings.partialCreditFactor));
  const [confirming, setConfirming] = useState(false);
  const [pendingImport, setPendingImport] = useState<Backup | null>(null);
  // Where a picked file will land. Defaults to the profile in use; the picker
  // below only appears once there is somewhere else it could go.
  const [importTarget, setImportTarget] = useState(registry.active);
  const [notice, setNotice] = useState<Notice | null>(null);
  const { t } = useI18n();

  const unnamed = t('profiles.unnamed');
  const nameOf = (profileId: string) =>
    profileLabel(findProfile(registry, profileId), unnamed);

  const [formatBefore, formatAfter] = t('settings.formatDoc').split('{link}');

  const submit = () => {
    onSave({
      ...settings,
      durationPerQuestionMs: Math.round(
        clamp(
          readNumber(seconds, settings.durationPerQuestionMs / 1000),
          SECONDS_MIN,
          SECONDS_MAX,
        ) * 1000,
      ),
      questionCount: Math.round(
        clamp(
          readNumber(count, settings.questionCount),
          SETTINGS_BOUNDS.questionCount.min,
          SETTINGS_BOUNDS.questionCount.max,
        ),
      ),
      partialCreditFactor: clamp(
        readNumber(partial, settings.partialCreditFactor),
        SETTINGS_BOUNDS.partialCreditFactor.min,
        SETTINGS_BOUNDS.partialCreditFactor.max,
      ),
    });
    onBack();
  };

  const exportOne = (profileId: string) => {
    const backup = onExport(profileId, findProfile(registry, profileId)?.name ?? '');
    downloadTextFile(
      backupFileName(backup.exportedAt, backup.profileName),
      serializeBackup(backup),
    );
    setPendingImport(null);
    setNotice({ kind: 'info', key: 'settings.exportDone' });
  };

  const handleExport = () => exportOne(registry.active);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset first, so picking the same file twice in a row still fires onChange.
    event.target.value = '';
    if (!file) return;

    const result = parseBackup(await readTextFile(file));
    if (!result.ok) {
      setPendingImport(null);
      setNotice({ kind: 'error', key: IMPORT_ERRORS[result.problem] });
      return;
    }
    // Valid, but nothing is written until the confirmation below.
    setNotice(null);
    setImportTarget(registry.active);
    setPendingImport(result.backup);
  };

  const confirmImport = () => {
    if (!pendingImport) return;
    try {
      onImport(importTarget, pendingImport);
    } catch {
      setPendingImport(null);
      setNotice({ kind: 'error', key: 'settings.importErrorStorage' });
      return;
    }
    // The three inputs above are seeded from props on first render only, so an
    // import has to refresh them by hand. Without this they keep showing the
    // pre-import values, and the next "Enregistrer" writes those stale numbers
    // back over what was just imported. Only when the file landed in the
    // profile being edited, though — importing into another one must leave
    // this form exactly as it was.
    if (importTarget === registry.active) {
      const imported = pendingImport.data.settings;
      setSeconds(String(imported.durationPerQuestionMs / 1000));
      setCount(String(imported.questionCount));
      setPartial(String(imported.partialCreditFactor));
    }
    setPendingImport(null);
    setNotice({ kind: 'info', key: 'settings.importDone' });
  };

  const summary = pendingImport ? summarizeBackup(pendingImport) : null;

  return (
    <div className="settings">
      <header className="settings__header">
        <h2>{t('settings.title')}</h2>
        <button
          type="button"
          className="settings__back-btn"
          onClick={onBack}
          aria-label={t('common.backToHomeAria')}
        >
          🏠
        </button>
      </header>

      <label className="settings__field">
        <span className="settings__label">{t('settings.targetTime')}</span>
        <input
          type="number"
          step={0.5}
          data-testid="settings-target-time"
          min={SECONDS_MIN}
          max={SECONDS_MAX}
          value={seconds}
          onChange={(e) => setSeconds(e.target.value)}
        />
        <span className="settings__hint">
          {t('settings.targetTimeHint')}
        </span>
      </label>

      <label className="settings__field">
        <span className="settings__label">{t('settings.questionCount')}</span>
        <input
          type="number"
          step={1}
          data-testid="settings-question-count"
          min={SETTINGS_BOUNDS.questionCount.min}
          max={SETTINGS_BOUNDS.questionCount.max}
          value={count}
          onChange={(e) => setCount(e.target.value)}
        />
      </label>

      <label className="settings__field">
        <span className="settings__label">
          {t('settings.partialCredit')}
        </span>
        <input
          type="number"
          step={0.1}
          min={SETTINGS_BOUNDS.partialCreditFactor.min}
          max={SETTINGS_BOUNDS.partialCreditFactor.max}
          value={partial}
          onChange={(e) => setPartial(e.target.value)}
        />
        <span className="settings__hint">{t('settings.partialCreditHint')}</span>
      </label>

      <div className="settings__field">
        <span className="settings__label">{t('settings.adaptiveDraw')}</span>
        <AdaptiveDrawToggle
          value={settings.adaptiveDraw ?? 'moderate'}
          onChange={(adaptiveDraw) => onSave({ ...settings, adaptiveDraw })}
        />
        <span className="settings__hint">{t('settings.adaptiveDrawHint')}</span>
      </div>

      <div className="settings__field">
        <span className="settings__label">{t('settings.language')}</span>
        <LanguageToggle
          value={settings.language}
          onChange={(language) => onSave({ ...settings, language })}
        />
      </div>

      <button
        type="button"
        className="settings__primary"
        data-testid="settings-save"
        onClick={submit}
      >
        {t('settings.save')}
      </button>

      <hr className="settings__divider" />

      <ProfileManager
        registry={registry}
        onChange={onRegistryChange}
        onExportProfile={exportOne}
      />

      <hr className="settings__divider" />

      <section className="settings__section">
        <h3 className="settings__section-title">{t('settings.dataTitle')}</h3>
        <p className="settings__hint">{t('settings.dataHint')}</p>

        <div className="settings__transfer">
          <button
            type="button"
            className="settings__secondary"
            data-testid="backup-export"
            onClick={handleExport}
          >
            {`⬇️ ${t('settings.export')}`}
          </button>
          <label className="settings__secondary settings__file">
            {`⬆️ ${t('settings.import')}`}
            <input
              type="file"
              accept="application/json,.json"
              data-testid="backup-import"
              className="settings__file-input"
              onChange={(event) => void handleFile(event)}
            />
          </label>
        </div>

        {notice && (
          <p
            className={`settings__notice settings__notice--${notice.kind}`}
            role={notice.kind === 'error' ? 'alert' : 'status'}
          >
            {t(notice.key)}
          </p>
        )}

        {pendingImport && summary && (
          <div className="settings__confirm">
            <p>{t('settings.importConfirm')}</p>
            <p className="settings__hint">
              {t('settings.importSummary', {
                sessions: summary.sessions,
                training: summary.trainingSessions,
                pairs: summary.pairs,
              })}
            </p>
            {pendingImport.profileName !== '' && (
              <p className="settings__hint">
                {t('settings.importSource', { name: pendingImport.profileName })}
              </p>
            )}
            {registry.profiles.length > 1 && (
              <label className="settings__field">
                <span className="settings__label">{t('settings.importTarget')}</span>
                <select
                  value={importTarget}
                  onChange={(event) => setImportTarget(event.target.value)}
                >
                  {registry.profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profileLabel(profile, unnamed)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <p className="settings__hint">
              {t('settings.importWarning', { name: nameOf(importTarget) })}
            </p>
            <div className="settings__confirm-row">
              <button
                type="button"
                className="settings__danger"
                data-testid="import-confirm"
                onClick={confirmImport}
              >
                {t('settings.importYes')}
              </button>
              <button
                type="button"
                className="settings__secondary"
                onClick={() => setPendingImport(null)}
              >
                {t('settings.cancel')}
              </button>
            </div>
          </div>
        )}

        <p className="settings__hint">
          {formatBefore}
          <a href={BACKUP_SCHEMA_URL} target="_blank" rel="noopener noreferrer">
            {t('settings.formatLink')}
          </a>
          {formatAfter}
        </p>
      </section>

      <hr className="settings__divider" />

      {!confirming ? (
        <button
          type="button"
          className="settings__danger"
          data-testid="clear-history"
          onClick={() => setConfirming(true)}
        >
          {`🧹 ${t('settings.clearHistory')}`}
        </button>
      ) : (
        <div className="settings__confirm">
          <p>{t('settings.clearConfirm')}</p>
          <div className="settings__confirm-row">
            <button
              type="button"
              className="settings__danger"
              data-testid="clear-confirm"
              onClick={() => {
                onClearHistory();
                setConfirming(false);
              }}
            >
              {t('settings.clearYes')}
            </button>
            <button
              type="button"
              className="settings__secondary"
              onClick={() => setConfirming(false)}
            >
              {t('settings.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
