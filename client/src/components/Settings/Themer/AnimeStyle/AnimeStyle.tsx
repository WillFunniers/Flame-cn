import { ChangeEvent } from 'react';

// Redux
import { useDispatch, useSelector } from 'react-redux';
import { bindActionCreators } from 'redux';
import { actionCreators } from '../../../../store';
import { State } from '../../../../store/reducers';

// UI
import { InputGroup, SettingsHeadline } from '../../../UI';

// Typescript
import { ThemeColors } from '../../../../interfaces';

// i18n
import { useT } from '../../../../i18n';

// Other
import { parsePABToTheme, parseThemeToPAB } from '../../../../utility';
import {
  THEME_STYLES,
  ThemeStyle,
  useThemeStyle,
} from '../../../../utility/animeTheme';

import classes from './AnimeStyle.module.css';

const DESC_KEYS: Record<ThemeStyle, string> = {
  default: 'theme.defaultDesc',
  'anime-light': 'theme.animeLightDesc',
  'anime-dark': 'theme.animeDarkDesc',
};

/**
 * The palette the user had before switching to an anime skin is remembered here
 * so that "Default" can restore it: applying a skin palette goes through the
 * upstream setTheme action, which writes that palette into localStorage
 * 'theme' and would otherwise destroy the user's own colours.
 */
const PRE_ANIME_THEME_KEY = 'flame.theme.beforeAnime';

const ANIME_PALETTES: string[] = THEME_STYLES.map((option) => option.palette)
  .filter((palette): palette is ThemeColors => palette !== null)
  .map((palette) => parseThemeToPAB(palette));

const readStorage = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch (err) {
    return null;
  }
};

const writeStorage = (key: string, value: string): void => {
  try {
    window.localStorage.setItem(key, value);
  } catch (err) {
    // ignore: storage can be unavailable (private browsing)
  }
};

const removeStorage = (key: string): void => {
  try {
    window.localStorage.removeItem(key);
  } catch (err) {
    // ignore
  }
};

const swatchColors = (option: { palette: ThemeColors | null }): string[] => {
  if (option.palette) {
    return [
      option.palette.background,
      option.palette.primary,
      option.palette.accent,
    ];
  }

  // "Default" previews whatever theme the user currently has applied
  return [
    'var(--color-background)',
    'var(--color-primary)',
    'var(--color-accent)',
  ];
};

export const AnimeStyle = (): JSX.Element => {
  const t = useT();
  const { config } = useSelector((state: State) => state.config);
  const { setTheme } = bindActionCreators(actionCreators, useDispatch());
  const { style, setStyle, background, setBackground } = useThemeStyle();

  const applyStyle = (next: ThemeStyle): void => {
    const option = THEME_STYLES.find((item) => item.id === next);

    if (!option) {
      return;
    }

    // Anime skin: remember the user's own palette, then apply the skin palette
    if (option.palette) {
      const current = readStorage('theme');

      if (current) {
        writeStorage(PRE_ANIME_THEME_KEY, current);
      }

      setStyle(option.id);
      setTheme(option.palette);
      return;
    }

    // Default: restore the user's own palette (or the configured default)
    const remembered = readStorage(PRE_ANIME_THEME_KEY);
    const current = readStorage('theme');
    let restored: string | null = null;

    if (remembered && ANIME_PALETTES.indexOf(remembered) === -1) {
      restored = remembered;
    } else if (current && ANIME_PALETTES.indexOf(current) === -1) {
      restored = current;
    }

    setStyle('default');

    if (restored) {
      setTheme(parsePABToTheme(restored));
    } else {
      // the configured default is not a user choice -> do not persist it
      setTheme(parsePABToTheme(config.defaultTheme), false);
    }

    removeStorage(PRE_ANIME_THEME_KEY);
  };

  const backgroundChangeHandler = (e: ChangeEvent<HTMLSelectElement>): void => {
    setBackground(e.target.value === '1');
  };

  return (
    <div className={classes.AnimeStyle}>
      <SettingsHeadline text={t('theme.visualStyle')} />
      <p className={classes.Hint}>{t('theme.visualStyleHint')}</p>

      <div
        className={classes.Options}
        role="radiogroup"
        aria-label={t('theme.visualStyle')}
      >
        {THEME_STYLES.map((option) => {
          const active = option.id === style;

          return (
            <label
              key={option.id}
              className={
                active
                  ? `${classes.Option} ${classes.OptionActive}`
                  : classes.Option
              }
            >
              <input
                type="radio"
                className={classes.Radio}
                name="animeStyle"
                value={option.id}
                checked={active}
                onChange={() => applyStyle(option.id)}
              />
              <span className={classes.Swatch} aria-hidden="true">
                {swatchColors(option).map((color, index) => (
                  <span
                    key={index}
                    className={classes.SwatchDot}
                    style={{ backgroundColor: color }}
                  ></span>
                ))}
              </span>
              <span className={classes.Label}>{t(option.labelKey)}</span>
              <span className={classes.Desc}>{t(DESC_KEYS[option.id])}</span>
            </label>
          );
        })}
      </div>

      <InputGroup>
        <label htmlFor="animeBackground">{t('theme.animeBackground')}</label>
        <select
          id="animeBackground"
          name="animeBackground"
          value={background ? 1 : 0}
          onChange={backgroundChangeHandler}
        >
          <option value={1}>{t('theme.backgroundOn')}</option>
          <option value={0}>{t('theme.backgroundOff')}</option>
        </select>
        <span>{t('theme.animeBackgroundHint')}</span>
      </InputGroup>
    </div>
  );
};
