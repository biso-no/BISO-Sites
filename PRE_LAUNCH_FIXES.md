# Pre-Launch Fixes

What changed in response to `PRE_LAUNCH_SECURITY_REVIEW.md`, what is deliberately
left open, and the two things only you can do.

Verified on this branch: `check-types` clean for `web`/`admin`/`api`,
`bun run test` 828 passing across 7 packages, all three apps compile,
`ultracite check` clean.

---

## Two owner actions — the code is not enough on its own

**1. Push the Appwrite config.** Every permission change lives in
`packages/api/appwrite.config.json` and does nothing until you push it:

```bash
appwrite push settings      # auth policy (session lifetime, password rules)
appwrite push tables        # table permissions
appwrite push buckets       # bucket extension allowlist
```

Until then the live project still has `update("users")` / `delete("users")` on
four tables. **This is the single highest-value step in this branch.**

**2. Backfill `user.department_ids`.** The expense scope check (H2) enforces
department membership only for users whose profile actually lists departments.
`m365-sync.ts:205` writes `?? []`, so users provisioned through that path have
none and are allowed through with a `[expense-scope]` warning logged. Backfill
the column, then delete the `knownDepartments.length === 0` branch in
`apps/api/src/lib/expense-ownership.ts` to make it strict.

---

## Fixed

### C1 — Staff directory PII
`apps/api/.../board/route.ts`

Kept public, as you confirmed it should be. `email` and `phone` are now stripped
from the response for unauthenticated callers; signed-in callers still get the
full record, so anything in the app showing contact details keeps working.

The web campus page was already discarding both fields (`mapToDepartmentBoard`
keeps only name, role, photo), so nothing visible changes there. Both are still
fetched from Graph because they are needed server-side — email keys the photo
lookup and the manager-first sort.

An anonymous Appwrite session does not count as authenticated for this check; a
real account always carries an email.

### C2 — Table permissions
`packages/api/appwrite.config.json`

- `content_entries`, `content_entry_locales`: `update("users")` / `delete("users")`
  removed, replaced with the same staff create-grants the live content tables use.
- `teams`, `typing_indicators`: reduced to `read("any")`, service-only writes.
- `user`: `create("users")` removed. All three creation sites use
  `createAdminClient()`, so nothing legitimate needed it.

Two regression tests added to `appwrite-config-permissions.test.ts` — the
existing ones only covered the seven recruitment tables, which is why this
drifted:

- no table may grant `create`/`update`/`delete`/`write` to `any` or `users`
  (with an explicit, currently-empty allowlist for documented exceptions);
- a table granting one campus-management team must grant all four.

### Stavanger campus management was locked out — found while fixing C2

Not in the original review. `campus-constants.ts:57` generates
`sg-app-dept-ledelsen${campus}`, and `CAMPUS_NAME_TO_ID` includes Stavanger, but
**no table granted `sg-app-dept-ledelsenstavanger` anything**. Oslo, Bergen and
Trondheim were all present.

Stavanger campus management could not create news, events, pages,
page_translations, content_translations, webshop_products, or product_variations.
The grant is added to all seven. This is a functional bug, not a security one —
worth a smoke test with a Stavanger account after you push the config.

### C3 — Security headers
`apps/web/next.config.ts`, `apps/api/next.config.ts`

Both now send `X-Frame-Options`, `frame-ancestors`, `nosniff`, `Referrer-Policy`
and HSTS; web also sends `Permissions-Policy`, api sends `default-src 'none'`.

A full CSP is still not shipped — it needs per-route nonces for Next's inline
runtime and getting it wrong breaks the payment redirects. `frame-ancestors` is
the one directive safe to ship alone, and it is the part that matters for
clickjacking a checkout.

### H1 — Rate limiting
`packages/shared/utils/rate-limit.ts`, `apps/api/src/lib/rate-limit.ts`

Sliding-window limiter, keyed on account id where known and caller IP otherwise.
Budgets are named in one place rather than scattered as numbers in routes.

| Endpoint | Budget |
|---|---|
| `POST /api/expenses/ocr` | 10/min, 40/hour |
| `POST /api/expenses/submit` | 10/min, 60/hour |
| `POST /api/expenses/draft` | 60/min |
| checkout + membership-checkout | 15/min, 60/hour |
| `POST /api/form/submit` (web, anonymous) | 5/min, 30/hour |

OCR is sized for the workflow you described — someone sitting down to file a
stack of receipts — not for one submission. Ten in a minute absorbs the burst;
forty in an hour is well past any honest session. Checkout is deliberately loose
so a buyer retrying a declined card is never told to come back later.

**Known limitation, stated plainly:** state is per process. With N instances the
effective ceiling is N x limit, and a cold start clears the window. This bounds
cost and runaway clients, not a distributed attacker. Swapping in Redis means
replacing `consume()` and nothing else — every caller goes through it.

### H2 — Expense department spoofing
`apps/api/src/lib/expense-ownership.ts`

The approval chain resolves approvers from the campus/department on the payload,
which was validated only as `z.string().min(1)`. Now, on every submission:

- the department must exist and sit on the claimed campus — always, for everyone;
- if the profile lists departments, membership is enforced (403);
- if it does not, the submission proceeds and logs a warning (see owner action 2).

Graduated rather than strict because hard-gating on `department_ids` would break
reimbursements at launch for every user provisioned with an empty list. Three
tests cover the reject, the cross-campus reject, and the empty-profile allow.

### H3 — Unsanitized HTML on public pages
`packages/ui/lib/sanitize-html.ts`, `plate-content-renderer.tsx`

News articles, event descriptions and job listings were injected raw on the
justification that content is "authored by trusted admins". Both branches now run
through DOMPurify with an allowlist generous enough for everything the Plate
serializer and Job Studio emit. `isomorphic-dompurify` supplies a DOM on the
server, so it holds in RSC and in the browser.

The JSON path is sanitized too — `toHtml` serializes stored content verbatim, so
it is only as safe as whatever reached the database.

### H4 — `javascript:` hrefs in the editor sanitizer
`packages/editor/src/lib/sanitize.ts`

`href` was preserved on `<a>` with no scheme check, and it is the only attribute
this sanitizer keeps — so it was the one way through. Now allowlisted to
`http(s)`, `mailto`, `tel`, and relative/in-page links, with URL-ignored
characters stripped first so `java<TAB>script:` cannot smuggle past.

Also found while testing: disallowed tags were *unwrapped*, so
`<script>alert(1)</script>` left `alert(1)` as visible article text. Script-like
elements are now dropped with their contents; `<div>`/`<h1>` still unwrap. Eight
tests added.

### Open mail relay — found while adding rate limiting
`apps/web/src/app/api/form/submit/route.ts`

Not in the original review, and the most serious thing found in this pass.

`POST /api/form/submit` is unauthenticated by design. In `mode: "email"` it sent
an HTML message to a **caller-supplied `recipientEmail`**, with the body built
from caller-supplied `data`, through BISO's Appwrite messaging. Anyone could mail
anyone, from your sending identity. Body content was HTML-escaped, so this was
not HTML injection — it was a spam and phishing relay against your domain
reputation.

The recipient is configured by an editor in the block inspector and then sent
back by the browser, so it cannot be trusted as received. It is now constrained
to the org domain (`M365_DOMAIN`, default `biso.no`), which is what makes the
untrusted value safe: the worst case is mailing a BISO inbox, bounded by the new
5/min limit. `accessTeamId` — also caller-supplied, also written straight into a
row ACL — is now shape-checked.

To close it fully, resolve the recipient from the stored page document instead of
the request body.

### M1 — Server Actions exposed by accident
`apps/admin/src/lib/team-provisioning.ts`

The file was `"use server"`, which makes every export a callable endpoint with a
public action id. `grantDeptTeamAccess` takes a caller-supplied `teamId` and
grants it update/delete on department rows via the admin client. Both exports are
internal helpers called only from `m365-sync.ts`; the directive is removed.

`import "server-only"` would be the belt-and-braces addition but its entry throws
under bun test and breaks `team-provisioning.test.ts`. Dropping `"use server"` is
what actually closes the exposure.

### M3 — SVG uploads

Initially blocked, then reverted: `appwrite-config.test.ts` requires svg as an
approved publishing extension, and the admin UI genuinely offers it
(`image-upload-field.tsx`) — logos need it. Removing it would have broken a real
workflow.

Instead SVG is **sanitized at upload** (`sanitizeSvgUpload` in
`inline-media.ts`), stripping script, event handlers, `foreignObject` and
external references before the bytes are stored. Antivirus is enabled on the
media bucket. The capability is kept; the stored bytes are made safe.

### M4 / M5 / M6 / M7

- `documents` bucket: open extension policy (`[]`, 100 MB, `read("any")`)
  replaced with an allowlist.
- Guest orders no longer fall back to `read("any")`. Both checkout routes 401
  before creating an order, so `"guest"` was already unreachable — the branch now
  returns no permissions (service-only) instead of exposing buyer name, email,
  phone, totals and receipt URL to anyone with the row id.
- Auth policy: session lifetime 365d → 30d; password dictionary, personal-data
  check and session alerts enabled.
- Expense approvals no longer accept a client-supplied approver name. `decidedBy`
  is optional now and falls back to the step's own `approver_email`; the Teams
  bot still passes its Bot Framework-verified sender.

### Incidental fixes

- `/api/expenses/ocr` returned 500 instead of 401 when unauthenticated —
  `account.get()` throws rather than returning null and sat outside the `try`.
- `@repo/editor` had no `test` script, so its tests would not have run in CI.
  Added, along with vitest + jsdom.
- `isomorphic-dompurify` was declared in the root manifest by `bun add --filter`;
  moved into the catalog and declared by the two packages that import it.

---

## Deliberately not done

- **A full Content-Security-Policy.** Needs per-route nonces; a wrong CSP breaks
  payment redirects. `frame-ancestors` covers the clickjacking case.
- **Strict department enforcement.** Blocked on the `department_ids` backfill.
- **Resolving the form recipient from the page document.** The domain constraint
  removes the external threat; this removes the trust question entirely.
- **P1 / P2 from the review** (32 N+1 sites, 274 unbounded `listRows`).
  Performance, not security, and the checkout-path ones deserve measurement
  rather than speculative batching.
- **Deleting the four dead tables.** They are now harmless. Whether
  `content_entries` is a planned schema or abandoned is your call.

---

## Suggested verification after pushing the config

1. Sign in as a **Stavanger** campus-management account and create a news item.
2. Submit one reimbursement end to end — receipt scan, submit, approve via the
   emailed link. Check the approval row records the approver's email.
3. One real checkout round-trip, and confirm the buyer can load their
   confirmation page.
4. Load a news article and a job listing; confirm formatting is intact after
   sanitization.
5. Upload an SVG logo in admin and confirm it renders.
6. `curl -sI https://biso.no | grep -i -E 'x-frame|strict-transport|nosniff'`.
