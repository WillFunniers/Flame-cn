import classes from './Spinner.module.css';

// i18n
import { useT } from '../../../i18n';

export const Spinner = (): JSX.Element => {
  const t = useT();

  return (
    <div className={classes.SpinnerWrapper}>
      <div className={classes.Spinner}>{t('ui.loading')}</div>
    </div>
  );
};
