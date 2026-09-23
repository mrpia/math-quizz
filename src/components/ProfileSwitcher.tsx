import type { ProfileEntry } from '../storage/profileRegistry';
import { profileLabel } from '../storage/profileRegistry';
import { useI18n } from '../i18n/I18nContext';
import './ProfileSwitcher.css';

type Props = {
  profiles: ProfileEntry[];
  activeId: string;
  onSwitch: (id: string) => void;
};

/**
 * Who is playing, on the home screen. A radio group like `ModeToggle`, but
 * wrapping instead of an equal-column grid: names are of unequal length and
 * there can be up to six of them.
 *
 * Renders nothing for a single profile. Before this feature every browser had
 * exactly one, and a lone chip labelled "Sans nom" would be pure noise on a
 * screen that is otherwise all about starting a session. It appears the moment
 * a second profile exists — which is also the moment picking the wrong one
 * starts to cost something.
 */
export const ProfileSwitcher = ({ profiles, activeId, onSwitch }: Props) => {
  const { t } = useI18n();
  if (profiles.length < 2) return null;

  return (
    <div
      className="profile-switcher"
      data-testid="profile-switcher"
      role="radiogroup"
      aria-label={t('profiles.switchAria')}
    >
      <span className="profile-switcher__icon" aria-hidden="true">
        👤
      </span>
      {profiles.map((profile) => (
        <button
          key={profile.id}
          type="button"
          role="radio"
          aria-checked={profile.id === activeId}
          className={`profile-switcher__option${
            profile.id === activeId ? ' profile-switcher__option--on' : ''
          }`}
          onClick={() => onSwitch(profile.id)}
        >
          {profileLabel(profile, t('profiles.unnamed'))}
        </button>
      ))}
    </div>
  );
};
