import { useState } from 'react';
import { summarizeBackup } from '../domain/backup';
import type { Backup } from '../domain/backup';
import type { ImportMode, MergeCounts } from '../domain/merge';
import { HISTORY_LIMIT } from '../storage/profileStore';
import { findProfile, profileLabel } from '../storage/profileRegistry';
import type { ProfileRegistry } from '../storage/profileRegistry';
import { ImportModeToggle } from './ImportModeToggle';
import { useI18n } from '../i18n/I18nContext';

type Props = {
  /** The parsed, validated file waiting for a decision. Nothing is written yet. */
  backup: Backup;
  registry: ProfileRegistry;
  /** What a merge into a profile would add, keep and drop. Writes nothing. */
  onPreviewMerge: (profileId: string, backup: Backup) => MergeCounts;
  onConfirm: (profileId: string, mode: ImportMode) => void;
  onCancel: () => void;
};

/**
 * The "import this file?" step of Settings → Tes données: where the file
 * lands, whether it replaces or is added, and what that would do to the
 * destination. It owns those two choices; the parent keys it per picked file,
 * so every file starts over on the profile in use and on Replace (#18).
 * Styled by SettingsScreen.css, whose `.settings__*` classes it shares.
 */
export const ImportDialog = ({
  backup,
  registry,
  onPreviewMerge,
  onConfirm,
  onCancel,
}: Props) => {
  const { t } = useI18n();
  // Where the file will land. Defaults to the profile in use; the picker
  // below only appears once there is somewhere else it could go.
  const [target, setTarget] = useState(registry.active);
  // Replace is the default: it is what import has always done, and a merge
  // is a choice the dialog asks for rather than a behaviour it slips in (#18).
  const [mode, setMode] = useState<ImportMode>('replace');

  const unnamed = t('profiles.unnamed');
  const nameOf = (profileId: string) =>
    profileLabel(findProfile(registry, profileId), unnamed);

  const summary = summarizeBackup(backup);
  // Recomputed on every render, so it follows the destination picker. Cheap:
  // two histories of at most HISTORY_LIMIT sessions each.
  const mergeCounts = mode === 'merge' ? onPreviewMerge(target, backup) : null;

  return (
    <div className="settings__confirm">
      <p>{t('settings.importConfirm')}</p>
      <p className="settings__hint">
        {t('settings.importSummary', {
          sessions: summary.sessions,
          training: summary.trainingSessions,
          pairs: summary.pairs,
        })}
      </p>
      {backup.profileName !== '' && (
        <p className="settings__hint">
          {t('settings.importSource', { name: backup.profileName })}
        </p>
      )}
      {registry.profiles.length > 1 && (
        <label className="settings__field">
          <span className="settings__label">{t('settings.importTarget')}</span>
          <select value={target} onChange={(event) => setTarget(event.target.value)}>
            {registry.profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profileLabel(profile, unnamed)}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="settings__field">
        <span className="settings__label">{t('settings.importMode')}</span>
        <ImportModeToggle value={mode} onChange={setMode} />
      </div>
      {mergeCounts ? (
        <>
          <p className="settings__hint">
            {t('settings.importMergeWarning', { name: nameOf(target) })}
          </p>
          <p className="settings__hint">
            {t('settings.importMergeSummary', {
              added: mergeCounts.added,
              known: mergeCounts.known,
            })}
          </p>
          {mergeCounts.dropped > 0 && (
            <p className="settings__hint">
              {t('settings.importMergeDropped', {
                limit: HISTORY_LIMIT,
                dropped: mergeCounts.dropped,
              })}
            </p>
          )}
        </>
      ) : (
        <p className="settings__hint">
          {t('settings.importWarning', { name: nameOf(target) })}
        </p>
      )}
      <div className="settings__confirm-row">
        <button
          type="button"
          className="settings__danger"
          data-testid="import-confirm"
          onClick={() => onConfirm(target, mode)}
        >
          {t('settings.importYes')}
        </button>
        <button type="button" className="settings__secondary" onClick={onCancel}>
          {t('settings.cancel')}
        </button>
      </div>
    </div>
  );
};
