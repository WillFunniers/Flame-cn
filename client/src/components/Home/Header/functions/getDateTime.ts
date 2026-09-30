import { parseTime } from '../../../../utility';
import { getLang, t } from '../../../../i18n';

// Upstream default schemas (stored in the backend config and mirrored into
// localStorage by storeUIConfig). They are treated as "not customised" so the
// active dictionary can supply the defaults; user-edited values always win.
const DEFAULT_DAYS = 'Sunday;Monday;Tuesday;Wednesday;Thursday;Friday;Saturday';
const DEFAULT_MONTHS =
  'January;February;March;April;May;June;July;August;September;October;November;December';

export const getDateTime = (): string => {
  const storedDays = localStorage.getItem('daySchema');
  const storedMonths = localStorage.getItem('monthSchema');

  const days = (
    storedDays && storedDays !== DEFAULT_DAYS
      ? storedDays
      : t('home.daysDefault')
  ).split(';');

  const months = (
    storedMonths && storedMonths !== DEFAULT_MONTHS
      ? storedMonths
      : t('home.monthsDefault')
  ).split(';');

  const now = new Date();

  const useAmericanDate = localStorage.useAmericanDate === 'true';
  const showTime = localStorage.showTime === 'true';
  const hideDate = localStorage.hideDate === 'true';

  // Date
  let dateEl = '';

  if (!hideDate) {
    if (getLang() === 'zh-CN') {
      // Chinese convention: 2026年4月25日 星期六
      dateEl = `${now.getFullYear()}年${
        now.getMonth() + 1
      }月${now.getDate()}日 ${days[now.getDay()]}`;
    } else if (!useAmericanDate) {
      dateEl = `${days[now.getDay()]}, ${now.getDate()} ${
        months[now.getMonth()]
      } ${now.getFullYear()}`;
    } else {
      dateEl = `${days[now.getDay()]}, ${
        months[now.getMonth()]
      } ${now.getDate()} ${now.getFullYear()}`;
    }
  }

  // Time
  const p = parseTime;
  let timeEl = '';

  if (showTime) {
    const time = `${p(now.getHours())}:${p(now.getMinutes())}:${p(
      now.getSeconds()
    )}`;

    timeEl = time;
  }

  // Separator
  let separator = '';

  if (!hideDate && showTime) {
    separator = ' - ';
  }

  // Output
  return `${dateEl}${separator}${timeEl}`;
};
