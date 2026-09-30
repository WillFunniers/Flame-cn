/**
 * Regression test for T9 finding F-04: a fresh module load must sync
 * <html lang> with the persisted/browser language (index.html ships lang="en",
 * and before this fix only setLang() updated the attribute).
 */
export {};

describe('initial <html lang> synchronisation', () => {
  const loadModule = () => {
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('..');
  };

  afterEach(() => {
    localStorage.clear();
    document.documentElement.lang = 'en';
  });

  it('adopts the persisted language on a fresh load', () => {
    localStorage.setItem('flame.lang', 'zh-CN');
    document.documentElement.lang = 'en';

    const i18n = loadModule();

    expect(i18n.getLang()).toBe('zh-CN');
    expect(document.documentElement.lang).toBe('zh-CN');
    expect(document.documentElement.lang).toBe(i18n.getLang());
  });

  it('adopts the browser language (zh*) when nothing is persisted', () => {
    Object.defineProperty(window.navigator, 'language', {
      value: 'zh-CN',
      configurable: true,
    });

    const i18n = loadModule();

    expect(i18n.getLang()).toBe('zh-CN');
    expect(document.documentElement.lang).toBe('zh-CN');
  });

  it('falls back to en for non-zh browsers and keeps it in sync', () => {
    Object.defineProperty(window.navigator, 'language', {
      value: 'en-GB',
      configurable: true,
    });

    const i18n = loadModule();

    expect(i18n.getLang()).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('still tracks in-session switches', () => {
    const i18n = loadModule();

    i18n.setLang('zh-CN');
    expect(document.documentElement.lang).toBe('zh-CN');

    i18n.setLang('en');
    expect(document.documentElement.lang).toBe('en');
  });
});
