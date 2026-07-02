# Production-Readiness — Go / No-Go Verdict

_Runtime-behaviour audit (S05–S09), 2026-07-02. Reflects the six runtime lanes
(payments, auth lifecycle, Appwrite runtime, Next.js/Bun runtime, failure modes)
plus the S01–S04 findings. Finding IDs reference `02-FINDINGS.md`._

## Verdict: **NO-GO** for a week of unattended real traffic

The platform is **not yet safe to run for a week straight** under real payment
volume and real failure conditions. The PR-032 unauthenticated client-amount
checkout hole and the PR-033/PR-015/PR-017/PR-034 permission/provisioning items
have been code/config-remediated locally, but they still need owner live
verification after deploy/schema push. The remaining money-path failure-mode
gaps still block launch. Several ways remain for the site to go fully down when
a single upstream is slow. PR-048 now adds minimal structured `onRequestError`
server logs in every Next app, but launch-week visibility still depends on a
real deploy log drain/retention/alerting path or a Sentry/OTel sink. None of
these are exotic — they trigger on ordinary launch-week conditions: a Vipps
slowdown, an Appwrite hiccup, a mobile buyer who doesn't return to the site, a
popular product near sell-out, or a curious user with a browser console.

The good news: the hardest-engineered flow (expense approval/posting) is genuinely
solid and is the correct model for fixing the order pipeline, the Vipps webhook
crypto is correct, and there is **no cross-user cache leak**. The gaps are
fixable in days, not weeks — they are concentrated, not systemic.

**Confidence:** the money-path and permission blockers below were verified
directly in code by the orchestrator against `appwrite.config.json` and the
route handlers. Items marked NEEDS-LIVE-CHECK require the live Appwrite console /
Vipps portal / Stripe dashboard and are listed as owner actions — do not assume
they pass.

---

## 1. Launch blockers — must fix before go (ordered by severity)

| # | ID | Blocker | Why it blocks | Verified |
|---|----|---------|---------------|----------|
| 1 | **PR-032** | Checkout API took a **client-supplied amount with no authentication** | **Code-remediated locally 2026-07-02, pending owner live smoke.** Checkout now requires an Appwrite JWT, derives `userId` from `account.get()`, recomputes trusted product totals server-side, and rejects mismatches before order/provider creation. | ✅ local tests/typecheck/lint; live smoke pending |
| 2 | **PR-033** | `orders` collection granted `create("any")` | **Code/config-remediated locally 2026-07-02, pending owner live Appwrite verification.** Source config removed the anonymous create grant; targeted order tests prove the legit flow still creates through the admin client with buyer read permission. | ✅ local tests/checks; live permission check pending |
| 3 | **PR-015** | M365 user provisioning never assigned Azure security-group membership | **Code-remediated locally 2026-07-02, pending owner Azure tenant verification.** New M365 user creation now resolves and assigns required campus/department security groups before success. | ✅ local test/checks; live Azure test pending |
| 4 | **PR-017** | 31 of 82 Appwrite collections granted over-permissive `create()` | **Code/config-remediated locally 2026-07-02, pending owner live Appwrite verification.** Source config now has zero `create("any")` / `create("users")`; legitimate self-service creates moved behind admin server writes with row permissions. | ✅ local tests/checks; live permission check pending |
| — | **PR-034** | Forged pre-"approved" expense payouts (**conditional blocker**) | **Code/config-remediated locally 2026-07-02, pending owner live Appwrite + approval/posting smoke.** Expense broad create grants removed; draft/submit create through admin with submitter row permissions; posting verifies a fully approved chain first. Keep `expenses_ledger_posting` OFF until live verification. | ✅ local tests/checks; live smoke pending |

**Blocker count:** PR-032/033/015/017 and gated PR-034 are locally remediated
but not fully closed until owner live verification completes.

---

## 2. High-severity — not formal blockers, but will bite in week 1 under real traffic

These don't corrupt money on their own, but each produces an outage, silent data
divergence, or a stuck user under ordinary launch conditions. Treat as
fix-before-launch-or-immediately-after, with monitoring in place either way.

**Resilience / "site goes down when one upstream is slow":**
- **PR-046** — code-remediated locally on 2026-07-02: server Appwrite clients now inject per-call deadlines and reuse shared transport objects. Deploy/runtime smoke pending.
- **PR-047** — checkout-chain code-remediated locally on 2026-07-02: the web→api checkout fetch aborts on deadline and the api route returns 504 when Vipps checkout creation stalls. Other Vipps SDK maintenance paths should still get explicit deadlines when touched.
- **PR-050** — timeout/fallback code-remediated locally on 2026-07-02: membership Finago lookup now has a deadline and falls back to `finago_error`; server-side membership caching remains an open follow-up.
- **PR-049** — two unguarded homepage fetches (`getPartners`, `getCampuses`) are now code-remediated locally with the sibling graceful-degradation pattern (`return []` on Appwrite failure).
- **PR-048** — minimal structured `onRequestError` server logging is now code-remediated in all four Next apps, with sensitive-header redaction. This improves production forensics but is not yet external error tracking; owner/deploy still needs log retention/alerting or Sentry/OTel to make incidents pageable.

**Money-path integrity (Vipps live):**
- **PR-039** — Finago (24SO) revenue posting happens **only** on the unauthenticated return route, with a non-atomic sentinel that clears on unknown outcomes, and the `finago_transaction_id`/`finago_account_number` columns appear **absent from the schema config**. Duplicate or omitted ledger entries; mobile buyers who never return produce **no ledger entry ever**. (Column existence is an owner live-check — if absent, this is its own blocker.)
- **PR-038** — **no reconciliation cron** for captured-but-diverged / webhook-dead orders. If the webhook secret is wrong or a buyer doesn't return, money is captured but the order is stuck `pending` forever.
- **PR-035** — stock decrement is a **non-atomic read-modify-write invoked from three concurrent entry points** (webhook, return route, public `verifyOrder`). Common launch path (webhook fires as the app redirects) double-decrements or loses updates; `Math.max(0,…)` masks oversell silently.
- **PR-036** — `getAvailableStock` subtracts the buyer's **own** reservation, so checkout requires `stock ≥ otherHolds + 2×qty` → the **last units of any limited product are unsellable**. Exactly the merch-drop scenario the shop exists for.
- **PR-037** — query syntax code-remediated locally on 2026-07-02: paid-transition reservation cleanup now uses structured `Query.equal`; limit/product scoping and deployed paid-order smoke remain follow-up.

**Auth lifecycle:**
- **PR-058** — offboarded Azure staff **keep full CMS/campus access for up to a year**: role sync is add-only, sessions last 365 days, nothing invalidates them. Operationally urgent given semester turnover.
- **PR-059 / PR-060** — booking-token reuse race creates **duplicate interviews**, and there's **no interview-slot uniqueness** so two candidates can book the same instant. Recruitment is the largest admin feature.
- **PR-061** — a dead anonymous-session cookie has **no recovery path**: after the cleanup cron deletes the idle anon user, the returning visitor's `add-to-cart is broken for up to 16 days` with no re-mint.
- **PR-075** — core authorization reads (`teams.list()`) and member detection (`memberships` list) are **truncated at 25 rows** with no limit → users in >25 teams silently lose roles; paying members past row 25 are misclassified as non-members.

**Storage:**
- **PR-079** — the `resumes` bucket has `create("any")` + no extension allowlist + 100 MB max, guarded only in app code → **anonymous 100 MB arbitrary-file uploads** via the storage API directly; two buckets are missing from config; no `deleteFile` exists anywhere so files leak forever.

**Build-time env (owner-verifiable):**
- **PR-085** — `NEXT_PUBLIC_*` values are baked at build time per app; a missing/misnamed build-env var silently ships `localhost:3003` / the wrong project id into the immutable client bundle. Naming drift makes this likely. **Verify each app's Appwrite build env before launch.**

---

## 3. What is verified sound (positive assurance for the go decision)

- **Expense approval + ledger posting** is the strongest flow in the codebase: atomic `incrementRowColumn` claim locks, stale-lease detection, no auto-repost after ambiguous failure, compensating release, reconcile-healing, hashed tokens with unique indexes and TTLs. It is the reference pattern for fixing the order pipeline.
- **Vipps webhook signature verification** matches the documented scheme exactly (HMAC-SHA256 over `POST\n<pathAndQuery>\n<date>;<host>;<contentSha256>`, raw body, constant-time compare); duplicate/out-of-order webhooks are structurally harmless because reconcile re-fetches authoritative state; double-capture is prevented (fresh idempotency keys, capture-error→re-fetch fallback).
- **Stripe** signature verification uses the SDK on the raw body with the correct tolerance; Stripe's SDK retries are idempotency-keyed. (Stripe checkout is OFF at launch anyway.)
- **The legitimate web checkout action recomputes all prices server-side**, enforces stock, purchase limits, and member-discount verification — the amount hole is exclusively the exposed API route (PR-032).
- **No cross-user cache leak:** the root layout is `force-dynamic`, nothing is prerendered with per-user data, and the browser JWT cache is client-bundle-only. No `runtime = "edge"` anywhere; no Bun-only APIs in shipping code; pdfjs runs workerless.
- **Per-request Appwrite clients** don't leak sessions; admin roles are computed live per request (team revocation takes effect next request); constant-time cron-secret gating; open-redirect protection on callbacks.
- **Memory hygiene over a week is clean:** every module-scope cache is single-entry or fixed-key with a TTL; no per-request intervals/listeners; no unbounded in-memory growth. Payment credentials are encrypted at rest.
- **Payments feature-flag posture is fail-safe:** kill switches default ON, `payments_stripe` and `expenses_ledger_posting` default OFF, a missing/erroring flag table falls back to catalog defaults.

---

## 4. Owner actions requiring live verification (cannot be confirmed from the repo)

These gate the go decision and must be checked against the live console/portals —
see `05-OWNER-ACTIONS.md` for the full list. The highest-priority live checks:

1. **Appwrite console — collection permissions**: confirm live `$permissions` for `orders` (`create("any")`?), `expense`/`expense_attachments` (`create("users")`?), and the other 31 flagged tables (PR-017/PR-033/PR-034).
2. **Appwrite console — schema columns**: confirm `orders.finago_transaction_id` and `webshop_products.finago_account_number` exist (absent from config → PR-039 is worst-case).
3. **Vipps portal**: webhook registered for the live MSN, secret populated, registered URL host/path exactly match what the callback sees (a proxy rewriting Host breaks HMAC). Send a test payment, watch for 401s.
4. **Appwrite build env per app**: all four `NEXT_PUBLIC_*` set with canonical names (PR-085).
5. **Rate-limit posture**: `_APP_OPTIONS_ABUSE=enabled` and real client IPs forwarded through the proxy.
6. **Is `apps/api` (:3003) network-restricted or public?** Drives the exploitability of PR-032/PR-033 — but note both should be fixed regardless, since the checkout route is designed to be reachable by the browser.

---

## 5. Minimum path to GO

**Must close (launch blockers):**
1. PR-032/PR-033 — deploy and owner-smoke authenticated checkout plus live `orders` permissions.
2. PR-015 — owner-test a real Azure tenant user and verify required security-group membership is written.
3. PR-017 — push schema and owner-verify live Appwrite permissions have zero `create("any")` / `create("users")`.
4. PR-034 — owner-verify deployed expense schema and approval/posting smoke path.
5. **Do not enable `expenses_ledger_posting`** until PR-034 live verification is complete.

**Should close before launch (or launch with monitoring + a rollback plan):**
6. PR-048 — minimal `onRequestError` logging is code-remediated; connect deploy
   logs to retention/alerting or replace the sink with Sentry/OTel.
7. PR-046 / PR-047 / PR-050 — local timeout remediations are in place; verify after deploy and finish the remaining follow-ups (Vipps maintenance-path deadlines, server-side membership cache).
8. PR-049 — code-remediated locally; keep the graceful-degradation tests in
   place and verify after deploy with the rest of the web smoke.
9. PR-039 / PR-038 / PR-035 / PR-036 / PR-037 — move Finago posting off the return-route-only path, add a reconciliation cron, make stock adjustment atomic (copy the expense claim-lock pattern), fix the last-units bug, and finish reservation-cleanup hardening/live smoke.
10. PR-058 — implement an offboarding hook (disable + delete sessions + prune memberships).

**Verify live (owner):** the six checks in §4.

Once the blockers close, the two red gates (`C7`, `F5`) plus the money-path gates
(`D1`–`D4`) and data-integrity gates can be re-evaluated. The realistic timeline
is a few focused days of remediation plus the live-console verification — not a
launch this week without at least the blockers and the observability gap closed.
