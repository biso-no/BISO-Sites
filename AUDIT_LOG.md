# Production Readiness Audit Log

Multi-phase audit of the BISO-Sites monorepo. Branch:
`claude/production-readiness-audit-mygfse`.

---

## Phase 0 — Orientation (read-only)

- Mapped 4 apps (web ~35k LOC, admin ~21k, api ~2.5k, docs ~1k) and 9
  packages (~54k LOC). Package dependency graph verified acyclic;
  `@repo/api` is the base layer with the largest blast radius.
- Confirmed the `@repo/api` abstraction holds: zero direct
  `appwrite`/`node-appwrite` imports in app code.
- Three intentionally distinct auth models: web (anonymous-session proxy +
  `isAuthenticatedAccount`), admin (team-derived roles, layout gates,
  campus scoping), api (per-route JWT).
- Doc drift noted: root CLAUDE.md says "Next.js 15" (repo is on Next 16),
  and references "Puck" (editor is the in-house `@repo/editor`).

## Phase 1 — Duplication & redundancy

### Findings (verified by scripted scans + targeted diffs)

- **Dead code hidden from knip**: previous sessions added dead dirs to
  `knip.json`'s ignore list instead of deleting them.
- `apps/web/src/components/expense-v2/**` (2,015 LOC): zero importers.
  Stale `@public — consumed by expense-v2` comments in actions.
- `apps/web/src/components/shop/product/**` (9 files): zero importers.
- `apps/admin/src/app/actions/migration/**`: 4 one-time migration scripts,
  never called.
- Expense-v1 leftovers (wizard + 4 step files) unreachable; only
  `expense-card`/`expense-skeleton` still used.
- `createExpense`, `createExpenseAttachment`, `_updateExpense`,
  `_deleteExpense` in web `lib/actions/expense.ts` and
  `getCampusWithDepartments` in `app/actions/campus.ts`: zero callers
  (expense-v3 submits via the REST API instead).
- `@repo/payment/stripe`, `@repo/connectors/woocommerce`: entire modules
  unused.
- `@repo/shared/utils/vipps-client.ts`, `utils/membership-sync.ts`: zero
  importers (`vipps-pure.ts` is alive transitively via vipps-order-ops).
- 27 unimported `@repo/ui` files (sections/*, unused shadcn primitives,
  unused Plate node components, pickers, lib/tokens, ...) — each verified
  against `@platejs/*` false positives before deletion.
- 8 dead `_`-prefixed helpers in admin `authorization.ts` (plus a
  transitively dead permission-parsing section) and api `admin-auth.ts`.
- `requireAuth()` defined identically 16× across admin `(portal)/_actions`.
- `listCampuses` ×4 / `listDepartmentsForCampus` ×3 verbatim copies in
  admin `_actions` (one with a divergent limit of 100 vs 200).
- Admin "studio" monoliths (6 files, ~16.8k lines): ~2,800 lines
  copy-pasted (HTML/description-block helpers byte-identical ×4,
  LocaleTabs ×4, FieldLabel ×3, StepRail ×3, CoverPattern ×3, BRAND
  palette ×6, divergent generateSlug ×3).
- Admin/api implemented the same Azure-AD-team → role model twice with
  behavioral divergence (api tolerated legacy `Ledelsen{City}` names,
  admin did not).
- `checkMembership()` duplicated verbatim-in-logic in web + admin.
- Smaller: duplicated profile form zod schema, identical `ProfileHead`,
  duplicated `PLACEHOLDER_IMAGE`, commented-out code blocks, unused
  `capitalize()` and `userId` prop.

Verified as **legitimately diverged, no action**: web vs admin `login.tsx`,
`lib/actions/user.ts`, `auth-utils.ts`, identity-management,
privacy-controls, profile-tabs (theming/audience), web vs admin
listNews/listJobs/listEvents (public read vs scoped CRUD), `applyAccent`
×2 in editor (different domains), admin `getPageEditorById` (auth-wrapping
re-export).

### Changes (3 commits)

1. **Tier 1 — dead code removal** (`30a1824`, −9,672 lines): all deletions
   above, plus knip.json ignore-list cleanup and removal of now-unused
   deps (`stripe`, `woocommerce-rest-ts-api`, `@vippsmobilepay/sdk` from
   shared) and `@repo/ui`/`@repo/payment`/`@repo/connectors` export-map
   entries.
2. **Tier 2 — mechanical consolidation** (`ede5e19`): canonical
   `requireAuth()` exported from admin `lib/authorization.ts` (16 copies
   removed); `_actions/lookups.ts` made the single source for campus/
   department lookups (4 copies removed, importers updated); profile form
   schema → `@repo/shared/types/profile-form`; `ProfileHead` →
   `@repo/ui/components/profile-head`; `PLACEHOLDER_IMAGE` →
   `@repo/ui/lib/placeholder-images` (18 importers updated).
3. **Tier 3 — behavioral consolidation** (`8b7235e`): team-role parsing →
   `@repo/shared/utils/team-roles` (admin + api now agree; both accept
   legacy camelCase team names); description-block helpers →
   `(portal)/_components/description-blocks.ts` (editors gain the
   Plate-JSON migration shim); `checkMembership` →
   `@repo/shared/utils/membership` with thin per-app wrappers.

Verification: `bun run check-types` green for all workspaces except
`docs`, which fails pre-existing in fresh clones (fumadocs `.source/` is
generated at build time). `bun x ultracite fix` clean on touched files.

### Deferred (flagged for later phases / checklist)

- api `getAdminScope` grants global admin from `admin`/`globaladmin`
  **labels**, which admin's CLAUDE.md explicitly forbids — policy decision
  needed (Phase 4 checklist).
- Studio-editor stage-2 extraction (LocaleTabs/FieldLabel/StepRail/
  CoverPattern/BRAND, ~990 lines) — riskier UI surgery, not blocking
  production.
- `apps/web/src/lib/actions/expense-ocr.ts` may be stub implementations on
  a production path — verify in Phase 2.
- `getExpenses` (web) missing `Query.limit` — Appwrite truncates at 25;
  Phase 2.
- 1 TODO remains: `event-studio-editor.tsx` (wire useAssistant) —
  intentional, references planned work.

## Phase 2 — Runtime bug hunt

### Confirmed bugs fixed (`d2896d1`)

1. **Order confirmation page broken (HIGH)** —
   `apps/web/src/app/(public)/shop/order/[orderId]/page.tsx` read
   `params.orderId` / `searchParams.success` synchronously; Next 16 passes
   Promises, so every post-payment landing rendered with
   `orderId: undefined`. Plain `tsc` cannot catch this and web sets
   `ignoreBuildErrors`. Fixed by awaiting both (page + generateMetadata).
2. **Purchase-limit bypass (HIGH)** — `purchase-limits.ts` scanned user
   orders without `Query.limit`; Appwrite caps unbounded queries at 25
   rows, so quota checks under-counted for users with >25 orders. Added
   `Query.limit(1000)` to both scans.
3. **Cart reservation oversell (HIGH)** — `cart_reservations` rows are
   row-secured to their creator (`create("any")` + rowSecurity), but
   `getAvailableStock` summed reservations through the session client, so
   it only ever saw the current user's rows — cross-user oversell
   protection was nonfunctional. The aggregation now uses the admin
   client (read-only; only the computed number leaves the server).
4. **Cron cleanup was a no-op (HIGH)** — `/api/cron/cleanup-reservations`
   called the session-client cleanup with no session cookie; it silently
   deleted nothing. Added `cleanupAllExpiredReservations` (admin client,
   paginated, capped) for the cron path; the session-scoped version
   remains for the cart page.
5. **Truncation limits (MED/LOW)** — explicit `Query.limit` added to the
   remaining cart-reservation queries, `getCollectionEvents` (public
   collection listings), `getBenefitReveals` (reveals beyond 25 appeared
   unrevealed), `getExpenses`, and admin news translation deletes.
6. **Dead stub deleted** — `apps/web/src/lib/actions/expense-ocr.ts`
   (`processReceipt` was a no-op stub; zero importers after Phase 1) plus
   its knip ignore entry.

### Verified-acceptable (documented, not changed)

- Finago double-post window in `/api/checkout/return`: sentinel +
  rollback mitigation in place; Appwrite has no atomic check-and-set, so
  a millisecond race remains. Accepted.
- Page-editor collection routes use the admin client with a caller-chosen
  `dept` param but return published-only content behind an auth check.
- JWT cache in web `api-client.ts` is race-safe (promise cleared in
  `finally`); 14-min expiry with 1-min refresh buffer is correct.
- All other dynamic routes await `params`; `cookies()`/`headers()`
  properly awaited; no server-only imports leak into client bundles;
  studio editors and forms have double-submit guards; admin actions
  audit-log and campus-scope consistently.

### Agent findings rejected during verification

- "Invalid model names" (`gpt-5.1-codex`, `gpt-5-nano`,
  `claude-opus-4-7`) — all are real, current models; reviewer knowledge
  was stale. Left untouched.
- "segment_members delete loop unbounded" — already `Query.limit(1000)`.
- "JWT rejections cached" / "await revalidatePath" — incorrect.

### Deferred to Phase 4 / checklist

- Timing-safe comparison for `CRON_SECRET`-style shared secrets
  (admin announcements dispatch, web cron route).
- Double-casts in `booking.ts` and admin events page (type-safety smell,
  not a runtime bug today).

## Phase 3 — Consistency & conventions

### Already consistent (verified, no action)

- File naming: uniformly kebab-case across every app and package.
- Env access: uniformly direct `process.env.X`; no typed config module
  anywhere. Left as-is — introducing one is a refactor without a defect.
- Admin server-action result shape: uniform `{ data } | { error }`.
- Loading/pending state gating on forms and studio editors (verified in
  Phase 2).
- `@repo/api` data-access abstraction (verified in Phases 0 and 2).

### Fixed

- C1: `packages/shared/utils/vipps-order-ops.ts` imported `ID` from
  `node-appwrite` directly — now imports from `@repo/api` like everything
  else.
- C2: the only two silent bare catches in admin `_actions`
  (`event-segments.ts` attendee-context fallback, `pages.ts` page-view
  stats) now `console.error` before returning their fallbacks, matching
  the dominant admin pattern.
- C4 docs: root `CLAUDE.md` corrected ("Next.js 15" → 16; admin does NOT
  ignore TS build errors — only web and api do); `apps/web/CLAUDE.md`
  corrected ("Puck" → block-editor pages) and now records the canonical
  result shape (`{ success, data?, error? }`) for new web server actions.

### Noted, intentionally left

- Web action result shapes are mixed per-feature (`{success}` vs
  `{error}` vs raw data). Unifying would churn dozens of call sites with
  zero behavior change; convention documented for new code instead.
- Admin `src/i18n/config.ts` is a deliberate re-export shim of
  `@repo/i18n/config` (2 importers) — harmless alias kept.
- `console.log` cleanup deferred to Phase 4 (scoped there).

## Phase 4 — Production hardening (`6c7ba8c`)

- **console.log**: deleted 7 debug logs (5× `[DEBUG]` in the api Graph
  board route, a browser-console response dump in
  `membership-provider.tsx`, a per-view `"Fetched event"` log); converted
  the 7 operational logs (checkout-return payment tracing, sync and
  provisioning progress) to `console.info`. Zero `console.log` remains in
  production paths.
- **Timing-safe secrets**: new `@repo/shared/utils/secrets.ts`
  (`safeSecretCompare`, `crypto.timingSafeEqual`-based) now used by all
  four shared-secret routes: admin `announcements/dispatch`, api
  `departures/sync`, api `tickster/sync`, web `cron/cleanup-reservations`.
- **Images**: added `sizes` to the two `<Image fill>` usages missing it
  (benefit card logo 56px; news article hero).
- **Metadata**: homepage now has a real title/description;
  `recruitment/book/[token]` is `noindex,nofollow` (tokenized one-off
  links). The `about/*` subtree and `safety` were already covered by
  layout-level metadata from earlier work; all other public pages have
  `generateMetadata`/`metadata` exports.
- **Checked, no change needed**: error boundaries present at sensible
  levels in both apps; mutations gate on pending state; no hardcoded
  secrets; CORS allowlist correctly scopes credentialed origins;
  `generateStaticParams` is N/A (web root layout forces dynamic
  rendering).

Verification: `bun run check-types` green for all workspaces except the
pre-existing `docs` failure; `bun x ultracite fix` clean.
