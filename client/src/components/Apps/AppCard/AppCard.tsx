import classes from './AppCard.module.css';
import { Icon } from '../../UI';
import { iconParser, isImage, isSvg, isUrl, urlParser } from '../../../utility';

import { App } from '../../../interfaces';
import { useSelector } from 'react-redux';
import { State } from '../../../store/reducers';

// i18n
import { useT } from '../../../i18n';

interface Props {
  app: App;
}

export const AppCard = ({ app }: Props): JSX.Element => {
  const t = useT();

  const { config } = useSelector((state: State) => state.config);

  const [displayUrl, redirectUrl] = urlParser(app.url);

  let iconEl: JSX.Element;
  const { icon } = app;

  if (isImage(icon)) {
    const source = isUrl(icon) ? icon : `/uploads/${icon}`;

    iconEl = (
      <img
        src={source}
        alt={t('apps.iconAlt', { name: app.name })}
        className={classes.CustomIcon}
      />
    );
  } else if (isSvg(icon)) {
    const source = isUrl(icon) ? icon : `/uploads/${icon}`;

    iconEl = (
      <div className={classes.CustomIcon}>
        <svg
          data-src={source}
          fill="var(--color-primary)"
          className={classes.CustomIcon}
        ></svg>
      </div>
    );
  } else {
    iconEl = <Icon icon={iconParser(icon)} />;
  }

  return (
    <a
      href={redirectUrl}
      target={config.appsSameTab ? '' : '_blank'}
      rel="noreferrer"
      className={classes.AppCard}
    >
      <div className={classes.AppCardIcon}>{iconEl}</div>
      <div className={classes.AppCardDetails}>
        <h5>{app.name}</h5>
        <span>{!app.description.length ? displayUrl : app.description}</span>
      </div>
    </a>
  );
};
