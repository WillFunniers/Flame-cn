import classes from './AppGrid.module.css';
import { Link } from 'react-router-dom';
import { App } from '../../../interfaces/App';

import { AppCard } from '../AppCard/AppCard';
import { Message } from '../../UI';

// i18n
import { useT } from '../../../i18n';

interface Props {
  apps: App[];
  totalApps?: number;
  searching: boolean;
}

export const AppGrid = (props: Props): JSX.Element => {
  const t = useT();

  let apps: JSX.Element;

  if (props.searching || props.apps.length) {
    if (!props.apps.length) {
      apps = <Message>{t('apps.noMatch')}</Message>;
    } else {
      apps = (
        <div className={classes.AppGrid}>
          {props.apps.map((app: App): JSX.Element => {
            return <AppCard key={app.id} app={app} />;
          })}
        </div>
      );
    }
  } else {
    if (props.totalApps) {
      apps = (
        <Message>
          {t('apps.emptyPinnedPrefix')}
          <Link to="/applications">/applications</Link>
          {t('apps.emptyPinnedSuffix')}
        </Message>
      );
    } else {
      apps = (
        <Message>
          {t('apps.emptyNonePrefix')}
          <Link to="/applications">/applications</Link>
          {t('apps.emptyNoneSuffix')}
        </Message>
      );
    }
  }

  return apps;
};
