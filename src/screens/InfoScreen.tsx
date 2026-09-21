import { AUTHOR_LABEL, AUTHOR_URL, SUPPORT_URL } from '../config/site';
import { releaseNotes } from '../domain/releaseNotes';
import { useI18n } from '../i18n/I18nContext';
import './InfoScreen.css';

type Props = {
  version: string;
  onBack: () => void;
};

export const InfoScreen = ({ version, onBack }: Props) => {
  const { t, lang } = useI18n();
  const [coffeeBefore, coffeeAfter] = t('info.coffee').split('{link}');
  const [creditBefore, creditAfter] = t('info.credit').split('{link}');
  return (
    <div className="info">
      <header className="info__header">
        <h2>{t('info.title')}</h2>
        <button
          type="button"
          className="info__back-btn"
          onClick={onBack}
          aria-label={t('common.backToHomeAria')}
        >
          🏠
        </button>
      </header>

      <section className="info__panel info__panel--version">
        <p className="info__identity">
          <span className="info__app">Math Quizz</span>{' '}
          {t('info.version', { version })}
        </p>
        <p className="info__credit-line">
          {creditBefore}
          <a href={AUTHOR_URL}>{AUTHOR_LABEL}</a>
          {creditAfter}
        </p>
      </section>

      <section className="info__panel">
        <h3 className="info__panel-title">{t('info.supportTitle')}</h3>
        <p className="info__coffee">
          {coffeeBefore}
          <a
            href={SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('info.coffeeLink')}
          </a>
          {coffeeAfter}
        </p>
      </section>

      <section className="info__panel">
        <h3 className="info__panel-title">{t('info.dataTitle')}</h3>
        <p className="info__data">
          {t('info.dataP1')}
        </p>
        <p className="info__data">
          {t('info.dataP2')}
        </p>
      </section>

      <section className="info__panel">
        <h3 className="info__panel-title">{t('info.whatsNew')}</h3>
        <ul className="info__notes">
          {releaseNotes.map((note) => (
            <li key={note.version} className="info__note">
              <p className="info__note-head">
                <span className="info__note-version">v{note.version}</span>
                <span className="info__note-date">{note.date}</span>
              </p>
              <ul className="info__note-changes">
                {(note.changes[lang] ?? note.changes.fr).map((change, i) => (
                  <li key={i}>{change}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>

    </div>
  );
};
