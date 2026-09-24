import { useEffect, useState } from 'react';
import { LanguageProvider } from './i18n/I18nContext';
import { HomeScreen } from './screens/HomeScreen';
import { SessionScreen } from './screens/SessionScreen';
import { PaperSessionScreen } from './screens/PaperSessionScreen';
import { TrainingScreen } from './screens/TrainingScreen';
import { ExerciseListScreen } from './screens/ExerciseListScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { ProgressScreen } from './screens/ProgressScreen';
import { InfoScreen } from './screens/InfoScreen';
import type { SessionResult, Settings } from './domain/session';
import type { Backup } from './domain/backup';
import type { ImportMode } from './domain/merge';
import {
  loadRegistry,
  saveRegistry,
  setActiveProfile,
  findProfile,
} from './storage/profileRegistry';
import type { ProfileRegistry } from './storage/profileRegistry';
import {
  loadSettings,
  saveSettings,
  recordSession,
  recordTrainingSession,
  exportProfile,
  importProfile,
  previewMerge,
  clearAll,
} from './storage/profileStore';

type Screen = 'home' | 'session' | 'results' | 'settings' | 'progress' | 'info';

/**
 * The registry and the settings of the profile it points at, held as **one**
 * state value on purpose.
 *
 * Two `useState`s would let a render exist in which `registry.active` is the
 * new profile while `settings` still belongs to the old one — and the effect
 * that persists settings would then write one child's preferences into
 * another child's storage key. Keeping them in a single object makes that
 * render unrepresentable rather than merely unlikely.
 */
type ProfileState = { registry: ProfileRegistry; settings: Settings };

const initialProfileState = (): ProfileState => {
  const registry = loadRegistry();
  return { registry, settings: loadSettings(registry.active) };
};

export const App = () => {
  const [screen, setScreen] = useState<Screen>('home');
  const [{ registry, settings }, setProfileState] =
    useState<ProfileState>(initialProfileState);
  const [lastResult, setLastResult] = useState<SessionResult | null>(null);

  const activeId = registry.active;

  // Also the moment a browser that predates profiles gets its registry written
  // for the first time: `loadRegistry` synthesises it but never persists.
  useEffect(() => {
    saveRegistry(registry);
  }, [registry]);

  useEffect(() => {
    saveSettings(activeId, settings);
  }, [activeId, settings]);

  const setSettings = (next: Settings) =>
    setProfileState((state) => ({ ...state, settings: next }));

  const switchProfile = (id: string) =>
    setProfileState((state) => {
      const nextRegistry = setActiveProfile(state.registry, id);
      if (nextRegistry === state.registry) return state;
      return { registry: nextRegistry, settings: loadSettings(id) };
    });

  /**
   * Settings may create, rename or delete profiles, so it hands the whole
   * registry back. Deleting the active one moves `active`, which means the
   * settings on screen have to follow.
   */
  const applyRegistry = (next: ProfileRegistry) =>
    setProfileState((state) => ({
      registry: next,
      settings:
        next.active === state.registry.active
          ? state.settings
          : loadSettings(next.active),
    }));

  const handleSessionComplete = (result: SessionResult) => {
    if (result.answerMode === 'paper') {
      // Never recorded (#44): the child marks the sheet against the answers on
      // screen, so the marks are a claim the statistics cannot check.
    } else if (result.answerMode === 'training') {
      recordTrainingSession(activeId, result);
    } else {
      recordSession(activeId, result);
    }
    setLastResult(result);
    setScreen('results');
  };

  const handleImport = (targetId: string, backup: Backup, mode: ImportMode) => {
    // Storage first: if the browser refuses the write, the screen reports it
    // and React state still matches what is actually stored.
    importProfile(targetId, backup, mode);
    // Importing into some *other* profile must not disturb the one in use,
    // and a merge keeps the destination's settings, so only a replace here.
    if (mode === 'replace' && targetId === activeId) setSettings(backup.data.settings);
  };

  const activeName = findProfile(registry, activeId)?.name ?? '';

  return (
    <LanguageProvider lang={settings.language}>
      <div className="app">
        {screen === 'home' && (
          <HomeScreen
            settings={settings}
            profiles={registry.profiles}
            activeProfileId={activeId}
            onSwitchProfile={switchProfile}
            onChange={setSettings}
            onStart={() => setScreen('session')}
            onOpenSettings={() => setScreen('settings')}
            onOpenProgress={() => setScreen('progress')}
            onOpenInfo={() => setScreen('info')}
          />
        )}
        {screen === 'session' &&
          (settings.answerMode === 'list' ? (
            <ExerciseListScreen
              profileId={activeId}
              settings={settings}
              onCancel={() => setScreen('home')}
            />
          ) : settings.answerMode === 'paper' ? (
            <PaperSessionScreen
              profileId={activeId}
              settings={settings}
              onComplete={handleSessionComplete}
              onCancel={() => setScreen('home')}
            />
          ) : settings.answerMode === 'training' ? (
            <TrainingScreen
              profileId={activeId}
              settings={settings}
              onComplete={handleSessionComplete}
              onCancel={() => setScreen('home')}
            />
          ) : (
            <SessionScreen
              profileId={activeId}
              settings={settings}
              onComplete={handleSessionComplete}
              onCancel={() => setScreen('home')}
            />
          ))}
        {screen === 'results' && lastResult && (
          <ResultsScreen
            result={lastResult}
            onReplay={() => setScreen('session')}
            onHome={() => setScreen('home')}
          />
        )}
        {screen === 'settings' && (
          // Keyed by profile: the three numeric inputs seed from props on first
          // render only, so deleting the active profile (which moves `active`)
          // has to hand the screen a fresh mount rather than stale numbers that
          // the next "Enregistrer" would write into someone else's profile.
          <SettingsScreen
            key={activeId}
            settings={settings}
            registry={registry}
            onRegistryChange={applyRegistry}
            onSave={setSettings}
            onClearHistory={() => clearAll(activeId)}
            onExport={(profileId, profileName) =>
              exportProfile(profileId, __APP_VERSION__, profileName)
            }
            onImport={handleImport}
            onPreviewMerge={previewMerge}
            onBack={() => setScreen('home')}
          />
        )}
        {screen === 'progress' && (
          <ProgressScreen
            profileId={activeId}
            profileName={activeName}
            showProfile={registry.profiles.length > 1}
            onBack={() => setScreen('home')}
          />
        )}
        {screen === 'info' && (
          <InfoScreen
            version={__APP_VERSION__}
            onBack={() => setScreen('home')}
          />
        )}
      </div>
    </LanguageProvider>
  );
};
