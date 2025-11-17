# @repo/i18n

Shared internationalization (i18n) package for the BISO monorepo.

## Overview

This package provides centralized translation management for both the web and admin apps, supporting Norwegian (no) and English (en) locales.

## Structure

```
packages/i18n/
├── config.ts           # Locale configuration
├── types.ts            # TypeScript type definitions
├── index.ts            # Main entry point
└── messages/           # Translation files
    ├── en/             # English translations
    ├── no/             # Norwegian translations
    ├── en.ts           # English message loader
    ├── no.ts           # Norwegian message loader
    └── index.ts        # Message loader exports
```

## Usage

### In Next.js Apps

1. Add dependency to `package.json`:
```json
{
  "dependencies": {
    "@repo/i18n": "*"
  }
}
```

2. Use in i18n configuration:
```typescript
// src/i18n/config.ts
export { SUPPORTED_LOCALES, DEFAULT_LOCALE, isLocale } from '@repo/i18n/config';
export type { Locale } from '@repo/i18n/config';
```

3. Load messages:
```typescript
// src/i18n/request.ts
import { loadMessages } from '@repo/i18n/messages';
import { getLocale } from '@/app/actions/locale';

export default getRequestConfig(async () => {
  const locale = await getLocale();
  return {
    locale,
    messages: await loadMessages(locale)
  };
});
```

4. Use translations in components:
```typescript
import { useTranslations } from 'next-intl';

function MyComponent() {
  const t = useTranslations('admin');
  return <h1>{t('title')}</h1>;
}
```

## Available Namespaces

### Shared Namespaces
- `common` - Common UI elements
- `home`, `about`, `membership`, etc. - Public pages
- `varsling` - Whistleblowing

### Admin-Specific Namespaces
- `admin` - Core admin UI (navigation, layout)
- `adminUsers` - User management
- `adminShop` - Shop management
- `adminJobs` - Jobs & applications
- `adminEvents` - Events management
- `adminExpenses` - Expense tracking
- `adminUnits` - Units/departments
- `adminSettings` - Settings

## Adding New Translations

### Manual Translation

1. Add translation keys to the appropriate JSON files in `messages/en/` and `messages/no/`
2. Update `messages/en.ts` and `messages/no.ts` if adding new namespace files
3. Update `messages/index.ts` to include new namespaces in the array
4. Update `types.ts` to include the new namespace in the `MessageNamespace` type

### Automated Translation with OpenAI

For bulk translations or when adding new content, you can use the automated translation script:

```bash
# Translate all files from English to Norwegian
OPENAI_API_KEY=your_key bun run translate

# Preview translations without writing files
OPENAI_API_KEY=your_key bun run translate --dry-run

# Translate a specific file
OPENAI_API_KEY=your_key bun run translate --file=admin.json
```

See [scripts/README.md](./scripts/README.md) for detailed documentation on the translation script.

## Type Safety

The package exports TypeScript types for locales and message namespaces. All translation calls are type-checked through `next-intl`.

## Locale Detection

Locale is stored in Appwrite user preferences and retrieved via the `getLocale()` server action in each app. Anonymous users also have locale preferences stored via Appwrite sessions.

