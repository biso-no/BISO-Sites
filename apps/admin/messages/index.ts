import type {Locale} from '@/i18n/config';

export async function loadMessages(locale: Locale) {
  switch (locale) {
    case 'no':
      return (await import('./no')).default;
    case 'en':
    default:
      return (await import('./en')).default;
  }
}

export const messageNamespaces = [
  'common',
  'home',
  'varsling',
  'partner',
  'about',
  'membership',
  'students',
  'projects',
  'fundingProgram',
  'projectDetail'
] as const;
