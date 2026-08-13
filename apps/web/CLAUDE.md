# apps/web

Public-facing BISO website (Next.js 16 App Router, React 19, RSC by default).
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
  `(public)/[...slug]/page.tsx` that pulls block-editor pages via
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

- Session cookie: `a_session_biso_web` (override with `APPWRITE_SESSION_COOKIE`).
  **Never name it `a_session_biso`.** That is byte-for-byte the cookie Appwrite
  itself issues for project `biso` (`a_session_<projectId>`), and because this
  app scopes the cookie to `.biso.no` while Appwrite is hosted at
  `appwrite.biso.no`, the browser replays our session to Appwrite on every
  top-level navigation — including the OAuth callback. Appwrite then treats the
  web visitor as the account being signed in, which broke `admin.biso.no`
  sign-in with `409 user_already_exists`. Sessions issued under the old name are
  still *read* via `APPWRITE_SESSION_COOKIE_FALLBACK` (see
  `LEGACY_SESSION_COOKIE` in `src/lib/cookie-prefs.ts`) and expired on every
  path that writes a new one; drop both once the 30-day cookies have aged out.
- Expire session cookies with `cookies().set(name, "", expiredSessionCookieOptions())`,
  not `cookies().delete(name)` — a bare `delete` omits the `Domain` attribute and
  silently no-ops against the `.biso.no`-scoped cookie in prod.
- **No anonymous sessions are minted on page view.** There is no `middleware.ts`
  / `proxy.ts` — eager provisioning was removed because cookieless clients
  (crawlers, link unfurlers, uptime monitors) each triggered a fresh anonymous
  Appwrite user, accumulating thousands of junk accounts. Anonymous sessions are
  now provisioned **lazily**, only inside actions that genuinely need a per-user
  identity, via `ensureAnonymousSession()` in `src/lib/anon-session.ts` (no-op if
  a session cookie already exists; sets the `a_session_biso_web` cookie cross-subdomain
  `.biso.no` in prod, `lax` locally). Currently called from
  `createOrUpdateReservation` (cart). Call it at the start of any new action that
  must write rows owned by the visitor.
- **Locale + selected campus live in cookies, not in an Appwrite user.** They are
  non-sensitive UI state, so anonymous visitors keep their choice with no backend
  identity. Cookie names + attributes are in `src/lib/cookie-prefs.ts`
  (`NEXT_LOCALE`, `campusId`). `getLocale`/`setLocale` (`src/app/actions/locale.ts`)
  and `getActiveCampus`/`setActiveCampus` (`src/app/actions/campus.ts`) are
  cookie-first and only mirror to/read from an authenticated user's `prefs` as a
  cross-device fallback. `getUserPreferences()` overlays the cookie values, so
  the `(public)` pages that read `prefs.campusId`/`prefs.locale` respect anonymous
  selection without change.
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
- Membership purchase → `/membership/join`. Requires an authenticated user with
  a linked BI Student (OIDC) identity whose profile carries `student_id` and
  `bi_employee_id` (populated by `syncBiStudentIdentity` on the OAuth return
  leg). Plans come from the `memberships` table; the trusted checkout lives in
  `apps/api` at `/api/payment/[provider]/membership-checkout`. Fulfilment
  (Finago customer → category → invoice) is `fulfilMembershipOrder` in
  `@repo/shared/utils/membership-fulfilment`, triggered from the payment
  webhook, `/api/checkout/return`, and the reconcile cron. Membership orders are
  excluded from `postFinagoTransactionForOrder`. Env: `BI_AZURE_*`.

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
  `src/app/api/form/submit/route.ts` for the pattern: Operations Unit +
  optional per-team grants).
- Locale comes from the `NEXT_LOCALE` cookie via `getLocale()` in
  `src/app/actions/locale.ts` (falling back to an authenticated user's
  `prefs.locale`); messages are loaded by `src/i18n/request.ts` and provided
  through `NextIntlClientProvider` in `app/layout.tsx`. See the Auth section for
  the cookie-based preference model.
- Server-action result shape for **new** actions: return a discriminated
  `{ success: boolean; data?: T; error?: string }` object instead of throwing
  or returning raw rows/null. Existing actions use a mix of shapes
  (`{ success }`, `{ error }`, raw data) — each feature is internally
  consistent; don't churn them, but follow the canonical shape going forward.

## Gotchas

- `next.config.ts` sets `typescript: { ignoreBuildErrors: true }` — `next build`
  will not catch type regressions. Run `bun run check-types` from `apps/web`
  before claiming a change compiles.
- `output: "standalone"` + `outputFileTracingRoot: "../../"` — workspace
  packages must stay in `transpilePackages` in `next.config.ts`.
- `images.remotePatterns` only allows `appwrite.biso.no`, `biso.no`, and
  `via.placeholder.com`. New image sources need an entry.
- There is **no middleware** and sessions are provisioned lazily, so the
  `a_session_biso_web` cookie is **not** guaranteed to exist on any given request.
  Never assume an anonymous session is present — read it defensively, and call
  `ensureAnonymousSession()` first in any action that needs a per-user identity
  (see Auth section).

## Do not touch

- `next-env.d.ts`, `.next/`, `node_modules/`.
- `apps/web/appwrite.json` and `apps/web/database.json` are stubs (project id
  + a legacy page seed). The real Appwrite schema lives in
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
