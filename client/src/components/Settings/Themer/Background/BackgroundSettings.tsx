import { ChangeEvent } from 'react';

// UI
import { InputGroup, SettingsHeadline } from '../../../UI';

// i18n
import { useT } from '../../../../i18n';

// Other
import { useBackground } from '../../../../utility/wallpaper';

/**
 * Wallpaper switch. Independent from the theme: it only toggles the
 * `data-bg` attribute, so every Flame theme (built-in or custom) can be
 * combined freely with or without the wallpaper.
 *
 * The picture itself is a local file served from the data volume:
 *   <data>/uploads/wallpaper.png  ->  /uploads/wallpaper.png
 */
export const BackgroundSettings = (): JSX.Element => {
  const t = useT();
  const { background, setBackground } = useBackground();

  const changeHandler = (e: ChangeEvent<HTMLSelectElement>) => {
    setBackground(e.target.value === '1');
  };

  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <SettingsHeadline text={t('theme.wallpaper')} />
      <InputGroup>
        <label htmlFor="wallpaper">{t('theme.wallpaper')}</label>
        <select
          id="wallpaper"
          name="wallpaper"
          value={background ? 1 : 0}
          onChange={changeHandler}
        >
          <option value={1}>{t('theme.backgroundOn')}</option>
          <option value={0}>{t('theme.backgroundOff')}</option>
        </select>
        <span>{t('theme.wallpaperHint')}</span>
      </InputGroup>
    </form>
  );
};
