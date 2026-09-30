import { useCallback, useEffect, useState } from 'react';

/* ---------------------------------------------------------------------------
 * Wallpaper / background layer.
 *
 * Completely independent from the theme:
 *
 *   Theme    -> upstream mechanism (three CSS variables written on <body> by
 *               store/action-creators/theme.ts) decides the colours of the UI.
 *   data-bg  -> decides whether the user's wallpaper is painted.
 *
 * Any theme can be combined with or without the wallpaper, and the wallpaper
 * never needs a special theme.
 *
 * The image itself is a local file served from the data volume:
 *   <data>/uploads/wallpaper.png  ->  /uploads/wallpaper.png
 * When it is missing the layer simply paints nothing, so the page keeps the
 * plain theme look (see src/styles/wallpaper.css).
 * ------------------------------------------------------------------------- */

export const WALLPAPER_URL = '/uploads/wallpaper.png';

const BACKGROUND_KEY = 'flame.bg';

const readStorage = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch (err) {
    // private mode / disabled storage — fall back to the default (on)
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

/** Wallpaper visible unless it was explicitly turned off. */
export const getBackgroundEnabled = (): boolean =>
  readStorage(BACKGROUND_KEY) !== 'off';

/** Persists the switch and syncs <html data-bg>. */
export const setBackgroundEnabled = (on: boolean): void => {
  writeStorage(BACKGROUND_KEY, on ? 'on' : 'off');
  document.documentElement.dataset.bg = on ? 'on' : 'off';
};

/**
 * Idempotent boot sync: mirrors the inline bootstrap in public/index.html
 * (which sets the attribute for the first paint) into the runtime.
 */
export const applyBootBackground = (): void => {
  document.documentElement.dataset.bg = getBackgroundEnabled() ? 'on' : 'off';
};

/** React binding for the settings UI. */
export const useBackground = (): {
  background: boolean;
  setBackground: (on: boolean) => void;
} => {
  const [background, setBackgroundState] = useState<boolean>(
    getBackgroundEnabled
  );

  useEffect(() => {
    applyBootBackground();
  }, []);

  const setBackground = useCallback((on: boolean) => {
    setBackgroundEnabled(on);
    setBackgroundState(on);
  }, []);

  return { background, setBackground };
};
