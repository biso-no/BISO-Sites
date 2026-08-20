# Pre-Launch Security & Quality Review

_Independent review ahead of go-live. Scope: security first, then quality and
performance. Findings were produced by static analysis of the whole monorepo
(1,273 TS/TSX files across 4 apps and 10 packages) and verified against source._

**Reading note on the Appwrite findings:** they are derived from
`packages/api/appwrite.config.json`. That file is pulled from the live project
and can drift. Every finding in the "Appwrite permission model" section must be
confirmed against the live console before you act on it — the fix is in
Appwrite, not in this repo.

## Status of the previous audit

Most of the earlier `PRODUCTION_READINESS_REVIEW.md` blockers are genuinely
fixed. Verified closed: Stripe `async_payment_failed` now maps to `CANCELLED`
(#3), the API checkout route enforces stock and purchase limits (#5), page
publish/unpublish/delete now call `assertPublishAccess` (#7), the membership
check is cached rather than hitting 24SO per pageview (#9), and the membership
gate is server-derived from session + `student_id` rather than a client cookie
(#10). The OData injection in the board route (#6) is fixed via
`escapeODataLiteral`.

One item from that list is still open, and it is the most serious finding here
(C1 below): the board route's **missing authentication**. Only the injection
half of #6 was fixed.

## Build health

- `bun run check-types` passes for `web`, `admin`, and `api`.
- `docs` still fails on two Fumadocs-generated modules (`collections/server`,
  `public/logo.png`). Not launch-critical.

---

# Critical

## C1. Unauthenticated staff-directory endpoint leaks name, email, phone, photo

`apps/api/src/app/api/campus/[campusId]/[departmentId]/board/route.ts:84`

The `GET` handler has no authentication of any kind — no JWT check, no session,
no shared secret. It calls `createAdminClient()` and Microsoft Graph and returns
`email`, `name`, `phone`, `officeLocation`, and a profile photo for every
matching enabled account. Both path segments are attacker-controlled, so the
directory is enumerable across every campus and department.

This is an unauthenticated PII disclosure covering your volunteers and staff.
Under GDPR this is personal data of identifiable individuals, published without
a lawful basis or access control.

**Fix:** decide whether this is meant to be public. If it is, return only the
fields you intend to publish (drop phone and email, or restrict to role holders
who have consented). If it is not, gate it behind `createAuthenticatedClient(req)`
+ `account.get()` like the expense routes do.

## C2. Any authenticated user can update and delete rows in four tables

`packages/api/appwrite.config.json`

These four tables carry `update("users")` and `delete("users")` at the **table**
level with row security enabled:

| Table | Permissions |
|---|---|
| `content_entries` | `read("any")`, `update("users")`, `delete("users")` |
| `content_entry_locales` | `read("any")`, `update("users")`, `delete("users")` |
| `teams` | `read("any")`, `update("users")`, `delete("users")` |
| `typing_indicators` | `read("any")`, `update("users")`, `delete("users")` |

Appwrite grants access when *either* the table-level or the row-level permission
matches — they are OR'd, not AND'ed. A table-level `update("users")` therefore
overrides every row ACL your code carefully builds.

This matters because anonymous auth is **enabled** project-wide
(`settings.auth.methods.anonymous: true`) and `appwrite.biso.no` is publicly
reachable with a public project ID. Appwrite's `users` role covers anonymous
sessions. So the attack is: `POST /v1/account/sessions/anonymous`, then
`PATCH`/`DELETE` any row in those four tables. No account, no email, no cost.

**What limits this today:** all four tables are unreferenced anywhere in the
codebase (`grep` returns zero hits for each). They appear to be a planned or
abandoned schema. That is the only reason this is not already destructive.

**Why fix it before launch anyway:** the exposure is latent, not absent. The
moment anything writes to `content_entries` — and the name suggests it is the
intended home for unified CMS content — an anonymous visitor can wipe or rewrite
it. Config outlives the intent behind it.

**Fix:** remove `update("users")` and `delete("users")` from all four tables in
Appwrite. If the tables are dead, delete them. Then extend
`packages/api/appwrite-config-permissions.test.ts` — its invariants currently
cover only the seven recruitment tables, which is why this drifted unnoticed.
A repo-wide assertion that no table grants `create`/`update`/`delete` to `any`
or `users` (with an explicit allowlist) would have caught it.

## C3. The public web app ships no security headers

`apps/web/next.config.ts`, `apps/api/next.config.ts`

`apps/admin/next.config.ts:88` sets a sensible baseline — `X-Frame-Options: DENY`,
`X-Content-Type-Options: nosniff`, `Referrer-Policy`, HSTS with preload, and a
`Permissions-Policy`. Neither `web` nor `api` has a `headers()` function at all.

`web` is the app that handles checkout, expense submission with bank account
numbers, and login. Missing there:

- **`X-Frame-Options` / `frame-ancestors`** — the checkout and expense flows can
  be framed, which is a clickjacking path against a payment action.
- **HSTS** — no protection against a downgrade on the main public domain.
- **`X-Content-Type-Options: nosniff`** — relevant given user-uploaded files.
- **`Referrer-Policy`** — you email expense approval links as
  `/fs/approve/{token}`, a bearer token in the URL path. Modern browser defaults
  happen to protect this, but you should not be relying on a default for a token
  that authorizes money movement.

**Fix:** copy the admin `headers()` block into `apps/web/next.config.ts` and
`apps/api/next.config.ts`. This is a ~15 line change and the highest
security-per-effort item on this list.

---

# High

## H1. No rate limiting anywhere in the monorepo

A search for every common limiter (`ratelimit`, `throttle`, `upstash`,
`@vercel/kv`, `limiter`) returns nothing outside of two comments. There is no
rate limiting on any endpoint in any of the three apps.

Concretely exposed:

- **`POST /api/expenses/ocr`** — runs an AI model per call. Unbounded calls mean
  an unbounded bill. This is the one I would fix first.
- **`POST /api/expenses/submit`** — generates a PDF and sends approval email per
  call.
- **`POST /api/payment/{provider}/checkout`** — creates orders and payment
  sessions.
- **Login / OTP / magic-URL** — Appwrite's own limits apply, but you have
  `settings.auth.security.limit: 0` (unlimited users) and anonymous session
  creation is free and unmetered.

**Fix:** put a limiter in front of the expensive endpoints at minimum (OCR,
submit, checkout). Appwrite has per-project abuse limits, but they will not
protect your OpenAI spend.

## H2. Expense approval chain trusts an attacker-supplied department

`apps/api/src/lib/expense-payload.ts:23-24` and
`apps/api/src/lib/expense-approval.ts:175-185`

The expense payload validates campus and department as `z.string().min(1)` —
nothing more. `createApprovalChain` then passes `campusId` / `departmentId` /
`departmentName` straight into `resolveExpenseApprovers`, which resolves the
approvers to notify and emails each of them a signed approval link.

Nothing checks that the submitter belongs to the department they are claiming.
Any authenticated user can inject a reimbursement request into any department's
approval queue, addressed to that department's real approvers. It still needs an
approver to click approve, so this is a social-engineering assist rather than a
direct theft — but a plausible-looking request arriving through the normal
channel is exactly what approvers are conditioned to approve.

**Fix:** validate that the submitter is a member of the claimed department (or
resolve the department from their profile rather than accepting it from the
request body).

## H3. Public pages render unsanitized HTML

`packages/ui/components/plate-content-renderer.tsx:16-34`

The component takes a string and, if it starts with `<`, injects it via
`dangerouslySetInnerHTML` with no sanitization. The same happens on the Plate
JSON path via `toHtml`. The `biome-ignore` comment justifies it as "Content is
authored by trusted admins in the CMS."

It renders on three public surfaces: news articles
(`apps/web/src/components/news/article-body.tsx`), event descriptions
(`event-content.tsx`), and job listings (`job-details-client.tsx:218`).

There is **no HTML sanitizer anywhere in the dependency tree** — no DOMPurify,
no `sanitize-html`.

The problem is the trust boundary. "Trusted admins" here means several hundred
volunteer editors across 50+ clubs and 5 campuses, with membership turning over
every year. Any one of them can put stored XSS on the public site, and the
obvious target is an admin session. The `news`, `events`, and `jobs` tables do
grant `create` only to staff teams, so this is not reachable anonymously — it is
a privilege-escalation path from club editor to site compromise.

**Fix:** sanitize server-side at render, not only at author time. Add
`isomorphic-dompurify` (or equivalent) inside `PlateContentRenderer`.

## H4. `sanitizeRichText` allows `javascript:` URLs

`packages/editor/src/lib/sanitize.ts:38-45`

```ts
function stripAttributes(el: Element, tag: string): void {
  for (const attr of Array.from(el.attributes)) {
    if (tag === "a" && attr.name === "href") {
      continue;          // <-- kept with no scheme validation
    }
    el.removeAttribute(attr.name);
  }
}
```

`href` on `<a>` is preserved unconditionally, so `<a href="javascript:...">`
survives sanitization.

Two further limitations worth knowing: it is client-only (it uses
`document.createElement`), so it is an author-time cleanup rather than a render-
time defense, and it is applied by the editor's text block but not by
`PlateContentRenderer` (H3).

**Fix:** allowlist schemes on `href` — `http`, `https`, `mailto`, and relative
paths only.

---

# Medium

## M1. Internal helpers exported as callable Server Actions

`apps/admin/src/lib/team-provisioning.ts:1`

The file opens with `"use server"`, which makes every exported async function a
callable endpoint with a stable action ID. It exports `grantDeptTeamAccess` and
`grantTeamRecruitmentAccess` — both unauthenticated, both using
`createAdminClient()`, and `grantDeptTeamAccess` grants `update` and `delete` on
department rows to a **caller-supplied `teamId`**.

Both are only ever called server-side from `m365-sync.ts`, so their action IDs
should not appear in any client bundle — that is what keeps this Medium rather
than Critical. But the `"use server"` directive is doing nothing useful here and
is needlessly turning two privileged helpers into endpoints.

**Fix:** replace `"use server"` with `import "server-only"`. Worth auditing the
other `"use server"` files in `src/lib/` for the same pattern — the directive
belongs on modules that client components actually call.

## M2. `user` table grants `create("users")`

`packages/api/appwrite.config.json`

The `user` table — which holds `bank_account`, `address`, `phone`, `student_id`,
and `email` — carries `create("users")` at the table level. Any authenticated
session, including a free anonymous one, can create rows in it.

**Fix:** if profile rows are always provisioned server-side (they appear to be,
via `it-users.ts` and the admin API), drop `create("users")` entirely.

## M3. SVG upload into a public bucket on the Appwrite origin

`apps/admin/src/lib/inline-media.ts:38`, `media` bucket config

`image/svg+xml` is an accepted upload type. The `media` bucket is `read("any")`,
with `antivirus: false` and `encryption: false`. Files are served from
`appwrite.biso.no` — the same origin as the Appwrite API and its session
cookies. An SVG is an active document; fetched directly, it executes script on
that origin.

The upload route itself (`apps/admin/src/app/api/media/upload/route.ts`) is
otherwise well built — auth check, dual size limits, filename sanitization,
MIME/extension agreement.

**Fix:** drop `svg` from the accepted types, or rasterize on upload. Turn on
antivirus for the bucket.

## M4. `documents` bucket accepts any file type at 100 MB, publicly readable

`allowedFileExtensions: []` (no restriction), `maximumFileSize: 100000000`,
`read("any")`. Encryption and antivirus are on, which is good. But an unrestricted
public bucket is a hosting service for whatever gets uploaded into it.

**Fix:** set an explicit extension allowlist.

## M5. Guest orders fall back to `read("any")`

`packages/shared/utils/vipps-order-ops.ts:108-114`

```ts
function buildOrderPermissions(userId: string): string[] {
  if (userId && userId !== "guest") {
    return [Permission.read(Role.user(userId))];
  }
  return [Permission.read(Role.any())];
}
```

Guest orders are world-readable by row ID. Orders hold `buyer_name`,
`buyer_email`, `buyer_phone`, totals, `payment_intent_id`, and
`payment_receipt_url`. Table-level read is restricted to Operations Unit, so
these cannot be *listed* — the only protection is that `ID.unique()` is
unguessable.

That is security through obscurity on payment PII. It is deliberate and
documented, so I am reporting it as a decision to re-confirm rather than a bug:
order IDs travel through email, browser history, and support tickets.

**Fix:** provision an anonymous session before creating a guest order (the code
already does this for cart reservations at `orders.ts:578`) and scope the read
to that user. Failing that, a short-lived signed token on the confirmation URL.

## M6. Appwrite auth policy is loose

`settings.auth.security` — sessions last **365 days** (`duration: 31536000`),
`passwordDictionary: false`, `personalDataCheck: false`, `sessionAlerts: false`.

For an admin surface that manages Azure AD accounts, licenses, MFA resets, and
payment credentials, a one-year session with common passwords permitted is more
than I would want.

**Fix:** enable the password dictionary and personal-data check; shorten session
duration meaningfully for admin.

## M7. Approval decisions record a client-supplied approver name

`apps/api/src/app/api/expenses/approve/route.ts:39,55`

`decidedBy` comes from the request body and is written to the audit trail
unchanged (defaulting to `"Web approver"`). Whoever holds the link chooses the
name that appears against the decision.

The token design itself is good — see "What's solid" below — so this is an
audit-integrity gap, not an authorization one.

**Fix:** derive the approver from the token's `approver_email` rather than the
body.

---

# Performance

## P1. N+1 query patterns — 32 sites

Sequential `await` on a DB/Graph/fetch call inside a loop. Highest counts:

| Count | File |
|---|---|
| 5 | `apps/web/src/app/actions/cart-reservations.ts` |
| 3 | `apps/admin/src/app/(portal)/_actions/shop.ts` |
| 3 | `packages/shared/utils/vipps-order-ops.ts` |
| 2 | `apps/admin/src/lib/announcements/send.ts` |
| 2 | `packages/shared/recruitment.ts` |

Most are admin or cron paths where latency is tolerable. The ones worth fixing
are `cart-reservations.ts` and `vipps-order-ops.ts`, because they sit on the
checkout path where added latency costs conversions.

**Fix:** batch with `Query.equal("$id", [...])` where the loop is a lookup, or
`Promise.all` where the calls are genuinely independent.

## P2. 274 `listRows` calls, many without an explicit limit

Appwrite defaults to 25 rows, so unbounded calls silently truncate rather than
blow up — which is the more dangerous failure mode, since a "working" page just
quietly stops showing rows 26+. There are also 14 `Query.limit(1000)` and 10
`Query.limit(500)` calls; those are real payloads to serialize across the RSC
boundary.

**Fix:** set limits explicitly everywhere, and paginate the 500/1000 cases.

---

# What's solid

Worth stating plainly, because it is a lot, and it means the codebase is in
better shape than the list above suggests:

- **Payment webhook verification is correct.** `verifyVippsWebhookSignature`
  (`packages/payment/src/vipps/webhook.ts:81`) validates the content SHA-256 and
  the HMAC over the signed string, both with `timingSafeEqual`, and fails closed
  on any missing header. Stripe goes through `verifyStripeWebhook`.
- **Expense approval tokens are well designed.** 192 bits from `randomBytes(24)`,
  SHA-256 hashed at rest, TTL-bounded, single-use via an atomic conditional
  update, and re-issued rather than recoverable.
- **CORS is a strict allowlist** with no wildcard and no origin reflection
  (`apps/api/src/lib/allowed-origins.ts`).
- **Admin authorization fails closed and handles outages correctly.**
  `getUserAuthContext` returns `null` on auth failure but rethrows on Appwrite
  5xx/timeout, so an outage does not silently degrade into "no permissions".
- **The IT module is granularly gated.** All 25 exported actions in
  `it-users.ts` call `requireItPermission` with a specific capability.
- **Row ACLs never grant write.** `buildContentRowPermissions`,
  `buildPageRowPermissions`, and the translation builders grant read only, with
  the reasoning documented in-comment. Authoring goes through the admin client
  behind role checks. This is the right model — C2 is a config drift *from* it.
- **No committed secrets and no secret values logged.** The `sk_live_` hits are
  prefix validation; the logging hits print presence booleans, not values.
- **Cron secrets use `timingSafeEqual`** (`packages/shared/utils/secrets.ts:18`).
- **Media upload is well guarded** — auth, dual size checks, filename
  sanitization, MIME/extension agreement.

---

# Suggested order

1. **C3** — add security headers to `web` and `api`. ~15 lines, no risk.
2. **C1** — put auth on the board route, or strip the PII from its response.
3. **C2** — remove the four `update("users")`/`delete("users")` grants in the
   Appwrite console, then add the repo-wide permission invariant test.
4. **H1** — rate-limit `/api/expenses/ocr` at minimum, before it costs money.
5. **H3 + H4** — sanitize in `PlateContentRenderer`; allowlist `href` schemes.
6. **H2** — validate department membership on expense submit.
7. **M1, M2, M3** — cheap hardening, low risk.
8. The rest as time allows; none of them should hold the launch.

Items 1–4 are all small, self-contained changes. None of them require
architectural work, and C2 is a console change rather than a code change.
