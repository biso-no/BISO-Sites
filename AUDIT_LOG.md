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
