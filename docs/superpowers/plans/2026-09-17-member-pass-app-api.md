# Member Pass for the App — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Serve the member pass, wallets and scanning to the Flutter app through `apps/api`, and let admins grant scanning rights to external people by email.

**Architecture:** Move the pass and scan logic into `packages/shared/member-pass/` (behaviour unchanged). Add a `member_pass_scanners` grants table, an admin "Scanner access" page that invites people by email, and JWT-authenticated endpoints in `apps/api`.

**Tech Stack:** Next.js 16, Bun workspaces, Appwrite via `@repo/api`, vitest (shared/web/api), `bun test` (admin), `@repo/connectors/email` (SMTP).

**Spec:** `docs/superpowers/specs/2026-09-17-member-pass-app-api-design.md` (read it; it is binding). Background: `docs/superpowers/specs/2026-09-17-member-pass-design.md`.

## Global Constraints

- Branch `feat/member-pass-api`. Bun only. Never import `appwrite`/`node-appwrite` in app code.
- The user edits this working tree at the same time. Never revert, checkout, stash, delete or reformat files you did not change. Stage files by path. Run `bun x ultracite fix` only on paths you changed.
- New tables go into `packages/api/appwrite.config.json` (user-approved). Match existing entries exactly (4-space JSON). Never hand-edit `packages/api/types/appwrite.ts`; use local row types.
- Read `apps/<app>/CLAUDE.md` and the Next 16 docs in `node_modules/next/dist/docs/` before touching an app. `"use server"` files export only async functions; verify with `bun run build --filter=<app>`.
- No behaviour change for existing web/admin pass and scanner features.
- Secrets and wallet credentials stay server-only. Codes, tokens and JWTs are never logged.
- New server actions return `{ success: true; data } | { success: false; error }`.
- Tests: shared → `bun x vitest run <path>` in `packages/shared`; web → `bun x vitest run` in `apps/web`; api → `NODE_ENV=test bun x vitest run` in `apps/api`; admin → `bun test <path>` in `apps/admin` (bun module mocks leak across files: prefer dependency injection; only mock modules no other test imports for real).
- Commit trailer: the Co-Authored-By line your session instructions give you.

---

### Task 1: Move web pass modules to `packages/shared/member-pass/`

**Files:**
- Move (with `git mv`, then fix imports): `apps/web/src/lib/member-pass/{types,state,term-label,wallet-config,apple-pass,google-pass,google-wallet-api}.ts` and their `.test.ts` files → `packages/shared/member-pass/`.
- Keep: `apps/web/src/lib/member-pass/resolve.ts` (update imports).
- Modify: `packages/shared/package.json` (`exports` gains `"./member-pass/*": "./member-pass/*.ts"`; add `passkit-generator` dependency at the version web uses; add `server-only` if the moved modules import it and it isn't resolvable), `apps/web/package.json` (remove `passkit-generator` if web no longer imports it), all web importers (`src/app/api/member-pass/**`, `src/components/member-pass/**`, `src/lib/member-portal-membership.ts`, etc.).
- `packages/shared/tsconfig.json` / vitest config: make sure the new folder is included and `server-only` is mocked in tests (`vi.mock("server-only", () => ({}))` as the web tests did).

**Interfaces produced:** `@repo/shared/member-pass/<module>` with the same exports as before.

- [ ] Move files and update every import (`rg "lib/member-pass/(types|state|term-label|wallet-config|apple-pass|google-pass|google-wallet-api)"` must return nothing in `apps/web`).
- [ ] Moved tests pass in `packages/shared`; web suite passes; `bun run check-types --filter=web --filter=@repo/shared`; `bun run build --filter=web`.
- [ ] Client-safety: `rg "member-pass/(wallet-config|apple-pass|google-pass|google-wallet-api|state)" apps/web/src/components` returns nothing (client files may import only `types` and `term-label`).
- [ ] Commit: "Move the member pass modules into the shared package".

### Task 2: Move admin scan modules to `packages/shared/member-pass/`

**Files:**
- Move: `apps/admin/src/lib/member-pass/types.ts` → `packages/shared/member-pass/scan-types.ts`; `store.ts` → `scan-store.ts`; `verify-scan.ts`, `guest-links.ts`, `guest-scan.ts`, `rate-limit.ts`, `membership-lookup.ts` → same names. Tests move too and are converted from `bun:test` to vitest (`mock()` → `vi.fn()`, `mock.module` → `vi.mock`, `spyOn` → `vi.spyOn`); keep every assertion.
- Update admin importers: `(portal)/_actions/member-pass.ts` (+ test), `(scan)/scan/actions.ts` (+ test), `(scan)/scan/[token]/page.tsx`, `components/member-pass-scanner/*`, `members/scan/**`.
- `membership-lookup.ts` imports `next/cache`: add `next` as a peer/dev dependency of `packages/shared` only if needed for type-checking (check how other shared modules that touch Next are handled; if none do, keep `membership-lookup.ts` in `apps/admin` and in `apps/api` write its own equivalent in Task 5 — record the choice in the report).
- Delete the emptied `apps/admin/src/lib/member-pass/` folder only if nothing is left in it.

- [ ] Move, convert tests, update imports (`rg "lib/member-pass" apps/admin/src` returns only intentionally kept files).
- [ ] Shared tests pass; full `bun test ./src` in admin passes with no new failures; `bun run check-types --filter=admin --filter=@repo/shared`; `bun run build --filter=admin`.
- [ ] Commit: "Move the member pass scan modules into the shared package".

### Task 3: Scanner grants table and store

**Files:**
- Modify: `packages/api/appwrite.config.json` — add table `member_pass_scanners` exactly as in spec §2 (insert as text after the `member_pass_scans` table entry; 4-space indent; `$permissions: []`, `rowSecurity: false`, `enabled: true`, `databaseId: "app"`; index entries `"type": "key"`, `"status": "available"`, `"orders": []`). Run `bun x vitest run` in `packages/api` afterwards (it validates the config).
- Create: `packages/shared/member-pass/scanner-grants.ts` + `scanner-grants.test.ts`.

**Interfaces produced:**
```ts
export interface ScannerGrantRow { $createdAt: string; $id: string; campus_id: string | null; email: string; expires_at: string | null; granted_by: string; invited_at: string | null; name: string | null; revoked_at: string | null; user_id: string }
export const SCANNER_GRANTS_TABLE = "member_pass_scanners";
export type GrantStatus = "active" | "expired" | "revoked";
export function grantStatus(grant: Pick<ScannerGrantRow, "expires_at" | "revoked_at">, now: Date): GrantStatus
export function isGrantActive(grant: Pick<ScannerGrantRow, "expires_at" | "revoked_at">, now: Date): boolean
export function findActiveGrantForUser(db: AdminDb, userId: string, now: Date): Promise<ScannerGrantRow | null>
export function findActiveGrantForUserAndCampus(db: AdminDb, userId: string, campusId: string | null, now: Date): Promise<ScannerGrantRow | null>
export function listGrants(db: AdminDb, campusIds: string[] | null): Promise<ScannerGrantRow[]>   // newest first, limit 200
export function getGrant(db: AdminDb, id: string): Promise<ScannerGrantRow | null>                // null on any error
export function createGrant(db: AdminDb, input: { campusId: string | null; email: string; expiresAt: Date | null; grantedBy: string; name: string | null; userId: string }): Promise<ScannerGrantRow>
export function updateGrant(db: AdminDb, id: string, patch: Partial<Pick<ScannerGrantRow, "expires_at" | "invited_at" | "name">>): Promise<void>
export function revokeGrant(db: AdminDb, id: string, now: Date): Promise<void>
```
`AdminDb` comes from `scan-store.ts`. Active-grant queries: `user_id` equal, `revoked_at` isNull, then filter `isGrantActive` in code (expires_at may be null). Campus match for `findActiveGrantForUserAndCampus`: `campus_id` equal, or `isNull` when `campusId` is null. Permissions `[]` on create.

- [ ] Tests first (status at exact expiry instant, null expiry, revoked; query shapes; create payload), then implement.
- [ ] Commit: "Add scanner grants".

### Task 4: Admin "Scanner access" page, actions and invitation email

**Files:**
- Create: `packages/shared/member-pass/scanner-invite-email.ts` (+ test) — `buildScannerInviteEmail({ inviterName, campusName, expiresAt, iosUrl, androidUrl, email }): { subject, text, html }`, Norwegian then English, HTML-escaped values, content per spec §3.
- Create: `apps/admin/src/app/(portal)/_actions/member-pass-scanners.ts` (+ test) — actions per spec §3.
  - Find user: `users.list({ queries: [Query.equal("email", email), Query.limit(1)] })`; create: `users.create({ userId: ID.unique(), email, name })` (check the node-appwrite signature in `@repo/api` usage elsewhere, e.g. `rg "users\.(create|list)\(" apps packages`).
  - Upsert by `findActiveGrantForUserAndCampus`.
  - Email via `sendEmail` from `@repo/connectors/email` when `isSmtpConfigured()`; failures are caught, logged and reported as `emailSent: false`.
  - Campus names via `CAMPUS_ID_TO_NAME`; app links from `process.env.BISO_APP_IOS_URL` / `BISO_APP_ANDROID_URL` (default Play URL `https://play.google.com/store/apps/details?id=com.biso.no`; if the iOS URL is unset, the email omits the App Store line and says to search "BISO" in the App Store).
  - Audit: `logAuditEvent` from `./audit-log` for invite, resend and revoke.
  - Tests: mock `@/lib/authorization`, `@repo/api/server`, `@repo/connectors/email` (this last one is already mocked by `varsling.test.ts` with the same export names — reuse the same shape), `./audit-log` (already mocked elsewhere with the same shape). Cover: new email creates a user; existing email reuses; re-invite same campus updates instead of creating; SMTP unconfigured → `emailSent: false` and grant saved; send throws → `emailSent: false`; invalid email; past end date; campus admin blocked from other campus and from null campus; revoke scoping; list scoping.
- Create: `apps/admin/src/app/(portal)/members/scan/access/page.tsx` and `_components/scanner-access-client.tsx` — table + add form + resend/revoke, per spec §3. Status badge uses `grantStatus`. Use existing `@repo/ui` components and `sonner` toasts like `scanner-links-client.tsx`. Empty/invalid end-date input sends `null`.
- Modify: `apps/admin/src/app/(portal)/members/page.tsx` — add a "Scanner access" header button next to the existing ones.
- Modify: `packages/i18n/messages/{en,no}/adminPortal.json` — `memberPass.access.*` strings for everything the page and toasts show (both locales, same keys).
- Modify: `apps/admin/.env.example` (`BISO_APP_IOS_URL=`, `BISO_APP_ANDROID_URL=https://play.google.com/store/apps/details?id=com.biso.no`), `turbo.json` build env (`BISO_APP_ANDROID_URL`, `BISO_APP_IOS_URL`, alphabetical).

- [ ] Tests first for the email builder and actions; implement; page.
- [ ] Gate: focused tests, full admin suite, `check-types` (admin, shared, i18n), `bun run build --filter=admin`.
- [ ] Commit(s): "Invite external scanners from admin".

### Task 5: API pass endpoints (JWT)

**Files:**
- Create: `apps/api/src/lib/member-pass/resolve.ts` — `resolveMemberPassForRequest(req): Promise<ResolvedMemberPass>` (same union as web's `resolve.ts`): `account.get()` via `createAuthenticatedClient(req)` (failure → `unauthenticated`), profile via admin client `getRow("app","user", userId)` (404 → treat as no student id), `sanitizeStudentNumber(profile.student_id)` (null → `no_bi_identity`), status via `getMembershipStatusForStudent` from `@/lib/membership-status-cache` (read its signature and how `/api/membership` calls it), then `memberPassStateFor` / `buildHolder` from `@repo/shared/member-pass/state`. Holder name: profile name, else account name.
- Create routes under `apps/api/src/app/api/member-pass/`: `route.ts` (GET), `apple/route.ts` (GET), `google/route.ts` (GET, JSON `{ saveUrl }`), each with `OPTIONS` preflight like `/api/membership`, `dynamic = "force-dynamic"`, CORS via `applyCorsHeaders`, `Cache-Control: private, no-store`. Logic mirrors the web routes (read them) but uses the resolver above; Google uses the shared `syncGoogleWalletPass`/JWT helpers and returns JSON instead of a redirect.
- Tests for each route (mock the resolver module and wallet config; the pattern in `apps/api/src/app/api/membership/route.test.ts`).
- Modify: `apps/api/.env.example` (MEMBER_PASS_SECRET + wallet vars, commented like web's), `apps/api/next.config.*` only if the build needs `serverExternalPackages` for passkit-generator.

- [ ] Tests first; implement; gate: api suite, `check-types --filter=api`, `bun run build --filter=api` (routes dynamic).
- [ ] Commit: "Serve the member pass to the app".

### Task 6: API scanner endpoints

**Files:**
- Create: `apps/api/src/lib/member-pass/scanner-auth.ts` — `requireScanner(req, now): Promise<{ ok: true; userId; grant } | { ok: false; status: 401 | 403; error }>` (JWT → user; `findActiveGrantForUser`).
- Create: `apps/api/src/app/api/member-pass/scanner/route.ts` (GET) and `scan/route.ts` (POST) per spec §4. `scan` validates body (`code` string ≤ 256 chars → else 400 `invalid_body`), rate-limits 60/min per user id with the shared `createRateLimiter`, then `verifyScan(code, { kind: "staff", userId }, { db, getStatus, now, scans: scanLogFor(db), secret })`. `getStatus` is the scan-time lookup (shared `getScanMembershipStatus` if Task 2 moved it, otherwise an api-local equivalent with the same 60 s freshness rule).
- Tests: no JWT → 401; no/expired/revoked grant → 403; valid → outcome passthrough and scanner id; body validation; rate limit; missing secret → 503; `/scanner` returns campusId/expiresAt/dayColor.
- Modify: `apps/api/src/lib/cors.ts` only if needed (JWT header is already allowed).

- [ ] Tests first; implement; gate as Task 5.
- [ ] Commit: "Let granted app users scan member passes".

### Task 7: App contract doc and final checks

**Files:**
- Create: `docs/superpowers/specs/2026-09-17-member-pass-app-contract.md` — for the Flutter session: base URL, auth, every endpoint with request/response JSON and status codes (from the implemented routes, not the spec), client rules for rotating codes (drift, slot selection, refetch below 4, 15 s retry while offline/low, keep active pass on transient errors, memory-only), scanner flow (call `/scanner` on open; 403 → "no scanning access"; result colours and reasons; 20 s repeat filter keyed by member id; day colour in the top bar), wallet flows (iOS: fetch pkpass with JWT → native add sheet; Android: open `saveUrl`), and the invitation flow (admin invites email → user signs in with that email → Explore → Scan memberships).
- Run full verification: `bun run check-types`; shared/web/api/admin suites; `packages/api` vitest; `bun run build --filter=web --filter=admin --filter=api`.

- [ ] Write doc; run checks; commit "Document the member pass API for the app".
