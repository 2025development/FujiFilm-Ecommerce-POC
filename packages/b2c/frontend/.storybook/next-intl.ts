import en from '../messages/en.json';
import de from '../messages/de.json';

type Messages = { en: typeof en; de: typeof de };

const messagesByLocale: Messages = { en, de };

const nextIntl = {
  defaultLocale: 'en',
  messagesByLocale,
};

export default nextIntl;
