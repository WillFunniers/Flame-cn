import { act, render, screen } from '@testing-library/react';

import { DEFAULT_LANG, LANGS, getLang, setLang, t, useI18n, useT } from '..';

const Probe = (): JSX.Element => {
  const { lang, setLang: change } = useI18n();
  const translate = useT();

  return (
    <div>
      <span data-testid="lang">{lang}</span>
      <span data-testid="text">{translate('nav.settings')}</span>
      <span data-testid="interpolated">
        {translate('apps.deleteConfirm', { name: 'Fluffy' })}
      </span>
      <button onClick={() => change(lang === 'en' ? 'zh-CN' : 'en')}>
        switch
      </button>
    </div>
  );
};

beforeEach(() => {
  localStorage.clear();
  setLang('en');
});

describe('i18n runtime', () => {
  it('exposes the frozen contract', () => {
    expect(DEFAULT_LANG).toBe('en');
    expect(LANGS).toEqual([
      { code: 'en', label: 'English' },
      { code: 'zh-CN', label: '简体中文' },
    ]);
    expect(typeof getLang).toBe('function');
    expect(typeof setLang).toBe('function');
    expect(typeof t).toBe('function');
  });

  it('re-renders consumers immediately when the language changes', () => {
    render(<Probe />);

    expect(screen.getByTestId('lang').textContent).toBe('en');
    expect(screen.getByTestId('text').textContent).toBe('Settings');
    expect(screen.getByTestId('interpolated').textContent).toBe(
      'Are you sure you want to delete Fluffy?'
    );

    act(() => {
      setLang('zh-CN');
    });

    expect(screen.getByTestId('lang').textContent).toBe('zh-CN');
    expect(screen.getByTestId('text').textContent).toBe('设置');
    expect(screen.getByTestId('interpolated').textContent).toBe(
      '确定要删除 Fluffy 吗？'
    );
  });

  it('persists the choice and syncs <html lang>', () => {
    setLang('zh-CN');

    expect(localStorage.getItem('flame.lang')).toBe('zh-CN');
    expect(document.documentElement.lang).toBe('zh-CN');

    expect(getLang()).toBe('zh-CN');
    expect(t('nav.settings')).toBe('设置');
  });

  it('keeps English byte-identical and falls back to the key', () => {
    setLang('en');

    expect(t('nav.settings')).toBe('Settings');
    expect(t('app.loggedInExpiresSuffix')).toBe('');
    expect(t('does.not.exist')).toBe('does.not.exist');
    expect(t('app.version')).toBe('version {version}');
  });
});
