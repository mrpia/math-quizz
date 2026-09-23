import type { AdaptiveDraw } from '../domain/session';
import { useI18n } from '../i18n/I18nContext';
import type { TranslationKey } from '../i18n/types';
import './ModeToggle.css';

type Props = {
  value: AdaptiveDraw;
  onChange: (next: AdaptiveDraw) => void;
};

const OPTIONS: { id: AdaptiveDraw; key: TranslationKey }[] = [
  { id: 'off', key: 'settings.adaptiveDrawOff' },
  { id: 'moderate', key: 'settings.adaptiveDrawModerate' },
  { id: 'strong', key: 'settings.adaptiveDrawStrong' },
];

export const AdaptiveDrawToggle = ({ value, onChange }: Props) => {
  const { t } = useI18n();
  return (
    <div
      className="mode-toggle"
      role="radiogroup"
      aria-label={t('settings.adaptiveDraw')}
    >
      {OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          role="radio"
          aria-checked={value === opt.id}
          className={`mode-toggle__option${value === opt.id ? ' mode-toggle__option--on' : ''}`}
          onClick={() => onChange(opt.id)}
        >
          {t(opt.key)}
        </button>
      ))}
    </div>
  );
};
