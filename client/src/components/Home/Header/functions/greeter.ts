import { t } from '../../../../i18n';

// Upstream default greetings schema (the value stored in the backend config and
// mirrored into localStorage by storeUIConfig). It is treated as "not
// customised" so the active dictionary can supply the defaults; a value the user
// actually edited always wins, in either language.
const DEFAULT_GREETINGS =
  'Good evening!;Good afternoon!;Good morning!;Good night!';

export const greeter = (): string => {
  const now = new Date().getHours();
  let msg: string;

  const stored = localStorage.getItem('greetingsSchema');
  const isCustomised = !!stored && stored !== DEFAULT_GREETINGS;
  const greetingsSchemaRaw = isCustomised
    ? (stored as string)
    : t('home.greetingsDefault');
  const greetingsSchema = greetingsSchemaRaw.split(';');

  if (now >= 18) msg = greetingsSchema[0];
  else if (now >= 12) msg = greetingsSchema[1];
  else if (now >= 6) msg = greetingsSchema[2];
  else if (now >= 0) msg = greetingsSchema[3];
  else msg = t('home.greetingHello');

  return msg;
};
