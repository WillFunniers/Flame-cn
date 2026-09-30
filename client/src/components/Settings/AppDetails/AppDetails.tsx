import { Fragment } from 'react';

// UI
import { Button, SettingsHeadline } from '../../UI';
import { AuthForm } from './AuthForm/AuthForm';
import classes from './AppDetails.module.css';

// Store
import { useSelector } from 'react-redux';
import { State } from '../../../store/reducers';

// Other
import { checkVersion } from '../../../utility';

// i18n
import { useT } from '../../../i18n';

export const AppDetails = (): JSX.Element => {
  const t = useT();

  const { isAuthenticated } = useSelector((state: State) => state.auth);

  return (
    <Fragment>
      <SettingsHeadline text={t('app.authentication')} />
      <AuthForm />

      {isAuthenticated && (
        <Fragment>
          <hr className={classes.separator} />

          <div>
            <SettingsHeadline text={t('app.appVersion')} />
            <p className={classes.text}>
              <a
                href="https://github.com/pawelmalak/flame"
                target="_blank"
                rel="noreferrer"
              >
                Flame
              </a>{' '}
              {t('app.version', {
                version: process.env.REACT_APP_VERSION as string,
              })}
            </p>

            <p className={classes.text}>
              {t('app.seeChangelog')}
              <a
                href="https://github.com/pawelmalak/flame/blob/master/CHANGELOG.md"
                target="_blank"
                rel="noreferrer"
              >
                {t('app.changelogLink')}
              </a>
            </p>

            <Button click={() => checkVersion(true)}>
              {t('app.checkForUpdates')}
            </Button>
          </div>
        </Fragment>
      )}
    </Fragment>
  );
};
