import { useState, useEffect, ChangeEvent, FormEvent } from 'react';

// Redux
import { useDispatch, useSelector } from 'react-redux';
import { State } from '../../../store/reducers';
import { bindActionCreators } from 'redux';
import { actionCreators } from '../../../store';

// Typescript
import { UISettingsForm } from '../../../interfaces';

// UI
import { InputGroup, Button, SettingsHeadline } from '../../UI';

// i18n
import { useT } from '../../../i18n';

// Components
import { LanguageSettings } from '../LanguageSettings/LanguageSettings';

// Utils
import { uiSettingsTemplate, inputHandler } from '../../../utility';

export const UISettings = (): JSX.Element => {
  const t = useT();

  const { loading, config } = useSelector((state: State) => state.config);

  const dispatch = useDispatch();
  const { updateConfig } = bindActionCreators(actionCreators, dispatch);

  // Initial state
  const [formData, setFormData] = useState<UISettingsForm>(uiSettingsTemplate);

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
    await updateConfig(formData);

    // Update local page title
    document.title = formData.customTitle;
  };

  // Input handler
  const inputChangeHandler = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    options?: { isNumber?: boolean; isBool?: boolean }
  ) => {
    inputHandler<UISettingsForm>({
      e,
      options,
      setStateHandler: setFormData,
      state: formData,
    });
  };

  return (
    <form onSubmit={(e) => formSubmitHandler(e)}>
      {/* === LANGUAGE === */}
      <SettingsHeadline text={t('settings.language')} />
      <LanguageSettings />

      {/* === OTHER OPTIONS === */}
      <SettingsHeadline text={t('settings.miscellaneous')} />
      {/* PAGE TITLE */}
      <InputGroup>
        <label htmlFor="customTitle">{t('settings.customPageTitle')}</label>
        <input
          type="text"
          id="customTitle"
          name="customTitle"
          placeholder="Flame"
          value={formData.customTitle}
          onChange={(e) => inputChangeHandler(e)}
        />
      </InputGroup>

      {/* === SEARCH OPTIONS === */}
      <SettingsHeadline text={t('settings.searchSection')} />
      {/* HIDE SEARCHBAR */}
      <InputGroup>
        <label htmlFor="hideSearch">{t('settings.hideSearchBar')}</label>
        <select
          id="hideSearch"
          name="hideSearch"
          value={formData.hideSearch ? 1 : 0}
          onChange={(e) => inputChangeHandler(e, { isBool: true })}
        >
          <option value={1}>{t('ui.true')}</option>
          <option value={0}>{t('ui.false')}</option>
        </select>
      </InputGroup>

      {/* AUTOFOCUS SEARCHBAR */}
      <InputGroup>
        <label htmlFor="disableAutofocus">
          {t('settings.disableAutofocus')}
        </label>
        <select
          id="disableAutofocus"
          name="disableAutofocus"
          value={formData.disableAutofocus ? 1 : 0}
          onChange={(e) => inputChangeHandler(e, { isBool: true })}
        >
          <option value={1}>{t('ui.true')}</option>
          <option value={0}>{t('ui.false')}</option>
        </select>
      </InputGroup>

      {/* === HEADER OPTIONS === */}
      <SettingsHeadline text={t('settings.headerSection')} />
      {/* HIDE HEADER */}
      <InputGroup>
        <label htmlFor="hideHeader">{t('settings.hideHeadline')}</label>
        <select
          id="hideHeader"
          name="hideHeader"
          value={formData.hideHeader ? 1 : 0}
          onChange={(e) => inputChangeHandler(e, { isBool: true })}
        >
          <option value={1}>{t('ui.true')}</option>
          <option value={0}>{t('ui.false')}</option>
        </select>
      </InputGroup>

      {/* HIDE DATE */}
      <InputGroup>
        <label htmlFor="hideDate">{t('settings.hideDate')}</label>
        <select
          id="hideDate"
          name="hideDate"
          value={formData.hideDate ? 1 : 0}
          onChange={(e) => inputChangeHandler(e, { isBool: true })}
        >
          <option value={1}>{t('ui.true')}</option>
          <option value={0}>{t('ui.false')}</option>
        </select>
      </InputGroup>

      {/* HIDE TIME */}
      <InputGroup>
        <label htmlFor="showTime">{t('settings.hideTime')}</label>
        <select
          id="showTime"
          name="showTime"
          value={formData.showTime ? 1 : 0}
          onChange={(e) => inputChangeHandler(e, { isBool: true })}
        >
          <option value={0}>{t('ui.true')}</option>
          <option value={1}>{t('ui.false')}</option>
        </select>
      </InputGroup>

      {/* DATE FORMAT */}
      <InputGroup>
        <label htmlFor="useAmericanDate">{t('settings.dateFormatting')}</label>
        <select
          id="useAmericanDate"
          name="useAmericanDate"
          value={formData.useAmericanDate ? 1 : 0}
          onChange={(e) => inputChangeHandler(e, { isBool: true })}
        >
          <option value={1}>{t('settings.dateFormatUs')}</option>
          <option value={0}>{t('settings.dateFormatIntl')}</option>
        </select>
      </InputGroup>

      {/* CUSTOM GREETINGS */}
      <InputGroup>
        <label htmlFor="greetingsSchema">{t('settings.customGreetings')}</label>
        <input
          type="text"
          id="greetingsSchema"
          name="greetingsSchema"
          placeholder={t('settings.placeholderGreetings')}
          value={formData.greetingsSchema}
          onChange={(e) => inputChangeHandler(e)}
        />
        <span>{t('settings.customGreetingsHint')}</span>
      </InputGroup>

      {/* CUSTOM DAYS */}
      <InputGroup>
        <label htmlFor="daySchema">{t('settings.customWeekdayNames')}</label>
        <input
          type="text"
          id="daySchema"
          name="daySchema"
          placeholder={t('settings.placeholderWeekdays')}
          value={formData.daySchema}
          onChange={(e) => inputChangeHandler(e)}
        />
        <span>{t('settings.namesSeparatedHint')}</span>
      </InputGroup>

      {/* CUSTOM MONTHS */}
      <InputGroup>
        <label htmlFor="monthSchema">{t('settings.customMonthNames')}</label>
        <input
          type="text"
          id="monthSchema"
          name="monthSchema"
          placeholder={t('settings.placeholderMonths')}
          value={formData.monthSchema}
          onChange={(e) => inputChangeHandler(e)}
        />
        <span>{t('settings.namesSeparatedHint')}</span>
      </InputGroup>

      {/* === SECTIONS OPTIONS === */}
      <SettingsHeadline text={t('settings.sections')} />
      {/* HIDE APPS */}
      <InputGroup>
        <label htmlFor="hideApps">{t('settings.hideApplications')}</label>
        <select
          id="hideApps"
          name="hideApps"
          value={formData.hideApps ? 1 : 0}
          onChange={(e) => inputChangeHandler(e, { isBool: true })}
        >
          <option value={1}>{t('ui.true')}</option>
          <option value={0}>{t('ui.false')}</option>
        </select>
      </InputGroup>

      {/* HIDE BOOKMARK CATEGORIES */}
      <InputGroup>
        <label htmlFor="hideCategories">{t('settings.hideBookmarks')}</label>
        <select
          id="hideCategories"
          name="hideCategories"
          value={formData.hideCategories ? 1 : 0}
          onChange={(e) => inputChangeHandler(e, { isBool: true })}
        >
          <option value={1}>{t('ui.true')}</option>
          <option value={0}>{t('ui.false')}</option>
        </select>
      </InputGroup>

      <Button>{t('ui.saveChanges')}</Button>
    </form>
  );
};
