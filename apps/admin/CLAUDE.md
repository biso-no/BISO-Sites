# apps/admin

Next.js 16 (App Router) CMS for BI Student Organisation (BISO). Used internally by
IT, editors, and campus/department operations staff — assume non-technical users.
Runs on port `3001` (`bun run dev --filter=admin`).

## Routing

App Router under `src/app/` with four route groups:

- `(auth)/auth/{login,callback,oauth,invite}` — public. Pass-through layout.
- `(portal)/…` — primary admin UI. Layout calls `getUserAuthContext()` and
  redirects to `/auth/login` on null. Subroutes: `activity`, `benefits`,
  `departments`, `documents`, `drafts`, `events`, `it`, `jobs` (`/applications`),
  `news`, `pages`, `settings`, `shop`, `submissions`. Domain server actions live
  in `(portal)/_actions/*.ts`; shared UI in `(portal)/_components/*`.
- `(editor)/pages/[id]` — block-based page editor. Layout enforces the same auth
  gate as `(portal)`. The editor itself is the in-house `@repo/editor`
  (`EditorShell`, built on `@dnd-kit` + `immer` + `zustand`) — **not Puck**.
- `(protected)/profile` — uses `getLoggedInUser()` + `unauthorized()` (matched by
  `app/unauthorized.tsx`). Different helper than `(portal)`; do not mix.

Top-level: `app/layout.tsx` wraps the tree with `NextIntlClientProvider` and
`force-dynamic`. `app/api/*` holds route handlers (admin-assistant, ai,
auth/check, campus-leadership, expense, health, notifications, page-editor,
recruitment, translate-page, units/sync, upload). There is **no `middleware.ts`** —
auth is enforced in route-group layouts and inside each server action / route
handler. Any new top-level route segment must add its own auth check.

## Auth

- Session cookie: `a_session_biso_admin` (set via `APPWRITE_SESSION_COOKIE`).
  Cookie attributes branch on `isProd` (`lib/utils.ts`): `sameSite: "none"` and
  `domain: ".biso.no"` in prod, `lax` + `localhost` otherwise.
- Sign-in flows in `src/lib/server.ts`:
  - `signInWithAzure()` → Microsoft OAuth via `account.createOAuth2Token`, lands
    on `(auth)/auth/oauth/route.ts`, which **awaits** `syncM365Permissions()`
    before setting the cookie.
  - `signInWithMagicLink()` → magic URL, lands on `(auth)/auth/callback/route.ts`,
    which calls `syncM365Permissions()` best-effort.
- Authorization (`src/lib/authorization.ts`, `src/lib/roles.ts`): roles are
  derived from Appwrite **team memberships** synced from Azure AD security groups.
  - `National + Operations Unit` → `globaladmin`
  - `Ledelsen{City} + Campus-{City}` → `campusadmin` (with managed campus list)
  - Any department team membership → the `department` pseudo-role
- Appwrite user **labels are read but never used for role checks** — do not add
  label-based gating.
- Use `getUserAuthContext()` (server) as the canonical auth read, and
  `getUserRolesForClient()` when passing roles to client components.
  Nav access is gated by `NAV_ACCESS` + `hasNavAccess()` in `lib/roles.ts`;
  server-side gate is `checkNavAccess(navKey)`.
- Global admins can scope themselves to a campus via the `admin_campus_ctx`
  cookie (`ctx.activeCampusId`). Non-global-admin queries must filter by
  `ctx.managedCampusIds` or `ctx.resolvedCampusIds` — see `_actions/pages.ts`
  for the canonical scoping pattern.

## Appwrite access

- Server work: import from `@repo/api/server`:
  - `createSessionClient()` → user-scoped Appwrite client (respects row security).
    Use for almost all reads/writes from server actions.
  - `createAdminClient()` → service-key client (`APPWRITE_API_KEY`). Bypasses
    row security; only use when an operation legitimately needs it, and gate it
    with `getUserAuthContext()` / role checks first.
  - Both expose `{ account, db, teams, storage, functions, messaging }`
    (`createAdminClient` also exposes `users`). `db` is a Proxy that JSON-clones
    `listRows`/`getRow` results so they cross the RSC boundary.
- Browser: `@repo/api/client` (the `appwrite` SDK). Currently used only by
  `src/components/profile/identity-management.tsx`. Prefer server actions over
  client-side Appwrite calls.
- Helpers: `@repo/api` re-exports `ID`, `Query`, `Permission`, `Role`,
  `OAuthProvider`, and the `Models` type from `node-appwrite`. Use these — do
  not import directly from `node-appwrite` in app code.
- Page editor: drafts/publish flow goes through `@repo/api/page-builder`
  (`savePageDraft`, `publishPage`, `getPageEditorById`, etc.) — see
  `(portal)/_actions/pages.ts`. The editor UI itself comes from `@repo/editor`.

### Required reading before any data work

- `packages/api/appwrite.config.json` — full schema for the `app` database
  (60+ tables, indexes, permissions). Source of truth for table IDs, column
  names, enum values, relationships, and `$permissions`.
- `packages/api/types/appwrite.ts` — generated row types and enums (e.g.
  `Pages`, `Events`, `Jobs`, `OrdersStatus`). Always type `db.listRows<T>(…)`
  and `db.getRow<T>(…)` with the matching type.

## App-specific patterns

- **Locale**: stored on the Appwrite user's `prefs.locale`; read with
  `app/actions/locale.ts#getLocale()`. `next-intl` plugin wired in
  `next.config.ts` to `src/i18n/request.ts`.
- **Server-action shape**: file starts with `"use server"`, calls
  `requireAuth()` / `getUserAuthContext()`, then scopes Appwrite queries by
  `managedCampusIds` / `resolvedCampusIds` for non-globaladmins. Mutations call
  `logAuditEvent()` (`_actions/audit-log.ts`) and `revalidatePath()` on the
  affected route.
- **Translations data model**: most content tables have `translation_refs` →
  `content_translations` (or `page_translations` for pages). Building permission
  strings for translation rows goes through
  `buildContentTranslationPermissions()` in `lib/utils.ts`.
- **Content scoping**: every content list action filters by `campus_id` based on
  the auth context — see `listPages` in `_actions/pages.ts` for the canonical
  pattern. New list actions must follow it or risk leaking data across campuses.
- **Path alias `@/*`** resolves into **both** `./src/*` and
  `../../packages/editor/src/*` (see `tsconfig.json`). An `@/foo` import may
  resolve into the editor package — keep that in mind when adding files.

## Do-not-touch

- `packages/api/appwrite.config.json` — auto-generated by the Appwrite CLI;
  edit the schema in Appwrite and regenerate.
- `packages/api/types/appwrite.ts` — auto-generated; regenerate via
  `appwrite types -l ts ./types`.
- `next-env.d.ts` — Next.js generated.

## Commands (scoped to this app)

```bash
bun run dev --filter=admin          # dev server on :3001
bun run build --filter=admin        # production build
bun --filter=admin check-types      # tsc --noEmit
bun --filter=admin lint             # biome lint
bun x ultracite fix                 # format + autofix (repo-wide)
```

`next.config.ts` must not suppress TypeScript build errors. Still run
`check-types` explicitly before merging because it gives faster, clearer output
than a full Next build.
