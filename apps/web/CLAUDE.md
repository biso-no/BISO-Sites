# apps/web

Public-facing BISO website (Next.js 15 App Router, React 19, RSC by default).
Audience: students, members, visitors. Sister app `apps/admin` shares the same
Appwrite backend through `@repo/api` — read `apps/admin/CLAUDE.md` for cross-app
context if you're touching shared data shapes.

## Required reading before any data-layer work

- `packages/api/appwrite.config.json` — source of truth for collections,
  attributes, permissions, indexes.
- `packages/api/types/appwrite.ts` — auto-generated row types. Regenerated via
  `appwrite types -l ts ./types`; do not hand-edit.

## Routing

Route groups under `src/app/`:

- `(public)/` — anonymous-friendly. Wrapped by `(public)/layout.tsx` which
  fetches membership status server-side. Includes catch-all
  `(public)/[...slug]/page.tsx` that pulls Puck pages via
  `getPage(slug, locale)` from `@repo/api/page-builder` and renders with
  `@repo/editor`'s `PageDoc`.
- `(protected)/` — gated by `(protected)/layout.tsx` which calls
  `getLoggedInUser()` from `@/lib/actions/user.ts` and triggers `unauthorized()`
  (Next.js `authInterrupts` is enabled in `next.config.ts`). The 401 UI is
  `src/app/unauthorized.tsx`. Routes: `applications`, `fs`, `profile`.
- `(auth)/` — login page + OAuth/magic-link/invite route handlers under
  `(auth)/auth/`.

Top-level: `app/layout.tsx` (sets `dynamic = "force-dynamic"`, loads locale +
next-intl messages), `not-found.tsx`, `unauthorized.tsx`, `robots.ts`,
`sitemap.ts`, `providers.tsx` (Theme + Tooltip).

## Auth

- Session cookie: `a_session_biso` (override with `APPWRITE_SESSION_COOKIE`).
- `src/proxy.ts` is the Next middleware (exported as `proxy`, matcher excludes
  `/api/`, `_next/*`, images, favicons). If no session cookie exists, it
  redirects to `/api/auth/anonymous?redirect=…`, which uses `createAdminClient`
  to mint an anonymous Appwrite session and sets the cookie (cross-subdomain
  `.biso.no` in prod, `lax` locally).
- Anonymous ≠ authenticated. `getAuthStatus()` in `src/lib/auth-utils.ts` and
  `getLoggedInUser()` both classify a session as authenticated only if
  `hasEmail || (hasRealName && emailVerification)` — apply the same rule when
  gating features, do not just check for `account.get()` succeeding.
- OAuth providers (Microsoft/Google/Facebook/Apple) and magic link are wired in
  `src/lib/server.ts`; OAuth callback handler is
  `src/app/(auth)/auth/callback/route.ts`.

## Appwrite access

Never import `appwrite` or `node-appwrite` directly — go through `@repo/api`:

- `@repo/api/server` → `createSessionClient(jwt?)`, `createAdminClient()`.
  Server-only. Admin client uses `APPWRITE_API_KEY`. `db` is proxied so
  `listRows`/`getRow` return plain objects safe to cross the RSC boundary.
- `@repo/api/client` → `clientSideClient`, `clientDatabase`, `clientAccount`,
  `clientStorage`, `clientFunctions`. Browser only.
- `@repo/api` (root) → runtime helpers (`ID`, `Query`, `Permission`, `Role`,
  `OAuthProvider`, `MessagingProviderType`) plus `Models` types and storage URL
  builders.
- `@repo/api/page-builder` → `getPage` for the catch-all renderer.
- `@repo/api/types/appwrite` → row types. Use these for every `db.getRow<T>` /
  `db.listRows<T>` call rather than `unknown` or hand-rolled shapes.

Server actions live in two places:

- `src/app/actions/*.ts` — feature-level actions (orders, events, jobs, news,
  campus, membership, etc.).
- `src/lib/actions/*.ts` — cross-cutting (user, membership, expense, departments).

The JWT-based REST client at `src/lib/api-client.ts` (`apiClient.fetch` /
`fetchFormData`) targets `NEXT_PUBLIC_API_BASE_URL` (the standalone `apps/api`
service); JWT is minted by the `createJWT` server action and cached for 14 min.

## Third-party integrations

All consumed server-side only:

- SharePoint document download → `@repo/connectors/sharepoint`
  (`src/app/api/documents/[id]/download/route.ts`). Env: `SHAREPOINT_*`.
- 24SevenOffice membership sync → `@repo/connectors/24sevenoffice`
  (`src/lib/actions/membership.ts`). Env: `AZURE_*`.
- Vipps MobilePay → `@repo/payment/vipps` (`src/app/actions/orders.ts`,
  `src/app/api/checkout/return/route.ts`). Env: `VIPPS_*`. The legacy webhook
  at `/api/checkout/webhook` returns 410 — new flows go to
  `/api/payment/vipps/callback`.
- OpenAI (`@ai-sdk/openai`) for expense OCR / description endpoints under
  `/api/expense/*` and `src/lib/actions/expense-ocr.ts`.

## Environment variables

- Public (bundled to client): `NEXT_PUBLIC_APPWRITE_ENDPOINT`,
  `NEXT_PUBLIC_APPWRITE_PROJECT`, `NEXT_PUBLIC_BASE_URL`,
  `NEXT_PUBLIC_API_BASE_URL`.
- Server-only — never reference from a Client Component or `NEXT_PUBLIC_*`
  variable: `APPWRITE_API_KEY`, `APPWRITE_SESSION_COOKIE`, `OPENAI_API_KEY`,
  `SHAREPOINT_*`, `VIPPS_*`, `AZURE_*`, `WEBDOCK_API_KEY`, `PINECONE_*`,
  `CRON_SECRET`, `APPWRITE_BUCKET_ID`.
- The cron handler (`/api/cron/cleanup-reservations`) gates on
  `Bearer ${CRON_SECRET}` when the env var is set — keep that check in place.

## Data fetching conventions

- Default to Server Components; mark a file `"use client"` only when you need
  state, effects, or browser-only APIs.
- Server actions in `src/app/actions/` and `src/lib/actions/` are the
  preferred mutation path. Use `Permission` / `Role` from `@repo/api` when
  writing rows that need row-level ACLs (see
  `src/app/api/form/submit/route.ts` for the pattern: admin team + optional
  per-team grants).
- Locale comes from the Appwrite account prefs via `getLocale()` in
  `src/app/actions/locale.ts`; messages are loaded by `src/i18n/request.ts`
  and provided through `NextIntlClientProvider` in `app/layout.tsx`.

## Gotchas

- `next.config.ts` sets `typescript: { ignoreBuildErrors: true }` — `next build`
  will not catch type regressions. Run `bun run check-types` from `apps/web`
  before claiming a change compiles.
- `output: "standalone"` + `outputFileTracingRoot: "../../"` — workspace
  packages must stay in `transpilePackages` in `next.config.ts`.
- `images.remotePatterns` only allows `appwrite.biso.no`, `biso.no`, and
  `via.placeholder.com`. New image sources need an entry.
- `src/proxy.ts` matcher already excludes `/api/`, so route handlers don't
  receive the anonymous-session redirect — don't add auth assumptions there
  that depend on the cookie always being present.

## Do not touch

- `next-env.d.ts`, `.next/`, `node_modules/`.
- `apps/web/appwrite.json` and `apps/web/database.json` are stubs (project id
  + a Puck seed). The real Appwrite schema lives in
  `packages/api/appwrite.config.json`; types live in
  `packages/api/types/appwrite.ts` (regenerated, not hand-edited).
- `public/pdf.worker.min.js`, `public/Voter_Template.xlsx`, font binaries.

## Commands (run from `apps/web/` or with `--filter=web` from root)

```bash
bun run dev          # next dev -p 3000
bun run build        # next build (standalone)
bun run start        # next start
bun run lint         # biome lint .
bun run check-types  # tsc --noEmit  ← use this, build ignores type errors
bun x ultracite fix  # repo-wide formatter/linter (see root CLAUDE.md)
```
