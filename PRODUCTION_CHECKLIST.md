# Production Checklist — Items Requiring Human Attention

Remaining items from the production-readiness audit that need a decision,
external configuration, or staging verification. Code-level fixes are
complete — see `AUDIT_LOG.md` for the full record.

## 1. Decisions only you can make

- **API label-based admin gating vs. documented policy.**
  `apps/api/src/lib/admin-auth.ts#getAdminScope` grants global admin to
  users with an `admin` or `globaladmin` **label**, while
  `apps/admin/CLAUDE.md` states labels must never be used for role
  checks (admin's own code never does). Decide: remove the label check
  from the API (may lock out anyone relying on labels), or amend the
  policy. Until then the two services disagree about who is a global
  admin.
- **`departures/sync` accepts the secret as a `?secret=` query
  parameter.** Query strings land in access logs and proxies. The other
  sync routes are header-only. Removing it is a one-line change but will
  break any cron currently configured with the query param — migrate the
  caller first.
- **Localhost origins ship in the production CORS/proxy allowlists**
  (`apps/api/src/lib/cors.ts`, `apps/api/src/proxy.ts`). Low risk
  (only exploitable by software already running on a user's machine),
  but trivially removable if you gate the dev origins on `NODE_ENV`.

## 2. CI / infrastructure configuration

- **Nothing gates type errors before deploys.** `web` and `api` set
  `typescript.ignoreBuildErrors: true`, and
  `.github/workflows/deploy-production.yml` never runs
  `bun run check-types` or `bun run lint`. Add a check-types (and
  ideally knip) step before the deploy job — this audit found a broken
  production page (`/shop/order/[orderId]`) that no existing gate could
  have caught.
- **`docs` type-check fails in fresh clones** because fumadocs generates
  `.source/` at build time. Either add a `postinstall`/pre-step that
  runs the fumadocs generator, or exclude docs from check-types in CI
  with a comment.
- **`CRON_SECRET` must be set in production** — the web cron route
  correctly refuses to run without it (500), and the admin announcements
  dispatch route requires it too. Confirm both are configured, plus
  `ENTUR_SYNC_SECRET` / `TICKSTER_SYNC_SECRET` for the api sync routes.
- **Confirm a scheduler actually calls
  `/api/cron/cleanup-reservations`** (every ~15 min recommended). The
  endpoint was silently broken until this audit (session client with no
  session); now that it works, its **first run may delete a large
  backlog** of expired reservations — expect a spike.

## 3. Staging verification for behavioral fixes

These audit fixes intentionally change behavior; verify them in staging:

- `/shop/order/[orderId]` renders after a real Vipps checkout (was
  broken: sync `params` under Next 16).
- Available-stock numbers now subtract **all** users' reservations
  (admin-client aggregation). Watch for products that previously
  appeared in stock now correctly showing reserved-out.
- Purchase limits now count beyond 25 historical orders.
- Admin UI now grants campus-admin to legacy `LedelsenOslo`-style team
  names (previously only the api accepted them).
- Cron/sync endpoints still authenticate (now constant-time comparison —
  the secret must match exactly, including whitespace).

## 4. Known-accepted limitations (documented, not fixed)

- **Finago double-post window** in `/api/checkout/return`: sentinel +
  rollback mitigation; Appwrite has no atomic check-and-set, so a
  millisecond race remains under concurrent return-redirects.
- **Reservation check-then-act races**: availability check and
  reservation write are not transactional; brief oversubscription under
  simultaneous checkouts is possible. Consider an Appwrite Function with
  a queue if this becomes real.
- **Web action result shapes are mixed per feature** (`{success}` vs
  `{error}` vs raw data). Canonical shape for new actions is documented
  in `apps/web/CLAUDE.md`; retrofitting old ones was judged churn.

## 5. Test coverage gap

Only 4 vitest files exist (api lib helpers). There are **no tests for
auth enforcement** (JWT validation, campus scoping, route gating) in any
app — every regression in those paths ships silently today. The highest-
value first tests: `@repo/shared/utils/team-roles` (pure functions, easy
wins), api `getAdminScope`, and the web checkout/purchase-limit actions.

## 6. Deferred cleanups (optional, non-blocking)

- Studio-editor stage-2 dedup: `LocaleTabs` ×4, `FieldLabel` ×3,
  `StepRail` ×3, `CoverPattern` ×3, `BRAND` palette ×6 (~990 duplicated
  lines remain across the admin studio files).
- `generateSlug` in the three studio editors still differs slightly from
  `lib/utils#sanitizeSlug` (no trailing-dash strip) — unify when next
  touching those files.
- One TODO remains: wire `useAssistant` in `event-studio-editor.tsx`
  (planned feature).
- Remaining `knip.json` ignores (`member-portal/**`, `lib/types/**`)
  mask some unused type exports — worth a knip run after removing them.

---

# Risk Assessment — Three Highest-Risk Areas

1. **The payment/checkout path (web → Vipps → Finago → reservations).**
   It moves money, it spans three external systems, it has two known
   (accepted) race windows, and it has zero automated tests. This audit
   fixed four high-severity bugs in this exact area — the density of
   defects found here is itself the strongest signal. Any future change
   to `orders.ts`, `cart-reservations.ts`, `purchase-limits.ts`, or the
   checkout routes deserves a staging Vipps test run, not just review.

2. **Authorization sprawl across three models with no tests.** Web
   (anonymous-session + email heuristic), admin (Azure-AD team parsing →
   roles → campus scoping), and api (JWT + scope) each enforce access
   differently, the label-gating policy conflict is still open, and
   nothing executes these paths in CI. The Phase 1 consolidation
   (`@repo/shared/utils/team-roles`) reduced drift, but a wrong campus
   filter still means silent cross-campus data exposure in a 60-table
   database.

3. **The admin studio monoliths (~15k lines across 6 client files).**
   They are the most-edited, least-reviewable surface: 2,000–4,500-line
   client components with autosave, translations, uploads, and publish
   state. Phase 1 removed ~1,800 duplicated lines, but the remaining
   duplication means fixes applied to one editor still routinely miss
   the others, and `tsc` is the only net under them.
