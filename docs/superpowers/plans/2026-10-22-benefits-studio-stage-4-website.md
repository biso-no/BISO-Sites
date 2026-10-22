# Benefits Studio, Stage 4 (Website switch, code leak fix, freshness) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every benefit on the website comes from `campus_benefits`, the admin-managed table, and no longer from `campus_data`. Redemption codes and member links reach only active members, through a server-side reveal. Admin saves show up on the website within about a minute.

**Architecture:**
- **Shared pure modules** (`packages/shared/utils/benefit-public.ts`) turn raw rows and partners into a public `PublicBenefit` list. The list has no secrets, applies the visibility rules and uses campus-first order. These modules are client-safe, so client pages can filter by the campus a visitor selects.
- **Shared reveal** (`benefit-reveal-server.ts`): one reveal function with the database injected. The web uses it now; `apps/api` uses it in stage 5.
- **Web data:** `apps/web/src/lib/data/benefits.ts` adds tag-cached readers (`cacheLife("minutes")` + `cacheTag`).
- **Revalidation:** a new web route, `POST /api/revalidate`, is protected by `CRON_SECRET`. Admin actions call it after saves.
- **Cleanup:** the stage 2 compatibility copies are removed, a script clears the legacy code column, and the table-level `read("any")` on `campus_benefits` is dropped in the config. The owner pushes that config change.

**Tech Stack:** Next.js 16 (Cache Components on: `"use cache"`, `cacheLife`, `cacheTag`, `revalidateTag`; read `apps/web/node_modules/next/dist/docs` for the exact Next 16 signatures before using them), React 19, next-intl, Vitest (web/shared), bun:test (admin).

**Spec:** `docs/superpowers/specs/2026-10-21-benefits-studio-design.md` (D2, D3, D4, D9 campus logos, D10). Recon: `.superpowers/sdd/stage-4-6-web-recon.md`.

## Global Constraints

- **apps/web rules** (`apps/web/CLAUDE.md`):
  - Cached readers in `src/lib/data/` **throw** on failure and never return a false empty; call sites own `.catch(() => [])`.
  - `"use cache"` functions must not read cookies or headers, and must not call `new Date()`. Apply the date-based visibility filter **after** reading cached rows, at request time.
  - `next build` ignores type errors. Run `bun run check-types`.
- **What `PublicBenefit` holds:** it never contains `redemption_value`, and neither do the cached rows. Cached reads use `Query.select` without that column. Code and link values reach the browser only through the reveal action, and only for active members.
- **Visibility everywhere:** `isBenefitVisible(benefit, partner, now)` (stage 1), where `partner` is the benefit's `benefit_partners` row. A missing partner for a set `partner_id` means not visible.
- **Order everywhere:** the campus's own rows first, then national (`"5"`), each by `sort_order` then `$createdAt` (`orderBenefitsCampusFirst`).
- **"All campuses" selected:** treat it as national only (`resolveBenefitCampusIds` semantics).
- **Campus for the member portal:** the switcher cookie (`getActiveCampus()`) first, then the profile's `campus_id`, then national.
- **Freshness:**
  - Benefit readers use `cacheTag("benefits")`. Logo readers use `cacheTag("partners")`. Both use `cacheLife("minutes")`.
  - The web route `POST /api/revalidate` takes body `{ tags: string[] }` and accepts only `benefits`, `partners` and `membership-texts`.
  - It is authorized with `x-cron-secret` or `Authorization: Bearer` matched against `CRON_SECRET` via `safeSecretCompare` (`packages/shared/utils/secrets.ts`), following `apps/web/src/app/api/cron/cleanup-reservations/route.ts`.
  - The admin helper `notifyWebsite(tags)` posts to `${NEXT_PUBLIC_WEB_BASE_URL}/api/revalidate` with a 3 s timeout and fails soft: it logs and never throws.
- **Copy:** new website strings go in `packages/i18n/messages/{no,en}/*.json` in the namespace the component already uses. Section labels come from `BENEFIT_SECTION_LABELS` (nb for locale `no`). Category labels come from `benefitCategoryLabel` (`apps/web/src/lib/benefit-text.ts`). Locales are `"no" | "en"`.
- **Commands:**
  - web: `cd apps/web && bun x vitest run <file>`
  - shared: `cd packages/shared && bun x vitest run <file>`
  - admin: `cd apps/admin && bun test <file>`
  - Run the full suites before each commit, then `bun run check-types`.
  - With bun's process-wide `mock.module` (admin), spread real exports.
- Run `bun x ultracite fix <changed files>`. Never write to production.

## Review Focus

- **A non-member, or a logged-out visitor, never gets a code or link.** This covers the RSC payload, component props, server action results, and a direct reveal call on someone else's benefit. Covered by Task 2 and Task 5 tests.
- **A membership-check outage is not reported as "not a member".** The reveal returns `unavailable` and the card says to try again (Task 2 and Task 5 tests).
- **A deal whose partner has ended, or whose end date has passed, disappears everywhere at once**, including the campus page, `/students`, `/membership` and the portal, with no cache delay beyond the minute (Task 1 tests, plus readers using request-time `now`).
- **`/students` keeps four slots per card:** the campus's own deals fill them before national ones (Task 1 `benefitsForCampus` test, plus the Task 6 test).
- **The revalidate route refuses a wrong or missing secret in production, and unknown tags** (Task 4 tests).

---

### Task 1: Public benefit model (shared, pure)

**Files:** Create `packages/shared/utils/benefit-public.ts` (+ `.test.ts`).

**Interfaces:**
- Consumes: `isBenefitVisible`, `orderBenefitsCampusFirst` (`benefit-visibility.ts`); `BENEFIT_SECTIONS`, `BenefitSection`, `NATIONAL_CAMPUS_ID`, `isBenefitSection` (`benefit-catalog.ts`); `resolveBenefitCampusIds` (`benefit-scope.ts`).
- Produces:

```ts
export const BENEFIT_PUBLIC_COLUMNS: readonly string[]; // every campus_benefits column the website needs; never "redemption_value"
export interface BenefitRowInput { $createdAt: string; $id: string; campus_id: string; category?: string | null; description_en?: string | null; description_nb?: string | null; image_url?: string | null; is_featured?: boolean | null; partner_id?: string | null; publish_end?: string | null; publish_start?: string | null; redemption_type?: string | null; section?: string | null; sort_order?: number | null; status: string; terms_en?: string | null; terms_nb?: string | null; title_en?: string | null; title_nb?: string | null }
export interface BenefitPartnerInput { $id: string; is_active?: boolean | null; logo_url?: string | null; name: string; website_url?: string | null }
export interface PublicBenefit { campusId: string; category: string | null; createdAt: string; description: { en: string | null; nb: string | null }; id: string; imageUrl: string | null; isFeatured: boolean; partner: { id: string; logoUrl: string | null; name: string; websiteUrl: string | null } | null; publishEnd: string | null; redemptionType: "code" | "link" | "none" | "onsite"; section: BenefitSection; sortOrder: number; terms: { en: string | null; nb: string | null }; title: { en: string; nb: string } }
export function publicBenefitsFromRows(rows: BenefitRowInput[], partners: BenefitPartnerInput[], now: Date): PublicBenefit[]; // visible only; any campus
export function benefitsForCampus(benefits: PublicBenefit[], campusId: string | null | undefined, sections?: readonly BenefitSection[]): PublicBenefit[]; // campus + national (or national only), campus-first order
export function countVisibleMemberBenefits(benefits: PublicBenefit[], campusId: string | null | undefined): number;
```

Mapping rules:
- `section`: null or unknown becomes `"member"`.
- `redemptionType`: anything outside `code|link|onsite` becomes `"none"`.
- `title`: each language falls back to the other; if both are empty, the row is dropped.
- Blank strings become null.
- `partner`: the partner row's data when `partner_id` matches, otherwise null.

`benefitsForCampus` filters by section when `sections` is given. It then orders with `orderBenefitsCampusFirst`, adapted to the DTO, or an equivalent comparator: own campus, then national, then `sortOrder`, then `createdAt`.

- [ ] **Step 1: Write the failing tests.**
  - **Columns:** `BENEFIT_PUBLIC_COLUMNS` doesn't include `"redemption_value"`.
  - **Filtering:**
    - A draft is dropped.
    - A row whose `publish_end` is before `now` is dropped.
    - A row whose partner has `is_active false` is dropped.
    - A row with a `partner_id` that isn't in `partners` is dropped.
    - A row with no titles is dropped.
  - **Mapping:**
    - A null section maps to member, and `"qr"` maps to `"none"`.
    - A blank `title_en` falls back to `title_nb`.
    - The partner is joined.
  - **`benefitsForCampus`:**
    - With `("2", ["member"])`, Bergen rows come before national rows, and other campuses are excluded.
    - With `null`, only national rows come back.
    - `slice(0,4)` on its result keeps Bergen's own rows when Bergen has 4 and national has 10.
  - **`countVisibleMemberBenefits`:** counts member rows for a campus plus national.
- [ ] **Steps 2–4:** run the tests to see them fail, implement, then run them to see them pass.
- [ ] **Step 5: Commit.** `git commit -m "feat(shared): public benefit model with visibility and campus-first order"`

---

### Task 2: Shared reveal

**Files:** Create `packages/shared/utils/benefit-reveal-server.ts` (+ `.test.ts`).

**Interfaces:**

```ts
export interface RevealDb { createRow(table: string, id: string, data: Record<string, unknown>, permissions: string[]): Promise<unknown>; getRow<T>(table: string, id: string): Promise<T>; listRows<T>(table: string, queries: string[]): Promise<{ rows: T[] }> } // database "app" bound by the caller
export type RevealResult = { ok: true; value: string } | { ok: false; reason: "no_code" | "not_found" | "not_member" | "unavailable" };
export async function revealBenefitCode(db: RevealDb, input: { benefitId: string; membership: "active" | "inactive" | "unavailable"; now: Date; userId: string }): Promise<RevealResult>;
```

Behaviour, in order:
1. Return `unavailable` if `membership === "unavailable"`, and `not_member` if it is `"inactive"`.
2. Load the benefit. Return `not_found` if it is missing, if its section (null counts as member) isn't member, or if it isn't visible under `isBenefitVisible`. Visibility needs the partner row; load it when `partner_id` is set.
3. Return `no_code` unless `redemption_type` is `code` or `link`.
4. Read the value from `benefit_codes` with row ID = benefit ID. A 404 falls back to the row's legacy `redemption_value`. If the value is blank, return `no_code`.
5. Record the reveal:
   - **Reveal row (idempotent):** if no `benefit_reveals` row exists for user and benefit, create one: `{ user_id, benefit_id, revealed_at: now.toISOString() }`, with permissions `read("user:<id>")` and `update("user:<id>")`.
   - **Interaction row:** create a `benefit_interactions` row for every reveal: `{ user_id, benefit_id, action: "reveal", campus_id, metadata: null }`, with `read("user:<id>")`. A failure here is swallowed.
6. Return `{ ok: true, value }`.

Recognize a 404 with the existing `isRowNotFound`-style check. Keep it in a shared module; don't import from apps.

- [ ] **Step 1: Write the failing tests** (fake db):
  - inactive gives `not_member`, and nothing is read or written;
  - unavailable gives `unavailable`;
  - a draft or expired benefit gives `not_found`;
  - a career-section row gives `not_found`;
  - redemption `onsite` gives `no_code`;
  - the code row is preferred over the legacy column, and the legacy column is used when the code row is missing (404);
  - a second reveal creates no second reveal row but does create an interaction;
  - an interaction failure still returns ok;
  - permissions are exactly as specified.
- [ ] **Steps 2–4:** run the tests to see them fail, implement, then run them to see them pass.
- [ ] **Step 5: Commit.** `git commit -m "feat(shared): member-only benefit code reveal"`

---

### Task 3: Website data readers

**Files:**
- Create: `apps/web/src/lib/data/benefits.ts` (+ `.test.ts`)
- Modify: `apps/web/src/lib/data/public-content.ts` (`cachedPartners`: order by `sort_order`, then `$createdAt`; `cacheLife("minutes")`; `cacheTag("partners")`), `packages/shared/utils/page-feeds.ts` (`readPagePartnersFeed`: select `sort_order` too and order by it), `apps/web/src/lib/data/public-content.ts` (`cachedPagePartnersFeed`: `cacheLife("minutes")` + `cacheTag("partners")`), `apps/web/src/app/actions/about.ts` (`getPartners` orders by `sort_order`; fix the stale `Partner` type to match `campus_id` and `sort_order`)

**Interfaces:**

```ts
// lib/data/benefits.ts
export async function cachedBenefitRows(): Promise<BenefitRowInput[]>; // "use cache"; cacheLife("minutes"); cacheTag("benefits"); guest client; published rows only; Query.select(BENEFIT_PUBLIC_COLUMNS + $id/$createdAt); limit 1000; throws on failure
export async function cachedBenefitPartners(): Promise<BenefitPartnerInput[]>; // "use cache"; same life + tag; limit 500
export async function getPublicBenefits(): Promise<PublicBenefit[]>; // NOT cached: await both, publicBenefitsFromRows(rows, partners, new Date())
export async function cachedCampusLogos(): Promise<CampusLogo[]>; // partners where level = "campus", ordered by campus_id then sort_order; "use cache"; minutes; tag "partners"
export interface CampusLogo { campusId: string; id: string; imageUrl: string; name: string; url: string | null }
```

- [ ] **Step 1: Write the failing tests**, mocking `createPublicClient` and `next/cache` (`cacheLife`, `cacheTag`):
  - `cachedBenefitRows` queries `status = published` with a select that doesn't contain `redemption_value`, and tags `"benefits"`.
  - `getPublicBenefits` drops a row whose partner is inactive.
  - `cachedPartners` orders by `sort_order` and tags `"partners"`.
  - `readPagePartnersFeed` selects `sort_order` and orders by it.
  - `cachedCampusLogos` maps the rows.
  - A reader rejects when the db rejects; it never returns an empty list on failure.
- [ ] **Steps 2–4:** run the tests to see them fail, implement, then run them to see them pass. Update the existing tests that mock `next/cache` to also provide `cacheTag`.
- [ ] **Step 5: Commit.** `git commit -m "feat(web): cached benefit and logo readers with tags"`

---

### Task 4: Freshness: the web revalidate route and admin notifications

**Files:**
- Create: `apps/web/src/app/api/revalidate/route.ts` (+ `route.test.ts`), `apps/admin/src/lib/web-revalidate.ts` (+ `.test.ts`)
- Modify:
  - `apps/admin/src/app/(portal)/_actions/benefits.ts` (after a successful create, update, delete, reorder or status change: `notifyWebsite(["benefits"])`)
  - `_actions/benefit-partners.ts` (create, update, end, restart, delete: `["benefits"]`)
  - `_actions/site-logos.ts` (save, delete, reorder: `["partners"]`)
  - `apps/admin/.env.example` (document that `CRON_SECRET` and `NEXT_PUBLIC_WEB_BASE_URL` are used for website refresh)

**Interfaces:**
- Web route: `POST`. It authorizes the same way as `cleanup-reservations`: prod with no secret → 500, wrong secret → 401. It parses `{ tags }`; anything other than a non-empty array of allowed tags → 400 `{ error: "invalid_tags" }`. It calls `revalidateTag(tag, …)` with the Next 16 signature from the docs, for each tag, then returns 200 `{ revalidated: tags }`. Add `export const dynamic = "force-dynamic"`.
- Admin: `export async function notifyWebsite(tags: ("benefits" | "membership-texts" | "partners")[]): Promise<void>`.
  - With no `NEXT_PUBLIC_WEB_BASE_URL` or no `CRON_SECRET`, it returns after a `console.warn`.
  - Otherwise it posts JSON with header `x-cron-secret`, aborting after 3 s.
  - A failure is logged and never thrown.

Admin action tests must mock `@/lib/web-revalidate` (process-wide, so spread or provide a full stub) and assert one call per successful mutation and none on refusals.

- [ ] **Step 1: Write the failing tests.**
  - **Route:**
    - 401 for a wrong secret, and 500 in production with no secret.
    - 400 for `{tags:["x"]}`.
    - 200 for `{tags:["benefits"]}` with `revalidateTag` called.
  - **`notifyWebsite`:**
    - It posts to `<base>/api/revalidate` with the header.
    - It resolves even when `fetch` rejects.
    - It does nothing without config.
  - **Actions:** a create calls `notifyWebsite(["benefits"])`, and a refused update doesn't.
- [ ] **Steps 2–4:** run the tests to see them fail, implement, then run them to see them pass. Run the full admin and web suites.
- [ ] **Step 5: Commit.** `git commit -m "feat: admin saves refresh the website within a minute"`

---

### Task 5: Member portal switch and code leak fix

**Files:**
- Modify: `apps/web/src/app/actions/member-portal.ts`:
  - `getMemberPortalBenefits(campusId)` and `getFeaturedBenefits(campusId)` return `PublicBenefit[]` via `getPublicBenefits` + `benefitsForCampus(..., ["member"])`; featured means `isFeatured`, top 6.
  - `revealBenefit(benefitId)` resolves the user; membership comes from `getLiveMembershipStatus()` (active when `isMember`, unavailable when `isTransientMembershipReason(reason)`, else inactive), then calls `revealBenefitCode` with an admin-client-backed `RevealDb`.
  - It returns `{ success: true, value } | { success: false, reason }`.
  - `getBenefitReveals` is unchanged.
- Modify: `apps/web/src/app/(public)/member/member-portal-content.tsx` (campus: cookie, then profile, then national; pass `PublicBenefit[]`)
- Modify `apps/web/src/components/member-portal/**`:
  - `benefit-card.tsx` takes `PublicBenefit`:
    - No code-seeded state: the value comes only from `revealBenefit`.
    - It shows `terms` in the visitor's locale and formats the end date with the visitor's locale.
    - It shows the partner logo and name from `partner`, and `imageUrl` when present.
    - It keeps the current description rendering: stored HTML or Plate JSON (a value starting with `<` or `[`) goes through `PlateContentRenderer`, and plain text renders in a `<p>` with `whitespace-pre-line`. Older benefits still hold HTML, and the stage 2 panel sends unchanged HTML back as it is.
    - `onsite` shows the i18n line "Vis medlemskortet i appen" instead of a reveal button.
    - For a reveal failure it shows the i18n message for `not_member`, `unavailable` and `no_code`.
  - `benefits-tab.tsx`: category chips from `BENEFIT_CATEGORIES` + labels (show only categories present); filter on keys.
  - `benefit-preview-card.tsx`: icon map keyed by the new category keys; partner logo when present.
  - `home-tab.tsx`: highlights from `featuredBenefits` (fall back to the first 3 when none are featured); replace the hardcoded "50+ partner companies" with an i18n string using the live count.
  - `benefits-showcase.tsx`: partner stat → live count (`countVisibleMemberBenefits`) with the existing label; leave the members stat unchanged.
- Tests:
  - Update `member-portal.test.ts` and `benefit-card.test.tsx`.
  - Add tests for the cookie-first campus and for chips with new keys.

- [ ] **Step 1: Write the failing tests.**
  - **`revealBenefit`:**
    - For a non-member it returns `{success:false, reason:"not_member"}`, with no code read.
    - A membership outage returns `{success:false, reason:"unavailable"}`.
    - For a member it reads `benefit_codes`.
  - **Portal benefits:**
    - The objects carry no `redemption_value` key; assert recursively on the returned objects.
  - **`BenefitCard`:**
    - It renders no code before reveal.
    - After reveal it shows the value.
    - It shows the Norwegian terms for locale `no`.
    - Onsite shows the member-card line.
  - **Chips:** they render "Mat og drikke" and filter by `food_drink`.
  - **`member-portal-content`:** it prefers the cookie campus over the profile campus.
- [ ] **Steps 2–4:** run the tests to see them fail, implement, then run them to see them pass. Run the full web suite and check-types.
- [ ] **Step 5: Commit.** `git commit -m "feat(web): member portal reads the benefit table and reveals codes only to members"`

---

### Task 6: Campus page, /students, /membership and campus logos

**Files:**
- Modify:
  - `apps/web/src/app/(public)/campus/page.tsx` (also `getPublicBenefits().catch(()=>[])` and `cachedCampusLogos().catch(()=>[])`)
  - `campus-page-client.tsx` (new props `benefits: PublicBenefit[]`, `campusLogos: CampusLogo[]`)
  - `students/students-tab.tsx`:
    - Four cards from `benefitsForCampus(benefits, activeCampusId, [section])`: member, career, social and safety. They show titles.
    - The member card ends with a link to `/member`, i18n "Se alle tilbud og koder i medlemsportalen".
    - "All campuses" shows national only.
  - `partners/partners-tab.tsx`:
    - The `business` section from the benefits.
    - A campus logo grid (`campusLogos` for the active campus) rendered even when there are no business items.
    - The existing CTA.
- Modify: `apps/web/src/app/(public)/students/page.tsx` + `students-page-client.tsx` (props `benefits: PublicBenefit[]`; `BenefitsSection` uses `benefitsForCampus(..., [key])` and `.slice(0,4)`; drop `getGlobalMembershipBenefits`)
- Modify: `apps/web/src/app/(public)/membership/page.tsx` + `membership-page-client.tsx`:
  - The global sections come from `benefitsForCampus(benefits, null, …)`.
  - The campus sections come from `benefitsForCampus(benefits, campusId, …)` filtered to `campusId` rows only.
  - The hero stat shows a live count (i18n `hero.stats.partners` becomes `"{count} medlemsfordeler"` / `"{count} member benefits"`).
  - Add `id="fordeler"` on the benefits section.
- Delete: `getGlobalMembershipBenefits` (`apps/web/src/app/actions/membership.ts`) and the benefit-array reads in `getCampusData` consumers. Keep `getCampusData` for the campus name, description and board.
- i18n: replace `memberPortal.cta.description`'s "50+" wording with a number-free sentence (both languages).
- Tests: update `campus/page.test.tsx` and `students/page.test.tsx` mocks; add component tests for `students-tab` (national-only on all-campuses; member link) and `partners-tab` (logos render with no business items).

- [ ] **Step 1: Write the failing tests** listed above, plus: `/students` gives four member titles, with Bergen's first when Bergen is selected.
- [ ] **Steps 2–4:** run the tests to see them fail, implement, then run them to see them pass. Run the full web suite and check-types. `rg "studentBenefits|careerAdvantages|businessBenefits|socialNetwork|getGlobalMembershipBenefits" apps/web/src` should return nothing, except the `CampusData` type file if it is still imported for other fields.
- [ ] **Step 5: Commit.** `git commit -m "feat(web): campus, students and membership pages read the benefit table"`

---

### Task 7: Remove compatibility copies and clear the legacy code column

**Files:**
- Modify: `apps/admin/src/lib/benefits/benefit-columns.ts` (`buildBenefitColumns` writes `redemption_value: null`, `partner_name: null`, `partner_logo_url: null`), `apps/admin/src/app/(portal)/_actions/benefits.ts` (`getBenefitForEdit` stops falling back to the legacy column only after the script has run. Keep the fallback; it is harmless once the column is null). Update tests.
- Create: `packages/shared/utils/legacy-benefit-codes.ts` (+ test) and `packages/shared/scripts/clear-legacy-benefit-codes.ts`, plus a package.json script `clear:legacy-benefit-codes` (`bun --env-file=../../apps/admin/.env.local …`).
  - The script is a dry run by default. For every `campus_benefits` row with a non-empty `redemption_value`:
    - If `benefit_codes` has no row for it, plan `copy` (upsert `{benefit_id, value}` with `[]` permissions).
    - Then plan `clear` (`updateRow` with `redemption_value: null`).
  - `--apply` executes it and prints counts only, never values.
  - The pure planner is `planLegacyCodeClear(rows, existingCodeIds): { copy: string[]; clear: string[] }`.
- [ ] **Step 1: Write the failing tests.**
  - The columns write null compat fields.
  - The planner copies only missing codes and clears all rows with values.
  - The script output never contains a value (unit-test the formatter).
- [ ] **Steps 2–4:** run the tests to see them fail, implement, then run them to see them pass. Run a read-only **dry run** against production and record the counts in the report. Expect 2 rows (or 0 if stage 1's migration apply already copied them).
- [ ] **Step 5: Commit.** `git commit -m "feat: stop copying codes into public rows and clear the legacy column"`

---

### Task 8: Drop the table-level read on campus_benefits (config only)

**Files:** `packages/api/appwrite.config.json` (`campus_benefits.$permissions` → `[]`), `packages/api/benefits-schema.test.ts` (flip the stage 1 "keeps its table-level read until stage 4" test to expect `[]`).

- [ ] Write the test change, then the config change. Run the api tests. Commit: `git commit -m "feat(api): campus_benefits rows are readable only through row permissions"`.

---

### Task 9: Verification and go-live notes

- [ ] Run each of these and confirm it exits 0:
  - full suites: web, shared, admin and api
  - `bun run check-types`
  - `bun run build --filter=admin`
  - `bun run build --filter=web` (it ignores type errors but catches `"use cache"` misuse)
  - ultracite on the changed files
- [ ] Grep:
  - `rg "redemption_value" apps/web/src` → only tests or the reveal path.
  - `rg "team:biso-members" apps packages --glob '!**/node_modules/**'` → no benefit paths.
- [ ] Append these stage 4 steps to `docs/superpowers/benefits-studio-go-live.md`, in order:
  1. Set `CRON_SECRET` to the same value in web and admin, and `NEXT_PUBLIC_WEB_BASE_URL` in admin.
  2. Deploy web and admin together: stage 2, 3 and 4 code.
  3. Run `clear:legacy-benefit-codes`: first the dry run, then `--apply`.
  4. Push the schema (table-level read removed on `campus_benefits`, the `partners` index from stage 3). Only after step 2: every published row then carries `read("any")`, because the stage 1 migration and the stage 2 admin write it.
  5. Check:
     - A logged-out page source contains no code.
     - A non-member reveal says "bare for medlemmer".
     - A test save in admin shows on the website within a minute.
