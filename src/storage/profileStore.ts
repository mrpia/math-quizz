import { DEFAULT_SETTINGS } from '../domain/session';
import type { Settings, SessionResult } from '../domain/session';
import { createBackup } from '../domain/backup';
import { aggregatePairs, chronological } from '../domain/stats';
import type { PairCounterMap } from '../domain/stats';
import type { Backup } from '../domain/backup';

/**
 * Everything one profile owns, addressed by id.
 *
 * Until 0.11.0 the id was a `PROFILE_ID = 'default'` constant; 0.12.0 turned it
 * into the first argument of every function here, which is the whole storage
 * side of multiple profiles. The key shape is unchanged, so the profile that
 * already exists keeps the id `default` and its data never moves.
 *
 * This module deliberately knows nothing about *which* profile is active —
 * that lives in `profileRegistry.ts`. Keeping the direction one-way (registry
 * imports the purge from here, never the reverse) means a screen cannot read
 * the wrong profile by forgetting to pass an id: there is no default to fall
 * back to.
 */
const prefix = (profileId: string) => `mathquizz:profile:${profileId}:`;

export const storageKeys = (profileId: string) => {
  const at = prefix(profileId);
  return {
    settings: `${at}settings`,
    history: `${at}history`,
    trainingHistory: `${at}training-history`,
  } as const;
};

/**
 * Abandoned in v0.11.0. It held lifetime per-pair counters that no screen ever
 * read: the progress screen recomputes from `history`, and now weights recent
 * sessions more heavily — something a timestamp-less running total cannot do.
 * Removed whenever we rewrite the profile, so nothing stale is left behind.
 */
const legacyErrorsKey = (profileId: string) => `${prefix(profileId)}errors`;

export const HISTORY_LIMIT = 50;

const safeParse = <T>(raw: string | null, fallback: T): T => {
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export const loadSettings = (profileId: string): Settings => {
  const stored = safeParse<Partial<Settings>>(
    localStorage.getItem(storageKeys(profileId).settings),
    {},
  );
  return { ...DEFAULT_SETTINGS, ...stored };
};

export const saveSettings = (profileId: string, settings: Settings): void => {
  localStorage.setItem(storageKeys(profileId).settings, JSON.stringify(settings));
};

export const loadHistory = (profileId: string): SessionResult[] =>
  safeParse(
    localStorage.getItem(storageKeys(profileId).history),
    [] as SessionResult[],
  );

export const appendSession = (profileId: string, session: SessionResult): void => {
  const next = [...loadHistory(profileId), session].slice(-HISTORY_LIMIT);
  localStorage.setItem(storageKeys(profileId).history, JSON.stringify(next));
};

export const recordSession = (profileId: string, session: SessionResult): void => {
  appendSession(profileId, session);
};

export const loadTrainingHistory = (profileId: string): SessionResult[] =>
  safeParse(
    localStorage.getItem(storageKeys(profileId).trainingHistory),
    [] as SessionResult[],
  );

export const recordTrainingSession = (
  profileId: string,
  session: SessionResult,
): void => {
  const next = [...loadTrainingHistory(profileId), session].slice(-HISTORY_LIMIT);
  localStorage.setItem(
    storageKeys(profileId).trainingHistory,
    JSON.stringify(next),
  );
};

/**
 * What the question draw leans on: every pair this profile has practised,
 * tests and training together, decayed in the order they were played. A pair
 * missed in a test should come back in training, and the other way round.
 * Recomputed on every call — a cached total could not be decayed.
 */
export const loadPairStats = (profileId: string): PairCounterMap =>
  aggregatePairs(chronological(loadHistory(profileId), loadTrainingHistory(profileId)));

/**
 * Everything this profile owns, wrapped in the published backup envelope.
 * Both histories carry every per-pair statistic the app derives, so there is
 * nothing else to export. The registry is *not* included: a backup is one
 * profile, and importing one must never rearrange who exists on the device.
 */
export const exportProfile = (
  profileId: string,
  appVersion: string,
  profileName = '',
  now: Date = new Date(),
): Backup =>
  createBackup(
    {
      settings: loadSettings(profileId),
      history: loadHistory(profileId),
      trainingHistory: loadTrainingHistory(profileId),
    },
    {
      appVersion,
      exportedAt: now.toISOString(),
      profile: profileId,
      profileName,
    },
  );

/**
 * Overwrites one profile with a validated backup — a restore, not a merge.
 * Merging is deliberately out of scope: sessions carry no id, so two files
 * recorded on two devices cannot be reconciled without guessing from
 * `startedAt`. Throws if storage refuses the write (quota, private mode).
 *
 * `profileId` is the *destination* the user picked, never `backup.profile`:
 * the id inside the file names a profile on the machine that wrote it, which
 * may mean something else here, or nothing at all.
 */
export const importProfile = (profileId: string, backup: Backup): void => {
  const { settings, history, trainingHistory } = backup.data;
  const keys = storageKeys(profileId);
  saveSettings(profileId, settings);
  // A hand-written file may carry more than the app itself would keep.
  localStorage.setItem(keys.history, JSON.stringify(history.slice(-HISTORY_LIMIT)));
  localStorage.setItem(
    keys.trainingHistory,
    JSON.stringify(trainingHistory.slice(-HISTORY_LIMIT)),
  );
  // A v1 file may carry the deprecated `errors` section; it is validated on
  // read and then dropped, since nothing derives statistics from it any more.
  localStorage.removeItem(legacyErrorsKey(profileId));
};

/** Wipes the results but keeps the settings — the "🧹" button in Settings. */
export const clearAll = (profileId: string): void => {
  const keys = storageKeys(profileId);
  localStorage.removeItem(keys.history);
  localStorage.removeItem(keys.trainingHistory);
  localStorage.removeItem(legacyErrorsKey(profileId));
};

/**
 * Everything, settings included. Used when a profile is deleted: leaving its
 * keys behind would be storage nobody can reach, export or clear again.
 */
export const purgeProfile = (profileId: string): void => {
  clearAll(profileId);
  localStorage.removeItem(storageKeys(profileId).settings);
};
