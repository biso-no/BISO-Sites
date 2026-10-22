# Benefits Studio, Stage 2 (Admin board, panel, edit rights) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the admin benefits list and editor with a per-campus board and a slide-in panel that a non-technical committee can use, and change who may edit benefits (global admins, campus admins for their own campus, and named benefits editors everywhere; departments lose access).

**Architecture:** Edit rights become a new role `benefitseditor`, added to `ctx.roles` inside `getUserAuthContext()` when the signed-in email is listed in the server env `BENEFITS_EDITOR_EMAILS`. A pure module, `lib/benefit-access.ts`, turns roles into editable and visible campus lists. Server actions in `_actions/benefits.ts` are rewritten around the stage 1 data model:
- `section` is a column on each benefit.
- Codes are stored in `benefit_codes`. Until stage 4 they are also kept in the old column.
- Published rows are always `read("any")`.
- Benefits have no department.
- New actions: board loader, delete, reorder, status change.

All rules live in pure modules with tests: column building, dates, board sections, summary, reorder and panel state. The UI is a server page that renders a client board. The panel is a Radix `Sheet`. The URL holds the open item, so `/benefits/<id>` and `/benefits/new` open the panel over the board.

**Tech Stack:** Next.js 16 App Router, React 19, next-intl, Radix (`@repo/ui`), `@dnd-kit` (core/sortable/utilities from the root catalog), sonner, `bun:test` (admin) and Vitest (`packages/shared`, `packages/ai`).

**Spec:** `docs/superpowers/specs/2026-10-21-benefits-studio-design.md` (D2, D3, D4, D5, D6, D7, D8, D10). Stage 1 (already on this branch) supplies `packages/shared/utils/benefit-catalog.ts`, `benefit-visibility.ts`, the schema and the migration. Recon notes are in `.superpowers/sdd/stage-2-recon.md`.

## Global Constraints

- Bun only. Admin tests: `cd apps/admin && bun test <path>` (`bun:test`, `mock.module`). `packages/shared` and `packages/ai` use `bun x vitest run <file>`.
- **`"use server"` files export only async functions** (types are fine). Constants and sync helpers go in plain modules. `bun --filter=admin check-types` does not catch this; Task 11 runs `bun run build --filter=admin`, which does.
- Benefit action tests mock `@/lib/authorization` with only `requireAuth`. New auth helpers must live in **`apps/admin/src/lib/benefit-access.ts`** (plain module) and are imported from there, so existing mocks keep working.
- `UserAuthContext` literals appear in many tests, so add no required fields to it. The editor override is a **role string** in `ctx.roles`.
- Role key: `ROLES.BENEFITS_EDITOR = "benefitseditor"`. Env var: `BENEFITS_EDITOR_EMAILS`, comma- or whitespace-separated, compared case-insensitively. It is read at request time. An unset or empty value means nobody (fail closed).
- Campus IDs: `"1"` Oslo, `"2"` Bergen, `"3"` Trondheim, `"4"` Stavanger, `"5"` Hele BISO. Board tab order: Oslo, Bergen, Trondheim, Stavanger, Hele BISO.
- Edit rights (D5): global admins and benefits editors edit `1`–`5`. Campus admins edit their `managedCampusIds` (never `5`) and see `5` read-only. Everyone else sees and edits nothing.
- Published benefit rows get permissions `['read("any")']`. Draft and archived rows get `[]`. Never `read("team:biso-members")`.
- Codes and member links (`redemption_type` `code` | `link`) are written to `benefit_codes` (row ID = benefit ID, data `{ benefit_id, value, updated_by }`, permissions `[]`, admin client). **Until stage 4** the same value is also written to `campus_benefits.redemption_value`, because today's website still reads it there. For any other redemption type the code row is deleted and `redemption_value` is set to null.
- **Until stage 4** the selected partner's `name` and `logo_url` are also copied into `partner_name` and `partner_logo_url` on the benefit, because today's website reads those columns.
- Benefits are no longer tied to departments: saves write `department: null`, and no department picker remains.
- Dates: the panel sends Oslo calendar dates (`YYYY-MM-DD`). Start is stored as `00:00:00` Oslo time and end as `23:59:59` Oslo time, both as UTC ISO. The visibility rule from stage 1 (`publish_end <= now` → expired) applies unchanged.
- `qr` is not offered. Sections other than `member` store: no partner, `redemption_type: "none"`, no code, no category, no terms, no image, `is_featured: false`, no description.
- All user-facing copy comes from `packages/i18n/messages/{no,en}/adminPortal.json` under `benefits.*` (Task 8). Exact Norwegian copy is fixed in Task 8. Section and category labels come from `BENEFIT_SECTION_LABELS` / `BENEFIT_CATEGORY_LABELS` (nb for `no`, en for `en`).
- Look: reuse `STUDIO` tokens and the primitives in `(portal)/_components/studio.tsx` (serif headings, paper/claret/gold palette) so the board matches the approved mockups in `.superpowers/brainstorm/62147-1792614825/content/overview-layout.html` (option A) and `editor-layout.html` (option A).
- Run `bun x ultracite fix <changed files>` before each commit. (Repo-wide `ultracite check` currently fails on another session's nested worktree config. Lint only your files.)
- Never write to production Appwrite from tests or scripts. Tests use mocks only.

## Review Focus

- **A campus admin edits a benefit on another campus, or on Hele BISO**, through the panel or by calling an action directly → the server refuses (`Unauthorized: no write access to this campus`), and the board shows that tab read-only. Task 2 tests cover `benefitAccessFor`; Task 4 tests cover create, update, delete and reorder refusals.
- **An editor saves a live benefit** → it stays live. Only "Skjul fra nettsiden" hides it (Task 7 tests: `panelFooterActions` and `toBenefitFormValues`; Task 4 test: update keeps `published`).
- **A code or member link must never reach the browser for a non-editor, nor land in a public row permission.** The board loader returns no code values. Published rows are `read("any")` and the code row is `[]` (Task 4 tests).
- **An "until" date is respected in Oslo time across daylight-saving changes.** `2026-10-25` ends at `2026-10-25T22:59:59.000Z` (Task 3 test).
- **Assistant or approval publishing produces an invisible row** (the old path set `status` only, and the row kept stale permissions). Both paths now call `setBenefitStatus`, which rewrites permissions (Task 6 tests).

---

### Task 1: Regenerate Appwrite types and fix compile fallout

**Files:**
- Modify: `packages/api/types/appwrite.ts` (generated, via the script only)
- Modify: any call sites that break (expected candidates: `apps/admin/src/lib/benefit-title.ts`, `apps/admin/src/app/(portal)/benefits/page.tsx`, `apps/admin/src/app/(portal)/_actions/benefits.ts`, `apps/web/src/components/member-portal/**`)

**Interfaces:**
- Produces: `CampusBenefits` with `section`, plus the `CampusBenefitsSection` enum, and `BenefitCodes`, `MembershipTexts` row types (names as the generator emits them). `kind`, `redemption_type`, `category`, `description_*` and `teaser_*` become nullable.

- [ ] **Step 1: Regenerate.** Run `cd packages/api && bun run types:generate`. It must render from the local `appwrite.config.json`. If the CLI asks for a login or a network call, stop and report NEEDS_CONTEXT; do not hand-edit the file.
- [ ] **Step 2: Inspect.** `git diff --stat packages/api/types/appwrite.ts` touches only that file. The diff adds `section`, `BenefitCodes` and `MembershipTexts`, and makes the optional columns nullable. Nothing unrelated may be renamed: the script's `perl` fix-ups for `24SevenOffice…` and `Departments` must still apply.
- [ ] **Step 3: Type-check the repo.** Run `bun run check-types` (repo root). Fix every error at its call site by handling `null` the way the surrounding code already handles missing values (e.g. `?? ""`), without changing behaviour. Don't touch code that compiles.
- [ ] **Step 4: Re-run the affected tests.** Run `cd apps/admin && bun test src/lib/benefit-title.test.ts`, then `cd apps/web && bun run test`. Both PASS.
- [ ] **Step 5: Commit.**

```bash
git add packages/api/types/appwrite.ts <fixed files>
git commit -m "chore(api): regenerate types for sectioned benefits"
```

---

### Task 2: Edit rights: the benefits-editor role and campus access

**Files:**
- Create: `apps/admin/src/lib/benefit-access.ts`, `apps/admin/src/lib/benefit-access.test.ts`
- Modify: `apps/admin/src/lib/roles.ts` (`ROLES`, `NAV_ACCESS["portal.benefits"]`, `NAV_ACCESS["portal.benefitsPartners"]`)
- Modify: `apps/admin/src/lib/authorization.ts` (`getUserAuthContext` adds the role; `requireAdminAccess` admits it)
- Modify: `apps/admin/src/lib/roles.test.ts`, `apps/admin/src/lib/nav-tree.test.ts` (departments no longer reach benefits; the editor role does)
- Modify: `packages/ai/src/assistant/authz.ts` and its test (benefits domain)
- Modify: `apps/admin/.env.example` (document `BENEFITS_EDITOR_EMAILS=`), `turbo.json` (`tasks.build.env` gains `BENEFITS_EDITOR_EMAILS`)

**Interfaces:**
- Produces (from `lib/benefit-access.ts`, plain module):

```ts
export const BENEFIT_EDITABLE_ALL: readonly string[]; // ["1","2","3","4","5"]
export function parseBenefitEditorEmails(value: string | undefined): Set<string>;
export function isBenefitEditorEmail(email: string | null | undefined, configured?: string): boolean; // configured defaults to process.env.BENEFITS_EDITOR_EMAILS
export interface BenefitAccess { editableCampusIds: string[]; visibleCampusIds: string[] }
export function benefitAccessFor(ctx: { managedCampusIds: string[]; roles: string[] }): BenefitAccess;
export function canEditBenefitCampus(access: BenefitAccess, campusId: string | null | undefined): boolean;
export function assertBenefitCampusWrite(ctx: { managedCampusIds: string[]; roles: string[] }, campusId: string | null | undefined): void; // throws Error("Unauthorized: no write access to this campus")
export function canManageMembershipTexts(ctx: { roles: string[] }): boolean; // global admin or benefits editor (used in stage 6)
```

- `ROLES.BENEFITS_EDITOR = "benefitseditor"`.
- `NAV_ACCESS["portal.benefits"]` and `NAV_ACCESS["portal.benefitsPartners"]` both become `[ROLES.GLOBAL_ADMIN, ROLES.CAMPUS_ADMIN, ROLES.BENEFITS_EDITOR]`.

Rules:
- `benefitAccessFor`:
  - `globaladmin` or `benefitseditor`: editable and visible are both `["1","2","3","4","5"]`.
  - `campusadmin`: editable is `managedCampusIds` ∩ `["1","2","3","4"]`, in that order. Visible is editable plus `"5"`, when editable isn't empty.
  - Everyone else: both lists empty.
- `getUserAuthContext` pushes `ROLES.BENEFITS_EDITOR` into `roles` when `isBenefitEditorEmail(user.email)` holds (no duplicates).
- `requireAdminAccess` admits a user who has no team when `roles` includes `benefitseditor`.
- Assistant `buildAssistantCapabilities`: `domains.benefits` is `"publish"` when `roles` includes `globaladmin`, `campusadmin` or `benefitseditor`, otherwise `"none"`. Other domains are unchanged.

- [ ] **Step 1: Write the failing tests.**
  - `benefit-access.test.ts`:
    - `parseBenefitEditorEmails(" PR@biso.no, a@b.no\nc@d.no ")` gives the set `{pr@biso.no, a@b.no, c@d.no}`. `undefined` and `""` give an empty set.
    - `isBenefitEditorEmail("Pr@Biso.no", "pr@biso.no")` is true; `isBenefitEditorEmail(null, "pr@biso.no")` and `isBenefitEditorEmail("x@biso.no", "")` are false.
    - `benefitAccessFor({roles:["globaladmin"], managedCampusIds:[]})` gives editable and visible `["1","2","3","4","5"]`. The same holds for `["benefitseditor"]`.
    - A campus admin with `managedCampusIds:["2"]` gets editable `["2"]` and visible `["2","5"]`. A campus admin with `["5","3"]` gets editable `["3"]`.
    - `{roles:["department"], managedCampusIds:[]}` gets both lists empty.
    - `assertBenefitCampusWrite(campusAdmin2, "5")` throws `"Unauthorized: no write access to this campus"`; with `"2"` it does not throw.
    - `canManageMembershipTexts({roles:["campusadmin"]})` is false; for `["benefitseditor"]` it is true.
  - `roles.test.ts`: department members do **not** get `portal.benefits`; `benefitseditor` gets `portal.benefits` and `portal.benefitsPartners`. Remove `portal.benefits` from the test's department-reachable publishing keys.
  - `nav-tree.test.ts`: a department user's content group no longer lists `benefits`. A `["benefitseditor"]`-only user's tree contains `benefits`, and `getDefaultNavPath` returns `/benefits`.
  - `packages/ai` authz test (create it next to `authz.ts` if absent): a department-only input gives `domains.benefits === "none"`; `roles:["benefitseditor"]` gives `"publish"`; `events` access for a department user is unchanged (`"write"`).
  - Optionally, in the authorization tests: a user with no teams and the editor role passes `requireAdminAccess`. Add this only if there is an existing harness for `authorization.ts`. If there isn't, cover it in Task 11's manual review list.
- [ ] **Step 2: Run them to verify failure.** Run `cd apps/admin && bun test src/lib/benefit-access.test.ts src/lib/roles.test.ts src/lib/nav-tree.test.ts` and `cd packages/ai && bun x vitest run src/assistant/authz.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the module, the role, the NAV_ACCESS changes, the two `authorization.ts` changes, the AI authz change, `.env.example` and `turbo.json`.
- [ ] **Step 4: Run the same commands, then `bun --filter=admin check-types`.** Expected: PASS.
- [ ] **Step 5: Commit.**

```bash
git commit -m "feat(admin): benefits editor role and campus-scoped benefit access"
```

---

### Task 3: New benefit schema, dates and column building

**Files:**
- Modify: `apps/admin/src/app/(portal)/_actions/schemas.ts` (replace `benefitSchema`/`BenefitFormValues`), `apps/admin/src/app/(portal)/_actions/schemas.test.ts` (benefit cases)
- Create: `apps/admin/src/lib/benefits/benefit-dates.ts` (+ `.test.ts`), `apps/admin/src/lib/benefits/benefit-columns.ts` (+ `.test.ts`)

**Interfaces:**
- Consumes: `BENEFIT_SECTIONS`, `BENEFIT_CATEGORIES`, `NATIONAL_CAMPUS_ID` (`@repo/shared/utils/benefit-catalog`); `osloWallClockToIso`, `isoToOsloWallClock` (`@repo/shared/utils/oslo-time`).
- Produces:

```ts
// schemas.ts
export const benefitSchema; // z.object(...).superRefine(...)
export type BenefitFormValues = z.infer<typeof benefitSchema>;
// fields: section (enum BENEFIT_SECTIONS, default "member"); campus_id (enum "1".."5"); status (draft|published|archived);
// title_nb, title_en (string, trim, max 200); description_nb, description_en (string max 2000, optional nullable);
// partner_id (string max 36, optional nullable); redemption_type (none|code|link|onsite, default none);
// redemption_value (string trim max 500, optional nullable); category (enum BENEFIT_CATEGORIES, optional nullable);
// terms_nb, terms_en (string max 1000, optional nullable); image_url (url max 500 | "" , optional nullable);
// is_featured (boolean default false); publish_start, publish_end (YYYY-MM-DD, optional nullable).
// superRefine issues (path → message):
//   title_nb → "Add a title in Norwegian or English" (both titles blank)
//   redemption_value → "Add the code" (member, code, blank) | "Add the link" (member, link, blank) | "The link must start with https://" (member, link, not https URL)
//   publish_end → "The end date must be on or after the start date"

// lib/benefits/benefit-dates.ts
export function benefitStartIso(date: string | null | undefined): string | null; // Oslo 00:00:00 → UTC ISO
export function benefitEndIso(date: string | null | undefined): string | null;   // Oslo 23:59:59 → UTC ISO
export function benefitDateFromIso(iso: string | null | undefined): string | null; // UTC ISO → Oslo "YYYY-MM-DD"

// lib/benefits/benefit-columns.ts
export const BENEFIT_SECRET_TYPES: readonly ["code", "link"];
export function normalizeBenefitValues(values: BenefitFormValues): BenefitFormValues; // non-member sections: clear member-only fields (Global Constraints)
export interface BenefitPartnerSnapshot { id: string; logo_url: string | null; name: string }
export function buildBenefitColumns(values: BenefitFormValues, partner: BenefitPartnerSnapshot | null, sortOrder: number): Record<string, unknown>;
export function benefitRowPermissions(status: string): string[]; // published → ['read("any")'], else []
export function benefitSecretValue(values: BenefitFormValues): string | null; // trimmed redemption_value for code|link, else null
```

`buildBenefitColumns` writes:
- `campus` and `campus_id` (both the campus ID), `department: null`, `section`, `status`
- `title_nb` and `title_en`: each falls back to the other language's title when blank
- `description_nb`, `description_en` (null when blank)
- `partner_id`, `partner_name` and `partner_logo_url` from the snapshot, or null
- `redemption_type`, and `redemption_value: benefitSecretValue(values)` (the stage-4 compatibility copy)
- `category`: `"other"` when a member benefit has none, null for other sections
- `terms_nb`, `terms_en`, `image_url` (null when blank), `is_featured`
- `publish_start: benefitStartIso(...)`, `publish_end: benefitEndIso(...)`
- `sort_order` (as given)
- It never writes `kind`, `teaser_*` or `is_member_only`.

- [ ] **Step 1: Write the failing tests.**
  - dates:
    - `benefitStartIso("2026-08-10")` gives `"2026-08-09T22:00:00.000Z"`.
    - `benefitEndIso("2026-10-25")` gives `"2026-10-25T22:59:59.000Z"`. That day is when daylight saving ends, so the time zone at day's end is CET.
    - `benefitEndIso("2026-10-24")` gives `"2026-10-24T21:59:59.000Z"`.
    - `benefitDateFromIso("2026-10-25T22:59:59.000Z")` gives `"2026-10-25"`.
    - `null`, `""` and `"not-a-date"` give null.
  - schema:
    - a member benefit with a title only passes and defaults to `redemption_type "none"` and `section "member"`.
    - both titles blank fail on `title_nb`.
    - code with a blank value fails on `redemption_value` with `"Add the code"`.
    - a link of `"http://x.no"` fails; `"https://x.no"` passes.
    - an end before the start fails on `publish_end`.
    - `redemption_type "qr"` fails.
    - `campus_id "6"` fails.
    - a career line with only `title_nb` passes.
  - columns:
    - a career value with a partner and code gets normalized to `partner_id null`, `redemption_type "none"`, `redemption_value null`, `category null`, `is_featured false`.
    - a member value with no category gets `category "other"`.
    - the partner snapshot is copied into `partner_name` and `partner_logo_url`.
    - `title_en` blank falls back to `title_nb`.
    - `benefitRowPermissions("published")` gives `['read("any")']`; `"draft"` gives `[]`.
    - the output has no `kind`, `teaser_nb` or `is_member_only` keys.
- [ ] **Step 2: Run them to verify failure.** Run `cd apps/admin && bun test src/lib/benefits "src/app/(portal)/_actions/schemas.test.ts"`. Expected: FAIL.
- [ ] **Step 3: Implement.** Remove the old benefit cases from `schemas.test.ts`, including the `department_id` test. Hoist regexes.
- [ ] **Step 4: Run the tests.** Expected: PASS. Other admin tests may now fail to compile against the new `BenefitFormValues`; Task 4 owns those.
- [ ] **Step 5: Commit.**

```bash
git commit -m "feat(admin): sectioned benefit schema, Oslo dates and column building"
```

---

### Task 4: Rewrite the benefit server actions

**Files:**
- Modify (rewrite): `apps/admin/src/app/(portal)/_actions/benefits.ts`
- Modify: `apps/admin/src/app/(portal)/_actions/benefits-relationships.test.ts` (rename the describe blocks to the new behaviour; department cases removed), `benefits-pagination.test.ts`, `benefits-translation.cases.ts`, `content-scoping.test.ts` (benefit case)
- Create: `apps/admin/src/app/(portal)/_actions/benefits-board.test.ts`

**Interfaces:**
- Consumes: Task 2 `benefitAccessFor`, `assertBenefitCampusWrite`, `canEditBenefitCampus`; Task 3 schema, dates and columns; `benefitDisplayState` is not needed server-side.
- Produces (`"use server"`, async exports only; result types exported as `type`):

```ts
export interface BoardBenefit { $createdAt: string; $id: string; campus_id: string; category: string | null; image_url: string | null; is_featured: boolean; partner_id: string | null; publish_end: string | null; publish_start: string | null; redemption_type: string; section: string; sort_order: number; status: string; title_en: string; title_nb: string }
export interface BoardPartner { campus_id: string | null; id: string; is_active: boolean; logo_url: string | null; name: string }
export interface BenefitBoardData { benefits: BoardBenefit[]; campusId: string; editable: boolean; partners: BoardPartner[] }
export interface BenefitEditData extends BoardBenefit { description_en: string | null; description_nb: string | null; editable: boolean; redemption_value: string | null; terms_en: string | null; terms_nb: string | null }
export type BenefitMutationResult = { data: string; translationQueued?: true } | { error: string | Record<string, string[] | undefined> };

export async function loadBenefitBoard(campusId: string): Promise<BenefitBoardData>; // throws "Unauthorized: no access to this campus" if not visible
export async function getBenefitForEdit(id: string): Promise<BenefitEditData | null>; // null if missing or not visible
export async function createBenefit(values: BenefitFormValues, autoTranslation?: AutoTranslationOptions): Promise<BenefitMutationResult>;
export async function updateBenefit(id: string, values: BenefitFormValues, autoTranslation?: AutoTranslationOptions): Promise<BenefitMutationResult>;
export async function deleteBenefit(id: string): Promise<{ data: string } | { error: string }>;
export async function reorderBenefits(campusId: string, section: string, orderedIds: string[]): Promise<{ data: true } | { error: string }>;
export async function setBenefitStatus(id: string, status: "draft" | "published" | "archived"): Promise<BenefitMutationResult>;
export async function generateBenefitTranslationDraft(input: { campusId: string; description: string; sourceLocale: ContentLocale; title: string }): Promise<{ data: { description: string; title: string } } | { error: string }>;
export async function listBenefits(params: ListParams & { status?: string }): Promise<PaginatedResult<CampusBenefits>>; // kept for the assistant
export async function listPartners(...) // unchanged (sponsor table; stage 3 replaces)
```

Behaviour:
- Every action starts with `requireAuth()` and uses the **admin client**.
- **Reads:**
  - `loadBenefitBoard` reads `campus_benefits` where `campus_id` is in `["5"]` (national tab) or `[campusId, "5"]`, all statuses, `Query.limit(500)`, ordered by `sort_order` asc then `$createdAt` asc. It maps rows to `BoardBenefit`, which has **no** code field.
  - It also reads `benefit_partners` for the referenced partner IDs plus the campus's and national partners (`Query.limit(500)`).
  - `editable = canEditBenefitCampus(access, campusId)`.
  - `getBenefitForEdit` returns the row plus `redemption_value` from `benefit_codes` (`getRow`, where a 404 means none). It falls back to the row's legacy `redemption_value`, and returns `editable` for the row's campus.
- **Create and update:**
  - Run `benefitSchema.safeParse`, then `normalizeBenefitValues`.
  - Check `assertBenefitCampusWrite` on the requested campus. On update, check it on the stored campus too.
  - Load the partner snapshot when `partner_id` is set; a missing partner gives `{ error: "Partner not found" }`.
  - `sort_order`: on create, the highest `sort_order` of that campus and section plus 1. On update, keep the stored value unless the campus or section changed, in which case it moves to the end.
  - `upsertRow("app","campus_benefits", id, {...buildBenefitColumns(...), contentTranslations: <children as today>}, benefitRowPermissions(status))`. Translation children use `buildContentTranslationPermissions({audience:"public", status, ...})` with the existing child-building logic, minus `short_description`/teaser.
  - **Codes:** `benefitSecretValue` non-null leads to `upsertRow("app","benefit_codes", id, {benefit_id:id, value, updated_by: ctx.userId}, [])`. Null leads to a `deleteRow` of the code row, ignoring a 404.
  - Then `logAuditEvent` (`benefit_created` / `benefit_updated` with `{status, section}`), the existing `scheduleBenefitTranslation` (with department references removed), `revalidatePath("/benefits")`.
- **Delete:** check write access on the stored campus, delete the code row (ignore 404), delete the benefit, log `benefit_deleted`, revalidate.
- **Reorder:**
  - Check write access on `campusId`.
  - Load the IDs. Every ID must exist with `campus_id === campusId` and `section === section`, and the list must cover every row of that campus and section. Otherwise return `{ error: "Reorder list is out of date" }`.
  - Write `sort_order = index` only where it changed, log `benefits_reordered`, revalidate.
- **`setBenefitStatus`:** load the row and its code, map them to `BenefitFormValues` (dates via `benefitDateFromIso`), and call `updateBenefit(id, {...values, status})`. This keeps a single write path.
- **`listBenefits`:** filter `Query.equal("campus_id", benefitAccessFor(ctx).visibleCampusIds)`, or a no-match filter when the list is empty. Keep the status and `q` filters and pagination. `campusId`/`kind` params are removed.
- Remove `_deleteBenefit` and all department logic (`assertContentOwnership`, `deriveContentRowTeams`, `loadRecruitmentLookups`) from this file.

- [ ] **Step 1: Write the failing tests** (mock `@repo/api/server` with an admin `db` of `getRow/listRows/upsertRow/updateRow/deleteRow` mocks; `@/lib/authorization` → `requireAuth`; `next/cache`; `./audit-log`; `@/lib/content-translation.server` as the cases file does today):
  - **create as campus admin of "2"**:
    - Upserts `campus_benefits` with `campus_id "2"`, `department: null`, `section "member"`, permissions `['read("any")']` when published.
    - Upserts `benefit_codes` with `[]` permissions and the code.
    - The benefit data's `redemption_value` equals the code (compatibility copy).
  - **create on "5" as campus admin**: returns `{error: "Unauthorized: no write access to this campus"}` with no upsert.
  - **create as benefits editor on "5"**: succeeds.
  - **sort order**: with existing rows of sort 0 and 3 in that campus and section, the new row gets 4.
  - **update keeps published**: values with `status "published"` keep `read("any")`.
  - **update to redemption "none"** deletes the code row. A 404 from that delete is ignored.
  - **update moving campus 2 → 3 as campus admin of 2 only**: refused.
  - **delete**: removes the code row and then the benefit, and logs `benefit_deleted`. Refused across campus.
  - **reorder**:
    - Writes only the changed `sort_order`s.
    - An ID from another section returns `{error: "Reorder list is out of date"}`.
    - A missing row ID returns the same error.
  - **setBenefitStatus("published")** on a draft row with a code: the upsert permissions become `['read("any")']`, and the code is re-written unchanged.
  - **loadBenefitBoard("2")**:
    - Queries `campus_id` in `["2","5"]`.
    - The returned benefits have no `redemption_value` key.
    - `editable` is false for a campus admin of "3" (visible "3","5" only), which throws for "2". A campus admin of "2" gets `editable: true`, and on `"5"` gets `editable: false`.
  - **getBenefitForEdit** returns the code from `benefit_codes`, and the legacy value when no code row exists.
  - **listBenefits**: a campus admin of "2" gets `Query.equal("campus_id", ["2","5"])`; pagination offset and search assertions as before.
  - The translation cases are updated: the `departmentId` cases are gone, campus denial is kept, and auto-translate scheduling is kept.
- [ ] **Step 2: Run them to verify failure.** Run `cd apps/admin && bun test "src/app/(portal)/_actions/benefits-board.test.ts" "src/app/(portal)/_actions/benefits-relationships.test.ts" "src/app/(portal)/_actions/benefits-pagination.test.ts" "src/app/(portal)/_actions/content-translation-actions.test.ts" "src/app/(portal)/_actions/content-scoping.test.ts"`. Expected: FAIL.
- [ ] **Step 3: Implement.** Keep the file focused. If it passes ~600 lines, move the translation helpers into `apps/admin/src/lib/benefits/benefit-translations.ts` (a plain module).
- [ ] **Step 4: Run the same command, then `bun --filter=admin check-types`.** Expected: PASS. Other admin files that used removed exports (old editor, list page) may fail to compile; leave them for Tasks 9–10 and note them in the report.
- [ ] **Step 5: Commit.**

```bash
git commit -m "feat(admin): benefit actions for the board (codes, delete, reorder, status)"
```

---

### Task 5: Partner picker actions

**Files:**
- Create: `apps/admin/src/app/(portal)/_actions/benefit-partners.ts`, `apps/admin/src/app/(portal)/_actions/benefit-partners.test.ts`

**Interfaces:**
- Consumes: Task 2 access helpers; `BoardPartner` type (Task 4).
- Produces:

```ts
export async function listBenefitPartners(campusId: string): Promise<BoardPartner[]>; // partners on campusId + "5", active and ended, name asc; throws if campus not visible
export async function createBenefitPartner(input: { campus_id: string; logo_url?: string | null; name: string; website_url?: string | null }): Promise<{ data: BoardPartner } | { error: string }>;
```

`createBenefitPartner`:
- Requires write access to `input.campus_id` and a name of 1–200 characters after trimming. Otherwise it returns `{error: "Add the partner's name"}`.
- `website_url` is null or an https URL; anything else returns `{error: "The website must start with https://"}`.
- Creates the row with `ID.unique()`, `is_active: true` and permissions `['read("any")']`.
- Logs `benefit_partner_created`, then `revalidatePath("/benefits")`.

Stage 3 adds update, end, restart and delete to this file.

- [ ] **Step 1: Write the failing tests**:
  - `listBenefitPartners("2")` queries `campus_id` in `["2","5"]` with ascending name order.
  - A campus admin of "3" calling `listBenefitPartners("2")` throws.
  - A campus admin of "2" calling `createBenefitPartner({campus_id:"5"})` is refused.
  - A blank name returns the error.
  - A website of `"http://x"` returns the error.
  - A valid input upserts or creates with `['read("any")']` and returns the mapped `BoardPartner`.
- [ ] **Step 2: Run them to verify failure.** `cd apps/admin && bun test "src/app/(portal)/_actions/benefit-partners.test.ts"`
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them to verify they pass.**
- [ ] **Step 5: Commit.** `git commit -m "feat(admin): list and create benefit partners for the picker"`

---

### Task 6: Assistant and approvals publish benefits through `setBenefitStatus`

**Files:**
- Modify: `apps/admin/src/app/api/assistant/route.ts` (`publishCreatedContent` and the `publishContent` tool: route `benefits` to `setBenefitStatus(id, "published")`; `createContent` for benefits ignores `departmentId`)
- Modify: `apps/admin/src/app/(portal)/_actions/approvals.ts` (approved `benefits` publish calls `setBenefitStatus`)
- Test: the nearest existing tests for these files (`apps/admin/src/app/api/assistant/*.test.ts`, `apps/admin/src/app/(portal)/_actions/approvals*.test.ts`). If none covers publishing, add a focused test file next to each.

**Interfaces:**
- Consumes: `setBenefitStatus` (Task 4).

- [ ] **Step 1: Write the failing tests.** Assistant `publishContent({domain:"benefits", id})` calls `setBenefitStatus(id, "published")` and never `db.updateRow` on `campus_benefits`. An approved benefits publish calls `setBenefitStatus` too. If `setBenefitStatus` returns `{error}`, the assistant returns that error and the approval throws it.
- [ ] **Step 2: Run them to verify failure.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the tests and `bun --filter=admin check-types`.**
- [ ] **Step 5: Commit.** `git commit -m "fix(admin): assistant and approvals publish benefits with fresh permissions"`

---

### Task 7: Board and panel state (pure)

**Files:**
- Create: `apps/admin/src/app/(portal)/benefits/_lib/board.ts` (+ `.test.ts`), `apps/admin/src/app/(portal)/benefits/_lib/panel-state.ts` (+ `.test.ts`)

**Interfaces:**
- Consumes: `benefitDisplayState`, `BenefitDisplayState` (`@repo/shared/utils/benefit-visibility`); `BENEFIT_SECTIONS`, `NATIONAL_CAMPUS_ID`; `BoardBenefit`, `BoardPartner`, `BenefitEditData` types (Task 4); `BenefitFormValues` (Task 3); `benefitDateFromIso` (Task 3).
- Produces:

```ts
// board.ts
export interface BoardItem { benefit: BoardBenefit; partner: BoardPartner | null; state: BenefitDisplayState }
export interface BoardSection { national: BoardItem[]; own: BoardItem[]; section: BenefitSection }
export function buildBoardSections(benefits: BoardBenefit[], partners: BoardPartner[], campusId: string, now: Date): BoardSection[]; // all five sections in BENEFIT_SECTIONS order
export function summarizeBoard(sections: BoardSection[], now: Date): { drafts: number; endingSoon: number; visible: number }; // own items only
export function reorderIds(ids: string[], activeId: string, overId: string): string[];
export const ENDING_SOON_DAYS = 30;

// panel-state.ts
export type PanelAction = "delete" | "hide" | "publish" | "saveChanges" | "saveDraft";
export interface PanelValues { campusId: string; category: string | null; descriptionEn: string; descriptionNb: string; endDate: string; imageUrl: string; isFeatured: boolean; partnerId: string | null; redemptionType: "code" | "link" | "none" | "onsite"; redemptionValue: string; section: BenefitSection; startDate: string; status: "archived" | "draft" | "published"; termsEn: string; termsNb: string; timing: "always" | "range"; titleEn: string; titleNb: string }
export type PanelErrorKey = "codeRequired" | "endBeforeStart" | "linkInvalid" | "linkRequired" | "titleRequired";
export function emptyPanelValues(section: BenefitSection, campusId: string): PanelValues; // status draft, timing always, redemption none
export function panelValuesFromBenefit(data: BenefitEditData): PanelValues;
export function panelFooterActions(status: PanelValues["status"], isNew: boolean): PanelAction[];
export function validatePanel(values: PanelValues, action: PanelAction): Partial<Record<"endDate" | "redemptionValue" | "titleNb", PanelErrorKey>>;
export function toBenefitFormValues(values: PanelValues, action: Exclude<PanelAction, "delete">): BenefitFormValues;
```

Rules:
- `buildBoardSections`:
  - `own` holds rows with `campus_id === campusId`.
  - `national` holds rows with `campus_id === "5"`, but only when `campusId !== "5"`; otherwise it is empty.
  - State comes from `benefitDisplayState(benefit, partner, now)`, where `partner` is the one whose `id` equals `partner_id`, mapped `{is_active}`.
  - Within each list, items whose state is `visible`, `scheduled` or `draft` come first, then `expired`, `ended` and `hidden`. Inside each group, order by `sort_order` asc, then `$createdAt` asc.
- `summarizeBoard` counts own items:
  - `visible`: state `visible`.
  - `drafts`: state `draft`.
  - `endingSoon`: `visible` with `publish_end` within `ENDING_SOON_DAYS` days of `now`.
- `reorderIds` is a pure array move of `activeId` to `overId`'s index. It returns the input unchanged when either ID is missing or they are equal.
- `panelFooterActions`:
  - New item: `["saveDraft","publish"]`.
  - `draft`: `["saveDraft","publish","delete"]`.
  - `archived`: `["saveDraft","publish","delete"]`.
  - `published`: `["saveChanges","hide","delete"]`.
- `toBenefitFormValues` sets the status from the action: `saveDraft` gives `draft`, `publish` gives `published`, `saveChanges` keeps the current status, and `hide` gives `archived`.
  - `timing: "always"` sends null for both dates.
  - Blank strings become null.
  - `redemption_value` is sent only for code and link.
- `validatePanel` (skipped for `hide`):
  - `titleRequired` when both titles are blank.
  - For member sections: `codeRequired` or `linkRequired` when the value is blank. `linkInvalid` when a link doesn't start with `https://`.
  - `endBeforeStart` when `timing` is `range`, both dates are set, and end < start.

- [ ] **Step 1: Write the failing tests** with fixed `now = new Date("2026-10-22T10:00:00Z")`:
  - **Sections:**
    - All five sections come back in order.
    - On campus "2", a national row lands in `national` and a campus "2" row in `own`. A campus "1" row appears in neither.
    - On "5", `national` is empty and national rows are in `own`.
    - An expired item sorts after a draft even with a lower `sort_order`.
    - A deal whose partner is inactive has state `ended`.
  - **Summary:**
    - A visible item ending `2026-11-10T22:59:59Z` counts in `endingSoon`; one ending in December doesn't.
    - National items are not counted on campus tabs.
  - **reorderIds:**
    - `(["a","b","c"],"c","a")` gives `["c","a","b"]`.
    - A missing ID returns the input.
  - **Footer actions:** each of the four cases above.
  - **toBenefitFormValues:**
    - `saveChanges` on a published item keeps `published`.
    - `hide` gives `archived`.
    - `timing "always"` nulls the dates.
    - `onsite` sends a null `redemption_value`.
  - **validatePanel:** each error key once, and `hide` skips validation.
  - **panelValuesFromBenefit:** maps a published row with `publish_end` to `timing "range"` and `endDate` in Oslo time.
- [ ] **Step 2: Run them to verify failure.** `cd apps/admin && bun test "src/app/(portal)/benefits/_lib"`
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them to verify they pass.**
- [ ] **Step 5: Commit.** `git commit -m "feat(admin): pure board and panel state for benefits"`

---

### Task 8: Copy (i18n)

**Files:**
- Modify: `packages/i18n/messages/no/adminPortal.json`, `packages/i18n/messages/en/adminPortal.json` (under `benefits`; keep existing keys that other code still uses, and delete keys only used by the removed editor in Task 10)

**Interfaces:**
- Produces the keys below in **both** files. Norwegian is exact; English is a plain translation.

| Key (under `benefits.`) | Norwegian |
|---|---|
| `board.title` | Medlemsfordeler |
| `board.eyebrow` | Fordeler |
| `board.partners` | Partnere |
| `board.newBenefit` | + Ny fordel |
| `board.nationalTab` | Hele BISO |
| `board.kpiVisible` | synlige på nettsiden |
| `board.kpiDrafts` | utkast |
| `board.kpiEndingSoon` | utløper innen 30 dager |
| `board.add` | + Legg til |
| `board.fromNational` | Fra Hele BISO |
| `board.readOnlyNational` | Disse gjelder alle campuser. Bare administratorer kan endre dem. |
| `board.emptySection` | Ingen her ennå. Trykk «+ Legg til» for å lage den første. |
| `board.dragHint` | Dra for å endre rekkefølgen. Det er rekkefølgen studentene ser. |
| `board.reorderFailed` | Kunne ikke lagre rekkefølgen. Prøv igjen. |
| `states.visible` / `draft` / `scheduled` / `expired` / `ended` / `hidden` | Synlig / Utkast / Planlagt / Utløpt / Avsluttet / Skjult |
| `panel.newTitle` | Ny fordel |
| `panel.editTitle` | Endre fordel |
| `panel.preview` | Slik ser studentene det |
| `panel.offer` | Hva er tilbudet? |
| `panel.more` | Fortell litt mer |
| `panel.optional` | valgfritt |
| `panel.partner` | Hvilken partner? |
| `panel.noPartner` | Ingen partner (BISO) |
| `panel.newPartner` | + Ny partner |
| `panel.partnerName` | Navn |
| `panel.partnerWebsite` | Nettside |
| `panel.partnerLogo` | Logo |
| `panel.savePartner` | Lagre partner |
| `panel.redeem` | Hvordan får studentene rabatten? |
| `panel.redeemOnsite` / `redeemCode` / `redeemLink` / `redeemNone` | Vis medlemskortet / Rabattkode / Lenke / Ingen |
| `panel.codeLabel` | Rabattkode |
| `panel.linkLabel` | Lenke |
| `panel.membersOnly` | vises bare for medlemmer |
| `panel.timing` | Hvor lenge gjelder det? |
| `panel.timingAlways` | Til vi tar det bort |
| `panel.timingRange` | Fra … til … |
| `panel.from` / `panel.to` | Fra / Til |
| `panel.moreOptions` | Flere valg |
| `panel.category` | Kategori |
| `panel.terms` | Vilkår |
| `panel.image` | Bilde |
| `panel.featured` | Vis først |
| `panel.featuredHelp` | Vises øverst i medlemsportalen og på Medlemskap-siden. |
| `panel.english` | Engelsk tekst |
| `panel.lineQuestion` | Hva får studentene? |
| `panel.lineQuestionBusiness` | Hva får bedriftene? |
| `panel.draftNote` | Lagres som utkast til du publiserer |
| `panel.saveDraft` / `publish` / `saveChanges` / `hide` / `delete` | Lagre utkast / Publiser / Lagre endringer / Skjul fra nettsiden / Slett |
| `panel.close` | Lukk |
| `panel.deleteTitle` | Slette «{title}»? |
| `panel.deleteBody` | Fordelen forsvinner fra nettsiden med en gang. Dette kan ikke angres. |
| `panel.cancel` | Avbryt |
| `panel.saved` / `published` / `hidden` / `deleted` | Lagret / Publisert / Skjult fra nettsiden / Slettet |
| `panel.saveFailed` | Kunne ikke lagre. Prøv igjen. |
| `errors.titleRequired` | Skriv hva tilbudet er. |
| `errors.codeRequired` | Skriv inn rabattkoden. |
| `errors.linkRequired` | Skriv inn lenken. |
| `errors.linkInvalid` | Lenken må starte med https:// |
| `errors.endBeforeStart` | Sluttdatoen må være etter startdatoen. |

- [ ] **Step 1: Add the keys** to both files, valid JSON with the existing indentation.
- [ ] **Step 2: Verify parity.** `python3 -I -c` loads both files and asserts that the flattened key sets under `benefits` are equal. It prints any difference; expected: none.
- [ ] **Step 3: Commit.** `git commit -m "feat(i18n): copy for the benefits board and panel"`

---

### Task 9: The board page

**Files:**
- Modify: `apps/admin/package.json` (add `"@dnd-kit/core": "catalog:"`, `"@dnd-kit/sortable": "catalog:"`, `"@dnd-kit/utilities": "catalog:"`, then `bun install` at the root)
- Create:
  - `apps/admin/src/app/(portal)/benefits/_components/benefit-board-page.tsx` (server)
  - `benefit-board.tsx` (client)
  - `benefit-board-section.tsx` (client)
  - `benefit-tile.tsx` (client, member cards)
  - `benefit-line.tsx` (client, one-line rows)
  - `benefit-state-pill.tsx`
- Create: `apps/admin/src/app/(portal)/_actions/benefit-board-prefs.ts` (`"use server"`: `rememberBenefitBoardCampus(campusId: string): Promise<void>`, which sets the cookie `benefits_board_campus`, path `/benefits`, one year, `sameSite: "lax"`)
- Modify (rewrite): `apps/admin/src/app/(portal)/benefits/page.tsx` (renders `BenefitBoardPage` with no open item)
- Test: `apps/admin/src/app/(portal)/benefits/_components/benefit-board.test.tsx` (harness `src/test/react-dom-harness.ts`, as in `filter-chip-link.test.tsx`)

**Interfaces:**
- Consumes: Tasks 2, 4, 7 and 8.
- Produces:
  - `BenefitBoardPage({ campus, openId }: { campus?: string; openId?: string | "new"; newSection?: string })` (server component). Tasks 10 and 11 reuse it.
  - The client component `BenefitBoard` receives `{ data: BenefitBoardData; access: BenefitAccess; locale: "no" | "en"; open?: ReactNode }`, where `open` is the panel slot filled in Task 10.

Behaviour:
- **Server page:**
  - Starts with `requireNavAccess("portal.benefits")` and computes `access = benefitAccessFor(ctx)`.
  - Campus: the `campus` search param, else the `benefits_board_campus` cookie, else `access.editableCampusIds[0]`, else `"5"`.
  - If the campus isn't visible, fall back to the first visible one.
  - It calls `loadBenefitBoard` and passes the labels.
- **Header:** `StudioPageHeader`, with eyebrow `board.eyebrow`, title `board.title`, and the buttons `board.partners` → `/benefits/partners` and `board.newBenefit` → `/benefits/new?campus=<c>&section=member`. The new-benefit button is hidden when the tab isn't editable.
- **Tabs:**
  - One tab per visible campus in the fixed order, with the label from the `campus` table name and `board.nationalTab` for `"5"`. Each tab is a link to `?campus=<id>` that also calls `rememberBenefitBoardCampus`.
  - The current tab is underlined in `STUDIO.gold`.
- **Summary:** a `StudioKpiStrip` with three `StudioKpi` from `summarizeBoard`.
- **Sections:**
  - The five sections in order. The header shows the section label (serif) and, when editable, `board.add` → `/benefits/new?campus=<c>&section=<s>`.
  - `member` items render as a 3-column grid of `BenefitTile`: initials logo or `logo_url`, title, partner · category, state pill. The other sections render as `BenefitLine` rows: title and state pill.
  - `expired`/`ended`/`hidden` items render at 55% opacity.
  - Clicking an item goes to `/benefits/<id>?campus=<c>`.
  - Under `own`, when `national` isn't empty, a quiet `board.fromNational` divider is followed by the national items (not draggable, no add button).
  - An empty `own` list shows `board.emptySection`.
  - When the tab is read-only, `board.readOnlyNational` shows above the sections and nothing is draggable.
- **Drag:**
  - Applies within `own` of one section when the tab is editable: `DndContext` + `SortableContext` (vertical for lines, rect sorting for tiles), `PointerSensor` `{activationConstraint:{distance:8}}`, `KeyboardSensor`.
  - On drop: `reorderIds` → an optimistic local order → `reorderBenefits(campusId, section, ids)`. On `{error}`, revert and `toast.error(board.reorderFailed)`.
  - A drag never opens the item.
- **State pill:** colours follow the `STUDIO` palette.
  - `visible`: leaf green on pale green.
  - `draft` and `hidden`: ink3 on paper2.
  - `scheduled`: sky on pale blue.
  - `expired` and `ended`: gold-brown on pale gold.
  - Labels come from `states.*`.

- [ ] **Step 1: Write the failing component test.**
  - Render `BenefitBoard` with campus "2" data:
    - one visible member tile
    - one draft career line
    - one national member item
  - Assert:
    - five section headings
    - the tile title and the "Synlig" pill
    - the "Fra Hele BISO" divider before the national item
    - `+ Legg til` links carrying `section=career`
    - with `access` read-only for that campus, no `+ Legg til` links and the read-only note shown
  - Mock `next/navigation` and the actions module (`mock.module`).
- [ ] **Step 2: Run it to verify failure.** `cd apps/admin && bun test "src/app/(portal)/benefits/_components/benefit-board.test.tsx"`
- [ ] **Step 3: Implement** the components and the rewritten `page.tsx`. Delete the old list grid code in `page.tsx`.
- [ ] **Step 4: Run the test and `bun --filter=admin check-types`.**
- [ ] **Step 5: Commit.** `git commit -m "feat(admin): benefits board per campus"`

---

### Task 10: The panel (create and edit)

**Files:**
- Create in `apps/admin/src/app/(portal)/benefits/_components/`:
  - `benefit-panel.tsx` (client, Radix `Sheet` from `@repo/ui/components/ui/sheet`, `side="right"`, className overriding the width to `w-full sm:max-w-[560px]`)
  - `benefit-preview.tsx`
  - `partner-picker.tsx`
  - `benefit-delete-dialog.tsx` (`@repo/ui/components/ui/alert-dialog`)
- Modify (rewrite): `apps/admin/src/app/(portal)/benefits/[id]/page.tsx`. It renders `BenefitBoardPage` with `openId = params.id` (`"new"` included), passing `newSection` and the campus from the search params.
- Delete: `apps/admin/src/app/(portal)/benefits/[id]/_components/benefit-editor-client.tsx`. Keep `benefit-save-error.ts` if the panel uses `describeBenefitSaveError`, otherwise delete it and its test.
- Test: `apps/admin/src/app/(portal)/benefits/_components/benefit-panel.test.tsx`

**Interfaces:**
- Consumes: Tasks 3, 4, 5, 7 and 8; `AutoTranslateControl` (`apps/admin/src/app/_components/content-translation-controls.tsx`); `ImageUploadField` (`(portal)/_components/image-upload-field.tsx`); `Pill`, `FieldLabel`, `fieldInputStyle` (`(portal)/communications/_components/composer/ui.tsx`); `toast` from `sonner`.
- `BenefitBoardPage` with `openId` loads `getBenefitForEdit(openId)`. `notFound()` applies when it returns null. For `"new"` it uses `emptyPanelValues(section, campus)`, and new is refused when the campus isn't editable. It also loads `listBenefitPartners(campus)`. It passes `<BenefitPanel …/>` as the board's `open` slot.

Behaviour:
- The sheet opens on mount. Closing (✕, Esc, overlay) goes to `/benefits?campus=<c>`.
- The header has a muted eyebrow `<campus name> · <section label>` and a serif title (`panel.newTitle` or `panel.editTitle`).
- **Member section, top to bottom:**
  1. `BenefitPreview`, a card in the website style (white, slate text, blue accents) under `panel.preview`. It shows the logo or initials, the title (nb, falling back to en), the description, and a chip: "Vis kode" for code or link, "Vis medlemskortet" for onsite, none otherwise. It updates live.
  2. `panel.offer` (title input).
  3. `panel.more` with the `panel.optional` hint (textarea, 3 rows).
  4. `panel.partner`:
     - `PartnerPicker` is a listbox of partners with logo or initials.
     - The first option is `panel.noPartner`.
     - Ended partners are marked `states.ended`.
     - `panel.newPartner` expands inline fields (name, website, logo via `ImageUploadField`, and `panel.savePartner` → `createBenefitPartner` on the benefit's campus). A new partner is selected automatically.
  5. `panel.redeem`: four `Pill`s. For code or link, the value input with label and `panel.membersOnly` help.
  6. `panel.timing`: two `Pill`s. Range shows two `<input type="date">` labelled `panel.from` and `panel.to`.
  7. `panel.moreOptions` (a disclosure, collapsed by default). It holds:
     - category `select`, from `BENEFIT_CATEGORIES` labels
     - terms nb (textarea)
     - image (`ImageUploadField`)
     - `panel.featured` toggle with help
     - `panel.english`: title en, description en and terms en, with `AutoTranslateControl`
- **One-line sections:**
  - the question: `panel.lineQuestionBusiness` for business, `panel.lineQuestion` otherwise
  - the title nb input
  - `panel.english` (title en) with `AutoTranslateControl`
  - `panel.timing` as above
- **Footer:**
  - `panelFooterActions(status, isNew)` buttons, with the primary action styled as `StudioButton` claret.
  - `delete` sits left as a red outline button and opens the confirm dialog (`panel.deleteTitle` / `panel.deleteBody` / `panel.cancel` / `panel.delete`).
  - A muted `panel.draftNote` shows for drafts.
- **Actions:**
  - Each save runs `validatePanel`. Errors show under their fields with `errors.*`.
  - Then `toBenefitFormValues` → `createBenefit` / `updateBenefit` (with auto-translate options).
  - Success shows a toast (`panel.saved` / `published` / `hidden`) and navigates to `/benefits?campus=<c>` with `router.refresh()`.
  - `{error}` shows `toast.error(panel.saveFailed)` plus `describeBenefitSaveError` details when present.
  - Delete → `deleteBenefit` → toast `panel.deleted` → back to the board.
- A read-only item (`editable: false`) renders the same panel with every input disabled and no footer actions.

- [ ] **Step 1: Write the failing component tests.**
  - A new member panel shows the six labelled questions in order and the footer "Lagre utkast" and "Publiser".
  - Choosing "Rabattkode" reveals the code field with "vises bare for medlemmer".
  - A published item shows "Lagre endringer", "Skjul fra nettsiden" and "Slett".
  - Clicking "Lagre endringer" calls the mocked `updateBenefit` with `status: "published"`.
  - Clicking "Publiser" with both titles blank shows "Skriv hva tilbudet er." and does not call the action.
  - A career panel shows "Hva får studentene?" and no partner question; a business panel shows "Hva får bedriftene?".
  - A read-only panel has no footer buttons.
- [ ] **Step 2: Run them to verify failure.** `cd apps/admin && bun test "src/app/(portal)/benefits/_components/benefit-panel.test.tsx"`
- [ ] **Step 3: Implement** the panel, the `[id]` page, and the deletion of the old editor.
- [ ] **Step 4: Run the panel and board tests and `bun --filter=admin check-types`.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(admin): slide-in benefit panel replaces the old editor"`

---

### Task 11: Verification

- [ ] **Step 1: Run all the checks.**
  - `cd apps/admin && bun test ./src`
  - `cd packages/ai && bun x vitest run`
  - `cd packages/shared && bun run test`
  - `cd apps/web && bun run test`
  - `bun run check-types` (root)
  - `bun run build --filter=admin` (catches non-async exports from `"use server"` files)
  - `git diff --name-only <stage-2 base>..HEAD -- '*.ts' '*.tsx' | xargs bun x ultracite check`

  Expected: every command exits 0. Report failures with their output.
- [ ] **Step 2: Grep checks.**
  - `rg "team:biso-members" apps/admin/src` returns no benefit code path.
  - `rg "department" "apps/admin/src/app/(portal)/_actions/benefits.ts"` returns only `department: null` through `buildBenefitColumns`.
  - `rg "redemption_value" "apps/admin/src/app/(portal)/benefits"` returns nothing; codes never reach board components.
- [ ] **Step 3: Owner notes** (for the final summary):
  1. Set `BENEFITS_EDITOR_EMAILS=pr@biso.no` (or the address the leader signs in with) in the admin app's Appwrite Sites env and redeploy.
  2. The Stage 1 schema must be pushed before this admin ships.
  3. The board shows the migrated one-line rows only after the stage 1 migration is applied.
  4. Stage 4 must follow soon: until then codes and partner names are also copied into the public row columns, as today.
