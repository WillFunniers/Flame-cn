import { NavLink, Link, Switch, Route } from 'react-router-dom';

// Redux
import { useSelector } from 'react-redux';
import { State } from '../../store/reducers';

// Typescript
import { Route as SettingsRoute } from '../../interfaces';

// CSS
import classes from './Settings.module.css';

// Components
import { Themer } from './Themer/Themer';
import { WeatherSettings } from './WeatherSettings/WeatherSettings';
import { UISettings } from './UISettings/UISettings';
import { AppDetails } from './AppDetails/AppDetails';
import { StyleSettings } from './StyleSettings/StyleSettings';
import { GeneralSettings } from './GeneralSettings/GeneralSettings';
import { DockerSettings } from './DockerSettings/DockerSettings';
import { ProtectedRoute } from '../Routing/ProtectedRoute';

// UI
import { Container, Headline } from '../UI';

// i18n
import { useT } from '../../i18n';

// Data
import clientRoutes from './settings.json';

export const Settings = (): JSX.Element => {
  const t = useT();

  const routes = clientRoutes.routes;

  const { isAuthenticated } = useSelector((state: State) => state.auth);

  const tabs = isAuthenticated ? routes : routes.filter((r) => !r.authRequired);

  return (
    <Container>
      <Headline
        title={t('nav.settings')}
        subtitle={<Link to="/">{t('ui.goBack')}</Link>}
      />
      <div className={classes.Settings}>
        {/* NAVIGATION MENU */}
        <nav className={classes.SettingsNav}>
          {tabs.map(({ name, dest }: SettingsRoute, idx) => {
            // settings.json keeps the upstream route names; translate at render
            // time and fall back to the original name when a key is missing.
            const navKey = `nav.${name.toLowerCase()}`;
            const label = t(navKey);

            return (
              <NavLink
                className={classes.SettingsNavLink}
                activeClassName={classes.SettingsNavLinkActive}
                exact
                to={dest}
                key={idx}
              >
                {label === navKey ? name : label}
              </NavLink>
            );
          })}
        </nav>

        {/* ROUTES */}
        <section className={classes.SettingsContent}>
          <Switch>
            <Route exact path="/settings" component={Themer} />
            <ProtectedRoute
              path="/settings/weather"
              component={WeatherSettings}
            />
            <ProtectedRoute
              path="/settings/general"
              component={GeneralSettings}
            />
            <ProtectedRoute path="/settings/interface" component={UISettings} />
            <ProtectedRoute
              path="/settings/docker"
              component={DockerSettings}
            />
            <ProtectedRoute path="/settings/css" component={StyleSettings} />
            <Route path="/settings/app" component={AppDetails} />
          </Switch>
        </section>
      </div>
    </Container>
  );
};
