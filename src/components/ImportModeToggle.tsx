import type { ImportMode } from '../domain/merge';
import { useI18n } from '../i18n/I18nContext';
import type { TranslationKey } from '../i18n/types';
import './ModeToggle.css';

type Props = {
  value: ImportMode;
  onChange: (next: ImportMode) => void;
};

const OPTIONS: { id: ImportMode; key: TranslationKey }[] = [
  { id: 'replace', key: 'settings.importModeReplace' },
  { id: 'merge', key: 'settings.importModeMerge' },
];

export const ImportModeToggle = ({ value, onChange }: Props) => {
  const { t } = useI18n();
  return (
    <div
      className="mode-toggle"
      role="radiogroup"
      aria-label={t('settings.importMode')}
    >
      {OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          role="radio"
          data-testid={`import-mode-${opt.id}`}
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
