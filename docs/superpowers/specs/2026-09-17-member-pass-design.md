# Member Pass — Design

Date: 2026-09-17
Status: Approved in conversation, pending spec review

## Goal

Give every active BISO member a digital membership pass that staff and event
security can verify at a glance and by scanning, and that cannot be faked with
a screenshot, a screen recording, or a copied page.

The pass appears on the web profile page and in the member portal, and can be
added to Google Wallet and Apple Wallet.

Finago (24SevenOffice) stays the only source of truth for membership. Every
scan is checked live against it.

## Decisions

| Topic | Decision |
|---|---|
| Protection | Live visual for glances, plus a server-signed QR code that rotates every 30 s |
| Code generation | Server signs one code per 30 s slot (approach A); the client holds a 10-minute batch in memory |
| Where scanning happens | Admin app: staff scanner, plus revocable guest links for guards without accounts |
| Holder check | Scan shows the full name; staff compare with an ID card when in doubt. No photos |
| Pass location | `apps/web` profile page and member portal |
| Google Wallet | Yes. Free; rotating TOTP barcode |
| Apple Wallet | Yes. Existing Apple Developer account (team `4JQ6VWVRGY`). Static signed code, marked "check ID" on scan |

## Background: bugs fixed as part of this work

- `memberships.startDate` / `expiryDate` are stored as `DD.MM.YYYY` for curated
  rows. `normalizeMembershipDate` (`packages/shared/utils/membership-dates.ts`)
  now reads both that form and ISO, and `computeMembershipStatus` /
  `toMembershipPlan` emit ISO dates. (Already implemented in the working tree.)
- The member portal passes `currentPlan="year"` as a literal
  (`apps/web/src/components/member-portal/member-portal-tabs.tsx`), so every
  member sees "Yearly". The membership tab also hard-codes prices, derives the
  start date as `expiry - 365 days`, and renders a non-functional auto-renew
  toggle and wallet/share buttons. These are replaced with real data (see
  "Member portal membership tab").

## Architecture

### 1. Shared code: `packages/shared/utils/member-pass.ts`

Pure functions, no I/O, `node:crypto` only. Server-only.

- `MEMBER_PASS_SLOT_SECONDS = 30`
- `passSlot(now: Date): number` → `floor(unixSeconds / 30)`
- `signWebPassCode(userId, slot, secret): string` →
  `v1.<userId>.<slot>.<sig>` where
  `sig = base64url(HMAC-SHA256(secret, "v1.<userId>.<slot>"))` truncated to
  16 bytes.
- `signAppleWalletCode(userId, expiryIso, secret): string` →
  `a1.<userId>.<YYYYMMDD>.<sig>` (same HMAC construction over the prefix).
- `googleWalletTotpKey(userId, secret): Buffer` →
  `HMAC-SHA256(secret, "g1-totp.<userId>")` (20 bytes used). No storage needed.
- `googleWalletCodePattern(userId): string` → `g1.<userId>.{totp_value_0}`
- `verifyMemberPassCode(code, secret, now): VerifyResult` where
  `VerifyResult` is one of:
  - `{ ok: true, kind: "web" | "google", userId, slot }`
  - `{ ok: true, kind: "apple", userId, expiry }`
  - `{ ok: false, reason: "malformed" | "bad_signature" | "stale" | "expired" }`
  Rules:
  - `v1`: constant-time signature compare; slot must be within ±1 of
    `passSlot(now)` (a code is valid for at most ~90 s).
  - `g1`: TOTP (SHA-1, 30 s period, 6 digits — must match what Google Wallet
    is configured with) over `googleWalletTotpKey`; accept current ±1 step.
  - `a1`: constant-time signature compare; `expired` if `YYYYMMDD` is before
    today in Oslo.
- `dayColor(date: Date, secret): { name: string; hex: string }` — picks one of
  a fixed palette of ~12 high-contrast named colors from
  `HMAC(secret, "day.<osloDate>")`. Unpredictable without the secret.
- `isRecentDuplicate(previousScanAt, now): boolean` — within 10 minutes.

User IDs are Appwrite ids (`[a-zA-Z0-9._-]`, ≤ 36 chars). The parser splits on
`.` from the right so the ids never need escaping; ids containing `.` are
handled by taking all middle segments.

Secret: `MEMBER_PASS_SECRET` (≥ 32 random bytes, base64). Server-only in both
`apps/web` and `apps/admin`. Missing secret → pass features disabled, not a
crash.

### 2. Web app (`apps/web`)

**`GET /api/member-pass`** (route handler, dynamic, `Cache-Control: no-store`)

1. `getMembershipStatus()`.
2. Not authenticated → 401. Not a member → `200 { state }` where state is
   `no_bi_identity | not_member | expired | unavailable`, with no codes.
   Transient Finago failure (`finago_error`, `unexpected_error`) →
   `unavailable`.
3. Member → `200 { state: "active", holder, codes, dayColor, serverNow, wallets }`
   - `holder`: `{ name, membershipName, period, startDate, expiryDate }`.
     `period` is derived from the matched membership (e.g. "Fall 2026",
     "2026–2027") using the shared plan mapping; `membershipName` from the row.
   - `codes`: 20 entries `{ slot, code }` starting at the current slot.
   - `serverNow`: lets the client correct for its own clock drift when
     picking the current slot.
   - `wallets`: `{ apple: boolean, google: boolean }` — true only when that
     wallet's env vars are set.

**`GET /api/member-pass/apple`** — members only. Builds a `.pkpass` with
`passkit-generator`: generic pass, QR barcode with `signAppleWalletCode`,
`expirationDate` = membership expiry, `relevantDate` unset, BISO branding and
the holder fields. No web service / push updates (YAGNI): early cancellation is
caught by the scanner's live Finago check.

**`GET /api/member-pass/google`** — members only. Builds a "Save to Google
Wallet" JWT (RS256, signed with the service account key via `node:crypto`)
that embeds the Generic Class and this user's Generic Object, so no REST calls
or OAuth token are needed. The object id is `<issuerId>.member-<userId>` and
carries
`rotatingBarcode = { type: QR_CODE, valuePattern: googleWalletCodePattern(userId), totpDetails: { algorithm: TOTP_SHA1, periodMillis: 30000, parameters: [{ key: base64(totpKey), valueLength: 6 }] } }`
and `validTimeInterval.end` = membership expiry. Redirects to
`https://pay.google.com/gp/v/save/<jwt>`. Whether rotating barcodes need Google
to enable them on the issuer account is checked during setup; if they do and
approval is pending, the Google button stays hidden.

**`<MemberPass>`** (`src/components/member-pass/member-pass.tsx`, client)

- Fetches `/api/member-pass`, keeps codes in React state only (never
  `localStorage`), refetches when fewer than 4 codes remain, on
  `visibilitychange` → visible, and on `online`.
- Picks the code for `passSlot(Date.now() + drift)`; countdown ring shows the
  seconds left in the slot.
- Visual: ticket-style card in BISO brand colors — large "MEMBER" label and
  period, animated holographic band (CSS, respects
  `prefers-reduced-motion` by slowing rather than stopping), live `HH:MM:SS`
  clock with a pulsing "live" dot, a wide day-color stripe with the color's
  name, large QR, name, valid-until.
- Tap → full-screen presentation mode, requests a Screen Wake Lock when
  supported.
- States: `no_bi_identity` → link CTA; `not_member` / `expired` → "Become a
  member" linking `/membership/join`; `unavailable` → "Can't verify right now"
  with retry; codes exhausted while offline → "Reconnect to refresh".
- Wallet buttons rendered only when `wallets.apple` / `wallets.google`.
- QR rendering: `qrcode` (MIT) to SVG.
- Strings via `next-intl` (`memberPass.*`, nb + en).

**Pages**

- Profile page: `MembershipStatusCard` is replaced by `<MemberPass>` (the
  refresh button behavior is kept inside the pass).
- Member portal: `page.tsx` switches from `verifyMembershipStatus()` to
  `getMembershipStatus()`; the pass is shown on the home tab and the
  membership tab.

**Member portal membership tab**

- Current plan, period, start and expiry come from the matched membership
  (`MembershipInfo`), mapped to a duration with `deriveAccrualMonths`.
- Plan list and prices come from `getPurchasableMembershipPlans()`; upgrade
  buttons link to `/membership/join`.
- Removed: hard-coded `MEMBERSHIP_PRICES`, fake monthly prices and "save 33%",
  auto-renew toggle, "next billing date", the old `MembershipCard` with the
  placeholder QR icon, and the dead wallet/share buttons.
- `member-portal-content.tsx` stops inventing a start date or a
  one-year-from-now expiry.

### 3. Admin app (`apps/admin`)

**Server-side verification: `src/lib/member-pass/verify-scan.ts`**

`verifyScan({ code, scanner })` where `scanner` is
`{ kind: "staff", userId } | { kind: "guest", linkId }`:

1. `verifyMemberPassCode`. Failure → red result with reason.
2. Load the `app.user` row (admin client) → `student_id`, name. Missing
   student id → red `not_linked`.
3. Membership: `computeMembershipStatus` wrapped in `unstable_cache` with a
   60 s TTL keyed by student number. Transient failure → grey
   `unavailable` (not logged as a denial).
4. Duplicate check: latest `member_pass_scans` row for the user with
   `result` in (`valid`, `duplicate`, `check_id`) within 10 minutes.
5. Write a `member_pass_scans` row.
6. Return:
   - `valid` (green): name, membership name, expiry
   - `duplicate` (orange): same, plus seconds since the previous scan
   - `check_id` (amber): Apple static code that is otherwise valid
   - `denied` (red): `bad_code | stale | not_member | expired | not_linked`
   - `unavailable` (grey)
   Never returns student number or email.

Duplicate takes precedence over `check_id`.

**Staff scanner:** `src/app/(portal)/members/scan/page.tsx`, gated with
`requireNavAccess("membership")`; server action calls `verifyScan` with the
session user.

**Guest scanner:** `src/app/(scan)/scan/[token]/page.tsx`, outside portal auth
(the admin root layout does not enforce a session; the `(portal)` layout does).
The page and its route handler hash the token (SHA-256), load the link row,
and reject when missing, expired, or revoked. Each scan re-validates the link.
Rate-limited per link (simple in-memory token bucket, e.g. 60 scans/min).

**Scanner UI** (`src/components/member-pass-scanner/*`, client): full-screen
camera via `qr-scanner` (MIT); top bar shows the day color and name (from the
server); result overlay fills the screen in the result color with a large
icon and name, vibrates, auto-dismisses after ~3 s; ignores the same code
within the overlay window.

**Guest link management:** `src/app/(portal)/members/scan/links/page.tsx`,
same gate. Create (label, campus, end time default now + 6 h, max 48 h) →
shows the URL once plus a QR of it; list active links with revoke.
Server actions follow the admin action shape and scope campus admins to their
managed campuses.

**Retention:** a new web cron route, `apps/web/src/app/api/cron/cleanup-member-pass/route.ts`
(gated by `Bearer ${CRON_SECRET}` like `cleanup-reservations`), deletes
`member_pass_scans` rows older than 90 days and link rows expired more than
30 days ago. The admin app has no cron of its own.

### 4. Appwrite schema (created in the Appwrite console, then regenerated)

`app.member_pass_scanner_links`

| column | type |
|---|---|
| `label` | string(120), required |
| `campus_id` | string(36), nullable |
| `token_hash` | string(64), required, unique index |
| `expires_at` | datetime, required |
| `revoked_at` | datetime, nullable |
| `created_by` | string(36), required |

`app.member_pass_scans`

| column | type |
|---|---|
| `member_user_id` | string(36), required, index |
| `result` | enum `valid, duplicate, check_id, denied, unavailable` |
| `reason` | string(40), nullable |
| `code_kind` | enum `web, google, apple`, nullable |
| `scanner_user_id` | string(36), nullable |
| `scanner_link_id` | string(36), nullable |
| `$createdAt` | (system) — index with `member_user_id` for the duplicate lookup |

Both tables: no client permissions (admin client only).

After creating them: `appwrite pull` + regenerate
`packages/api/types/appwrite.ts`. Until then the code uses local row types,
following the existing `BiUser` pattern.

### 5. Configuration

New server-only env vars (also added to `turbo.json` `build.env` and the
`.env.example` files):

- `MEMBER_PASS_SECRET` — web, admin
- `APPLE_PASS_TYPE_ID`, `APPLE_TEAM_ID`, `APPLE_PASS_CERT`, `APPLE_PASS_KEY`,
  `APPLE_PASS_KEY_PASSPHRASE`, `APPLE_WWDR_CERT` — web (PEM values,
  base64-encoded)
- `GOOGLE_WALLET_ISSUER_ID`, `GOOGLE_WALLET_SERVICE_ACCOUNT` (JSON,
  base64-encoded) — web

New dependencies: `qrcode` (web), `passkit-generator` (web), `qr-scanner`
(admin). Google Wallet needs no dependency (JWT signed with `node:crypto`).

## Security notes

- The signing secret never reaches a browser; codes are useless without it.
- A forwarded web code works for at most ~90 s, and a second scan within
  10 minutes shows orange on any scanner device.
- The Apple code is static by platform limitation; it is always marked
  "check ID", and duplicate detection applies.
- Codes carry only the Appwrite user id, never student number, name, or
  email, and are not URLs.
- Scan results expose name, membership name and expiry only.
- Guest links are stored hashed, time-boxed (≤ 48 h), revocable, and
  rate-limited.

## Error handling

- Missing `MEMBER_PASS_SECRET`: `/api/member-pass` returns
  `state: "unavailable"` and logs an error; the scanner shows a configuration
  error page.
- Missing wallet env: that wallet's button is hidden; its route returns 404.
- Finago timeout: pass shows "Can't verify right now"; scanner shows grey.
- Appwrite write failure on the scan log: result is still returned, the error
  is logged, duplicate detection is best-effort.

## Testing

Unit (vitest, `packages/shared`):
- sign/verify round trip for all three kinds; tampered signature, wrong
  secret, malformed input, user ids with dots
- slot window: current, ±1 accepted, ±2 rejected
- TOTP matches RFC 6238 SHA-1 test vectors
- Apple code expiry in Oslo time
- `dayColor` is stable for a date and changes across dates
- `isRecentDuplicate` edges

Unit (apps):
- `/api/member-pass`: 401, non-member gets no codes, member gets 20 codes,
  transient failure → `unavailable`, wallet flags follow env
- `verifyScan`: each result path, duplicate precedence, no student number in
  the response, guest link expired/revoked
- membership tab mapping: semester row → "Semester", real prices

Manual (browser):
- pass renders and rotates on profile and member portal
- staff scanner and a guest link scanning a live pass; forwarded screenshot
  after 90 s → red; second scan → orange
- Google and Apple wallet add flows once credentials exist

## Out of scope

- Apple Wallet update web service / push
- NFC passes
- Photos on the pass
- Offline scanning (the scanner needs network for the Finago check)
