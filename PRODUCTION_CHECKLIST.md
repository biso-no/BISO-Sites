# Production Checklist — Items Requiring Human Attention

Remaining items from the production-readiness audit that need a decision,
external configuration, or staging verification. Code-level fixes are
complete — see `AUDIT_LOG.md` for the full record.

## 1. Decisions only you can make

- **Confirm no production admin depended on Appwrite labels.**
  `apps/api/src/lib/admin-auth.ts#getAdminScope` now matches the admin
  policy: global admin is derived from `SG-App-Campus-National` plus
  `SG-App-Dept-OperationsUnit` team membership only. Appwrite labels
  such as `admin` or `globaladmin` no longer grant API global-admin
  authority. Before cutover, confirm real production admins have the
  correct Azure/Appwrite team memberships.

## 2. CI / infrastructure configuration

- **First production deploy after the CI gate change should be watched.**
  `.github/workflows/deploy-production.yml` now runs deploy-blocking
  `lint` for each affected app and `check-types` for each affected app
  plus its internal dependencies before upload. `web` and `api` still set
  `typescript.ignoreBuildErrors: true`, so this CI gate is the signal
  that prevents type regressions from shipping.
- **`docs` type-check fails in fresh clones** because fumadocs generates
  `.source/` at build time. Either add a `postinstall`/pre-step that
  runs the fumadocs generator, or exclude docs from check-types in CI
  with a comment.
- **Scheduler secrets must be set and sent as headers in production** —
  `CRON_SECRET` gates reservation cleanup, anonymous-user cleanup, and
  announcement dispatch; `ENTUR_SYNC_SECRET` / `TICKSTER_SYNC_SECRET`
  gate the api sync routes. The `departures/sync` route is now
  header-only like the other sync routes, so confirm no scheduler still
  calls it with `?secret=`.
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
- Cron/sync endpoints still authenticate with header secrets only (the
  secret must match exactly, including whitespace).
- API CORS still allows real BISO origins in production and localhost
  origins in local development only.

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
