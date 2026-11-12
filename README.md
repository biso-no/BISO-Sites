# BISO-Sites

The websites and services of BI Studentorganisasjon (BISO): the public website
at [biso.no](https://biso.no), the admin and CMS that BISO staff use, the API
behind them, and the documentation at [docs.biso.no](https://docs.biso.no).
Everything shares one Appwrite backend.

The mobile app lives in [BISO-Flutter](https://github.com/biso-no/BISO-Flutter).

## What's in here

| Path | What it is | Local port |
|---|---|---|
| `apps/web` | Public website for students, members and visitors | 3000 |
| `apps/admin` | Admin and CMS for BISO staff, with a block-based page editor | 3001 |
| `apps/docs` | Staff guide and developer handover, built with Fumadocs | 3002 |
| `apps/api` | REST API with JWT auth, called by the website and the admin | 3003 |
| `functions/*` | Appwrite functions: push notifications for new content, the member roster sync from 24SevenOffice, and scheduled jobs | |

| Package | What it is |
|---|---|
| `@repo/api` | Appwrite access and generated types. All data access goes through it. |
| `@repo/editor` | The block editor. The admin edits pages with it and the website renders them. |
| `@repo/ui` | Shared React components (Radix and Tailwind) |
| `@repo/ai` | AI SDK setup, model providers and tools |
| `@repo/connectors` | Microsoft 365 (Entra ID, Graph, SharePoint), 24SevenOffice and WooCommerce |
| `@repo/payment` | Vipps MobilePay and Stripe |
| `@repo/i18n` | Norwegian and English translations for `next-intl` |
| `@repo/shared` | Shared helpers and types |
| `@repo/tours` | Guided tours in the admin |
| `@repo/wp-import` | One-off migration from the old WordPress site |
| `@repo/typescript-config` | Shared `tsconfig` presets |

Built with Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4,
Appwrite, Turborepo and Bun. Biome, through the Ultracite preset, formats and
lints the code.

## Getting started

You need [Bun](https://bun.sh) 1.3.1 and Node 22 or later. npm and pnpm don't
work with this repository.

```bash
bun install
cp apps/web/.env.example apps/web/.env.local   # and the same for each app you run
bun run dev --filter=web
```

> [!WARNING]
> An Appwrite endpoint or project you leave unset falls back to
> **production**. Read
> [Local setup](https://docs.biso.no/developers/change-it/local-setup) and
> point the apps at an Appwrite project of your own before you run them.

## Commands

Run these from the repository root. Add `--filter=<app or package>` to run
one workspace only, for example `--filter=admin`.

| Command | What it does |
|---|---|
| `bun run dev` | Starts every app in development mode |
| `bun run build` | Builds everything |
| `bun run check-types` | Type-checks everything. Required before merging. |
| `bun run test` | Runs every test suite |
| `bun x ultracite fix <paths>` | Formats and fixes the files you name |
| `bun x ultracite check <paths>` | Reports lint problems in the files you name |

## Documentation

- [Developer docs](https://docs.biso.no/developers): how the platform works,
  how to change it and how to keep it running. Start here if you're new.
- [Platform guide](https://docs.biso.no/guide): how BISO staff use the admin.
- `CLAUDE.md` files at the root and in each app hold the coding rules.

The docs source is in `apps/docs/content/docs/`. Run it locally with
`bun run dev --filter=docs`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to report a bug, set up the
project and get a change merged. Everyone who takes part follows the
[code of conduct](CODE_OF_CONDUCT.md).

## Security

Found a security problem? Don't open an issue. Follow
[SECURITY.md](SECURITY.md).

## License

Copyright (c) 2025-2026 BI Studentorganisasjon (BISO). All rights reserved.

The code is public so anyone can read it, but it isn't open source. You may
not reuse it without written permission from BISO. See [LICENSE](LICENSE).
