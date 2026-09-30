// Lightweight, dependency-free i18n layer for Flame (React 17 compatible).
//
// Design notes:
// - No Context Provider: the language is module-level state with a simple
//   subscriber set, exposed to components through useI18n() / useT().
// - t() works outside React (store/action-creators, utility modules).
// - Lookup order: current language -> en -> the key itself.
// - Interpolation uses {name} placeholders.
import { useCallback, useEffect, useState } from 'react';

import { en } from './en';
import { zhCN } from './zh-CN';
import { Dictionary, Lang, Translate, Vars } from './types';

export type { Dictionary, Lang, Translate, Vars } from './types';

export const LANGS: { code: Lang; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'zh-CN', label: '简体中文' },
];

export const DEFAULT_LANG: Lang = 'en';

const STORAGE_KEY = 'flame.lang';

const english: Dictionary = en;

const dictionaries: Record<Lang, Dictionary> = {
  en: english,
  'zh-CN': zhCN,
};

const listeners = new Set<() => void>();

let currentLang: Lang | null = null;

const hasOwn = (target: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(target, key);

const readStorage = (key: string): string | null => {
  try {
    return typeof localStorage !== 'undefined'
      ? localStorage.getItem(key)
      : null;
  } catch (err) {
    return null;
  }
};

const writeStorage = (key: string, value: string): void => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  } catch (err) {
    // Storage may be unavailable (e.g. private mode); in-memory state still works.
  }
};

const isZh = (value: string): boolean => /^zh($|-|_)/i.test(value.trim());

const parseLang = (value: string | null | undefined): Lang | null => {
  if (!value) {
    return null;
  }

  if (value === 'en') {
    return 'en';
  }

  if (value === 'zh-CN') {
    return 'zh-CN';
  }

  return isZh(value) ? 'zh-CN' : null;
};

const syncDocumentLang = (lang: Lang): void => {
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.lang = lang;
  }
};

/** localStorage 'flame.lang' -> navigator.language (zh* => 'zh-CN') -> 'en'. */
export const getLang = (): Lang => {
  if (currentLang) {
    return currentLang;
  }

  const stored = parseLang(readStorage(STORAGE_KEY));

  if (stored) {
    currentLang = stored;
    return stored;
  }

  const navigatorLang =
    typeof navigator !== 'undefined' && navigator.language
      ? navigator.language
      : '';

  currentLang = isZh(navigatorLang) ? 'zh-CN' : DEFAULT_LANG;

  return currentLang;
};

/** Persist the language, notify subscribers and keep <html lang> in sync. */
export const setLang = (lang: Lang): void => {
  if (!hasOwn(dictionaries, lang)) {
    return;
  }

  const changed = currentLang !== lang;

  currentLang = lang;

  writeStorage(STORAGE_KEY, lang);
  syncDocumentLang(lang);

  if (changed) {
    listeners.forEach((listener) => listener());
  }
};

const interpolate = (template: string, vars?: Vars): string => {
  if (!vars) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    hasOwn(vars, name) ? String(vars[name]) : match
  );
};

const lookup = (lang: Lang, key: string, vars?: Vars): string => {
  const dictionary: Dictionary = dictionaries[lang] || english;

  if (hasOwn(dictionary, key)) {
    return interpolate(dictionary[key], vars);
  }

  if (hasOwn(english, key)) {
    return interpolate(english[key], vars);
  }

  return key;
};

/** Translate a key: current language -> en -> the key itself. Safe outside React. */
export const t = (key: string, vars?: Vars): string =>
  lookup(getLang(), key, vars);

/** Subscribe a component to language changes without a Context Provider. */
const useLang = (): Lang => {
  const [lang, setLangState] = useState<Lang>(getLang);

  useEffect(() => {
    const listener = () => setLangState(getLang());

    listeners.add(listener);
    // Keep in sync in case the language changed between render and effect.
    listener();

    return () => {
      listeners.delete(listener);
    };
  }, []);

  return lang;
};

export const useI18n = (): {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Translate;
} => {
  const lang = useLang();

  // t is bound to the language of the current render, so its identity changes
  // with the language: consumers that list it as a dependency re-run, and
  // components that only render text re-render through useLang().
  const translate = useCallback(
    (key: string, vars?: Vars) => lookup(lang, key, vars),
    [lang]
  );

  return { lang, setLang, t: translate };
};

export const useT = (): Translate => useI18n().t;

// Sync <html lang> once when the module is first evaluated, so a fresh page load
// (and every refresh) reflects the persisted/browser language instead of the
// static lang="en" in index.html. setLang() covers in-session switches; this
// covers module initialisation. syncDocumentLang() keeps the typeof document
// guard, and the call is a plain DOM attribute write (no listener, no loop).
syncDocumentLang(getLang());
