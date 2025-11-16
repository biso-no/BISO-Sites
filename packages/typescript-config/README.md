## `@repo/typescript-config` – Shared TSConfig Bases

`@repo/typescript-config` provides shared `tsconfig` bases for the BISO Sites monorepo. Apps and packages extend these configs instead of duplicating compiler options.

### Available Configs

The package ships the following JSON config files:

- **`@repo/typescript-config/base.json`**
  - Baseline strict TypeScript configuration for any Node/TypeScript project.
  - Enables strict type-checking and sensible defaults for libraries.

- **`@repo/typescript-config/nextjs.json`**
  - Extends `base.json` with options suitable for Next.js App Router apps.
  - Used by `apps/web`, `apps/admin`, and `apps/docs`.

- **`@repo/typescript-config/react-library.json`**
  - Extends `base.json` with JSX and module settings appropriate for React component libraries.
  - Used by packages like `@repo/ui` and `@repo/editor`.

### Usage in an App (`tsconfig.json`)

```json
{
  "extends": "@repo/typescript-config/nextjs.json",
  "compilerOptions": {
    "baseUrl": "./src",
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "src/**/*", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### Usage in a React Library

```json
{
  "extends": "@repo/typescript-config/react-library.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "rootDir": ".",
    "outDir": "dist"
  },
  "include": ["**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules", "dist"]
}
```

### Usage in a Utility Package

```json
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "rootDir": ".",
    "outDir": "dist"
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

### Notes

- All configs assume TypeScript 5+ and strict mode.
- Apps and packages are responsible for their own `include`/`exclude` and `paths` as needed.
- Run `bun run check-types` at the repo root to type-check all apps and packages.


