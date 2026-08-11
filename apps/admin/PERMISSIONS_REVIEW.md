# Permissions & Roles Review — admin app

Status: living document. Phase 1 fixes applied on `claude/permissions-roles-review-nsjyA`.
Phase 3 (relationship-scoped service boundary, 2026-08-11) is implemented on
`codex/content-auto-translation`; only the live table-permission cutover
remains, deliberately deferred until after production deployment.

## Phase 3 — Relationship-scoped publishing (2026-08-11)

The authorization model changed from "session client + dynamically provisioned
team grants" to a **scoped service boundary**:

- Appwrite **relationships** (`campus`, `department`) are the canonical content
  ownership source on `news`, `events`, `webshop_products`, `pages`,
  `campus_benefits`, `announcements`, and `documents`. Scalar columns
  (`campus_id`, `department_id`, `departmentId`) remain as migration-era
  compatibility metadata only.
- Every general-content Server Action authenticates, resolves scope from
  `sg-app-*` teams, authorizes via `assertContentOwnership` /
  `applyContentRelationshipScopeQueries`
  (`apps/admin/src/lib/content-authorization.ts`), then reads/writes with the
  **admin client**. Department members publish directly within their own
  campus + department; campus management covers its campus; only global admins
  may use a null campus (global announcements, national documents; pages keep
  their pre-existing national scope).
- Jobs stay HR-exclusive (`ROLES.HR` derived from the normalized HR department
  name) with global-admin break-glass; the broad `department` pseudo-role no
  longer opens recruitment navigation, search, or data.
- Translations are real relations: synchronous saves nest
  `translation_refs`/`contentTranslations` children in the parent upsert, and
  deferred `after()` callbacks attach only the destination locale
  (`news_ref`/`event_ref`/`product_ref`/`memberBenefit`; jobs replace their
  complete one-way `translations` relation). A unique
  `(content_type, content_id, locale)` index (`uniq_content_locale`) makes the
  deferred upserts idempotent.
- Row `$permissions` are **consumer-only**: published public → `read("any")`,
  published member-only → `read("team:biso-members")`, everything else
  service-only. Job rows/translations additionally keep the static
  Operations Unit + HR staff grants. `grantTeamContentAccess` and its M365-sync
  calls are removed — mirrored teams never enter content ACLs again.

### Repair evidence (run 2026-08-11 against project `biso`)

- `bun run --cwd packages/api repair:content-relationships` — dry-run, then
  `--apply`, then a converging dry-run: 4 translations already linked, 1
  ownership backfill applied (`news/6a7ae8476aefd433caee campus=5`), 0
  duplicates / orphans / wrong parents.
- Row-permission audit: every existing published row already carries row-level
  read permissions, so removing table-level reads cannot hide legacy content.
- `uniq_content_locale` created and locked into the schema contract test.

### Remaining owner steps (in order)

1. Merge and deploy the admin app (Tasks 2–14 must be live **before** any
   permission reduction).
2. `bun run --cwd packages/api cutover:content-permissions` (dry-run review),
   then `-- --apply`. Only the nine general tables change, each to an empty
   table-permission array: `events`, `news`, `webshop_products`, `pages`,
   `campus_benefits`, `announcements`, `documents`, `content_translations`,
   `page_translations`.
3. `cd packages/api && appwrite pull tables`, then lock the contract with a
   test in `appwrite-config-permissions.test.ts`:
   `expect(table?.$permissions, tableId).toEqual([])` for each of the nine
   tables (import `GENERAL_CONTENT_TABLES` from
   `content-permission-cutover.ts`).
4. Manual role-matrix smoke with one global, campus-management, department,
   and HR account.
5. Separately verified follow-ups: drop the legacy `create("users")` grant on
   the `user` profile table once the external mobile app is confirmed not to
   client-create profile rows (see `KNOWN_BROAD_CREATE_EXCEPTIONS` in
   `packages/api/appwrite-config.test.ts`), and consider changing
   `events.department` from `onDelete: cascade` to `setNull` so deleting a
   department can never delete its events.

## TL;DR

The admin app uses a **hybrid** authorization model and should keep it:

- **App code** derives roles from Appwrite team membership (`getUserAuthContext`),
  gates navigation (`NAV_ACCESS`), and scopes list/CRUD queries by campus/department
  (`applyScopeQueries`, `assertWriteAccess`, `hasRowAccess`, `assertPublishAccess`).
- **Appwrite** enforces coarse table-level CRUD + per-row `$permissions` (RLS /
  `rowSecurity`) as a backstop.

Going "RLS-only" is **not** viable: the primary tenant boundary (campus) is a string
**attribute** (`campus_id`), not an Appwrite role, and Appwrite permissions cannot do
attribute-based filtering. The `globaladmin` / `campusadmin` roles are also *combinations*
of teams, which a flat permission OR cannot express. Keep app-level scoping; make Appwrite
a true backstop rather than a decorative one.

## What verification corrected

Two first-pass concerns were **false positives** and are not bugs:

1. **Migration server actions are NOT unauthenticated.** Every action in
   `src/app/actions/migration/*` begins with `if (!(await isGlobalAdmin())) return Unauthorized`.
2. **`grantTeamContentAccess` is NOT over-permissive.** It grants **create-only** on content
   tables; update/delete are enforced per-row via `$permissions`. This is sound.

## Confirmed findings

### A — Unpublished content is world-readable at the Appwrite API (HIGH)

`events`, `news`, `pages`, `webshop_products` have collection-level `read("any")` with
`rowSecurity: true`. Because Appwrite grants access on a collection-**or**-row match, every
row — **including drafts and archived rows** — is readable by anyone who queries the API with
`status=draft`. The `status` filter in app queries is cosmetic for access control.

**RESOLVED.** Implemented the per-row pattern across all content write/publish flows and
removed the collection-level `read("any")` from the schema. The public `apps/web` reads these
collections via an anonymous **session** client (respects RLS), so published rows now carry a
per-row `read(any)` while drafts/archived get team-only reads.

- New helpers in `lib/utils.ts`: `buildContentRowPermissions` (main rows) and
  `deriveContentRowTeams`; `buildContentTranslationPermissions` is now status-aware.
  Published+public → `read(any)`; otherwise team-only (admin + owning campus team [read] +
  owning department team [read+write]; `biso-members` only when published+member-only). Drafts
  are never `read(any)` and never member-readable.
- Applied at create/update/publish/unpublish for `events`, `news`, `webshop_products`
  (`_actions/*.ts`) and `pages`/`page_translations` (`packages/api/page-builder.ts`).
- **`jobs` was NOT actually safe** — `buildJobRowPermissions` set `read(any)` for any public
  vacancy regardless of status, so draft vacancies (and their translations) were world-readable
  too. Made `buildJobRowPermissions` status-aware and threaded `status` through `jobs.ts`.
- Schema (`packages/api/appwrite.config.json`): removed `read("any")` from `events`, `news`,
  `pages`, `webshop_products`, `page_translations` collection permissions (left
  `stop_places`/`departures` public — they are reference data).

**Two bugs fixed during review of the generated code:** the draft translation read set was
(1) including `read(team:biso-members)` — leaking draft titles/descriptions to all members — and
(2) omitting the owning campus team, so a campus admin could list a cross-department draft but
not read its translation. Both corrected by gating `members` on published and adding a
`readTeams` (campus) parameter; the `page-builder` mirror was already correct.

### B — Divergent campus/department scoping (RESOLVED in Phase 1: department-only)

**Decision: department users are scoped to their department.** `pages.ts` (`listPages`,
`getDashboardStats`) now routes through `applyScopeQueries(ctx)` — the single source of truth —
which also fixes the global-admin `activeCampusId` switcher that the old inline code ignored.
`savePageEditorDoc` now defaults a page's `department_id` to the saver's department when they
belong to exactly one and haven't picked one, so a department user never creates a page they
immediately can't see.

**Note:** `pages` has no owner field — `department_id` is the only scoping handle. Pages with a
null/non-matching `department_id` are invisible to department users under department-only scoping
(global/campus admins are unaffected). There is **no production data yet**, so no backfill is
needed; the write-side default ensures new department-user pages carry a real `department_id`.

Remaining inline scopers intentionally left as-is (verified safe):
- `activity.ts` → `audit_logs` has neither `campus_id` nor `department_id`; must not use the helper.
- `benefits.ts`/`departments.ts` → campus-only collections, campus-admin-only nav (no department
  branch reachable). Consolidating is optional and behavior-neutral; deferred to avoid churn.
- `events.ts`, `news.ts`, `documents.ts`, `announcements.ts`, `drafts.ts`, `shop.ts`,
  `submissions.ts` already use `applyScopeQueries`.

#### Original analysis (for context)

`applyScopeQueries()` scopes department users by **`department_id`**, but `listPages` /
`getDashboardStats` in `_actions/pages.ts` scope them by **`campus_id`** (whole campus).
`apps/admin/CLAUDE.md` documents `listPages` as the canonical pattern that "filters by
`campus_id`", contradicting the helper.

Two real consequences pull in opposite directions:

- **Campus-level (current `pages.ts`):** a department user sees *all* pages in their campus.
- **Department-level (`applyScopeQueries`):** tighter, but pages can have a **null
  `department_id`** (`page-builder.ts:343`), so any page without a department set would
  disappear from its owner's list.

There is also an unambiguous sub-bug: in `listPages`/`getDashboardStats`, the
`if (!globaladmin)` guard means **global admins ignore their own `admin_campus_ctx` campus
switcher** — `applyScopeQueries` respects it, the inline code does not.

**Decision required:** should department users be scoped to their **department** or their
**campus** for content lists? Once decided, route *all* list actions through
`applyScopeQueries` (single source of truth) and handle null `department_id` explicitly.

Inline-scoping offenders to consolidate (reachability noted):
- `pages.ts` — department-reachable (`NAV_ACCESS.pages` includes `department`). **Real divergence.**
- `benefits.ts`, `approvals.ts`, `departments.ts`, `activity.ts` — campus-admin-only nav, so
  the department branch is effectively dead; consolidate for consistency, low risk.

### D — Recruitment PII readable cross-campus at the DB layer (MEDIUM, GDPR-sensitive)

`grantTeamRecruitmentAccess` grants **table-level `read/update/delete`** on
`job_applications`, `candidate_profiles`, `job_interviews`, etc. to *every* department team.
Campus isolation is enforced **only** in app code (`assertRecruitmentApplicationReviewAccess`,
`assertCandidateProfileReadAccess`). At the Appwrite layer, any provisioned department team can
read every applicant's data (incl. resumes) across all campuses. App-gated, but the DB backstop
is open for sensitive PII.

**Verified detail (why this needs care):**
- `job_applications`, `candidate_profiles`, `job_application_answers`, `job_interviews` **are**
  created with per-row `$permissions` (now via `buildRecruitmentStaffRowPermissions()`).
  Before this hardening, the collection grants used a literal `team:admin`
  backstop; the current schema uses SG-App department teams instead.
- The hole: `grantTeamRecruitmentAccess` (`lib/team-provisioning.ts`) grants **table-level
  read/update/delete to every department team**, which overrides those per-row restrictions.
- But two things block a naive grant removal:
  1. `buildVacancyRowPerms` grants read only to `sg-app-dept-operationsunit`, `sg-app-dept-hr`,
     and the vacancy's **owning department** team — **not** the campus team. So **campus admins**
     (Ledelsen{City}) review applications across their campus only via the blanket table grant.
  2. `job_interview_participants` and `recruitment_booking_tokens` are created in
     `interviews.ts` with **no** per-row `$permissions` — they depend entirely on the table grant.

**RESOLVED.** Recruitment data is now staff-only at the Appwrite data layer:
`sg-app-dept-operationsunit` and `sg-app-dept-hr` keep table-level create only,
and read/update/delete are governed by per-row permissions stamped with
`buildRecruitmentStaffRowPermissions()`.

Public applications still work through the web server action: the applicant
submits the form while signed in, the server validates the vacancy/payload, and
then the admin client creates the application row with staff row permissions.
Direct `create("users")` is intentionally absent from restricted recruitment
tables so clients cannot self-write review/status/screening fields.

Done:
- `grantTeamRecruitmentAccess` is a no-op for non-HR department teams and grants
  HR create-only on `job_applications`, `job_application_answers`,
  `candidate_profiles`, `job_interviews`, `job_interview_participants`,
  `job_interview_scorecards`, and `recruitment_booking_tokens`.
- `packages/api/appwrite.config.json` mirrors that contract: the restricted
  recruitment tables have Operations Unit + HR create-only table grants, no
  `create("users")`, no literal `admin` team grants, and
  `recruitment_booking_tokens` now has row security.
- Admin interview creation, participant creation, scorecard create/update,
  booking-token issuance, candidate self-booking interview creation, and
  existing candidate-profile updates now stamp rows with
  `buildRecruitmentStaffRowPermissions()`.
- Resume files are already safe: the `recruitment_resumes` bucket has `fileSecurity: true` with no
  bucket-level read, and uploads pass no file perms, so resumes are reachable only via the
  admin-gated download route — never via team grants.

Remaining operational caveat:
- If staging/prod already contains recruitment rows created before this change,
  backfill their `$permissions` to `buildRecruitmentStaffRowPermissions()` before
  removing HR table-level read/update/delete in Appwrite.

### E — Literal team IDs must exist in Appwrite (verify)

Code references literal team IDs such as `Role.team("biso-members")`,
`Role.team("sg-app-dept-operationsunit")`, and `Role.team("sg-app-dept-hr")`
(in `lib/utils.ts`, `lib/recruitment.ts`). Provisioning auto-creates
`sg-app-campus-*` / `sg-app-dept-*` teams, but production cutover should still
confirm the exact required IDs exist, or row `$permissions` referencing them
silently grant nothing.

**CLI check on 2026-06-18:** `biso-members`, `sg-app-dept-operationsunit`, and
`sg-app-dept-hr` exist in the configured Appwrite project. There is
intentionally no literal `admin` team dependency.

### F — Dead `labels` field (FIXED in Phase 1)

`UserAuthContext.labels` was populated but never read (labels are not used for role checks, per
`CLAUDE.md`). Removed to eliminate a misleading third "source of truth". The unrelated
`label:globaladmin` on `content_templates` / `content_template_versions` in
`appwrite.config.json` is a separate, schema-side item — reconcile it with the derived
`globaladmin` role or drop it (requires an Appwrite-side change).

## Phase 1 — applied

- **F:** removed `labels` from `UserAuthContext` and its population.
- **B:** `pages.ts` consolidated onto `applyScopeQueries` (department-only scoping +
  global-admin `activeCampusId` fix); `savePageEditorDoc` defaults `department_id` for
  single-department users. No data backfill needed (no production data yet).
- This document.

## Phase 2

- **A — DONE** (code + schema). No backfill was needed: there is no production data, and the
  write-side helpers stamp `$permissions` on every create/update/publish/unpublish. Because the
  schema is edited directly here (`appwrite.config.json`), the collection-permission change and
  the row-permission writers ship together. The original sequencing caveat ("don't remove
  `read("any")` before row perms exist") only matters if existing rows are present — they aren't.
- **D — DONE.** Restricted recruitment tables now use Operations Unit + HR
  create-only table grants, with row-level read/update/delete stamped by shared
  recruitment staff permissions. `recruitment_booking_tokens` now uses row
  security. Resumes remain locked to the admin-gated download route.

### Staging verification checklist (before prod)

- Anonymous (logged-out) read of a **draft** event/news/page/product via the API returns nothing;
  a **published** one is readable.
- A draft is not readable by a plain `biso-members` user.
- A campus admin can see drafts across departments in their campus (rows **and** translations).
- A department user sees only their department's content.
- **D:** HR/global-admin users can create/review recruitment data through the
  app, and non-HR department/campus teams cannot read restricted recruitment
  rows directly through Appwrite table grants. If pre-existing rows exist,
  backfill row `$permissions` before removing legacy table grants.
- **E:** confirm required literal teams exist before cutover. `biso-members`,
  `sg-app-dept-operationsunit`, and `sg-app-dept-hr` exist in the configured
  Appwrite project as of 2026-06-18; no literal `admin` team is required.

## Recommendation

Keep the hybrid model. **A** (draft exposure), **B** (scoping), **D**
(recruitment PII), and **F** (labels) are closed in code/schema. **E** remains
a production cutover task to confirm the required SG-App and membership team IDs
exist in the target project. The retracted items (migration gating, content
grants) need no action.
