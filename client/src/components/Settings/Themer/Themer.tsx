import { ChangeEvent, FormEvent, Fragment, useEffect, useState } from 'react';

// Redux
import { useDispatch, useSelector } from 'react-redux';
import { bindActionCreators } from 'redux';
import { actionCreators } from '../../../store';
import { State } from '../../../store/reducers';

// Typescript
import { Theme, ThemeSettingsForm } from '../../../interfaces';

// i18n
import { useT } from '../../../i18n';

// Components
import { Button, InputGroup, SettingsHeadline, Spinner } from '../../UI';
import { AnimeStyle } from './AnimeStyle/AnimeStyle';
import { ThemeBuilder } from './ThemeBuilder/ThemeBuilder';
import { ThemeGrid } from './ThemeGrid/ThemeGrid';

// Other
import {
  inputHandler,
  parseThemeToPAB,
  themeSettingsTemplate,
} from '../../../utility';

export const Themer = (): JSX.Element => {
  const t = useT();

  const {
    auth: { isAuthenticated },
    config: { loading, config },
    theme: { themes, userThemes },
  } = useSelector((state: State) => state);

  const dispatch = useDispatch();
  const { updateConfig } = bindActionCreators(actionCreators, dispatch);

  // Initial state
  const [formData, setFormData] = useState<ThemeSettingsForm>(
    themeSettingsTemplate
  );

  // Get config
  useEffect(() => {
    setFormData({
      ...config,
    });
  }, [loading]);

  // Form handler
  const formSubmitHandler = async (e: FormEvent) => {
    e.preventDefault();

    // Save settings
    await updateConfig({ ...formData });
  };

  // Input handler
  const inputChangeHandler = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    options?: { isNumber?: boolean; isBool?: boolean }
  ) => {
    inputHandler<ThemeSettingsForm>({
      e,
      options,
      setStateHandler: setFormData,
      state: formData,
    });
  };

  const customThemesEl = (
    <Fragment>
      <SettingsHeadline text={t('theme.userThemes')} />
      <ThemeBuilder themes={userThemes} />
    </Fragment>
  );

  return (
    <Fragment>
      <AnimeStyle />

      <SettingsHeadline text={t('theme.appThemes')} />
      {!themes.length ? <Spinner /> : <ThemeGrid themes={themes} />}

      {!userThemes.length ? isAuthenticated && customThemesEl : customThemesEl}

      {isAuthenticated && (
        <form onSubmit={formSubmitHandler}>
          <SettingsHeadline text={t('theme.otherSettings')} />
          <InputGroup>
            <label htmlFor="defaultTheme">
              {t('theme.defaultThemeForNewUsers')}
            </label>
            <select
              id="defaultTheme"
              name="defaultTheme"
              value={formData.defaultTheme}
              onChange={(e) => inputChangeHandler(e)}
            >
              {[...themes, ...userThemes].map((theme: Theme, idx) => (
                <option key={idx} value={parseThemeToPAB(theme.colors)}>
                  {theme.isCustom && '+'} {theme.name}
                </option>
              ))}
            </select>
          </InputGroup>

          <Button>{t('ui.saveChanges')}</Button>
        </form>
      )}
    </Fragment>
  );
};
