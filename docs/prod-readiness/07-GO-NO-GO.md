# Production-Readiness — Go / No-Go Verdict

_Runtime-behaviour audit (S05–S09), 2026-07-02. Reflects the six runtime lanes
(payments, auth lifecycle, Appwrite runtime, Next.js/Bun runtime, failure modes)
plus the S01–S04 findings. Finding IDs reference `02-FINDINGS.md`._

## Verdict: **NO-GO** for a week of unattended real traffic

The platform is **not yet safe to run for a week straight** under real payment
volume and real failure conditions. There is one newly-confirmed way to take
money fraudulently, several ways the site goes fully down when a single upstream
is slow, and effectively **no way to see any of it happen** (no error tracking).
None of these are exotic — they trigger on ordinary launch-week conditions: a
Vipps slowdown, an Appwrite hiccup, a mobile buyer who doesn't return to the
site, a popular product near sell-out, or a curious user with a browser console.

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
| 1 | **PR-032** | Checkout API takes a **client-supplied amount with no authentication** | `POST /api/payment/{provider}/checkout` uses the admin client, reads `userId` from the body, and charges `body.total` with no server-side price recomputation. CORS is not a gate. Anyone POSTs a real product with `total: 1`, pays 1 NOK, gets fulfilled. Vipps is **live** at launch. | ✅ in code |
| 2 | **PR-033** | `orders` collection grants `create("any")` | Any client with the (public) Appwrite endpoint can insert an order row with `status: "paid"` and arbitrary `total`/`items`. Forged paid orders pollute accounting + purchase limits. The legit flow uses the admin client, so the grant is **safe to remove**. | ✅ in code |
| 3 | **PR-015** | M365 user provisioning never assigns Azure security-group membership | Pre-existing (S03). A newly-provisioned user lands with **zero authorization** — the whole role chain depends on group membership that is never written. | ✅ (S03) |
| 4 | **PR-017** | 31 of 82 Appwrite collections grant over-permissive `create()` | Pre-existing (S03). Document-level permissions are load-bearing because collection grants are wide open. PR-033 and PR-034 are concrete money exploits of this exact gap. | ✅ (S03) |
| — | **PR-034** | Forged pre-"approved" expense payouts (**conditional blocker**) | `expense`/`expense_attachments` grant `create("users")`; a logged-in student can create an expense row with `status: "approved"` and their own `bank_account`, and the payout cron never verifies an approval chain — it trusts the row's status. **Gated by `expenses_ledger_posting`, which defaults OFF.** Not launch-live, but a **hard gate: do not enable that flag** until the create grant is removed and `postApprovedExpense` verifies the `expense_approvals` chain. | ✅ in code |

**Blocker count: 4 live (PR-032, PR-033, PR-015, PR-017) + 1 conditional (PR-034).**

---

## 2. High-severity — not formal blockers, but will bite in week 1 under real traffic

These don't corrupt money on their own, but each produces an outage, silent data
divergence, or a stuck user under ordinary launch conditions. Treat as
fix-before-launch-or-immediately-after, with monitoring in place either way.

**Resilience / "site goes down when one upstream is slow":**
- **PR-046** — node-appwrite has **no request timeout** and rebuilds its connection pool every call (205+ sites). A slow self-hosted Appwrite hangs every in-flight render. This is the single biggest availability risk.
- **PR-047** — the Vipps checkout chain (web action → api route → SDK) has **no deadline at any hop**. Vipps slowness freezes checkout indefinitely.
- **PR-050** — every public page view by a logged-in member fires a **synchronous, timeout-less 24SevenOffice SOAP call** (the membership cookie cache can't be written from RSC render). 24SO slow = whole site slow for members.
- **PR-049** — two unguarded fetches (`getPartners`, `getCampuses`) send the **entire public homepage** to the error page on any Appwrite blip, while every sibling fetch degrades gracefully.
- **PR-048** — **zero error tracking / structured logging.** Every failure below is invisible in production. This is an operational blocker: launch week would be blind. Add Sentry (or at minimum `onRequestError`) first — it converts every other finding from "silent" to "pageable."

**Money-path integrity (Vipps live):**
- **PR-039** — Finago (24SO) revenue posting happens **only** on the unauthenticated return route, with a non-atomic sentinel that clears on unknown outcomes, and the `finago_transaction_id`/`finago_account_number` columns appear **absent from the schema config**. Duplicate or omitted ledger entries; mobile buyers who never return produce **no ledger entry ever**. (Column existence is an owner live-check — if absent, this is its own blocker.)
- **PR-038** — **no reconciliation cron** for captured-but-diverged / webhook-dead orders. If the webhook secret is wrong or a buyer doesn't return, money is captured but the order is stuck `pending` forever.
- **PR-035** — stock decrement is a **non-atomic read-modify-write invoked from three concurrent entry points** (webhook, return route, public `verifyOrder`). Common launch path (webhook fires as the app redirects) double-decrements or loses updates; `Math.max(0,…)` masks oversell silently.
- **PR-036** — `getAvailableStock` subtracts the buyer's **own** reservation, so checkout requires `stock ≥ otherHolds + 2×qty` → the **last units of any limited product are unsellable**. Exactly the merch-drop scenario the shop exists for.
- **PR-037** — the post-payment reservation cleanup uses **legacy string query syntax** that current node-appwrite rejects; it fails silently on every paid order, leaving stale holds that suppress others' purchases for ~10 min.

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
1. PR-032 — authenticate the checkout route and recompute the amount server-side from product rows; reject client/server mismatch.
2. PR-033 — remove `create("any")` from `orders` (safe — legit flow uses the admin client).
3. PR-015 — assign Azure security-group membership during M365 provisioning.
4. PR-017 — tighten the 31 over-permissive collections to least-privilege (this also closes PR-033/PR-034's root cause).
5. **Do not enable `expenses_ledger_posting`** until PR-034 is fixed.

**Should close before launch (or launch with monitoring + a rollback plan):**
6. PR-048 — add error tracking (unblocks visibility into everything else).
7. PR-046 / PR-047 / PR-050 — add timeouts to Appwrite, the Vipps chain, and 24SO SOAP; treat 24SO as enrichment, not a render dependency.
8. PR-049 — wrap `getPartners`/`getCampuses` in the graceful-degradation pattern the siblings already use.
9. PR-039 / PR-038 / PR-035 / PR-036 / PR-037 — move Finago posting off the return-route-only path, add a reconciliation cron, make stock adjustment atomic (copy the expense claim-lock pattern), fix the last-units and reservation-cleanup bugs.
10. PR-058 — implement an offboarding hook (disable + delete sessions + prune memberships).

**Verify live (owner):** the six checks in §4.

Once the blockers close, the two red gates (`C7`, `F5`) plus the money-path gates
(`D1`–`D4`) and data-integrity gates can be re-evaluated. The realistic timeline
is a few focused days of remediation plus the live-console verification — not a
launch this week without at least the blockers and the observability gap closed.
