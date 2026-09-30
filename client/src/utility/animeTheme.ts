import { useCallback, useEffect, useState } from 'react';

import { ThemeColors } from '../interfaces';

/* ---------------------------------------------------------------------------
 * Anime visual skin — persistence + DOM wiring.
 *
 * The upstream theme mechanism stays untouched: a theme is still the three
 * custom properties --color-background / --color-primary / --color-accent set
 * on <body> by store/action-creators/theme.ts (setTheme) and persisted in
 * localStorage 'theme'.  This module only owns the *skin* selector:
 *
 *   <html data-theme="default | anime-light | anime-dark">
 *   <html data-bg="on | off">
 *
 * `default` (or a missing attribute) means "upstream look", and no rule in
 * src/styles/anime.css matches it.
 * ------------------------------------------------------------------------- */

export type ThemeStyle = 'default' | 'anime-light' | 'anime-dark';

const STYLE_KEY = 'flame.style';
const BACKGROUND_KEY = 'flame.bg';

const THEME_STYLE_IDS: ThemeStyle[] = ['default', 'anime-light', 'anime-dark'];

/**
 * The three selectable visual styles.  `palette` is the recommended colour set
 * for the skin (applied through the existing redux `setTheme` action so the
 * text contrast of the skin is preserved); it is `null` for `default`, where
 * the user's own colours must not be overridden.
 */
export const THEME_STYLES: {
  id: ThemeStyle;
  labelKey: string;
  palette: ThemeColors | null;
}[] = [
  {
    id: 'default',
    labelKey: 'theme.default',
    palette: null,
  },
  {
    id: 'anime-light',
    labelKey: 'theme.animeLight',
    palette: { background: '#fbf3f6', primary: '#2f2a3f', accent: '#9d3b62' },
  },
  {
    id: 'anime-dark',
    labelKey: 'theme.animeDark',
    palette: { background: '#1b1a26', primary: '#f2edf7', accent: '#f8b9d4' },
  },
];

const isThemeStyle = (value: string | null): value is ThemeStyle =>
  value !== null && THEME_STYLE_IDS.indexOf(value as ThemeStyle) !== -1;

const readStorage = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch (err) {
    // private mode / disabled storage — fall back to the defaults
    return null;
  }
};

const writeStorage = (key: string, value: string): void => {
  try {
    window.localStorage.setItem(key, value);
  } catch (err) {
    // ignore: the DOM attribute below still applies for this session
  }
};

/** Selected visual style; unknown or missing values fall back to 'default'. */
export const getThemeStyle = (): ThemeStyle => {
  const stored = readStorage(STYLE_KEY);
  return isThemeStyle(stored) ? stored : 'default';
};

/** Persists the style and syncs <html data-theme>. */
export const setThemeStyle = (style: ThemeStyle): void => {
  writeStorage(STYLE_KEY, style);
  document.documentElement.dataset.theme = style;
};

/** Background layer switch; enabled unless explicitly turned off. */
export const getBackgroundEnabled = (): boolean =>
  readStorage(BACKGROUND_KEY) !== 'off';

/** Persists the background switch and syncs <html data-bg>. */
export const setBackgroundEnabled = (on: boolean): void => {
  writeStorage(BACKGROUND_KEY, on ? 'on' : 'off');
  document.documentElement.dataset.bg = on ? 'on' : 'off';
};

/**
 * Idempotent boot sync: mirrors the inline bootstrap in public/index.html
 * (which paints the first frame before React starts) into the runtime.
 */
export const applyBootThemeStyle = (): void => {
  document.documentElement.dataset.theme = getThemeStyle();
  document.documentElement.dataset.bg = getBackgroundEnabled() ? 'on' : 'off';
};

/**
 * React binding for the settings UI.  `setStyle` / `setBackground` persist the
 * choice and update <html> immediately; the mount effect covers the case where
 * the inline bootstrap script was blocked (CSP) or stripped by a proxy.
 */
export const useThemeStyle = (): {
  style: ThemeStyle;
  setStyle: (s: ThemeStyle) => void;
  background: boolean;
  setBackground: (on: boolean) => void;
} => {
  const [style, setStyleState] = useState<ThemeStyle>(getThemeStyle);
  const [background, setBackgroundState] = useState<boolean>(
    getBackgroundEnabled
  );

  useEffect(() => {
    applyBootThemeStyle();
  }, []);

  const setStyle = useCallback((next: ThemeStyle) => {
    setThemeStyle(next);
    setStyleState(next);
  }, []);

  const setBackground = useCallback((on: boolean) => {
    setBackgroundEnabled(on);
    setBackgroundState(on);
  }, []);

  return { style, setStyle, background, setBackground };
};
