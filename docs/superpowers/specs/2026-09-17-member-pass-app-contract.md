# Member Pass API Contract — for the Flutter app

Date: 2026-09-17
Generated from the implemented code on branch `feat/member-pass-api`
(`apps/api/src/app/api/member-pass/*`, `apps/api/src/lib/member-pass/*`,
`packages/shared/member-pass/*`, `packages/shared/utils/member-pass*.ts`),
not from the spec. Supersedes `flutter-brief-v2.md` where the two differ — see
"Differences from the v2 brief" at the end.

## Base URL and auth

Base URL: `https://api.biso.no` (`apps/api`, currently unreleased — the
routes exist on this branch but are not deployed yet).

Every call must send:

```
Authorization: Bearer <Appwrite JWT>
```

from `account.createJWT()`. **The session cookie is never read by these
routes** — `extractJwtFromRequest` (`apps/api/src/lib/auth.ts`) only reads the
`Authorization` header, and every member-pass route calls it directly and
returns `401` when it's missing, deliberately not falling back to
`createAuthenticatedClient(req)`'s cookie fallback (see the comments in
`apps/api/src/lib/member-pass/resolve.ts` and `scanner-auth.ts`). A missing or
malformed JWT header, or one Appwrite rejects, returns:

```
401 {"error":"not_authenticated"}
```

on every endpoint below except `POST /api/member-pass/scan` and
`GET /api/member-pass/scanner`, where an auth failure is folded into the
scanner-grant check and still surfaces as `401 {"error":"not_authenticated"}`
(see `requireScanner`).

## Common headers

- **CORS**: every response (including error responses and `OPTIONS`
  preflights) goes through `applyCorsHeaders`. If the request's `Origin`
  header matches the allow-list (`apps/api/src/lib/allowed-origins.ts`:
  `https://admin.biso.no`, `https://web.biso.no`, `https://public.biso.no`,
  `https://biso.no` in production, plus `localhost:3000/3001/3002` outside
  production), the response gets `Access-Control-Allow-Origin: <origin>` and
  `Access-Control-Allow-Credentials: true`. Every response also always gets
  `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS` and
  `Access-Control-Allow-Headers: Content-Type, Authorization, Cookie,
  X-Requested-With`. A native app calling with no `Origin` header (or one not
  on the allow-list) still gets a normal response body — CORS headers only
  gate browser reads, not the server's willingness to answer.
- **Cache-Control**: every JSON and pkpass response sets
  `Cache-Control: private, no-store`. Never cache a response client-side.
- **`MEMBER_PASS_SECRET` not configured**: `GET /api/member-pass` degrades to
  `200 {"state":"unavailable"}` (not an error status) when
  `readMemberPassSecret()` returns null. `GET /api/member-pass/scanner` and
  `POST /api/member-pass/scan` instead return `503
  {"error":"not_configured"}`. `GET /api/member-pass/apple` and `GET
  /api/member-pass/google` fold a missing secret into the same check as a
  missing wallet cert/key config and return `404 {"error":"not_configured"}`
  (see "Differences" — the brief only documented this for the two wallet
  cases, not that the check happens before the auth check).
- **Configuration errors are checked before authentication.** On the wallet
  endpoints (`apple`, `google`: `404 {"error":"not_configured"}`) and the
  scanner endpoints (`scanner`, `scan`: `503 {"error":"not_configured"}`),
  the config check runs first — so an unauthenticated caller (no/invalid
  JWT) against a misconfigured deployment still sees the config error, not
  `401`.

## 1. `GET /api/member-pass`

No request body.

- `401 {"error":"not_authenticated"}` — missing/invalid JWT.
- `200 {"state":"no_bi_identity"|"not_member"|"expired"|"unavailable"}` —
  no pass to show. `unavailable` covers: `MEMBER_PASS_SECRET` unset, a
  Finago/Appwrite transient error (`reason` `finago_error` or
  `unexpected_error` in the shared membership-status computation), or the
  holder builder failing to compute a current membership even though Finago
  says the user is a member (`buildHolder` returning null — should not
  normally happen).
- `200` with an active pass:

```json
{
  "state": "active",
  "holder": {
    "name": "Markus Heien",
    "membershipName": "Semester",
    "startDate": "2026-07-01",
    "expiryDate": "2026-12-31",
    "term": { "duration": "semester", "season": "fall", "fromYear": 2026, "toYear": 2026 }
  },
  "codes": [{ "slot": 59654564, "code": "v1.6aa3847618da8122d12c.59654564.NkAwFh_bRSXJoZyzyvO5tw" }],
  "dayColor": { "name": "teal", "hex": "#12A594" },
  "serverNow": 1789636920000,
  "wallets": { "apple": true, "google": false }
}
```

Field notes (from `packages/shared/member-pass/types.ts`,
`packages/shared/utils/member-pass.ts`, `packages/shared/utils/member-pass-slots.ts`):

- `codes` always holds exactly 20 entries
  (`MEMBER_PASS_BATCH_SIZE`), one per 30-second slot
  (`MEMBER_PASS_SLOT_SECONDS`) starting at the current slot — 10 minutes of
  codes. `slot = floor(nowMs / 30000)`.
- `code` format: `v1.<userId>.<slot>.<sig>` — `sig` is an HMAC-SHA256 over
  `v1.<userId>.<slot>`, truncated to 16 bytes, base64url-encoded.
- `dayColor` — see "Day colors" below.
- `term` is `null` when `describeMembershipTerm` cannot parse the dates or
  snap the span to a known accrual length (6/12/36 months →
  `semester`/`year`/`three_years`); when non-null, `season` is `"spring"`,
  `"fall"`, or `null` (`null` unless `duration === "semester"`).
- `wallets.apple` / `wallets.google` are `true` only when the corresponding
  server-side wallet config (`APPLE_PASS_*`/`APPLE_WWDR_CERT` or
  `GOOGLE_WALLET_*`) is fully present — not a live probe against Apple/Google.

### Term display label (`packages/shared/member-pass/term-label.ts`)

- `term === null` → the raw `membershipName` (e.g. "Semester").
- `term.season` set → `"Høst 2026"` / `"Fall 2026"` (locale message key
  `term.semester`, a `{season, select, spring{…} other{…}}` ICU form — `other`
  covers `fall`).
- `term.season === null` → `"2026–2027"` (`term.span`, `"{from}–{to}"`).

## 2. `GET /api/member-pass/apple`

Returns the pass as `.pkpass` bytes.

- `200`, `Content-Type: application/vnd.apple.pkpass`,
  `Content-Disposition: attachment; filename="biso-membership.pkpass"`.
- `404 {"error":"not_configured"}` — `readAppleWalletConfig()` or
  `readMemberPassSecret()` returned null. Checked **before** authentication,
  so this fires even with no/invalid JWT.
- `401 {"error":"not_authenticated"}`.
- `403 {"error":"<state>"}` — `resolved.state` is one of `no_bi_identity`,
  `not_member`, `expired`, `unavailable` (i.e. any non-`active`
  `MemberPassState` other than the ones already handled).
- `500 {"error":"failed"}` — pass build threw (e.g. signer cert / icon fetch
  failure).

The pkpass's embedded QR payload is `signAppleWalletCode(userId, expiryDate,
secret)` → `a1.<userId>.<YYYYMMDD>.<sig>` (date is `expiryDate` with dashes
stripped; `sig` is the same 16-byte HMAC truncation scheme as the web code,
over `a1.<userId>.<compactDate>`). It is static — the scanner always shows it
as "check ID" on first sight (see `verify-scan.ts`: `kind === "apple"` with no
prior scan → `check_id`).

## 3. `GET /api/member-pass/google`

- `200 {"saveUrl":"https://pay.google.com/gp/v/save/<jwt>"}`.
- `404 {"error":"not_configured"}` — missing `GOOGLE_WALLET_*` config or
  `MEMBER_PASS_SECRET`. Checked before authentication.
- `401 {"error":"not_authenticated"}`.
- `403 {"error":"<state>"}` — same non-active states as Apple.
- `502 {"error":"wallet_unavailable"}` — the Google Wallet API write
  (`syncGoogleWalletPass`, called before the save JWT is signed) threw.
- `500 {"error":"failed"}` — any other failure (JWT signing, etc.).

Unlike the website (which redirects the browser straight to the save URL),
the app receives JSON and must open `saveUrl` itself. The object is written
through the Wallet API first (`syncPass`) so the TOTP key never appears in
the save link and a renewal updates a pass the member already saved. The
Google barcode value pattern is `g1.<userId>.{totp_value_0}` — the app never
sees the raw TOTP key; the scanner recomputes it server-side from
`googleWalletTotpKeyHex(userId, secret)`.

## 4. `GET /api/member-pass/scanner`

Tells the caller whether they may scan, and today's color.

- `503 {"error":"not_configured"}` — `MEMBER_PASS_SECRET` unset. Checked
  before authentication.
- `401 {"error":"not_authenticated"}`.
- `403 {"error":"not_scanner"}` — no active grant (`findActiveGrantForUser`
  returns null: none exists, or the only ones are revoked/expired).
- `200 {"campusId":"1"|null,"expiresAt":"2026-09-20T22:00:00.000Z"|null,"dayColor":{"name":"teal","hex":"#12A594"}}`.
- `500 {"error":"failed"}` — unhandled exception (e.g. Appwrite outage while
  checking the grant). **Not documented in the v2 brief** — see
  "Differences".

Re-checked on every call (no caching server-side) — a revoked grant stops
working on the very next request.

A grant's `campus_id` does not restrict *where* a pass can be scanned —
membership is BISO-wide, so any active scanner can scan any member
regardless of campus. The campus only decides which campus admins can see
and revoke the grant in `apps/admin`. When a user holds several active
grants (e.g. one per campus, or a leftover from a past invite), `/scanner`
reports the newest one (`findActiveGrantForUser` orders by `$createdAt`
descending) — its `campusId` and `expiresAt`, not a merge of all of them.

## 5. `POST /api/member-pass/scan`

Body: `{"code": "<scanned string>"}`. The code is trimmed and must be a
string of length 1–256 after trimming. Order of checks in
`apps/api/src/app/api/member-pass/scan/route.ts` (the scanner-grant check
runs *before* the body is parsed, so an invalid body from a caller with no
grant still comes back `403`, not `400`):

1. Missing `MEMBER_PASS_SECRET` → `503 {"error":"not_configured"}`.
2. `requireScanner` → `401 {"error":"not_authenticated"}` or `403
   {"error":"not_scanner"}` (this is the "mid-shift 403": a grant revoked
   after the scanner screen opened fails here on the very next scan).
3. Body parse/validate → `400 {"error":"invalid_body"}` if the JSON is
   unparsable, not an object, `code` isn't a string, or the trimmed length is
   0 or > 256.
4. Per-caller rate limit (60 scans/minute, in-memory, keyed by the scanning
   user's id) → `429 {"error":"rate_limited"}`.
5. `verifyScan` → `200` with a `ScanOutcome` body.
6. Anything else thrown → `500 {"error":"failed"}` (not in the v2 brief).

`ScanOutcome` shape (`packages/shared/member-pass/scan-types.ts`):

```
{
  "result": "valid" | "duplicate" | "check_id" | "denied" | "unavailable",
  "reason"?: "bad_code" | "stale" | "expired" | "not_member" | "not_linked",
  "name"?: string,
  "membershipName"?: string,
  "expiryDate"?: string,
  "secondsSincePrevious"?: number
}
```

`verifyScan` logic (`packages/shared/member-pass/verify-scan.ts`):

- Code signature/format/time check first
  (`verifyMemberPassCode`) — failure → `denied` with reason mapped from the
  low-level parse failure: `malformed`→`bad_code`, `bad_signature`→`bad_code`,
  `stale`→`stale`, `expired` (Apple only, past the encoded expiry
  date)→`expired`.
- Profile lookup fails (non-404 Appwrite error) → `unavailable`, no `reason`.
- No linked/sanitized `student_id` on the profile → `denied`,
  `reason: "not_linked"`, `name` included if known.
- Live Finago status lookup throws → `unavailable`.
- Not currently a member → `denied`, `reason` is `"expired"` if the status
  reason is `expired`, else `"not_member"`; `name` included if known.
- Duplicate-window log read fails → `unavailable` (never treated as "no
  previous scan", to avoid letting a duplicate through).
- Otherwise: `valid`, unless a previous **counted** scan
  (`valid`/`duplicate`/`check_id`) exists for that member within
  `DUPLICATE_SCAN_WINDOW_MS` (10 minutes) → `duplicate` (with
  `secondsSincePrevious`, clamped to ≥ 0), or the code kind is `apple` and
  there was no prior scan → `check_id`. `check_id` and `valid` both carry
  `name`, `membershipName`, `expiryDate`.

Every scan attempt is logged server-side regardless of outcome (except when
the profile/Finago/log lookups themselves fail before a result is reached —
those still log with `result: "unavailable"`).

## Code formats and slot math

| Prefix | Shape | Notes |
|---|---|---|
| `v1` | `v1.<userId>.<slot>.<sig>` | Web/app pass. `slot = floor(nowMs / 30000)`. Scanner accepts slots within `MEMBER_PASS_SLOT_TOLERANCE` (±1 slot, i.e. ±30s) of its own current slot — anything further off is `stale`. |
| `g1` | `g1.<userId>.<6 digits>` | Google Wallet. RFC 6238 TOTP (HMAC-SHA1, 6 digits), keyed by `googleWalletTotpKeyHex(userId, secret)`, tried against ±1 time-step around the scanner's current slot. Can't distinguish "wrong key" from "old step" — both report `stale`. |
| `a1` | `a1.<userId>.<YYYYMMDD>.<sig>` | Apple Wallet. Static (embeds the pass's `expiryDate`, no rotation). `sig` invalid → `bad_signature`. Date before "today" in Europe/Oslo → the code itself decodes as `{ok:false, reason:"expired"}`, distinct from the membership being expired. |

`userId` in all three must match `/^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/` or the
code is `malformed`. Signatures are 16-byte HMAC-SHA256 truncations,
base64url-encoded, compared with `timingSafeEqual`.

## Client rules for the pass (must match the web client exactly)

Implemented in `apps/web/src/components/member-pass/use-member-pass.ts` and
`pass-refresh.ts` — the app must reproduce this exactly, not just approximate it:

- On any successful fetch with `state === "active"`, compute
  `drift = body.serverNow - Date.now()` (device clock offset vs. server).
  Drift from a failed/offline fetch is not recomputed — the last known drift
  is reused.
- The shown code is `codes.find(c => c.slot === passSlot(Date.now() + drift))`,
  i.e. `slot === floor((now + drift) / 30000)`.
- **Refetch threshold**: refetch as soon as fewer than 4
  (`MEMBER_PASS_REFETCH_BELOW`) codes remain at-or-after the current slot
  (`codesRemaining`).
- **Retry while offline or low**: while offline, or while codes-remaining is
  below the refetch threshold, retry on a 15-second timer
  (`PASS_RETRY_MS`) until a fetch succeeds. Also refetch on the
  `visibilitychange` → visible transition (app resume) and on the browser's
  `online` event (connectivity return).
- **Replace-vs-keep rule** (`nextPassState` in `pass-refresh.ts`), applied to
  every fetch outcome:
  - A `200` body (any state, including non-`active`) always replaces what's
    shown, and clears `offline`.
  - A `401` always replaces what's shown with `{state:"unavailable"}` and
    clears `offline`. (Note: the brief describes this as "on a 200 body or a
    401" — matches.)
  - A network error (fetch threw, e.g. no connectivity) **keeps** the
    previous data untouched and sets `offline: true` — regardless of whether
    the previous pass still has a usable code.
  - Any other failure (any non-2xx status other than 401) keeps the
    previous pass **only if** it's `active` and still has ≥1 code at or after
    the current slot (`hasUsableCode`); otherwise it replaces the shown data
    with `{state:"unavailable"}` and clears `offline`.
  - So "keep an active pass on transient errors" is exact for network
    errors, and conditional on a usable code remaining for 5xx errors — the
    app should replicate both branches, not just one blanket "keep on any
    error" rule.
- If no usable code remains and the state ends up `unavailable`/offline with
  nothing to show, present "Reconnect" / try-again UI.
- Codes exist in memory only (component state / hook state) — never persisted
  to disk, never logged.

## Day colors

Twelve fixed names, each with a fixed hex (`packages/shared/utils/member-pass.ts`,
`DAY_COLORS`, in this exact order — order matters, it's used for the HMAC
selection but not otherwise meaningful to the client):

`red #E5484D`, `orange #F76B15`, `yellow #FFC53D`, `lime #7CB518`,
`green #30A46C`, `teal #12A594`, `cyan #00A2C7`, `blue #0090FF`,
`indigo #3E63DD`, `purple #8E4EC6`, `pink #D6409F`, `brown #AD7F58`.

The color for "today" is `HMAC-SHA256(secret, "day.<YYYY-MM-DD in Europe/Oslo>")`
mod 12 — same color on every pass and every scanner for the same calendar day
(Oslo time), unpredictable without the server secret. Localized names live at
message key `colors.<name>` in `packages/i18n/messages/{en,no}/memberPass.json`
(e.g. `teal` → "Teal" / "Blågrønn").

## Scanner client rules (from `apps/admin`'s scanner components — same rules the app must follow)

- Open the scanner screen only after `GET /api/member-pass/scanner` returns
  `200`; a `403` means "no scanning access" (localize as appropriate — admin's
  own copy isn't reused by the app, but the v2 brief's wording is fine:
  "You don't have scanning access. Ask BISO staff for an invitation.").
- Top bar shows the day color (name + swatch) from the `scanner` response,
  and, if `expiresAt` is non-null, an "Access until …" line.
- **Result colors and texts** (`apps/admin/src/components/member-pass-scanner/scan-tone.ts`,
  mapped 1:1 from `ScanOutcome.result`):
  - `valid` → green
  - `duplicate` → orange
  - `check_id` → **amber** (not "yellow" — distinct from the amber vs. the
    yellow day-color name)
  - `denied` → red
  - `unavailable` → grey
  - Reason texts for `denied` are not hardcoded in the admin scanner
    component read here — use the v2 brief's wording (`bad_code`: "Not a
    BISO pass", `stale`: "Old code — ask them to reopen the pass", `expired`:
    "Membership has ended", `not_member`: "Not a member", `not_linked`: "No
    linked student account"); nothing in the implemented server code
    contradicts these.
- **20-second repeat filter**, keyed by member id
  (`apps/admin/src/components/member-pass-scanner/scan-repeat.ts`,
  `REPEAT_WINDOW_MS = 20_000`):
  - Parse the member id from the *raw scanned code string* (client-side,
    before calling `/scan`): split on `.`; for prefixes `v1` and `a1`, the
    key is `member:<the segments between the prefix and the last two
    segments joined by ".">`; for prefix `g1`, it's `member:<the segments
    between the prefix and the last segment>`. If the prefix isn't
    recognized, or the computed id is empty, fall back to the whole trimmed
    string as the key.
  - A sighting of the same key within 20s of the last sighting of that same
    key is a repeat — ignore it (do not call `/scan` again).
  - Every sighting restarts the 20s window for that key, whether or not it
    was a repeat — so a pass held continuously in front of the camera is
    logged once, then stays "already seen" as long as it keeps being
    re-read at least every 20s.
  - Ignore camera reads entirely while a `/scan` request is already in
    flight (don't fire concurrent requests for the same or different codes
    mid-request).
- **429 handling**: `429 {"error":"rate_limited"}` → show "Too many scans —
  wait a moment" (per the v2 brief); this is a per-scanning-user, in-memory,
  60-scans-per-60-seconds limit, so it resets on its own.
- **Mid-shift 403**: `403 {"error":"not_scanner"}` from `/scan` (grant
  revoked after the scanner screen opened, caught on the next scan attempt)
  should close the scanner and show the same "no access" message as a 403
  from `/scanner`.
- Network errors (not just non-2xx) should render like an `unavailable`
  result (grey), per the v2 brief.

## Wallet flows

- **iOS**: `GET /api/member-pass/apple` with the JWT header → raw `.pkpass`
  bytes → hand to the native "add to Wallet" flow (`PKAddPassesViewController`
  or equivalent) via a method channel/plugin. The server never returns a
  URL for iOS.
- **Android**: `GET /api/member-pass/google` with the JWT header → `{
  "saveUrl": "https://pay.google.com/gp/v/save/<jwt>" }` → open `saveUrl` in
  a browser/the Wallet app (`url_launcher` or equivalent). The app does not
  construct this URL itself; it's a short-lived signed JWT from the server.
- Show each button only when the corresponding `wallets.apple` /
  `wallets.google` flag from `GET /api/member-pass` is `true`.

## Invitation flow (`apps/admin/src/app/(portal)/_actions/member-pass-scanners.ts`)

1. A campus or global admin invites someone by email (optionally scoped to a
   campus; unscoped/"all campuses" grants are global-admin only) from
   `inviteScanner`.
2. The server looks up an existing Appwrite user by that email
   (`findOrCreateUser`); if none exists, it **creates the Appwrite account
   itself** before anything else happens — so the email always exists by the
   time the invitation is sent.
3. A `member_pass_scanners` row is created (or, if an active grant already
   exists for that user+campus, updated in place — expiry and name only).
4. If SMTP is configured, an invitation email is sent
   (`buildScannerInviteEmail`, bilingual Norwegian/English) with these
   instructions: install the app → sign in with **that exact email** (an
   Appwrite email code is sent) → open Explore → "Scan memberships". Android
   always gets a link — `BISO_APP_ANDROID_URL` if set, otherwise the default
   `https://play.google.com/store/apps/details?id=com.biso.no` (a details
   link, not a search URL). Only iOS falls back to a "search for BISO in the
   App Store" hint, and only when `BISO_APP_IOS_URL` is unset. If the email
   send fails or SMTP isn't configured, the grant is still saved (invitation
   can be resent later via `resendScannerInvite`) — the invite email carries
   no token; access is entirely a function of the signed-in account's email
   matching an active grant's `user_id`, checked live on every
   `/scanner`/`/scan` call.
5. From the app's perspective this means: nothing token-based to parse or
   store — sign-in alone (the same Appwrite JWT flow as a member) is
   sufficient, and the app should just try `GET /api/member-pass/scanner`
   after sign-in to discover access.

## Differences from the v2 brief

- **`GET /api/member-pass/scanner` and `POST /api/member-pass/scan` can also
  return `500 {"error":"failed"}`** on an unhandled exception. The v2 brief
  did not document this status for either endpoint.
- **`GET /api/member-pass/google` can also return `500 {"error":"failed"}`**
  on an unhandled exception (e.g. JWT signing), on top of the `502
  wallet_unavailable` case the brief documents.
- **The `not_configured` check order differs from what the brief implies.**
  On `apple`/`google`, `404 {"error":"not_configured"}` is checked *before*
  authentication — an unauthenticated caller against a misconfigured wallet
  still gets `404`, not `401`. The brief's "common errors" section only
  states the missing-JWT→401 rule as a blanket statement; it's true for
  `/member-pass`, `/scanner`, and `/scan`, but not for the wallet endpoints
  when wallet/secret config is also missing.
- **`GET /api/member-pass` never returns a raw 503/500 for a missing
  secret.** Unlike the scanner endpoints (which return `503
  {"error":"not_configured"}`), a missing `MEMBER_PASS_SECRET` here degrades
  to a normal `200 {"state":"unavailable"}` body. The brief's "common errors"
  section scopes the 503 rule to "the scanner endpoints" already, so this is
  consistent, but worth calling out explicitly since it's easy to assume the
  503 rule is global.
- **`check_id`'s scanner color is "amber", not "yellow".** The brief itself
  already says amber for `check_id` (and reserves the color list `red,
  orange, yellow, lime, green, teal, cyan, blue, indigo, purple, pink, brown`
  for day colors only) — flagging only because the two color vocabularies
  share some names (`orange`) and it's easy to conflate the "scan result
  tone" palette with the "day color" palette. They are unrelated enums in the
  code.
- Everything else checked field-by-field (endpoint shapes, status codes,
  code formats, slot math, day-color list, client refetch/retry/drift rules,
  repeat-filter parsing, wallet flows, invitation flow) matches the v2 brief.
