## `@repo/eslint-config` – Shared ESLint Configs

`@repo/eslint-config` provides shared ESLint configurations for all apps and packages in the BISO Sites monorepo. It standardizes TypeScript, React, Next.js, Turbo, and Prettier rules.

These configs are consumed via the flat ESLint `extends` API.

### Available Configs

- **`@repo/eslint-config/base`**
  - Baseline TypeScript + JS config for any package.
  - Includes:
    - `@eslint/js` recommended rules.
    - `typescript-eslint` recommended configs.
    - `eslint-config-prettier` (disables conflicting formatting rules).
    - `eslint-plugin-turbo` with `turbo/no-undeclared-env-vars`.
    - `eslint-plugin-only-warn` (treats violations as warnings by default).
  - Ignores `dist/**` by default.

- **`@repo/eslint-config/next-js`**
  - Extends `base` and adds:
    - `@next/eslint-plugin-next` with `recommended` and `core-web-vitals` rules.
    - React and React Hooks rules.
    - Appropriate globals for Next.js environments (service worker, etc.).
  - Use this in Next.js apps (`apps/web`, `apps/admin`, `apps/docs`).

- **`@repo/eslint-config/react-internal`**
  - Extends `base` and adds:
    - React + React Hooks rules for React libraries (e.g. `@repo/ui`, `@repo/editor`).
    - Browser + service worker globals.
  - Use this in React packages that are not Next.js apps.

### Usage in Apps & Packages

Each app/package has its own flat ESLint config (e.g. `eslint.config.js` or `eslint.config.mjs`). Import the shared config and spread it into the exported config array.

#### Next.js App Example (`apps/web/eslint.config.js`)

```js
import { nextJsConfig } from '@repo/eslint-config/next-js';

export default [
  ...nextJsConfig,
  // App-specific overrides here
];
```

#### React Library Example (`packages/ui/eslint.config.mjs`)

```js
import { config as reactInternalConfig } from '@repo/eslint-config/react-internal';

export default [
  ...reactInternalConfig,
  // Library-specific overrides here
];
```

#### Base Config Example (Non-React Package)

```js
import { config as baseConfig } from '@repo/eslint-config/base';

export default [
  ...baseConfig,
  // Package-specific rules
];
```

### Notes

- Turbo’s `no-undeclared-env-vars` rule is enabled in `base` to catch mistyped or undeclared env vars early.
- Formatting is delegated to Prettier; run `bun run format` from the repo root.
- For full command usage, see `/docs/reference/commands` and the linting notes under `/docs/development`.
