# BISO-Sites

Monorepo for **BI Student Organisation (BISO)**: the public-facing student site,
the internal admin CMS, a shared REST/JWT API, and the developer docs site. All
apps share one Appwrite backend through `@repo/api`.

## Layout

### Apps (`apps/*`)

| App     | Port | Audience                  | What it is |
|---------|------|---------------------------|------------|
| `web`   | 3000 | Students, members, public | Next.js 16 public site (App Router, RSC). See `apps/web/CLAUDE.md`. |
| `admin` | 3001 | BISO staff (IT, editors)  | Next.js 16 CMS with block-based page editor. See `apps/admin/CLAUDE.md`. |
| `docs`  | 3002 | Developers                | Fumadocs-based developer documentation. |
| `api`   | 3003 | `web` (server-to-server)  | Standalone JWT-authenticated REST service consumed via `NEXT_PUBLIC_API_BASE_URL`. |

### Packages (`packages/*`)

| Package                | Purpose |
|------------------------|---------|
| `@repo/api`            | Appwrite SDK wrappers + generated row types. **Single source of truth for backend access.** |
| `@repo/editor`         | In-house block editor (`EditorShell`, `PageDoc`) built on `@dnd-kit` + `immer` + `zustand`. Used by both `web` (render) and `admin` (edit). |
| `@repo/ui`             | Shared React component library (Radix + Tailwind). |
| `@repo/ai`             | AI SDK config, providers, hooks, and tool schemas. |
| `@repo/connectors`     | External integrations: Azure AD/Graph, 24SevenOffice, SharePoint, WooCommerce. |
| `@repo/payment`        | Payment providers: Vipps MobilePay, Stripe. |
| `@repo/i18n`           | `next-intl` config + message bundles. |
| `@repo/shared`         | Cross-cutting utils, types, recruitment helpers. |
| `@repo/typescript-config` | Shared `tsconfig` presets. |

## Package manager

**Always use Bun (`bun@1.3.1`).** Never `npm` or `pnpm` — workspaces and the
shared `catalog:` dependency protocol require Bun. The lockfile is `bun.lock`.

- Add a dep to an app: `bun add <pkg> --filter=<app>`
- Add a workspace dep: `bun add @repo/ui --filter=admin`
- Pin shared versions in the root `package.json` `catalog` block and reference
  them from app/package manifests as `"<pkg>": "catalog:"`.

## Root commands

```bash
bun run dev          # turbo run dev — starts every app in parallel
bun run build        # turbo run build
bun run lint         # turbo run lint (biome via Ultracite)
bun run check-types  # turbo run check-types — REQUIRED before merging
bun run fix          # turbo run fix
bun x ultracite fix  # repo-wide format + autofix
```

Filter to one app: append `--filter=<admin|web|api|docs>`
(e.g. `bun run dev --filter=admin`).

App-specific build-and-bundle scripts for Appwrite deploys (`build:web:appwrite`,
`build:admin:appwrite`, etc.) live in the root `package.json` scripts block.

## Turborepo notes

- Remote cache is **disabled** (`turbo.json#remoteCache.enabled = false`).
- `build` declares an explicit env allow-list — any new build-time env var must
  be added to `turbo.json#tasks.build.env` or Turbo will treat it as an undeclared
  input and break cache correctness.
- `check-types` depends on a `_transit` task so package `tsc` runs propagate
  through the dependency graph before app-level type-checks. Don't remove the
  `_transit` shim without rewiring this.
- `dev` is `persistent: true` and uncached — keep it that way.

## Backend: Appwrite

All data access goes through `@repo/api`. Never import `appwrite` or
`node-appwrite` directly in app code.

**Required reading before any data-layer work:**

- `packages/api/appwrite.config.json` — full schema (collections, attributes,
  indexes, permissions). Source of truth for table IDs, column names, enum
  values, relationships, and `$permissions`.
- `packages/api/types/appwrite.ts` — generated row types and enums. Use them as
  the type parameter on every `db.getRow<T>(…)` / `db.listRows<T>(…)`.

Entrypoints:

- `@repo/api/server` — `createSessionClient()` (user-scoped), `createAdminClient()` (service key). Server-only.
- `@repo/api/client` — browser-only Appwrite client.
- `@repo/api` (root) — runtime helpers (`ID`, `Query`, `Permission`, `Role`,
  `OAuthProvider`) and `Models` types.
- `@repo/api/page-builder` — draft/publish flow for the block editor.

## Cross-cutting conventions

- **Ultracite / Biome** govern formatting and linting. Style rules live in
  `.claude/CLAUDE.md` (Ultracite Code Standards). Run `bun x ultracite fix`
  before committing; `lefthook` + `lint-staged` enforce it on pre-commit.
- **TypeScript**: `strict` everywhere. `tsconfig` presets come from
  `@repo/typescript-config`.
  so their `next build` will **not** catch type errors — `bun run check-types`
  is the only signal that matters.
- **Imports**: prefer named imports over namespace imports; avoid barrel files
  that re-export everything (perf). In `apps/admin`, the `@/*` alias resolves
  into **both** `./src/*` and `../../packages/editor/src/*` — see
  `apps/admin/CLAUDE.md`.
- **Env vars**: only `NEXT_PUBLIC_*` vars cross to the browser. Server-only
  secrets (`APPWRITE_API_KEY`, `VIPPS_*`, `AZURE_*`, `OPENAI_API_KEY`,
  `SHAREPOINT_*`, `CRON_SECRET`, etc.) must never be referenced from a Client
  Component. New build-time env vars must also be added to `turbo.json`.
- **Server-first**: default to React Server Components and server actions.
  Mark a file `"use client"` only when you need state, effects, or browser APIs.

## When working on a specific app

Read the relevant app-level `CLAUDE.md` **before** making non-trivial changes:

- Touching `apps/admin`? → `apps/admin/CLAUDE.md` (auth roles, route groups,
  campus scoping, server-action shape).
- Touching `apps/web`? → `apps/web/CLAUDE.md` (anonymous session middleware,
  third-party integrations, env var rules).
- Touching shared data shapes used by both? Read **both** files plus
  `packages/api/appwrite.config.json`.

## Do not touch

- `packages/api/appwrite.config.json` — auto-generated by the Appwrite CLI.
  Edit the schema in Appwrite, then regenerate.
- `packages/api/types/appwrite.ts` — auto-generated; regenerate with
  `appwrite types -l ts ./types`.
- `apps/*/next-env.d.ts` — Next.js generated.
- `apps/web/appwrite.json`, `apps/web/database.json` — legacy stubs; the real
  schema lives in `packages/api/`.
- Any `.next/`, `dist/`, `node_modules/` artifacts.
