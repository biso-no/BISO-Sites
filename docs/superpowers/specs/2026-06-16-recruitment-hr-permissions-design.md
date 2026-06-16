# Recruitment HR-Scoped Permission Model — Design

**Date:** 2026-06-16
**Status:** Approved (Approach B)
**Area:** `apps/admin` (recruitment), `apps/web` (job audience), `packages/shared`, `packages/api/appwrite.config.json`

## Problem

Recruitment access in the admin app is gated in two layers:

1. **RLS / row permissions** — `buildJobRowPermissions()` already grants
   `read`/`update`/`delete` to `team:sg-app-dept-hr` on every job row.
2. **Application-layer scope** — `toRecruitmentAdminScope()` +
   `canManageRecruitmentVacancy()` decide what the admin UI actually shows.

The app layer treats HR as "just another department." A user in
`sg-app-campus-national` + `sg-app-dept-hr` (but **not** Operations Unit and
**not** Ledelsen{City}) therefore:

- is not `globaladmin` (needs National **+ Operations Unit**),
- is not `campusadmin` (needs Ledelsen{City}),
- falls through to the department branch, so `listJobs`
  (`apps/admin/src/app/(portal)/_actions/jobs.ts`) filters to
  `department.$id == HR` and hides jobs owned by other departments.

Result: HR cannot see jobs they did not personally own. The fix belongs in the
**scope logic**, not the schema — but we also harden the schema so HR access is
guaranteed for all rows including legacy ones, and remove campus from the
permission layer entirely.

## Goals

- **HR is the recruitment department.** Recruitment access (jobs, applications,
  answers, interviews, participants, candidate profiles, scorecards, booking
  tokens) requires HR membership or global admin.
- **Campus is pure scoping, never a permission.** National = all campuses;
  Campus-X = that campus only. The National elevation is implemented generally,
  not hardcoded to HR.
- **Members-only vacancies** are not publicly readable; they grant read to
  `team:biso-members` instead. (Already implemented — hardened here.)

## Non-goals

- No change to the global-admin (National + Operations Unit) superuser role.
- No change to the public/member application **submission** flow itself (only the
  row permissions it writes).
- No new Appwrite teams. No per-campus HR teams.

## Behavior matrix (authoritative)

| User (teams) | Recruitment access |
|---|---|
| Global admin (National + Operations Unit) | Everything, all campuses (unchanged) |
| HR + National | All recruitment across **all campuses** |
| HR + Campus-X (and/or Campus-Y) | All recruitment for **campus X** (every department in it) |
| Any non-HR, non-global user | **No recruitment access** |

**Consequence to confirm at spec review:** campus leadership (Ledelsen{City})
who are *not* in HR lose the application-review access they have today. This
follows directly from "HR-exclusive recruitment."

## Architecture

Two orthogonal concerns:

1. **Access gate** — "may this user touch recruitment at all?" → HR membership
   or global admin.
2. **Campus scope** — "which campuses?" → National ⇒ all; specific campus teams
   ⇒ those campuses. General mechanism; only ever exercised by users who pass the
   gate.

These map cleanly onto the **existing** `AdminScope` shape so downstream
predicates (`canManageRecruitmentVacancy`, `canReviewRecruitmentVacancy`, the
`listJobs` query builder, the `listJobApplications` guard) need **no change** —
we only change how the scope is *constructed*.

### 1. `toRecruitmentAdminScope()` rewrite

File: `apps/admin/src/lib/recruitment.ts`

New construction logic:

```
isActualGlobalAdmin = ctx.roles.includes("globaladmin")
isHr               = isHrDepartment(ctx.departmentNames)
isNational         = ctx.campusNames.includes("National")
recruitmentGlobal  = isActualGlobalAdmin || (isHr && isNational)

if recruitmentGlobal:
  { canManageAnyCampus: true,  isGlobalAdmin: true,  isCampusAdmin: false,
    managedCampusNames: [], managedDepartmentNames: [], userId }

else if isHr:
  campuses = ctx.managedCampuses.length ? ctx.managedCampuses : ctx.campusNames
  { canManageAnyCampus: false, isGlobalAdmin: false, isCampusAdmin: true,
    managedCampusNames: campuses, managedDepartmentNames: [], userId }

else:  // no recruitment access
  { canManageAnyCampus: false, isGlobalAdmin: false, isCampusAdmin: false,
    managedCampusNames: [], managedDepartmentNames: [], userId }
```

Notes:
- Setting `isGlobalAdmin: true` for HR + National is **safe**: this `AdminScope`
  is produced by `toRecruitmentAdminScope` and consumed **only** in recruitment
  actions; it is not the app-wide auth role.
- `managedDepartmentNames` is always `[]` for HR because HR sees **all**
  departments within scope, not just the HR department. This makes the existing
  `canManage`/`canReview` campus-admin branch do exactly the right thing.

### 2. `isHrDepartment()` helper

File: `apps/admin/src/lib/recruitment.ts` (or a small shared util).

```
const HR_DEPARTMENT_KEY = "hr";
isHrDepartment(names) =
  names.some(n => n.replace(/\s+/g, "").toLowerCase() === HR_DEPARTMENT_KEY)
```

Assumption: the HR team's clean name normalizes to `hr` (it backs the existing
`HR_TEAM = "sg-app-dept-hr"` constant). Documented inline.

### 3. Publish access for jobs

File: `apps/admin/src/app/(portal)/_actions/jobs.ts`

`assertPublishAccess(ctx, campusId)` requires global admin or
`managedCampusIds.includes(campusId)`. HR users have neither, so they cannot
publish today. For HR-exclusive recruitment, **manage == publish**: replace the
`assertPublishAccess` calls in `createJob`/`updateJob` with the recruitment
write check (`assertRecruitmentVacancyWriteAccess`, already called), so any HR
user who can manage a vacancy in their campus scope can also publish it. Do
**not** loosen the generic `assertPublishAccess` (still used by pages/events/news).

### 4. Row-permission simplification

File: `apps/admin/src/lib/recruitment.ts` — `buildJobRowPermissions()`

Staff access now comes from the **table level** (see §5), so job row permissions
encode **only public/member visibility**:

| Job state | Row `$permissions` |
|---|---|
| published + public | `read(any)` |
| published + members | `read(team:biso-members)` |
| draft / closed | *(none — staff read via table-level HR/admin)* |

Drop the campus-team and owning-department-team grants entirely (campus leaves
the permission layer; HR-exclusive removes per-department write).

File: `apps/web/src/app/actions/jobs.ts` — `buildVacancyRowPerms()`

Applications/answers/candidate-profiles are never public and staff read them via
table-level HR/admin; applicants read via the admin-client path
(`listMyApplications`). Reduce these row permissions to `[]` (staff access is
table-level; rowSecurity stays `true`). Remove the `operationsunit` /
`ledelsen{city}` per-row grants.

### 5. Schema changes — `packages/api/appwrite.config.json`

Add `team:sg-app-dept-hr` to **table-level** permissions so HR is a first-class
recruitment role at the DB layer (campus scoping stays in the app). Mirror the
existing `team:admin` grants. Tables:

- `jobs`
- `job_applications`
- `job_application_answers`
- `job_interviews`
- `job_interview_participants`
- `candidate_profiles`
- `job_interview_scorecards`
- `recruitment_booking_tokens`

For each, table-level perms become:

```
create(team:admin), create(team:sg-app-dept-hr),
read(team:admin),   read(team:sg-app-dept-hr),
update(team:admin), update(team:sg-app-dept-hr),
delete(team:admin), delete(team:sg-app-dept-hr)
```

`jobs` currently has only `create("users")` — replace with the admin+HR set
above. The public application submission path writes via the **admin client**
(bypasses RLS), so tightening `create("users")` → admin+HR on the application
tables does not break public apply. `rowSecurity` stays `true` on all of them;
the public/member read grants live on the job **row** (§4).

`content_translations` is shared across content types and is **not** modified —
its job rows keep their existing row-level public/member read grants via
`buildContentTranslationPermissions()`.

The user pushes this config to Appwrite after the change.

### 6. Web member-only verification

The members-only path already works (`buildJobRowPermissions` published+members ⇒
`read(team:biso-members)`, no `read(any)`). Verify, do not rebuild:

- A published member-only job is **not** returned to an anonymous/guest session
  (`apps/web/src/app/actions/jobs.ts#_listJobs` uses the session client → RLS).
- A logged-in user in `team:biso-members` **does** see it.
- Confirm the `audience` value round-trips on update so a members-only job is not
  silently flipped to public `read(any)` when re-saved without `audience`
  (check `recruitmentVacancyUpsertSchema` / metadata persistence in
  `@repo/shared/types/recruitment`). If `audience` is not persisted, persist it
  (metadata field) so updates preserve member-only.

## Affected files

- `apps/admin/src/lib/recruitment.ts` — scope rewrite, `isHrDepartment`,
  `buildJobRowPermissions` simplification.
- `apps/admin/src/app/(portal)/_actions/jobs.ts` — publish-access swap.
- `apps/web/src/app/actions/jobs.ts` — `buildVacancyRowPerms` simplification;
  audience-persistence check.
- `packages/api/appwrite.config.json` — table-level HR grants (user pushes).
- `packages/shared/recruitment.ts` — no logic change expected; verify predicates
  behave under the new scope shapes (add unit tests).

## Testing

Unit tests (`bun:test`) for `toRecruitmentAdminScope` + the predicates:

- Global admin → manage/review any campus+department.
- HR + National → manage/review any campus+department.
- HR + Campus-Oslo → manage/review Oslo jobs (any dept); **denied** for Bergen.
- HR + Campus-Oslo + Campus-Bergen → both campuses; denied for a third.
- Non-HR department (Operations Unit only, no national-ops) → **no access**
  (`listJobs` empty, `listJobApplications` throws Forbidden).
- `isHrDepartment` normalization: "HR", "hr", " Hr " all match; "Marketing" does
  not.
- `buildJobRowPermissions`: published+public ⇒ `read(any)`; published+members ⇒
  `read(team:biso-members)` and **no** `read(any)`; draft ⇒ no public read; no
  campus/dept team grants in any case.

Manual:
- Reproduce the original bug account (National + HR) and confirm it now lists all
  jobs.
- Member-only job hidden from guest, visible to a `biso-members` user.

## Risks / open questions

1. **Ledelsen{City} campus admins lose recruitment review access** unless also in
   HR (direct consequence of HR-exclusive). Confirm acceptable at spec review.
2. **HR team clean-name assumption** (`hr`). If HR's Appwrite team name does not
   normalize to `hr`, `isHrDepartment` must be adjusted. Verify against the live
   team list.
3. **Legacy rows** created with old per-department permissions still carry stale
   `update/delete(team:<dept>)` grants until rewritten. Table-level HR makes them
   accessible to HR regardless; stale grants are harmless but could be cleaned in
   a later migration (out of scope here).
4. **`listRecruitmentReviewers`** returns all active users for global/national-HR
   scope (pre-existing behavior). Not changed here; note for follow-up if HR
   wants a tighter reviewer list.
