import { ChangeEvent } from 'react';

// i18n
import { LANGS, useI18n } from '../../../i18n';
import type { Lang } from '../../../i18n';

// UI
import { InputGroup } from '../../UI';

// CSS
import classes from './LanguageSettings.module.css';

export const LanguageSettings = (): JSX.Element => {
  const { lang, setLang, t } = useI18n();

  const changeHandler = (e: ChangeEvent<HTMLSelectElement>): void => {
    setLang(e.target.value as Lang);
  };

  return (
    <div className={classes.LanguageSettings}>
      <InputGroup>
        <label htmlFor="language">{t('settings.language')}</label>
        <select
          id="language"
          name="language"
          value={lang}
          onChange={changeHandler}
        >
          {LANGS.map(({ code, label }) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      </InputGroup>
    </div>
  );
};
