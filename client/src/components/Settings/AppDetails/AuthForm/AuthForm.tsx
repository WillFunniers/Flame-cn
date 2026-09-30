import { FormEvent, Fragment, useEffect, useState, useRef } from 'react';

// Redux
import { useSelector, useDispatch } from 'react-redux';
import { bindActionCreators } from 'redux';
import { actionCreators } from '../../../../store';
import { State } from '../../../../store/reducers';
import { decodeToken, parseTokenExpire } from '../../../../utility';

// Other
import { InputGroup, Button } from '../../../UI';

// i18n
import { useT } from '../../../../i18n';
import classes from '../AppDetails.module.css';

export const AuthForm = (): JSX.Element => {
  const t = useT();

  const { isAuthenticated, token } = useSelector((state: State) => state.auth);

  const dispatch = useDispatch();
  const { login, logout } = bindActionCreators(actionCreators, dispatch);

  const [tokenExpires, setTokenExpires] = useState('');
  const [formData, setFormData] = useState({
    password: '',
    duration: '14d',
  });

  const passwordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    passwordInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (token) {
      const decoded = decodeToken(token);
      const expiresIn = parseTokenExpire(decoded.exp);
      setTokenExpires(expiresIn);
    }
  }, [token]);

  const formHandler = (e: FormEvent) => {
    e.preventDefault();
    login(formData);
    setFormData({
      password: '',
      duration: '14d',
    });
  };

  return (
    <Fragment>
      {!isAuthenticated ? (
        <form onSubmit={formHandler}>
          <InputGroup>
            <label htmlFor="password">{t('app.password')}</label>
            <input
              type="password"
              id="password"
              name="password"
              placeholder="••••••"
              autoComplete="current-password"
              ref={passwordInputRef}
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
            />
            <span>
              {t('app.seeWikiPrefix')}
              <a
                href="https://github.com/pawelmalak/flame/wiki/Authentication"
                target="blank"
              >
                {t('app.seeWikiLink')}
              </a>
              {t('app.seeWikiSuffix')}
            </span>
          </InputGroup>

          <InputGroup>
            <label htmlFor="duration">{t('app.sessionDuration')}</label>
            <select
              id="duration"
              name="duration"
              value={formData.duration}
              onChange={(e) =>
                setFormData({ ...formData, duration: e.target.value })
              }
            >
              <option value="1h">{t('app.duration1h')}</option>
              <option value="1d">{t('app.duration1d')}</option>
              <option value="14d">{t('app.duration2w')}</option>
              <option value="30d">{t('app.duration1m')}</option>
              <option value="1y">{t('app.duration1y')}</option>
            </select>
          </InputGroup>

          <Button>{t('app.login')}</Button>
        </form>
      ) : (
        <div>
          <p className={classes.text}>
            {t('app.loggedInExpiresPrefix')}
            <span>{tokenExpires}</span>
            {t('app.loggedInExpiresSuffix')}
          </p>
          <Button click={logout}>{t('app.logout')}</Button>
        </div>
      )}
    </Fragment>
  );
};
