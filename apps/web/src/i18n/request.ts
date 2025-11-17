import { getRequestConfig } from 'next-intl/server';
import { getLocale } from '@/app/actions/locale';
import { loadMessages } from '@repo/i18n/messages';

export default getRequestConfig(async () => {
  const locale = await getLocale();

  return {
    locale,
    messages: await loadMessages(locale)
  };
});

