# Permissions & Roles Review — admin app

Status: living document. Phase 1 fixes applied on `claude/permissions-roles-review-nsjyA`.
Phase 2 is planned but **not** executed (requires Appwrite-side changes + a backfill run
against staging → prod).

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
  created with correct per-row `$permissions` (`buildVacancyRowPerms` in `apps/web/.../jobs.ts`,
  `interviewPerms` in `booking.ts`). Collection perms are `read("team:admin")` only — no `read(any)`.
- The hole: `grantTeamRecruitmentAccess` (`lib/team-provisioning.ts`) grants **table-level
  read/update/delete to every department team**, which overrides those per-row restrictions.
- But two things block a naive grant removal:
  1. `buildVacancyRowPerms` grants read only to `sg-app-dept-operationsunit`, `sg-app-dept-hr`,
     and the vacancy's **owning department** team — **not** the campus team. So **campus admins**
     (Ledelsen{City}) review applications across their campus only via the blanket table grant.
  2. `job_interview_participants` and `recruitment_booking_tokens` are created in
     `interviews.ts` with **no** per-row `$permissions` — they depend entirely on the table grant.

**PARTIALLY RESOLVED.** The highest-PII, firmly per-row-stamped tables are now isolated; the
un-stamped interview/pool tables are documented as remaining.

Done:
- `buildVacancyRowPerms` (`apps/web/.../jobs.ts`) now also grants **read** to the owning campus's
  leadership team (`sg-app-dept-ledelsen{city}`) so campus admins keep per-row review access, and
  its department-team derivation was corrected from spaces→hyphens to the canonical spaces→removed
  rule (`sg-app-dept-operationsunit`), matching `m365-sync` and the admin helpers.
- `grantTeamRecruitmentAccess` now grants **create-only** on `job_applications` and
  `job_application_answers` (the cover-letter/answer/contact PII). Read/update/delete on those is
  governed per row (ops + hr + owning department + owning campus leadership). Department teams can
  no longer read another department's or campus's applications.
- Resume files are already safe: the `recruitment_resumes` bucket has `fileSecurity: true` with no
  bucket-level read, and uploads pass no file perms, so resumes are reachable only via the
  admin-gated download route — never via team grants.

Remaining (follow-up):
- `candidate_profiles`, `job_interviews`, `job_interview_participants`, `job_interview_scorecards`,
  `recruitment_booking_tokens` still get full table-level CRUD because they are created **without**
  per-row `$permissions` (and profiles are cross-vacancy). Stamp them per row (campus-leadership +
  owning dept + ops/hr), then move them to create-only too.
- `grantTeamRecruitmentAccess` only **adds** perms; for any already-provisioned team it would not
  strip a prior read/update/delete on the PII tables. N/A now (no teams/data yet); if teams exist
  before deploy, run a one-time cleanup.

**Staging dependency to verify:** the per-row *department* grant resolves `department_id` →
`Departments.Name` → `sg-app-dept-{name}`. This is the **same invariant** `resolveDepartmentIds`
(core auth) already relies on (Azure dept name == 24SevenOffice `Departments.Name`). The
`grantDeptTeamAccess` comment hints some Names may be campus-prefixed (`"OSL Operations Unit"`),
which would break the dept-level grant (ops/hr/campus-admin are unaffected). Confirm on staging
that a plain department reviewer can read their own department's applications.

### E — Literal team IDs must exist in Appwrite (verify)

Code references `Role.team("admin")`, `Role.team("biso-members")`, `Role.team("sg-app-dept-hr")`
(in `lib/utils.ts`, `lib/recruitment.ts`). Provisioning only auto-creates `sg-app-campus-*` /
`sg-app-dept-*` teams. Confirm `admin`, `biso-members`, and `sg-app-dept-hr` exist with exactly
those IDs, or row `$permissions` referencing them silently grant nothing.

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
- **D — PARTIALLY DONE.** The high-PII application tables (`job_applications`,
  `job_application_answers`) are now create-only at the table level with complete per-row reads
  (ops + hr + owning dept + owning campus leadership), and resumes were already locked to the
  admin-gated route. Remaining: stamp the interview/pool tables per row, then narrow them too
  (see finding D). Touched `apps/web/.../jobs.ts` and `lib/team-provisioning.ts`.

### Staging verification checklist (before prod)

- Anonymous (logged-out) read of a **draft** event/news/page/product via the API returns nothing;
  a **published** one is readable.
- A draft is not readable by a plain `biso-members` user.
- A campus admin can see drafts across departments in their campus (rows **and** translations).
- A department user sees only their department's content.
- **D:** a department reviewer can read **their own** department's applications, but **not**
  another department's or campus's; ops/hr/global and campus admins can review within scope. (This
  exercises the `department_id → Departments.Name → team` invariant — see finding D.)
- **E:** confirm the teams `admin`, `biso-members`, `sg-app-dept-hr`, and the `sg-app-dept-*` /
  `sg-app-dept-ledelsen*` teams exist in Appwrite with those exact IDs (row `$permissions`
  reference them).

## Recommendation

Keep the hybrid model. **A** (draft exposure) is closed. **D** (recruitment PII) — the worst
exposure (applications + answers, plus resumes already safe) is closed; finishing it means
stamping the interview/pool tables per row, then narrowing their grants. **B** (scoping) and **F**
(labels) are done. **E** is a one-time operational check (now a hard dependency for D's dept-level
reviews). The retracted items (migration gating, content grants) need no action.
