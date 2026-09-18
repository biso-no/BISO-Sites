# Member Pass for the App — Design

Date: 2026-09-17
Builds on: `2026-09-17-member-pass-design.md`
Status: Approved in conversation

## Goal

Let the BISO Flutter app show the member pass, add it to Apple/Google Wallet,
and scan passes, all through `api.biso.no`. Let campus and global admins give
scanning rights to people without BISO accounts (e.g. hired security) by
email.

## Decisions

| Topic | Decision |
|---|---|
| Where the app gets pass data | New endpoints in `apps/api`, authenticated with the Appwrite JWT |
| Code sharing | Pass and scan logic moves to `packages/shared/member-pass/`; web, admin and api all call it. Web and admin routes keep working unchanged |
| Who may scan in the app | Signed-in users with an active scanner grant. No guest-link pairing in the app |
| Where grants live | New table `member_pass_scanners` |
| Grant expiry | Optional end date; empty means until revoked |
| Inviting | Admin creates the Appwrite account if the email is new, records the grant, and emails instructions |
| Guest links | Stay as the browser-only scanner (`/scan/<token>`) |

## 1. Shared module: `packages/shared/member-pass/`

New export path in `packages/shared/package.json`:
`"./member-pass/*": "./member-pass/*.ts"`.

Moved, behaviour unchanged (tests move with them and run under vitest):

- From `apps/web/src/lib/member-pass/`: `types.ts`, `state.ts`,
  `term-label.ts`, `wallet-config.ts`, `apple-pass.ts`, `google-pass.ts`,
  `google-wallet-api.ts`.
  `resolve.ts` stays in web (it depends on web's session helpers).
- From `apps/admin/src/lib/member-pass/`: `types.ts` (renamed
  `scan-types.ts`), `store.ts` (renamed `scan-store.ts`), `verify-scan.ts`,
  `guest-links.ts`, `guest-scan.ts`, `rate-limit.ts`, `membership-lookup.ts`.

`passkit-generator` moves from `apps/web` to `packages/shared` dependencies.
`term-label.ts` and `types.ts` stay free of Node and `server-only` imports
(the web client imports them). All other moved modules are server-only.

## 2. Scanner grants

### Table `app.member_pass_scanners` (added to `appwrite.config.json`)

| column | type |
|---|---|
| `user_id` | string(36), required |
| `email` | string(320), required |
| `name` | string(120), optional |
| `campus_id` | string(36), optional (null = all campuses; global admins only) |
| `granted_by` | string(36), required |
| `expires_at` | datetime, optional (null = until revoked) |
| `revoked_at` | datetime, optional |
| `invited_at` | datetime, optional (last invitation email sent) |

Indexes: `user_id_idx` (key), `email_idx` (key), `campus_id_idx` (key).
No permissions (service key only).

### Shared store: `packages/shared/member-pass/scanner-grants.ts`

- `isGrantActive(grant, now)` — not revoked, and `expires_at` empty or in the
  future.
- `findActiveGrantForUser(db, userId, now)` → the active grant, or null.
- `listGrants(db, campusIds | null)` → newest first, max 200, including
  expired and revoked (the page greys them out).
- `getGrant(db, id)`, `createGrant(db, …)`, `updateGrant(db, id, patch)`,
  `revokeGrant(db, id, now)`.

A user may hold several grants (e.g. two campuses). Re-inviting an email that
already has an active grant for the same campus updates that grant (end date,
name) instead of adding a new one.

## 3. Admin: "Scanner access" page

Route `apps/admin/src/app/(portal)/members/scan/access/page.tsx`, gated by
`requireNavAccess("portal.members")`. Linked from the members page header.

- Table: name, email, campus, granted by, end date, status (active / expired /
  revoked), last invited, actions (resend invitation, revoke).
- "Add scanner" form: email (required), name (optional), campus (campus admins:
  only their managed campuses; global admins: any or "all campuses"), end date
  (optional).
- Scoping follows the guest-link actions: campus admins see and manage only
  their campuses' grants and cannot create campus-less grants.

Server actions in `(portal)/_actions/member-pass-scanners.ts`:

- `listScannerGrants()`
- `inviteScanner({ email, name, campusId, expiresAt })`:
  1. Normalise and validate the email.
  2. Find the Appwrite user by email (`users.list` with
     `Query.equal("email", …)`); if none, `users.create(ID.unique(), email,
     undefined, undefined, name)`.
  3. Create or update the grant.
  4. Send the invitation email. If SMTP is not configured or sending fails, the
     grant is still saved and the action returns `{ success: true, data: {
     emailSent: false } }` so the page can say so.
  5. `logAuditEvent(ctx, "member_pass_scanner.invite", …)`.
- `resendScannerInvite(grantId)` — same email, updates `invited_at`.
- `revokeScannerGrant(grantId)` — sets `revoked_at`, audit-logged.

Errors: `invalid_email`, `invalid_expiry` (end date in the past),
`forbidden_campus`, `not_found`, `failed`.

### Invitation email

Norwegian first, English below, plain text and HTML. It contains:

- Who invited them and for which campus, and the end date if any.
- Step 1: install the BISO app — App Store link (`BISO_APP_IOS_URL`) and
  Google Play link (`BISO_APP_ANDROID_URL`, default
  `https://play.google.com/store/apps/details?id=com.biso.no`).
- Step 2: sign in with this exact email address (code sent by email).
- Step 3: open Explore → "Scan memberships".
- A note that access can be revoked at any time and never shows student
  numbers or email addresses.

The builder is a pure function (`buildScannerInviteEmail`) with a unit test.

## 4. API endpoints (`apps/api`)

All are dynamic (`export const dynamic = "force-dynamic"`), send
`Cache-Control: private, no-store`, answer CORS preflight like
`/api/membership`, and authenticate with `Authorization: Bearer <Appwrite
JWT>` through `createAuthenticatedClient`. A missing or invalid JWT → 401
`{ "error": "not_authenticated" }`. A missing `MEMBER_PASS_SECRET` →
503 `{ "error": "not_configured" }` (pass endpoints return
`{ "state": "unavailable" }` instead, matching web).

| Endpoint | Success | Other responses |
|---|---|---|
| `GET /api/member-pass` | same body as the web route | — |
| `GET /api/member-pass/apple` | `.pkpass` bytes | 403 `<state>`, 404 `not_configured`, 500 `failed` |
| `GET /api/member-pass/google` | `{ "saveUrl": "…" }` | 403 `<state>`, 404 `not_configured`, 502 `wallet_unavailable` |
| `GET /api/member-pass/scanner` | `{ "campusId", "expiresAt", "dayColor": { "name", "hex" } }` | 403 `not_scanner` |
| `POST /api/member-pass/scan` `{ "code" }` | scan outcome (same shape as admin) | 400 `invalid_body`, 403 `not_scanner`, 429 `rate_limited` |

- Membership for the pass uses `apps/api`'s existing
  `getMembershipStatusForStudent` cache and the profile's `student_id`
  (admin client), mirroring web's `resolveMemberPass`.
- `/scanner` and `/scan` re-check the grant on every call. Scans are logged
  with `scanner_user_id` = the app user's id. Rate limit: 60 scans per user
  per minute (per instance).
- The scan body's `code` must be a string of at most 256 characters.

New env vars for `apps/api`: `MEMBER_PASS_SECRET` and the wallet variables
(same values as web). New env vars for `apps/admin`: `BISO_APP_IOS_URL`,
`BISO_APP_ANDROID_URL`. All are added to `turbo.json` and the `.env.example`
files.

## 5. App contract

`docs/superpowers/specs/2026-09-17-member-pass-app-contract.md` documents the
endpoints above, the client rules for rotating codes, and the scanner flow,
for the Flutter session.

## Security notes

- Scanning rights are server-side only: every scan re-checks an active grant.
- Revoking a grant takes effect on the next scan.
- Invitation emails contain no tokens or links that grant access by
  themselves; access follows the signed-in account.
- Creating an Appwrite account for an invited email does not give that
  account anything besides the grant.

## Testing

- Shared module: the moved tests pass under vitest; new tests for grants
  (`isGrantActive`, store queries, upsert on re-invite) and the email builder.
- Admin: action tests for invite (new user, existing user, re-invite updates,
  SMTP failure keeps the grant), revoke, scoping.
- API: route tests for every endpoint and error path, including an expired or
  revoked grant, rate limiting, and JWT failures.
- Full suites, `check-types`, and `bun run build --filter=web --filter=admin
  --filter=api`.
