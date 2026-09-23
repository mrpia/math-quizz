import { useI18n } from '../i18n/I18nContext';
import './NumPad.css';

type Props = {
  onDigit: (digit: number) => void;
  onErase: () => void;
  onValidate: () => void;
  disabled?: boolean;
};

const DIGIT_LAYOUT: number[][] = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
];

export const NumPad = ({ onDigit, onErase, onValidate, disabled = false }: Props) => {
  const { t } = useI18n();
  return (
    <div className="numpad" data-testid="numpad" aria-disabled={disabled}>
      {DIGIT_LAYOUT.map((row, rowIdx) => (
        <div className="numpad__row" key={rowIdx}>
          {row.map((digit) => (
            <button
              key={digit}
              type="button"
              className="numpad__key"
              data-testid={`numpad-digit-${digit}`}
              onClick={() => onDigit(digit)}
              disabled={disabled}
              aria-label={t('numpad.digit', { digit })}
            >
              {digit}
            </button>
          ))}
        </div>
      ))}
      <div className="numpad__row">
        <button
          type="button"
          className="numpad__key numpad__key--erase"
          data-testid="numpad-erase"
          onClick={onErase}
          disabled={disabled}
          aria-label={t('numpad.erase')}
        >
          ⌫
        </button>
        <button
          type="button"
          className="numpad__key"
          data-testid="numpad-digit-0"
          onClick={() => onDigit(0)}
          disabled={disabled}
          aria-label={t('numpad.digit', { digit: 0 })}
        >
          0
        </button>
        <button
          type="button"
          className="numpad__key numpad__key--validate"
          data-testid="numpad-validate"
          onClick={onValidate}
          disabled={disabled}
          aria-label={t('numpad.validate')}
        >
          ✓
        </button>
      </div>
    </div>
  );
};
