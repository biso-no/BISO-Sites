# Recruitment HR-Scoped Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make HR the recruitment gatekeeper department — HR + National sees all recruitment across every campus, HR + Campus-X sees only campus X (every department), and non-HR/non-global users get no recruitment access — while keeping campus out of the permission layer entirely.

**Architecture:** The fix is in the **application-layer scope** (`toRecruitmentAdminScope`), which maps HR membership onto the existing `AdminScope` campus-admin shape so all downstream predicates work unchanged. Row permissions shrink to "staff (admin+HR) + public/member visibility" (campus and owning-department grants removed), and the same admin+HR grant is added at the **table level** in `appwrite.config.json` for robustness and legacy rows.

**Tech Stack:** Next.js 16 server actions, Appwrite (node-appwrite via `@repo/api`), TypeScript, `bun:test` (admin), `vitest` (`@repo/shared`).

---

## Background facts (verified)

- `toRecruitmentAdminScope(ctx)` lives in `apps/admin/src/lib/recruitment.ts:42`. It is a plain lib (no `"use server"`), consumed only by recruitment actions.
- `UserAuthContext` (`apps/admin/src/lib/authorization.ts:21`) exposes `campusNames`, `departmentNames`, `managedCampuses`, `roles`, `userId`, etc. Team names are clean (e.g. `"National"`, `"Operations Unit"`, `"HR"`).
- `AdminScope` (`packages/shared/types/user-management.ts:130`) fields: `canManageAnyCampus`, `isCampusAdmin`, `isGlobalAdmin`, `managedCampusNames`, `managedDepartmentNames`, `userId`.
- Downstream predicates `canManageRecruitmentVacancy` / `canReviewRecruitmentVacancy` (`packages/shared/recruitment.ts:44,68`): global ⇒ all; campus-admin + campus match ⇒ all departments in that campus; else department-membership branch.
- `buildJobRowPermissions` (`apps/admin/src/lib/recruitment.ts:100`) currently grants admin+HR+campus+dept on every job; its `update("team:…")` entries are *reused* by `createJob`/`updateJob` to derive translation write-teams (`apps/admin/src/app/(portal)/_actions/jobs.ts:375,465`). **Decouple this.**
- `buildVacancyRowPerms` (`apps/web/src/app/actions/jobs.ts:157`) grants ops+HR+dept+leadership on applications/answers/candidate_profiles.
- `audience` is persisted in vacancy metadata (`packages/shared/types/recruitment.ts:180`) and merges on update — but `createJob`/`updateJob` build permissions from `validated.data.audience ?? "public"` (form input), so re-saving a members-only job without re-sending `audience` flips it to `read(any)`. **Fix in `updateJob`.**
- `assertPublishAccess` (`apps/admin/src/lib/utils/authorization.ts:143`) requires global or campus admin → HR cannot publish today. For recruitment, manage == publish.
- `bun test` resolves `@repo/api` and `./recruitment` from inside `apps/admin` (probed OK).
- HR already has row-level grants on all *existing* recruitment rows (HR was always in the old builders), so the schema change carries **no hard deploy-ordering risk**; it is robustness + future-proofing.

---

## File Structure

- `packages/shared/recruitment.ts` — add `buildRecruitmentStaffRowPermissions()` (admin+HR CRUD). Single source of the staff grant, reused by admin + web.
- `packages/shared/recruitment.test.ts` — **new**, vitest, covers the staff-perms helper.
- `apps/admin/src/lib/recruitment.ts` — add `isHrDepartment()`; rewrite `toRecruitmentAdminScope()`; simplify `buildJobRowPermissions()` to `(audience, status)`.
- `apps/admin/src/lib/recruitment.test.ts` — **new**, bun:test, covers scope + `isHrDepartment` + `buildJobRowPermissions`.
- `apps/admin/src/app/(portal)/_actions/jobs.ts` — update `buildJobRowPermissions` call sites; inline translation write-teams; drop `assertPublishAccess`; fix `audience` fallback in `updateJob`.
- `apps/web/src/app/actions/jobs.ts` — replace `buildVacancyRowPerms(vacancy)` with `buildRecruitmentStaffRowPermissions()`; delete the old helper.
- `packages/api/appwrite.config.json` — add table-level admin+HR grants on the 8 recruitment tables (user pushes to Appwrite).

---

### Task 1: Recruitment scope + HR detection

**Files:**
- Modify: `apps/admin/src/lib/recruitment.ts:42-57`
- Test: `apps/admin/src/lib/recruitment.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `apps/admin/src/lib/recruitment.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import type { UserAuthContext } from "@/lib/authorization";
import { isHrDepartment, toRecruitmentAdminScope } from "./recruitment";

function ctx(partial: Partial<UserAuthContext>): UserAuthContext {
  return {
    activeCampusId: undefined,
    campusNames: [],
    campusTeamIds: [],
    departmentNames: [],
    departmentTeamIds: [],
    email: null,
    managedCampuses: [],
    managedCampusIds: [],
    name: null,
    resolvedCampusIds: [],
    resolvedDepartmentIds: [],
    roles: [],
    userId: "user-1",
    ...partial,
  };
}

describe("isHrDepartment", () => {
  test("matches HR regardless of casing/whitespace", () => {
    expect(isHrDepartment(["HR"])).toBe(true);
    expect(isHrDepartment(["hr"])).toBe(true);
    expect(isHrDepartment([" Hr "])).toBe(true);
    expect(isHrDepartment(["Marketing", "HR"])).toBe(true);
  });
  test("does not match non-HR departments", () => {
    expect(isHrDepartment(["Marketing"])).toBe(false);
    expect(isHrDepartment([])).toBe(false);
  });
});

describe("toRecruitmentAdminScope", () => {
  test("global admin manages any campus", () => {
    const scope = toRecruitmentAdminScope(ctx({ roles: ["globaladmin"] }));
    expect(scope.canManageAnyCampus).toBe(true);
    expect(scope.isGlobalAdmin).toBe(true);
  });

  test("HR + National manages any campus", () => {
    const scope = toRecruitmentAdminScope(
      ctx({ campusNames: ["National"], departmentNames: ["HR"] })
    );
    expect(scope.canManageAnyCampus).toBe(true);
    expect(scope.isGlobalAdmin).toBe(true);
    expect(scope.isCampusAdmin).toBe(false);
  });

  test("HR + single campus is a campus-scoped recruitment admin", () => {
    const scope = toRecruitmentAdminScope(
      ctx({ campusNames: ["Oslo"], departmentNames: ["HR"] })
    );
    expect(scope.canManageAnyCampus).toBe(false);
    expect(scope.isGlobalAdmin).toBe(false);
    expect(scope.isCampusAdmin).toBe(true);
    expect(scope.managedCampusNames).toEqual(["Oslo"]);
    expect(scope.managedDepartmentNames).toEqual([]);
  });

  test("HR + multiple campuses scopes to those campuses", () => {
    const scope = toRecruitmentAdminScope(
      ctx({ campusNames: ["Oslo", "Bergen"], departmentNames: ["HR"] })
    );
    expect(scope.isCampusAdmin).toBe(true);
    expect(scope.managedCampusNames).toEqual(["Oslo", "Bergen"]);
  });

  test("non-HR, non-global user gets no recruitment access", () => {
    const scope = toRecruitmentAdminScope(
      ctx({ campusNames: ["Oslo"], departmentNames: ["Marketing"] })
    );
    expect(scope.canManageAnyCampus).toBe(false);
    expect(scope.isGlobalAdmin).toBe(false);
    expect(scope.isCampusAdmin).toBe(false);
    expect(scope.managedCampusNames).toEqual([]);
    expect(scope.managedDepartmentNames).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test apps/admin/src/lib/recruitment.test.ts`
Expected: FAIL — `isHrDepartment` is not exported yet.

- [ ] **Step 3: Implement `isHrDepartment` and rewrite `toRecruitmentAdminScope`**

In `apps/admin/src/lib/recruitment.ts`, replace the existing `toRecruitmentAdminScope` (lines 42-57) with:

```ts
const HR_DEPARTMENT_KEY = "hr";

/**
 * HR is the recruitment-gatekeeper department. Detected by normalizing the
 * clean team name to "hr" (the suffix behind the `sg-app-dept-hr` team).
 */
export function isHrDepartment(departmentNames: string[]): boolean {
  return departmentNames.some(
    (name) => name.replace(/\s+/g, "").toLowerCase() === HR_DEPARTMENT_KEY
  );
}

/**
 * Recruitment access is HR-exclusive:
 *  - Real global admins (National + Operations Unit) and HR + National manage
 *    recruitment across ALL campuses.
 *  - HR + a specific campus manage ALL recruitment for that campus (every
 *    department in it).
 *  - Everyone else gets no recruitment access.
 * Campus is pure scoping and never enters row permissions.
 */
export function toRecruitmentAdminScope(ctx: UserAuthContext): AdminScope {
  const isActualGlobalAdmin = ctx.roles.includes("globaladmin");
  const isHr = isHrDepartment(ctx.departmentNames);
  const isNational = ctx.campusNames.includes("National");

  if (isActualGlobalAdmin || (isHr && isNational)) {
    return {
      canManageAnyCampus: true,
      isCampusAdmin: false,
      isGlobalAdmin: true,
      managedCampusNames: [],
      managedDepartmentNames: [],
      userId: ctx.userId,
    };
  }

  if (isHr) {
    const campuses =
      ctx.managedCampuses.length > 0 ? ctx.managedCampuses : ctx.campusNames;
    return {
      canManageAnyCampus: false,
      isCampusAdmin: true,
      isGlobalAdmin: false,
      managedCampusNames: campuses,
      managedDepartmentNames: [],
      userId: ctx.userId,
    };
  }

  return {
    canManageAnyCampus: false,
    isCampusAdmin: false,
    isGlobalAdmin: false,
    managedCampusNames: [],
    managedDepartmentNames: [],
    userId: ctx.userId,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test apps/admin/src/lib/recruitment.test.ts`
Expected: PASS (all scope + isHrDepartment cases).

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/lib/recruitment.ts apps/admin/src/lib/recruitment.test.ts
git commit -m "feat(recruitment): HR-scoped admin scope (HR=recruitment gatekeeper)"
```

---

### Task 2: Shared staff-row-permission helper

**Files:**
- Modify: `packages/shared/recruitment.ts`
- Test: `packages/shared/recruitment.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `packages/shared/recruitment.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildRecruitmentStaffRowPermissions } from "./recruitment";

describe("buildRecruitmentStaffRowPermissions", () => {
  it("grants read/update/delete to admin and HR only", () => {
    expect(buildRecruitmentStaffRowPermissions()).toEqual([
      'read("team:admin")',
      'update("team:admin")',
      'delete("team:admin")',
      'read("team:sg-app-dept-hr")',
      'update("team:sg-app-dept-hr")',
      'delete("team:sg-app-dept-hr")',
    ]);
  });

  it("never includes campus or department teams", () => {
    const perms = buildRecruitmentStaffRowPermissions().join(" ");
    expect(perms).not.toContain("sg-app-campus-");
    expect(perms).not.toContain("sg-app-dept-operationsunit");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/shared && bunx vitest run recruitment.test.ts`
Expected: FAIL — `buildRecruitmentStaffRowPermissions` is not exported.

- [ ] **Step 3: Implement the helper**

In `packages/shared/recruitment.ts`, update the top import and add the helper near the other exports. Change line 2:

```ts
import { Permission, Query, Role } from "@repo/api";
```

Then add (e.g. after the `RecruitmentLookups` interface):

```ts
const RECRUITMENT_STAFF_TEAMS = ["admin", "sg-app-dept-hr"] as const;

/**
 * Row permissions for recruitment rows that are never public (applications,
 * answers, candidate profiles) and the staff portion of job rows.
 * HR-exclusive: only the admin team and the HR department team. Campus and
 * owning-department teams are intentionally excluded — campus is scoping only.
 */
export function buildRecruitmentStaffRowPermissions(): string[] {
  return RECRUITMENT_STAFF_TEAMS.flatMap((team) => [
    Permission.read(Role.team(team)),
    Permission.update(Role.team(team)),
    Permission.delete(Role.team(team)),
  ]);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/shared && bunx vitest run recruitment.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/recruitment.ts packages/shared/recruitment.test.ts
git commit -m "feat(shared): buildRecruitmentStaffRowPermissions (admin+HR only)"
```

---

### Task 3: Simplify job row permissions

**Files:**
- Modify: `apps/admin/src/lib/recruitment.ts:100-146`
- Test: `apps/admin/src/lib/recruitment.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

Append to `apps/admin/src/lib/recruitment.test.ts`:

```ts
import { buildJobRowPermissions } from "./recruitment";

describe("buildJobRowPermissions", () => {
  test("published + public is world-readable plus admin/HR staff grant", () => {
    const perms = buildJobRowPermissions("public", "published");
    expect(perms).toContain('read("any")');
    expect(perms).toContain('read("team:sg-app-dept-hr")');
    expect(perms).toContain('update("team:admin")');
    expect(perms.join(" ")).not.toContain("sg-app-campus-");
    expect(perms.join(" ")).not.toContain("sg-app-dept-operationsunit");
  });

  test("published + members swaps read(any) for biso-members", () => {
    const perms = buildJobRowPermissions("members", "published");
    expect(perms).not.toContain('read("any")');
    expect(perms).toContain('read("team:biso-members")');
    expect(perms).toContain('read("team:sg-app-dept-hr")');
  });

  test("draft is never public and never member-readable", () => {
    const perms = buildJobRowPermissions("public", "draft");
    expect(perms).not.toContain('read("any")');
    expect(perms).not.toContain('read("team:biso-members")');
    expect(perms).toContain('read("team:sg-app-dept-hr")');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test apps/admin/src/lib/recruitment.test.ts`
Expected: FAIL — current `buildJobRowPermissions` has signature `(lookups, job, audience, status)`.

- [ ] **Step 3: Rewrite `buildJobRowPermissions`**

In `apps/admin/src/lib/recruitment.ts`, replace the whole `buildJobRowPermissions` function (lines ~87-146, including its doc comment and the `ADMIN_TEAM`/`HR_TEAM`/`MEMBERS_TEAM` usage) with the version below. Keep the `MEMBERS_TEAM` constant; you may remove `ADMIN_TEAM`/`HR_TEAM` if no longer referenced elsewhere in the file (grep first — if referenced, leave them).

```ts
import { buildRecruitmentStaffRowPermissions } from "@repo/shared/recruitment";

// ...

const MEMBERS_TEAM = "biso-members";

/**
 * Row permissions for a job. Staff access (admin + HR) comes from
 * `buildRecruitmentStaffRowPermissions()`; the row additionally encodes public
 * visibility:
 *   - published + public  → read(any)
 *   - published + members → read(team:biso-members)
 *   - draft / closed      → no public read (staff only)
 * Campus and owning-department teams are intentionally never granted.
 */
export function buildJobRowPermissions(
  audience: "public" | "members",
  status?: string
): string[] {
  const published = status === undefined || status === "published";

  const visibility =
    published && audience === "public"
      ? [Permission.read(Role.any())]
      : published && audience === "members"
        ? [Permission.read(Role.team(MEMBERS_TEAM))]
        : [];

  return [
    ...new Set([...visibility, ...buildRecruitmentStaffRowPermissions()]),
  ];
}
```

Ensure `Permission` and `Role` remain imported from `@repo/api` at the top of the file (they already are). Add the `buildRecruitmentStaffRowPermissions` import to the existing `@repo/shared/recruitment` import block at the top of the file.

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test apps/admin/src/lib/recruitment.test.ts`
Expected: PASS (scope, isHrDepartment, buildJobRowPermissions).

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/lib/recruitment.ts apps/admin/src/lib/recruitment.test.ts
git commit -m "refactor(recruitment): job row perms = staff + visibility, no campus/dept"
```

---

### Task 4: Wire job actions (perms, translations, publish, audience)

**Files:**
- Modify: `apps/admin/src/app/(portal)/_actions/jobs.ts`

No new unit test (server-action wiring); verified by build + check-types in Task 7.

- [ ] **Step 1: Update `createJob` permission wiring**

In `createJob` (`apps/admin/src/app/(portal)/_actions/jobs.ts`, around lines 357-385), replace the block that builds `jobPerms`, `campusTeam`, and `translationPerms` with:

```ts
const jobId = ID.unique();
const audience = validated.data.audience ?? "public";
const jobPerms = buildJobRowPermissions(audience, validated.data.status);
const translationPerms = buildContentTranslationPermissions({
  audience,
  status: validated.data.status,
  // Recruitment editors only: admin + HR. Campus is scoping, never a perm.
  writeTeams: ["admin", "sg-app-dept-hr"],
  readTeams: [],
});
```

- [ ] **Step 2: Update `updateJob` permission wiring + audience fallback**

In `updateJob` (around lines 448-469), replace the analogous block with the version below. The key change: `audience` falls back to the **persisted** metadata so re-saving a members-only job never reverts it to public.

```ts
const audience =
  validated.data.audience ?? vacancy.metadata.audience ?? "public";
const jobPerms = buildJobRowPermissions(audience, validated.data.status);
const translationPerms = buildContentTranslationPermissions({
  audience,
  status: validated.data.status,
  writeTeams: ["admin", "sg-app-dept-hr"],
  readTeams: [],
});
```

- [ ] **Step 3: Remove the publish-access calls (manage == publish for recruitment)**

In `createJob`, delete:

```ts
if (validated.data.status === "published") {
  assertPublishAccess(ctx, validated.data.campus_id);
}
```

In `updateJob`, delete:

```ts
if (
  vacancy.status === "published" ||
  validated.data.status === "published"
) {
  assertPublishAccess(ctx, vacancy.campus_id);
  assertPublishAccess(ctx, validated.data.campus_id);
}
```

The existing `assertRecruitmentVacancyWriteAccess(scope, lookups, …)` calls remain and now fully gate publish (HR campus scope == publish scope).

- [ ] **Step 4: Clean up now-unused imports**

Remove `assertPublishAccess` from the `@/lib/utils/authorization` import. Remove `deriveContentRowTeams` from the `@/lib/utils` import **only if** no longer used elsewhere in this file (grep `deriveContentRowTeams` within `jobs.ts`; `buildContentTranslationPermissions` stays). Confirm `buildJobRowPermissions` is still imported from `@/lib/recruitment`.

- [ ] **Step 5: Verify nothing else calls the old 4-arg `buildJobRowPermissions`**

Run: `rg -n "buildJobRowPermissions" apps packages`
Expected: only `apps/admin/src/lib/recruitment.ts` (definition + test) and the two updated call sites in `jobs.ts`, all using the `(audience, status)` signature.

- [ ] **Step 6: Build to catch the "use server" async-export + type rules**

Run: `bun run build --filter=admin`
Expected: `✓ Compiled` with no "Server Actions must be async" or type errors in `jobs.ts`.

- [ ] **Step 7: Commit**

```bash
git add "apps/admin/src/app/(portal)/_actions/jobs.ts"
git commit -m "feat(recruitment): HR publish access + members-only audience persistence on update"
```

---

### Task 5: Simplify web application/profile row permissions

**Files:**
- Modify: `apps/web/src/app/actions/jobs.ts:157-195` and its 3 call sites

- [ ] **Step 1: Replace `buildVacancyRowPerms` with the shared helper**

In `apps/web/src/app/actions/jobs.ts`:

1. Add to the `@repo/shared/recruitment` import block:

```ts
import {
  buildRecruitmentStaffRowPermissions,
  fetchRecruitmentListRows,
  getRecruitmentJobById,
  getRecruitmentJobBySlug,
  isAuthenticatedAppwriteUser,
  localizeVacancy,
} from "@repo/shared/recruitment";
```

2. Delete the entire `buildVacancyRowPerms` function (lines ~157-195) and the now-unused `DEPT_NAME_SPACE_RE` constant if it is only used there (grep first).

3. Replace each call. There are three: the `candidate_profiles` create (~line 404), the `job_applications` create (~line 411), and the `job_application_answers` create (~line 460). Change every `buildVacancyRowPerms(vacancy)` to `buildRecruitmentStaffRowPermissions()`. For the `const perms = buildVacancyRowPerms(vacancy);` line, change to `const perms = buildRecruitmentStaffRowPermissions();`.

- [ ] **Step 2: Confirm no remaining references**

Run: `rg -n "buildVacancyRowPerms|DEPT_NAME_SPACE_RE" apps/web`
Expected: no matches (or `DEPT_NAME_SPACE_RE` only if still used by `readCustomAnswers`/availability parsing — leave it then).

- [ ] **Step 3: Type-check web**

Run: `bun run check-types --filter=web`
Expected: PASS (web `next build` ignores type errors, so check-types is the signal).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/actions/jobs.ts
git commit -m "refactor(recruitment): application rows use shared admin+HR staff perms"
```

---

### Task 6: Schema — table-level admin+HR on recruitment tables

**Files:**
- Modify: `packages/api/appwrite.config.json`

This file is normally CLI-generated; the user pushes it to Appwrite after merge. Edit the `$permissions` arrays in place. Keep `rowSecurity` values unchanged.

- [ ] **Step 1: `jobs` table (line ~893)**

Replace:

```json
"$permissions": ["create(\"users\")"],
```

with:

```json
"$permissions": [
  "create(\"users\")",
  "create(\"team:admin\")",
  "read(\"team:admin\")",
  "update(\"team:admin\")",
  "delete(\"team:admin\")",
  "create(\"team:sg-app-dept-hr\")",
  "read(\"team:sg-app-dept-hr\")",
  "update(\"team:sg-app-dept-hr\")",
  "delete(\"team:sg-app-dept-hr\")"
],
```

- [ ] **Step 2: Add HR grants to the admin-already tables**

For each of these tables, the current array is:

```json
"create(\"users\")",
"read(\"team:admin\")",
"update(\"team:admin\")",
"delete(\"team:admin\")"
```

Append these four entries to the array (after the admin ones):

```json
"create(\"team:sg-app-dept-hr\")",
"read(\"team:sg-app-dept-hr\")",
"update(\"team:sg-app-dept-hr\")",
"delete(\"team:sg-app-dept-hr\")"
```

Tables to edit (by `$id`, near these lines):
- `job_applications` (line ~2245)
- `job_application_answers` (line ~6817)
- `job_interviews` (line ~6921)
- `job_interview_participants` (line ~7159)
- `candidate_profiles` (line ~7262)
- `job_interview_scorecards` (line ~7459)

- [ ] **Step 3: `recruitment_booking_tokens` (line ~6692, rowSecurity false)**

Current array is admin-only CRUD (no `create("users")`). Append the same four HR entries:

```json
"create(\"team:sg-app-dept-hr\")",
"read(\"team:sg-app-dept-hr\")",
"update(\"team:sg-app-dept-hr\")",
"delete(\"team:sg-app-dept-hr\")"
```

- [ ] **Step 4: Validate JSON**

Run: `bun -e "JSON.parse(require('fs').readFileSync('packages/api/appwrite.config.json','utf8')); console.log('valid json')"`
Expected: `valid json`.

- [ ] **Step 5: Commit**

```bash
git add packages/api/appwrite.config.json
git commit -m "feat(recruitment): table-level admin+HR grants on recruitment tables"
```

---

### Task 7: Verification & edge checks

**Files:** none (verification only)

- [ ] **Step 1: Full type-check both apps**

Run: `bun run check-types --filter=admin --filter=web`
Expected: PASS for both.

- [ ] **Step 2: Run all recruitment unit tests**

Run: `bun test apps/admin/src/lib/recruitment.test.ts` and `cd packages/shared && bunx vitest run recruitment.test.ts`
Expected: all PASS.

- [ ] **Step 3: Lint/format**

Run: `bun x ultracite fix`
Expected: clean (commit any formatting churn).

- [ ] **Step 4: Edge check — non-HR interview participants / scorecards**

Read `apps/admin/src/app/(portal)/jobs/[id]/applications/_actions/recruitment-workspace.ts` and `_actions/interviews.ts`. Confirm whether scorecard submission gates on `toRecruitmentAdminScope` access *before* the `canSubmitScorecard` participant check. Under HR-exclusive scope, a non-HR interviewer now resolves to "no access". If the action blocks them before reaching `canSubmitScorecard`, note it in the PR description as a known consequence (interviews are run by HR). Do **not** change behavior in this plan unless the user flags it — it is out of scope.

- [ ] **Step 5: Manual smoke (document results in PR)**

- As a National + HR user: `/jobs` lists **all** jobs across campuses (reproduces and fixes the original bug).
- As a Campus-Oslo + HR user: `/jobs` lists only Oslo jobs; opening a Bergen job id is Forbidden.
- As a non-HR department user: `/jobs` is empty and `listJobApplications` throws Forbidden.
- Members-only published job: hidden from an anonymous web session; visible to a `biso-members` user. Re-save it in admin without touching audience → still members-only (not `read(any)`).

- [ ] **Step 6: Final commit (if any formatting/cleanup)**

```bash
git add -A
git commit -m "chore(recruitment): formatting + verification cleanup"
```

---

## Self-Review

- **Spec coverage:** scope rewrite (§Architecture.1 → Task 1), HR detection (§Architecture.2 → Task 1), publish access (§Architecture.3 → Task 4), row-perm simplification jobs + applications (§Architecture.4 → Tasks 2,3,5), schema table-level HR (§Architecture.5 → Task 6), members-only/audience verification (§Architecture.6 → Tasks 4,7). All covered.
- **Behavior matrix:** global, HR+National, HR+Campus-X, non-HR — all asserted in Task 1 tests and Task 7 manual smoke.
- **Translation-perm decoupling:** not in the original spec but required; handled in Task 4 (explicit `writeTeams: ["admin","sg-app-dept-hr"]`).
- **Audience-revert bug:** handled in Task 4 Step 2 (`vacancy.metadata.audience` fallback).
- **Type/name consistency:** `buildRecruitmentStaffRowPermissions` (Task 2) consumed by Tasks 3 & 5; `buildJobRowPermissions(audience, status)` signature consistent across Task 3 definition and Task 4 call sites; `isHrDepartment` defined and tested in Task 1.
- **Deploy ordering:** HR already holds row-level grants on existing rows, so the schema change (Task 6) carries no hard ordering dependency; documented in Background facts.
- **Open consequence:** Ledelsen (non-HR campus leadership) lose recruitment access — accepted at spec review. Non-HR interviewer scorecard edge flagged for verification in Task 7 Step 4.
