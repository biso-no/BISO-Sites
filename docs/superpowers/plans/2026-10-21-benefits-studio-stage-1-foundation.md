# Benefits Studio, Stage 1 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the schema, the shared benefit rules and a reviewable migration from `campus_data` in place, so later stages (admin board, partners, website, app, membership texts) build on one data model.

**Architecture:** Schema changes go into `packages/api/appwrite.config.json` (the owner pushes them and regenerates types). Pure, client-safe rules (sections, categories, visibility, ordering) live in `packages/shared/utils/benefit-catalog.ts` and `benefit-visibility.ts`. The migration is a pure planner (`benefit-match.ts` + `benefit-migration.ts`) that produces an editable JSON plan and a Markdown review, an executor (`benefit-migration-apply.ts`) that writes an approved plan with idempotent upserts, and a thin CLI (`scripts/migrate-benefits.ts`). One small web change keeps the current member portal correct once migrated rows exist.

**Tech Stack:** Bun 1.3, TypeScript strict, Vitest, node-appwrite `TablesDB`, Next.js 16 server actions (web).

**Spec:** `docs/superpowers/specs/2026-10-21-benefits-studio-design.md` (D1, D2, D3 schema part, D8, D9 `sort_order`, D10 ordering, D12, D13 schema part).

**Scope moved out of this stage (deliberate):** the shared reader and the reveal function move to Stage 4 (their first consumers); the D5 edit-rights rules and the benefits-editor override move to Stage 2 (admin-only); seeding `membership_texts` moves to Stage 6. Removing the table-level `read("any")` from `campus_benefits` (D4) is **not** in this stage: it must wait until the Stage 2 admin is live (the old admin still writes `read("team:biso-members")` rows).

## Global Constraints

- Bun only (`bun@1.3.1`); never npm/pnpm. Tests: `bun x vitest run <file>` from the package directory.
- Never hand-edit `packages/api/types/appwrite.ts`. The owner runs the schema push and `bun run types:generate` (in `packages/api`). No task depends on regenerated types.
- Edit `appwrite.config.json` textually with the file's existing 4-space indentation; do not reformat it. `git diff --stat` must show only that file with a small line count.
- Campus IDs: `"1"` Oslo, `"2"` Bergen, `"3"` Trondheim, `"4"` Stavanger, `"5"` Hele BISO (national).
- Section keys, in website order: `member`, `career`, `social`, `safety`, `business`. Labels nb/en: Medlemsfordeler / Member benefits; Karrierefordeler / Career advantages; Sosialt nettverk / Social network; Trygghet og støtte / Safety & support; For bedrifter / For companies.
- Category keys and labels nb/en: `food_drink` Mat og drikke / Food & drink; `health_fitness` Trening og helse / Health & fitness; `nightlife` Uteliv / Nightlife; `shopping` Shopping / Shopping; `travel` Reise / Travel; `software` Programvare / Software; `events` Arrangementer / Events; `other` Annet / Other.
- `campus_data` list keys → sections: `studentBenefits` → `member`, `careerAdvantages` → `career`, `socialNetwork` → `social`, `safety` → `safety`, `businessBenefits` → `business`. Read only the `_nb` / `_en` columns.
- `benefit-catalog.ts` and `benefit-visibility.ts` must stay client-safe: no `node:*`, no `@repo/api/server`, no `server-only`.
- Redemption codes are secret: the plan JSON (which carries them) is written only under the gitignored `.superpowers/benefits-migration/`; code values never appear in `review.md` or on stdout.
- Nothing writes to Appwrite except `migrate-benefits.ts --apply`.
- Run `bun x ultracite fix` on changed files before each commit.

## Review Focus

- **Existing rows have no `section` right after the schema push** → the current member portal must keep listing them (Task 8 test: the query accepts `section = member` OR `section IS NULL`).
- **The owner hand-edits `plan.json` and gets it wrong** (merge with no target, unknown partner key, misspelled section) → apply writes nothing and lists every problem (Task 5 validation tests, Task 6 "no writes on invalid plan" test).
- **Apply is run twice, or dies halfway and is re-run** → the result converges with no duplicate rows (Task 6 idempotency test: deterministic IDs and upserts only).
- **Uneven source lists**: English list shorter than Norwegian, blank entries, the same line twice on one campus → no line lost or misaligned; English falls back to Norwegian with a note; duplicates become `skip` (Task 5 tests, plus the "every source line accounted for once" invariant).
- **A deal whose end time is exactly now, or a malformed date** → treated as expired, or the bad date ignored, never a crash (Task 3 boundary tests).

---

### Task 1: Schema changes

**Files:**
- Modify: `packages/api/appwrite.config.json` (`campus_benefits` entry ~line 2598, `partners` entry ~line 1904, append two tables after `document_versions`, the last entry of `tables`)
- Test: `packages/api/benefits-schema.test.ts` (create)

**Interfaces:**
- Produces (runtime schema, after the owner's push): `campus_benefits.section` enum; table `benefit_codes` (row ID = the benefit's ID); table `membership_texts`; `partners.sort_order`.

- [ ] **Step 1: Write the failing test** `packages/api/benefits-schema.test.ts`, loading the config the same way as `appwrite-config.test.ts` (`readFileSync(join(import.meta.dirname, "appwrite.config.json"))`). Tests:
  - `campus_benefits gains a section enum defaulting to member`: column `section` has `type: "string"`, `format: "enum"`, `elements` equal to `["member","career","social","safety","business"]`, `required: false`, `default: "member"`.
  - `one-line benefits can omit description, category and kind`: `description_nb`, `description_en`, `category`, `kind` all have `required: false`; `redemption_type` has `required: false` and `default: "none"`.
  - `campus_benefits has a campus/section/status index`: an index `idx_campus_section_status` of type `key` with columns `["campus_id","section","status"]`.
  - `campus_benefits keeps its table-level read until stage 4`: `$permissions` equals `['read("any")']`.
  - `benefit_codes is service-only`: table exists, `$permissions` is `[]`, `rowSecurity: true`, columns `benefit_id` (string, size 36, required), `value` (string, size 500, required), `updated_by` (string, size 36, optional), unique index `idx_benefit` on `["benefit_id"]`.
  - `membership_texts is public copy`: `$permissions` `['read("any")']`, `rowSecurity: false`; column `spot` enum with `elements` `["home_join","plan_card","portal_locked","onboarding","shop_callout","business","business_hotspot"]`, required; `sort_order` integer, `required: false`, `default: 0`, `min: 0`, `max: 9999`; `title_nb` string 200 required; `title_en` string 200 optional; `body_nb`, `body_en` string 500 optional; key index `idx_spot_order` on `["spot","sort_order"]`.
  - `partners can be ordered`: `partners` has `sort_order` integer, `required: false`, `default: 0`, `min: 0`, `max: 9999`.

- [ ] **Step 2: Run it to verify it fails**

Run: `cd packages/api && bun x vitest run benefits-schema.test.ts`
Expected: FAIL (missing `section` column, missing tables).

- [ ] **Step 3: Edit `appwrite.config.json`** to satisfy the test. Copy column/index/table JSON shapes from neighbouring entries (e.g. `status` for enums, `sort_order` on `campus_benefits` for integers, `benefit_reveals` for a service-only table with a unique index). New tables carry `"databaseId": "app"`, `"enabled": true`, names `"Benefit Codes"` and `"Membership Texts"`. Leave every other column and permission untouched.

- [ ] **Step 4: Run the new test and the existing config tests**

Run: `cd packages/api && bun x vitest run benefits-schema.test.ts appwrite-config.test.ts appwrite-config-permissions.test.ts`
Expected: PASS. Then `python3 -I -c "import json;json.load(open('appwrite.config.json'))"` exits 0 and `git diff --stat` lists only `appwrite.config.json` and the test.

- [ ] **Step 5: Commit**

```bash
git add packages/api/appwrite.config.json packages/api/benefits-schema.test.ts
git commit -m "feat(api): schema for sectioned benefits, benefit codes and membership texts"
```

---

### Task 2: Benefit catalog (sections, categories, campus IDs)

**Files:**
- Create: `packages/shared/utils/benefit-catalog.ts`
- Modify: `packages/shared/utils/benefit-scope.ts` (import `NATIONAL_CAMPUS_ID` from the catalog instead of declaring it)
- Test: `packages/shared/utils/benefit-catalog.test.ts`

**Interfaces:**
- Produces:
  - `NATIONAL_CAMPUS_ID = "5"`; `CAMPUS_IDS = ["1","2","3","4"] as const`; `type CampusId = (typeof CAMPUS_IDS)[number]`
  - `BENEFIT_SECTIONS` (readonly tuple, website order); `type BenefitSection`; `BENEFIT_SECTION_LABELS: Record<BenefitSection, { nb: string; en: string }>`
  - `BENEFIT_CATEGORIES` (readonly tuple, order as in Global Constraints); `type BenefitCategoryKey`; `BENEFIT_CATEGORY_LABELS: Record<BenefitCategoryKey, { nb: string; en: string }>`
  - `isBenefitSection(value: unknown): value is BenefitSection`
  - `isBenefitCategory(value: unknown): value is BenefitCategoryKey`
  - `mapLegacyBenefitCategory(value: string | null | undefined): BenefitCategoryKey`

- [ ] **Step 1: Write the failing tests**
  - sections are exactly `["member","career","social","safety","business"]` and `BENEFIT_SECTION_LABELS.safety` equals `{ nb: "Trygghet og støtte", en: "Safety & support" }`.
  - categories are exactly the eight keys in order; `BENEFIT_CATEGORY_LABELS.nightlife.nb === "Uteliv"`.
  - `isBenefitSection("career")` true; `isBenefitSection("perk")`, `isBenefitSection(null)` false. Same shape for `isBenefitCategory`.
  - `mapLegacyBenefitCategory`: `"Health"` and `"Health & Fitness"` → `health_fitness`; `"Food & Drink"` → `food_drink`; `"Entertainment"` → `events`; `"Travel"` → `travel`; `"Software"` → `software`; `"Career"`, `"Lifestyle"`, `"Finance"`, `"Education"`, `"Other"`, `""`, `null`, `"whatever"` → `other`; an already-new key (`"nightlife"`) → itself. Matching is case-insensitive and trims.
  - `resolveBenefitCampusIds` (existing, `benefit-scope.ts`) still returns `["5"]` for `null`/`"5"` and `["2","5"]` for `"2"`.

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/shared && bun x vitest run utils/benefit-catalog.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `benefit-catalog.ts`** with the exact values from Global Constraints, and switch `benefit-scope.ts` to import `NATIONAL_CAMPUS_ID`.

- [ ] **Step 4: Run tests**

Run: `cd packages/shared && bun x vitest run utils/benefit-catalog.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/utils/benefit-catalog.ts packages/shared/utils/benefit-catalog.test.ts packages/shared/utils/benefit-scope.ts
git commit -m "feat(shared): benefit sections, categories and campus ids"
```

---

### Task 3: Visibility state and ordering (D2, D10)

**Files:**
- Create: `packages/shared/utils/benefit-visibility.ts`
- Test: `packages/shared/utils/benefit-visibility.test.ts`

**Interfaces:**
- Consumes: `NATIONAL_CAMPUS_ID` (Task 2).
- Produces:
  - `type BenefitDisplayState = "visible" | "draft" | "scheduled" | "expired" | "ended" | "hidden"`
  - `interface BenefitVisibilityFields { status: string; publish_start?: string | null; publish_end?: string | null; partner_id?: string | null }`
  - `interface PartnerActivity { is_active?: boolean | null }`
  - `benefitDisplayState(benefit: BenefitVisibilityFields, partner: PartnerActivity | null | undefined, now: Date): BenefitDisplayState`
  - `isBenefitVisible(benefit: BenefitVisibilityFields, partner: PartnerActivity | null | undefined, now: Date): boolean`
  - `interface OrderableBenefit { $createdAt: string; campus_id: string; sort_order?: number | null }`
  - `orderBenefitsCampusFirst<T extends OrderableBenefit>(rows: readonly T[], campusId: string | null | undefined): T[]`

Precedence for `benefitDisplayState`, first match wins: `status === "draft"` → `draft`; any status other than `published` → `hidden`; `partner_id` set and (`partner` missing or `partner.is_active === false`) → `ended` (`is_active` null/undefined counts as active); `publish_start` later than `now` → `scheduled`; `publish_end` at or before `now` → `expired`; otherwise `visible`. A date string that `Date.parse` cannot read is treated as absent.

`orderBenefitsCampusFirst`: the given campus's rows first, then national (`"5"`) rows, then any other campus; inside each group by `sort_order` ascending (null = 0), then `$createdAt` ascending. When `campusId` is null/undefined/`"5"`, national rows come first. Returns a new array.

- [ ] **Step 1: Write the failing tests** (fixed `now = new Date("2026-10-21T12:00:00Z")`):
  - published, no dates, no partner → `visible`; `isBenefitVisible` true.
  - `draft` → `draft`; `archived` → `hidden`; `"weird"` → `hidden`.
  - published with `partner_id: "p1"` and partner `{ is_active: false }` → `ended`; partner `null` → `ended`; partner `{}` → `visible`.
  - `publish_start: "2026-10-22T00:00:00Z"` → `scheduled`.
  - `publish_end` exactly `now.toISOString()` → `expired`; one second later → `visible`.
  - `publish_end: "not a date"` → `visible` (ignored, no throw).
  - ended beats scheduled: inactive partner plus future start → `ended`.
  - ordering: rows on campus `"2"` (sort 1, sort 0), national (sort 0), campus `"1"` (sort 0) ordered for campus `"2"` → `["2"/0, "2"/1, "5"/0, "1"/0]`; equal sort orders fall back to `$createdAt`; for `campusId` `null` national rows come first; input array not mutated.

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/shared && bun x vitest run utils/benefit-visibility.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `benefit-visibility.ts`** per the precedence and ordering rules above.

- [ ] **Step 4: Run tests**

Run: `cd packages/shared && bun x vitest run utils/benefit-visibility.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/utils/benefit-visibility.ts packages/shared/utils/benefit-visibility.test.ts
git commit -m "feat(shared): benefit visibility states and campus-first ordering"
```

---

### Task 4: Text matching for the migration

**Files:**
- Create: `packages/shared/utils/benefit-match.ts`
- Test: `packages/shared/utils/benefit-match.test.ts`

**Interfaces:**
- Produces:
  - `normalizeBenefitText(text: string): string` (for exact "same line" detection)
  - `benefitTokens(text: string): string[]`
  - `interface BenefitMatch { anchor: boolean; containment: number; dice: number }`
  - `compareBenefitTexts(a: string, b: string): BenefitMatch`
  - `isMergeMatch(match: BenefitMatch): boolean`: `dice >= 0.75 || anchor`
  - `isPossibleMatch(match: BenefitMatch): boolean`: `dice >= 0.4 || containment === 1`
  - `suggestPartnerName(title: string): string | null`
  - `partnerKey(name: string): string`

Rules the tests don't fully determine:
- `normalizeBenefitText`: Unicode NFKC, lowercase, remove whitespace before `%`, collapse whitespace, trim.
- `benefitTokens`: take the normalized text, replace every character that is not a letter or digit (`\p{L}\p{N}`) with a space, split, drop tokens shorter than 2 characters, drop stopwords, dedupe while keeping order. Stopwords: `og i på pa hos til for med av en et ei du deg din ditt dine alle som fra om det den de er the at of and on in to a an rabatt discount biso bi hr media campus medlem medlemmer oslo oslos bergen bergens trondheim trondheims stavanger stavangers`.
- Two tokens match when equal, or when both are at least 6 characters long and their common prefix is at least 6 characters and at least 75% of the shorter token.
- `dice = 2 * matched / (|A| + |B|)`, where `matched` greedily pairs each token of A with at most one unused token of B. `containment = matched / min(|A|, |B|)`. Both are 0 when either side has no tokens.
- Anchors. Split the original text on whitespace, then split each word on `-`. A segment is a *real anchor* if it is ALL CAPS with at least 3 letters (anywhere), or starts with an uppercase letter and is not in the first word. Segments of a capitalised first word are *lead anchors*. Anchor segments are tokenized like `benefitTokens` (stopwords removed, so BISO/HR/Oslo never anchor). `anchor` is true when some token is an anchor (real or lead) on both sides and a real anchor on at least one side.
- `suggestPartnerName`: the text after the last ` hos ` (case-insensitive), with any trailing `(...)` and trailing punctuation removed, trimmed. Return `null` if there is no ` hos `, if the result contains `,`, `&` or the word `og`, or if it has more than 4 words.
- `partnerKey`: NFKC, lowercase, collapse whitespace, trim, strip a trailing ` as` or ` a/s`.

- [ ] **Step 1: Write the failing tests** with real lines from production:
  - `normalizeBenefitText("  40 %  rabatt ")` → `"40% rabatt"`.
  - `benefitTokens("Intervju-coaching med BISO HR")` → `["intervju","coaching"]`.
  - merge (`isMergeMatch` true):
    - `"40 % rabatt på billett til Fadderullan"` vs `"40% rabatt på Fadderullan"`
    - `"Rabatt på alle Rekom-utesteder i Norden og Storbritannia"` vs `"REKOM-rabatt"`
    - `"1-1-veiledning på CV, søknad og LinkedIn med Econa (begrenset antall plasser)"` vs `"Econa karriereveiledning"`
    - `"Intervju-coaching med BISO HR"` vs `"Intervju-coaching"`
    - `"CV-portrettbilde med BISO Media"` vs `"CV-portrett"`
    - `"25 % rabatt på Peppes Pizza Nydalen"` vs `"25 % hos Peppes Pizza Nydalen"`
    - `"Medlemsavtaler med blant annet Bertoni, Egon Solsiden og BarbeQueZ"` vs `"Medlemstilbud hos Bertoni"`
  - possible but not merge:
    - `"Karrieredagene Bergen – to dager med inspirerende foredrag og messedag"` vs `"Karrieredagene"` (containment 1)
    - `"Gratis bedriftspresentasjoner på campus"` vs `"Bedriftspresentasjoner"`
    - `"Arbeidslivsspesifikke kurs og workshops"` vs `"Arbeidslivsrettede kurs"` (dice 0.4)
  - neither (a capitalised first word never anchors): `"Bli med i undergrupper og utvalg"` vs `"Bli med på Winter Games på Storefjell med BI-studenter fra hele landet"`; `"Styrker studentstemmen din i politikken"` vs `"Winter Games"`.
  - `suggestPartnerName`:
    - `"25 % hos Peppes Pizza Nydalen"` → `"Peppes Pizza Nydalen"`
    - `"20 % rabatt på alle briller (ordinær pris) og gratis synsprøve hos Okkult"` → `"Okkult"`
    - `"20% hos Løft studios "` → `"Løft studios"`
    - `"15 % / 20 % rabatt (inne/takeaway) hos Nama Sushi, Big Horn Bergen, Le Pintxos & Brasserie og Boccone Ristorante"` → `null`
    - `"20 % rabatt på ordinære varer hos Bertoni Lagunen og Xhibition"` → `null`
    - `"Karrieredagene"` → `null`
  - `partnerKey("BERTONI") === partnerKey(" Bertoni ")`; `partnerKey("Løft Studios AS") === "løft studios"`.

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/shared && bun x vitest run utils/benefit-match.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `benefit-match.ts`** per the rules above. Hoist regexes to module scope (Biome `useTopLevelRegex`).

- [ ] **Step 4: Run tests**

Run: `cd packages/shared && bun x vitest run utils/benefit-match.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/utils/benefit-match.ts packages/shared/utils/benefit-match.test.ts
git commit -m "feat(shared): text matching for the benefits migration"
```

---

### Task 5: Migration planner, plan validation and review file (D12)

**Files:**
- Create: `packages/shared/utils/benefit-migration.ts`
- Test: `packages/shared/utils/benefit-migration.test.ts`

**Interfaces:**
- Consumes: Task 2 catalog, Task 4 matching.
- Produces (exported types and functions):

```ts
export interface CampusDataInput { $id: string; [column: string]: unknown }
export interface ExistingBenefitInput {
  $id: string; $createdAt: string; $permissions: string[];
  campus_id: string; status: string; kind?: string | null; section?: string | null;
  category?: string | null; title_nb: string; title_en?: string | null;
  description_nb?: string | null; partner_name?: string | null;
  partner_logo_url?: string | null; partner_id?: string | null;
  redemption_value?: string | null;
}
export interface MigrationInput { benefits: ExistingBenefitInput[]; campusData: CampusDataInput[]; generatedAt: string }

export interface PlannedLine {
  action: "create" | "merge" | "skip";
  campusId: string;            // "1".."4", or "5" when collapsed
  id: string;                  // row id used when action = create
  mergeInto: string[];         // existing row ids when action = merge
  note: string | null;
  partnerKey: string | null;   // member lines only
  score: number | null;        // best dice against same-section candidates
  section: BenefitSection;
  sortOrder: number;
  sourceCampusIds: string[];
  titleEn: string;
  titleNb: string;
}
export interface PlannedRowUpdate {
  campusId: string; category: BenefitCategoryKey | null; makePublic: boolean;
  partnerKey: string | null; rowId: string; section: BenefitSection;
  sortOrder: number | null; title: string;
}
export interface PlannedPartner { campusId: string; id: string; key: string; logoUrl: string | null; name: string; suggested: boolean }
export interface PlannedCode { rowId: string; value: string }
export interface PlannedDeletion { approved: boolean; rowId: string; title: string }
export interface MigrationPlan {
  codes: PlannedCode[]; deletions: PlannedDeletion[]; generatedAt: string;
  lines: PlannedLine[]; partners: PlannedPartner[]; rowUpdates: PlannedRowUpdate[];
  version: 1;
}

export function planBenefitMigration(input: MigrationInput): MigrationPlan;
export function validateMigrationPlan(plan: MigrationPlan): string[]; // empty = valid
export function renderMigrationReview(plan: MigrationPlan): string;   // Markdown, Norwegian
export function summarizeMigrationPlan(plan: MigrationPlan): { created: number; merged: number; skipped: number; sourceLines: number; updated: number; partners: number; codes: number; deletions: number };
```

Planner rules (in order):
1. **Existing rows → `rowUpdates`** (one per row). `section`: keep `row.section` if it's a valid section. Otherwise, if `kind === "perk"`: title matching `/karriere|bedriftspresentasjon|kurs\b|intervju|\bcv\b/i` → `career`, matching `/verv|undergrupp/i` → `social`. Everything else → `member`. `category`: for `member`, keep a valid key or use `mapLegacyBenefitCategory`; otherwise `null`. `partnerKey` (member rows without `partner_id` only): `partnerKey(partner_name)` if a name is set, else `partnerKey(suggestPartnerName(title_nb))` if non-null, else `null`. `makePublic`: `status === "published"` and permissions are not exactly `['read("any")']`. `sortOrder: null` (rule 5 may set it). `title`: `title_nb || title_en`.
2. **Codes and deletions.** Every row with a non-empty `redemption_value` → `codes`. Every `draft` row with an empty `description_nb` → `deletions` with `approved: false`.
3. **Source lines.** For each campus `"1"`–`"4"` and each list key, pair `<key>_nb[i]` with `<key>_en[i]`. Skip blank Norwegian entries. Use the trimmed English text, or the Norwegian text with note `"Mangler engelsk tekst"` when the English is missing or blank. `sortOrder = i`.
4. **Collapse and dedupe.** Group by `(section, normalizeBenefitText(nb))`. A group present on all four campuses becomes one national line: `campusId "5"`, `sortOrder` = the lowest index, English from the Oslo occurrence, `sourceCampusIds` all four. A second identical line on the same campus and section becomes `action: "skip"` with note `"Duplikat"`.
5. **Match.** Candidates are existing rows on the line's campus plus national rows (national lines: national rows only), with the section from rule 1.
   - Merge targets are same-section candidates where `isMergeMatch` holds. If there are any: `action: "merge"`, `mergeInto` = their IDs, `partnerKey: null`. For each target on the same campus as the line, set that row update's `sortOrder` to the line's (first line wins).
   - Otherwise `action: "create"`. For member lines, `partnerKey` comes from `suggestPartnerName`.
   - `note` lists possible matches against candidates in any section, as `Ligner på «<title>» (<campus>, <section label>)`. Add `Samme tilbud finnes på <campus> – vurder å gjøre det nasjonalt` when a same-section row on another non-national campus is a merge match.
   - `score` is the best same-section dice, or `null`.
   - Campus names for notes: Oslo, Bergen, Trondheim, Stavanger, Hele BISO.
6. **IDs.** Line `id` = `"mb-"` + the first 20 hex chars of SHA-1 of `${campusId}|${section}|${normalizeBenefitText(titleNb)}` (via `node:crypto`). Partner `id` = `"bp-"` + the first 20 hex chars of SHA-1 of the key.
7. **Partners**, one per key used by row updates or create lines.
   - `name`: the first variant that is not all caps, else the first variant.
   - `campusId`: the single campus of its rows and lines, or `"5"` if they span campuses.
   - `logoUrl`: the first non-empty `partner_logo_url`.
   - `suggested`: true when no source had an explicit `partner_name`.

`validateMigrationPlan` reports, one human-readable string each:
- `version !== 1`
- duplicate line IDs
- a `merge` with an empty `mergeInto`
- a `mergeInto`, code or deletion `rowId` that no row update knows
- a `partnerKey` missing from `partners`
- an invalid `section` or `category`
- a `create` line with an empty `titleNb`

`renderMigrationReview`:
- Heading with `generatedAt` and the summary counts.
- Per campus (Oslo … Hele BISO) and section, a table: `Tekst | Handling | Detaljer`. Handling is `Ny`, `Slås sammen med «…»` or `Hoppes over`; Detaljer is the note and the partner name.
- Then tables for existing benefits (title, campus, section, category, partner), new partners (`(forslag)` when suggested), deletions (`krever godkjenning`), and `Koder som flyttes: N`. **Never prints a code value.**
- Ends with instructions: edit `plan.json` (`action`, `mergeInto`, `partnerKey`, `approved`), then run apply.

- [ ] **Step 1: Write the failing tests** with small fixtures built from the production lines in Task 4 (helpers `campusRow(id, lists)` and `benefitRow(partial)`):
  - **every source line is accounted for once:** across fixtures with four campuses, `summarizeMigrationPlan(plan).sourceLines` equals the number of non-blank `_nb` entries and equals the sum of `sourceCampusIds.length` over all lines.
  - **collapse:** `"Intervju-coaching med BISO HR"` in `careerAdvantages_nb` on all four campuses → exactly one line, `campusId "5"`, `section "career"`, `sourceCampusIds` `["1","2","3","4"]`; on only three campuses → three campus lines.
  - **merge:** with a national perk row `"Intervju-coaching"` (kind `perk`), that collapsed line is `merge` into that row's ID, and the row update's `section` is `career` and its `sortOrder` equals the line's index.
  - **merge on the same campus sets order:** Oslo `studentBenefits_nb[2] = "25 % rabatt på Peppes Pizza Nydalen"` with Oslo row `"25 % hos Peppes Pizza Nydalen"` (kind `offer`) → `merge`; that row update has `sortOrder 2`, `section "member"`, `category "other"` (legacy `"Career"`), and `partnerKey` equal to `partnerKey("Peppes Pizza Nydalen")`.
  - **cross-campus note:** Bergen `"Rabatt på alle Rekom-utesteder i Norden og Storbritannia"` with only an Oslo row `"REKOM-rabatt"` → `create` with a note containing `"Samme tilbud finnes på Oslo"`.
  - **English fallback:** `studentBenefits_en` shorter than `_nb` → the extra line has `titleEn === titleNb` and the note `"Mangler engelsk tekst"`.
  - **blanks and duplicates:** `"  "` entries produce no line; a line repeated on one campus gives one `create` and one `skip` (`"Duplikat"`).
  - **deterministic IDs:** planning the same input twice gives identical `lines[].id` and `partners[].id`; IDs match `/^mb-[0-9a-f]{20}$/` and `/^bp-[0-9a-f]{20}$/`.
  - **partners:** rows with `partner_name` `"Bertoni"` (campus 3) and `"BERTONI"` (campus 2) → one partner, `name "Bertoni"`, `campusId "5"`, `suggested false`.
  - **codes and deletions:** a row with `redemption_value "LOFT20"` → `codes` contains `{ rowId, value: "LOFT20" }`; a draft with empty description → deletion with `approved: false`; `renderMigrationReview(plan)` does **not** contain `"LOFT20"` and does contain `"Koder som flyttes: 1"`.
  - **makePublic:** a published row with `['read("team:biso-members")']` → `makePublic: true`; a published row with `['read("any")']` → false; a draft → false.
  - **validation:**
    - a valid plan returns `[]`
    - a plan where one line is changed to `action: "merge"` with `mergeInto: []`, another gets `partnerKey: "nope"`, and a row update gets `section: "carrer"` returns three problems
    - `version: 2` returns a problem

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/shared && bun x vitest run utils/benefit-migration.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `benefit-migration.ts`** per the planner rules. Keep functions small: e.g. `proposeRowUpdates`, `collectSourceLines`, `collapseLines`, `matchLines`, `collectPartners`. Add the review renderer and summary. Hoist regexes.

- [ ] **Step 4: Run tests**

Run: `cd packages/shared && bun x vitest run utils/benefit-migration.test.ts utils/benefit-match.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/utils/benefit-migration.ts packages/shared/utils/benefit-migration.test.ts
git commit -m "feat(shared): plan the campus_data benefits migration with a review file"
```

---

### Task 6: Migration executor

**Files:**
- Create: `packages/shared/utils/benefit-migration-apply.ts`
- Test: `packages/shared/utils/benefit-migration-apply.test.ts`

**Interfaces:**
- Consumes: `MigrationPlan`, `validateMigrationPlan` (Task 5); `NATIONAL_CAMPUS_ID` (Task 2).
- Produces:

```ts
export type MigrationTable = "benefit_codes" | "benefit_partners" | "campus_benefits";
export interface MigrationWriter {
  deleteRow(table: "campus_benefits", rowId: string): Promise<void>;
  updateRow(table: "campus_benefits", rowId: string, data: Record<string, unknown>, permissions?: string[]): Promise<void>;
  upsertRow(table: MigrationTable, rowId: string, data: Record<string, unknown>, permissions?: string[]): Promise<void>;
}
export interface MigrationApplyResult { codes: number; created: number; deleted: number; partners: number; updated: number }
export class InvalidMigrationPlanError extends Error { readonly problems: string[] }
export function applyBenefitMigration(plan: MigrationPlan, writer: MigrationWriter): Promise<MigrationApplyResult>;
```

Write order and payloads (validate first; on problems throw `InvalidMigrationPlanError` before any write):
1. Partners: `upsertRow("benefit_partners", p.id, { name, campus_id, logo_url, is_active: true }, ['read("any")'])`.
2. Lines with `action: "create"`: `upsertRow("campus_benefits", line.id, { campus: campusId, campus_id: campusId, section, status: "published", title_nb, title_en, sort_order, redemption_type: "none", is_featured: false, category: section === "member" ? "other" : null, partner_id: <partner id for partnerKey> ?? null }, ['read("any")'])`.
3. Row updates: `updateRow("campus_benefits", rowId, data, makePublic ? ['read("any")'] : undefined)`. `data` always has `section` and `category`, has `partner_id` only when `partnerKey` is set, and has `sort_order` only when it isn't null.
4. Codes: `upsertRow("benefit_codes", code.rowId, { benefit_id: code.rowId, value: code.value }, [])`.
5. Deletions with `approved: true` only: `deleteRow("campus_benefits", rowId)`.

- [ ] **Step 1: Write the failing tests** with a recording fake writer:
  - writes happen in the order partners → creates → updates → codes → deletions, and the result counts each.
  - a created member line with `partnerKey` gets the `partner_id` of the matching planned partner; a created career line gets `category: null`.
  - an unapproved deletion is not deleted; flipping `approved: true` deletes it.
  - `makePublic: false` passes `undefined` permissions.
  - **idempotency:** applying the same plan twice issues identical calls with the same row IDs, and no `createRow`-style call exists (the writer has none).
  - **invalid plan:** a plan with a merge line with an empty `mergeInto` rejects with `InvalidMigrationPlanError` whose `problems` has length 1, and the writer recorded zero calls.

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/shared && bun x vitest run utils/benefit-migration-apply.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `benefit-migration-apply.ts`** per the order above (sequential awaits; no parallel writes).

- [ ] **Step 4: Run tests**

Run: `cd packages/shared && bun x vitest run utils/benefit-migration-apply.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/utils/benefit-migration-apply.ts packages/shared/utils/benefit-migration-apply.test.ts
git commit -m "feat(shared): apply an approved benefits migration plan idempotently"
```

---

### Task 7: Migration CLI and dry run against production

**Files:**
- Create: `packages/shared/scripts/migrate-benefits.ts`
- Modify: `packages/shared/package.json` (scripts: `"migrate:benefits": "bun --env-file=../../apps/admin/.env.local scripts/migrate-benefits.ts"`)

**Interfaces:**
- Consumes: `planBenefitMigration`, `validateMigrationPlan`, `renderMigrationReview`, `summarizeMigrationPlan` (Task 5); `applyBenefitMigration`, `MigrationWriter`, `InvalidMigrationPlanError` (Task 6).

Behaviour, modelled on `scripts/backfill-content-notification-locks.ts` (same env checks, `TablesDB` client, exit code 2 on missing config):
- Header comment with usage and the go-live order from this plan's final section.
- **Dry run (default):**
  - Read all `campus_data` rows, and all `campus_benefits` rows with cursor paging (page size 100).
  - Map rows to the planner's input types, then plan and validate.
  - Write `plan.json` (2-space JSON) and `review.md` to `--out <dir>`, default `join(import.meta.dirname, "../../../.superpowers/benefits-migration")`. Create the directory if missing.
  - Print the summary counts and the two file paths. Never print code values.
  - Exit 1 if validation reports problems (print them).
- **Apply:** `--apply --plan <path>` reads and parses the JSON and calls `applyBenefitMigration` with a writer backed by `db.upsertRow` / `db.updateRow` / `db.deleteRow` (object-params form, `databaseId: "app"`). It prints the result counts. On `InvalidMigrationPlanError` it prints the problems and exits 1. Without `--plan` it refuses with a usage message.

- [ ] **Step 1: Implement the script and the package.json entry.**

- [ ] **Step 2: Type-check**

Run: `cd packages/shared && bun run check-types`
Expected: exit 0.

- [ ] **Step 3: Dry run against production (read-only)**

Run: `cd packages/shared && bun run migrate:benefits`
Expected:
- It prints `Mode: dry-run`, the counts, and two paths under `.superpowers/benefits-migration/`.
- `sourceLines` equals the number of non-blank `_nb` entries on campuses 1–4.
- `git status --short` shows no files under `.superpowers/`, because the folder is gitignored.

- [ ] **Step 4: Sanity-check the review against the recon numbers**

Open `review.md`. Check:
- the 21 existing benefits are all listed
- "los t" appears under deletions as `krever godkjenning`
- `Koder som flyttes: 2`
- Fadderullan lines are merged into the national row
- lines that are identical on every campus (e.g. "Trygg varslingskanal…") appear once, under Hele BISO

If anything looks wrong, fix the planner in Task 5 with a test and re-run.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/scripts/migrate-benefits.ts packages/shared/package.json
git commit -m "feat(shared): migrate-benefits CLI with dry run and apply"
```

---

### Task 8: Keep the current member portal correct once migrated rows exist

**Files:**
- Modify: `apps/web/src/app/actions/member-portal.ts` (`getMemberPortalBenefits` ~line 63, `getFeaturedBenefits` ~line 92)
- Test: `apps/web/src/app/actions/member-portal.test.ts`

**Interfaces:**
- Consumes: nothing new (string column `section`; no generated types needed).

Both queries gain `Query.or([Query.equal("section", "member"), Query.isNull("section")])`, so one-line rows (career, social, safety, business) never show as portal cards. Rows that predate the schema push and have no section keep showing. Deploy this only **after** the schema push: before it, Appwrite rejects the unknown `section` attribute and the portal's catch returns an empty list.

- [ ] **Step 1: Write the failing tests** in `member-portal.test.ts` (import `Query` from `@repo/api`; `@repo/api/server` is already mocked):
  - `getMemberPortalBenefits("2")`: `sessionDb.listRows` is called with `"app"`, `"campus_benefits"` and a query array containing `Query.or([Query.equal("section", "member"), Query.isNull("section")])`.
  - `getFeaturedBenefits("2")`: same.

- [ ] **Step 2: Run to verify failure**

Run: `cd apps/web && bun x vitest run src/app/actions/member-portal.test.ts`
Expected: the two new tests FAIL; the existing reveal test passes.

- [ ] **Step 3: Add the query to both functions.**

- [ ] **Step 4: Run tests and type-check**

Run: `cd apps/web && bun x vitest run src/app/actions/member-portal.test.ts && bun run check-types`
Expected: PASS, exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/actions/member-portal.ts apps/web/src/app/actions/member-portal.test.ts
git commit -m "fix(web): member portal lists only member-section benefits"
```

---

### Task 9: Full verification and owner hand-off

- [ ] **Step 1: Repo checks**

Run: `bun x ultracite check` (repo root), then `cd packages/shared && bun run test`, `cd packages/api && bun run test`, `cd apps/web && bun run test`, then `bun run check-types` (repo root).
Expected: all exit 0. Report any failure with its output; don't claim success without it.

- [ ] **Step 2: Hand the owner this go-live checklist** (copy it into the PR description):
  1. Push the schema (`appwrite push tables` from `packages/api`), then `bun run types:generate` in `packages/api`, then commit the regenerated `types/appwrite.ts`.
  2. Deploy web (Task 8) **before** any apply.
  3. Review `.superpowers/benefits-migration/review.md`, edit `plan.json` where needed, and re-run the dry run if the data changed.
  4. Apply (`bun run migrate:benefits -- --apply --plan ../../.superpowers/benefits-migration/plan.json`), now or at Stage 2 go-live. If applied now, nobody should edit benefits in the old admin until Stage 2 ships. The old editor can't handle one-line rows and only writes codes to the old column.
  5. Not in this stage: removing table-level `read("any")` from `campus_benefits` (Stage 4, after Stage 2's admin is live) and clearing the old `redemption_value` column (Stage 4).
