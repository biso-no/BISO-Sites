## BISO Sites Monorepo

**BISO Sites** is a Turborepo-powered monorepo for BISO’s public website, admin CMS, and internal tooling. It hosts multiple Next.js applications and shared packages for API access, payments, UI, and page building.

If you are new to the project, start in the docs app: `/docs` (see **Documentation** below).

### Monorepo Layout

```text
apps/
  web/    # Public website for students and visitors (port 3000)
  admin/  # Admin & CMS for editors and IT (port 3001)
  docs/   # Documentation site powered by Fumadocs (port 3002)

packages/
  api/             # Appwrite client & helpers
  payment/         # Vipps MobilePay integration
  ui/              # Shared design system & primitives
  editor/          # Puck-based page builder
  eslint-config/   # Shared ESLint configs
  typescript-config/ # Shared tsconfig bases
```

### Tech Stack

- **Framework**: Next.js 15 (App Router), React 19, TypeScript (strict)
- **Styling**: Tailwind CSS, design tokens from `@repo/ui`
- **Backend**: Appwrite (database, auth, storage)
- **Payments**: Vipps MobilePay via `@repo/payment`
- **i18n**: `next-intl` (Norwegian & English)
- **Monorepo tooling**: Turborepo + Bun

For architectural details, see the docs pages under `/docs/repository` and `/docs/architecture`.

### Getting Started

#### Prerequisites

- Node.js `>=18`
- Bun `>=1.3`
- Appwrite and Vipps credentials (see **Operations** docs for setup)

#### Install dependencies

```bash
bun install
```

#### Run all apps in development

```bash
bun run dev
```

#### Run a single app

```bash
# Public web app
bun run dev --filter=web

# Admin CMS
bun run dev --filter=admin

# Docs app
bun run dev --filter=docs
```

### Core Commands

From the repo root:

```bash
# Build all apps and packages
bun run build

# Lint all apps and packages
bun run lint

# Type-check all apps and packages
bun run check-types

# Format supported files
bun run format
```

You can scope any of these with `--filter=<app-or-package>` if needed.

### Applications

- **Web (`apps/web`)**: Public-facing site for students, members, and visitors.
  - Features: membership onboarding, events, e‑commerce, units/departments, news, jobs.
  - Docs: `/docs/applications/web-app`

- **Admin (`apps/admin`)**: Admin console and CMS for editors and IT.
  - Features: user management, page builder, events/news, shop & orders, units, jobs, expenses.
  - Docs: `/docs/applications/admin-app`

- **Docs (`apps/docs`)**: Fumadocs-powered documentation site.
  - Purpose: canonical documentation for repository, applications, architecture, operations, and packages.
  - Docs about docs: `/docs/architecture/apps#docs-application`

### Shared Packages

- **`@repo/api`** (`packages/api`): Type-safe Appwrite clients for server and browser, plus storage helpers and generated types.
- **`@repo/payment`** (`packages/payment`): Vipps checkout and payment flow abstractions with server actions and core helpers.
- **`@repo/ui`** (`packages/ui`): Design system, tokens, and UI primitives used by web, admin, and docs.
- **`@repo/editor`** (`packages/editor`): Puck configuration, editor, and renderer for visual page building.
- **`@repo/eslint-config`** (`packages/eslint-config`): Shared ESLint configs for apps and packages.
- **`@repo/typescript-config`** (`packages/typescript-config`): Base `tsconfig` presets for Next.js apps and React libraries.

See `/docs/packages` for in-depth package documentation and examples.

### Documentation

The docs app is the **source of truth** for workflows, operations, and APIs.

- **Repository**: `/docs/repository` – onboarding, quickstart, project structure, troubleshooting.
- **Applications**: `/docs/applications` – web/admin overviews and feature guides.
- **Packages**: `/docs/packages` – `@repo/api`, `@repo/payment`, `@repo/ui`, `@repo/editor` details.
- **Architecture**: `/docs/architecture` – high-level design and data flow.
- **Operations**: `/docs/operations` – environments, Appwrite, Docker, and deployment.
- **Reference**: `/docs/reference/commands` – full command reference for Bun/Turbo.

When in doubt, update the docs app first and keep READMEs short, linking back to the relevant pages.
