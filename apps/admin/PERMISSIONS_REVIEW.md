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

`jobs` already does this correctly: no collection `read("any")`; per-row read permissions are
set by `buildJobRowPermissions` (public vacancies → `read(any)`, members-only → team reads).

**Fix direction (chosen): mirror the jobs pattern.** See Phase 2.

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

**Required fix sequence (separate task — touches the public web submission flow):**
1. Extend `buildVacancyRowPerms` / `interviewPerms` to also grant read to the owning campus's
   leadership team (`sg-app-dept-ledelsen{city}`) so campus admins keep review access per-row.
2. Add per-row `$permissions` to the `job_interview_participants`, `recruitment_booking_tokens`
   (and any scorecard) creates in `interviews.ts`.
3. Only then narrow `grantTeamRecruitmentAccess` to `create`-only (drop blanket read/update/delete).
4. Verify on staging: a department user cannot read another department's applications; campus
   admins still can within their campus.

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

## Phase 2 — planned (Appwrite changes + backfill, run on staging first)

Goal: make Appwrite a real backstop for A and D by mirroring the `jobs` pattern.

**Sequencing matters — do not remove `read("any")` before row permissions exist, or public
reads break.**

1. **Add row-permission writers.** Extend the content create/publish/unpublish flow so each
   row's `$permissions` are set on every write:
   - published → `read(any)` (+ owning campus/dept/admin write teams)
   - draft / archived → team-only reads (owning campus/dept + `admin`), no `read(any)`
   Reuse / generalize `buildJobRowPermissions`.
2. **Backfill migration** (guarded, `isGlobalAdmin`, `createAdminClient`): iterate existing rows
   in `events`/`news`/`pages`/`webshop_products` (and recruitment tables for D) and write the
   correct per-row `$permissions` based on current `status` + `campus_id`/`department_id`.
3. **Verify on staging:** anonymous read of a draft returns 404/empty; published still readable;
   admin/campus/department reads unchanged.
4. **Tighten collection permissions in Appwrite** (console or guarded migration): remove
   `read("any")` from the four content tables; narrow recruitment table grants to `create`-only.
   `appwrite.config.json` is auto-generated — change in Appwrite, then regenerate.
5. **Add regression tests:** cross-campus read returns empty; draft not world-readable.

## Recommendation

Keep the hybrid model. Prioritize **A** (draft exposure) and **D** (PII) for Phase 2 — these are
the genuine production-readiness gaps. **B** is correctness/consistency. **E** is a one-time
operational check. The retracted items (migration gating, content grants) need no action.
