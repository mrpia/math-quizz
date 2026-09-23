import { MULTIPLICANDS } from '../domain/tables';
import { useI18n } from '../i18n/I18nContext';
import './TableSelector.css';

type Props = {
  selected: number[];
  onChange: (next: number[]) => void;
};

export const TableSelector = ({ selected, onChange }: Props) => {
  const { t } = useI18n();
  const toggle = (n: number) => {
    if (selected.includes(n)) {
      onChange(selected.filter((x) => x !== n));
    } else {
      onChange([...selected, n].sort((a, b) => a - b));
    }
  };

  const allSelected = selected.length === MULTIPLICANDS.length;

  return (
    <div className="table-selector">
      <div className="table-selector__header">
        <span>{t('tables.title')}</span>
        <button
          type="button"
          className="table-selector__toggle-all"
          onClick={() =>
            onChange(allSelected ? [] : (MULTIPLICANDS as readonly number[]).slice())
          }
        >
          {allSelected ? t('tables.deselectAll') : t('tables.selectAll')}
        </button>
      </div>
      <div className="table-selector__grid" data-testid="table-selector">
        {MULTIPLICANDS.map((n) => {
          const isOn = selected.includes(n);
          return (
            <button
              key={n}
              type="button"
              className={`table-selector__chip${isOn ? ' table-selector__chip--on' : ''}`}
              onClick={() => toggle(n)}
              aria-pressed={isOn}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
};
