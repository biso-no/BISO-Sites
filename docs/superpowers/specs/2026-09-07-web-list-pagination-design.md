# Web list pagination, search, filtering & sorting

Date: 2026-09-07
Status: Approved for planning

Covers the three public list surfaces in `apps/web`: `/jobs`, `/events`,
`/shop`. Sibling to `2026-09-03-admin-pagination-design.md`, which did the same
for `apps/admin` and explicitly deferred the web app to "a separate session".

## Background

All three pages fetch one large window and do everything else in the browser:

| Page | Action | Fetch limit | Done client-side |
|---|---|---|---|
| `/jobs` | `listJobs` | 100 | search, paid, employment type, unit category, department, sort |
| `/events` | `listEvents` → `queryEvents` | 200 | search, category, member-only, collection-item hiding |
| `/shop` | `listProducts` | 100 | search, category, member-only |

`/shop` additionally re-fetches all 100 products from a `useEffect` whenever the
campus switcher changes.

### Live data shape (probed 2026-09-07, read-only)

| Table | Published | Actually listed |
|---|---|---|
| `jobs` | 253 | **28** (open — deadline unexpired) |
| `webshop_products` | 52 | 52 |
| `events` | 3 | 3 |

At 12 rows/page that is 3, 5 and 1 pages. **The performance win is modest
today; the correctness wins are the reason to do this work.** Recruitment-season
job spikes are what pagination is banked for.

### Three production bugs this work fixes

1. **Events search returns nothing.** `queryEvents`
   (`apps/web/src/lib/data/queries.ts:179`) calls
   `Query.search("translation_refs.title", …)`. Appwrite rejects fulltext
   through a relationship — *"Searching by attribute
   "translation_refs.title" requires a fulltext index"* — and `listEvents`'s
   `try/catch` swallows the throw and returns `[]`. Any search on `/events` is
   silently empty.

2. **Open jobs can be invisible.** `_listJobs` fetches the 100 *newest
   published* jobs, then post-filters with `isRecruitmentVacancyOpen`. Only 28
   of 253 published jobs are open; any open vacancy older than the newest 100
   never reaches the page. Moving the deadline predicate into the query fixes
   it — and is required for pagination regardless, since a post-fetch filter
   makes `response.total` wrong and leaves holes in page slices.

3. **Every event renders as "Social".** The admin editor writes the real
   `events.category` enum column (`_actions/events.ts:474`), but web reads
   `metadata.category` via `getEventCategory()`, which defaults to `"Social"`
   when absent. All 3 published events have the column set. Affects
   `event-card`, `event-hero`, `event-detail-modal`, `event-info-cards`,
   `home/events-section` and the `/events` category filter.

## Goals

1. All three surfaces paginate against Appwrite's true `total`, with a **"Load
   more"** control; page state lives in the URL so results are linkable.
2. Search, filtering and sorting are **server-side**, applying to the whole
   dataset rather than the loaded window.
3. Filter dropdown options come from a facet query over the full filtered set,
   not from the current page.
4. Fix the three bugs above as part of the change, not as follow-ups.
5. Backfill the department data the unit-category filter depends on, so the
   filter is honest rather than merely present.

## Non-goals

- **No Appwrite schema changes.** Filters expressible only against the
  `metadata` JSON string are dropped from the UI rather than promoted to
  columns (see "Dropped from the UI"). The unit-category filter is the
  exception that proves the rule — it survives because `departments.type` is
  already a real column reachable through a relationship, so it needs *data*,
  not schema.
- **Not a departments-data cleanup project.** The three backfills exist to make
  the category filter honest, and stop there. Deduplicating the 139
  decommissioned units, fixing the `Accounting Departement` typo, or enforcing
  `department_id` on new jobs are separate calls.
- The admin app's behaviour. Two modules are promoted to shared packages, but
  admin keeps its current behaviour through re-export shims. The **one
  deliberate admin change** is the accounting-row exclusion in
  `/api/units/sync` (backfill 3), which cannot live anywhere else.
- Detail pages (`/jobs/[slug]`, `/events/[slug]`, `/shop/[slug]`), cart,
  checkout, membership.
- Rewriting card markup. `JobCard`, `EventCard`, `ProductCard` are untouched
  except for the events category source.
- Infinite scroll and numbered page bars. "Load more" was chosen deliberately:
  numbered bars read as admin table furniture on a marketing card grid, and
  infinite scroll strands the `/shop` pickup-info and `/jobs` CTA footers.

## Verified Appwrite behaviour

Everything below was probed against the live instance on 2026-09-07 with
read-only `listRows` calls. **These are facts, not assumptions.**

| Query shape | Result |
|---|---|
| `Query.or([…, Query.and([…]), …])` (one nesting level) | ✅ works |
| `Query.search` on a relationship attribute (`translation_refs.title`, `translations.title`) | ❌ **rejected** — needs a fulltext index on the queried table |
| `Query.search` directly on `content_translations.title` / `.description` | ✅ works (fulltext indexes `search_title`, `search_description` exist) |
| `Query.or([Query.search(title), Query.search(description)])` on `content_translations` | ✅ works |
| `Query.equal("$id", [ids])` on a parent table | ✅ **260 ids accepted** — no practical cap at this scale |
| Phase-2 shape: 150 ids + `equal(status)` + deadline `or` + `orderDesc` + `limit` + `offset` | ✅ correct `total` |
| `Query.equal("event_ref.status", …)` — filtering translations by parent props | ✅ works (but unusable for jobs, below) |
| `Query.offset(5000)` | ✅ accepted |
| **`Query.equal("department.active", true)` on `jobs`** — filter operators through a relationship | ✅ **works — returned 21 rows.** Also `isNotNull`, and the array form `equal("department.type", ["society","project"])` |
| `Query.select(["department.*"])` / `Query.select(["$id","department.type"])` | ✅ works |
| Relationship filter composed with status + deadline `or` + `orderDesc` + `offset` | ✅ works |
| **`Query.orderAsc("department.Name")`** | ❌ **rejected** — *"Cannot order by nested attribute: department"* |

**Filtering traverses relationships; ordering does not.** This is the finding that
keeps the unit-category filter server-side (via `department.type`) while A–Z
sort stays impossible.

**`jobs.translations` is `twoWay: false`.** There is no `job_ref` column on
`content_translations`, so jobs cannot be searched from the translations side
with a parent-property filter the way events (`event_ref`) and products
(`product_ref`) can. Jobs forces the two-phase strategy; all three use it for
consistency.

## Design

### 1. Shared foundation

Two admin modules are already generic and hardened (six review rounds on PR
#60). Promote both; **admin behaviour must not change** — it is in production.

| Move | To | Admin becomes |
|---|---|---|
| Size-independent half of `apps/admin/src/lib/list-params.ts`: `MAX_OFFSET`, `lastPageByOffset`, `lastReachablePage`, `firstParam`, `ListSearchParams` | `@repo/shared/utils/list-params` | keeps `PAGE_SIZES`, `PageSize`, `DEFAULT_PAGE_SIZE`, `parseListParams`, `PaginatedResult`, `emptyResult`; re-exports the rest |
| `apps/admin/src/app/(portal)/_components/use-list-params.tsx` (incl. the 300 ms-debounced `useUrlSearch` and the pending-write context) | `@repo/ui/hooks/use-list-params` | one-line re-export |

`packages/ui/package.json` needs a `"./hooks/use-list-params":
"./hooks/use-list-params.tsx"` export entry — the existing `"./hooks/*"` glob
maps to `.ts` only.

The pending-write context is not incidental: `/jobs` has search, department and
sort all writing the same URL, and writing straight to `router.replace` drops
whichever write has not yet committed. Admin already solved this.

`apps/web/src/lib/list-params.ts` (new, thin):

```ts
/** 12 divides both the 2-col (jobs) and 3-col (events, shop) grids evenly. */
export const WEB_PAGE_SIZE = 12;
export function parseWebListParams(sp: ListSearchParams): { page: number; q: string };
```

Web has no page-size picker, so it never parses `?size=` and does not need
admin's `PageSize` union. Admin's `PAGE_SIZES = [25, 50, 100]` stays admin's.

**`PaginatedResult` and `emptyResult` are deliberately *not* moved.** Admin's
`PaginatedResult<T>` types `size` as its own `PageSize` union (`25|50|100`),
which web's `size: 12` cannot satisfy. Widening the shared type to
`size: number` would loosen admin's, and a generic parameter is not worth it
for a five-line interface. Web declares its own in
`apps/web/src/lib/list-params.ts` with `size: number`. This is the one place
duplication is preferred to sharing, and the reason is the type, not
convenience.

### 2. Server actions return `PaginatedResult<T>`

All three change from `Promise<T[]>` to
`Promise<PaginatedResult<T>>` — `{ rows, total, page, size, capped }`, where
`capped` marks a search that hit `SEARCH_CANDIDATE_CAP` and whose `total` is
therefore a floor rather than an exact count. They take `page`, and apply
`Query.limit(WEB_PAGE_SIZE)` + `Query.offset((page - 1) * WEB_PAGE_SIZE)`.

**The blast radius is wider than the three list pages.** Enumerated:

| Consumer | Calls | Role |
|---|---|---|
| `(public)/jobs/page.tsx` | `listJobs` | paginated surface |
| `(public)/events/page.tsx` | `listEvents` | paginated surface |
| `(public)/shop/page.tsx` | `listProducts` | paginated surface |
| `components/shop/shop-list-client.tsx:57` | `listProducts` | **the `useEffect` re-fetch — deleted** |
| `(public)/page.tsx:57` | `listEvents` | home, first-N |
| `(public)/campus/page.tsx:40-41` | `listEvents`, `listJobs` | first-N (limit 10) |
| `(public)/students/page.tsx:24-25` | `listEvents`, `listJobs` | first-N (limit 24) |
| `lib/data/nav-featured.ts:84` | `queryEvents` | nav featured card |
| `lib/data/public-content.ts:67` | `queryEvents` | first-N |

The six first-N consumers are **not** converted to paginated surfaces. They read
`.rows` off the new result and are otherwise untouched — one property access
each, which is cheaper than maintaining a parallel array-returning entry point
and a second copy of the query logic.

They do inherit the query-level upcoming/open filters, which is a fix: they
share the post-fetch-filter bug today. `/campus` requesting `limit: 10` open
jobs currently gets "however many of the 10 newest published jobs happen to be
open", frequently fewer than 10 and sometimes zero.

`_listJobs` is wrapped in React `cache()` keyed on **primitive arguments only**
(an object would never hit the memo — see the comment citing
`WEB_APP_APPWRITE_INCIDENT_AUDIT.md` F-6b). The new `page` and `sort` arguments
must be threaded as additional primitives, preserving that constraint.

**Post-fetch filters must become queries.** This is the non-mechanical part: a
filter applied after the query returns makes `response.total` overcount and
punches holes in page slices.

`_listJobs` — replace the `isRecruitmentVacancyOpen` post-filter:

```ts
Query.equal("status", JobsStatus.PUBLISHED),
Query.or([
  Query.isNull("application_deadline"),
  Query.greaterThanEqual("application_deadline", nowIso),
])
```

Equivalent: the helper's "unparseable date → keep" branch is unreachable for a
datetime column.

`queryEvents` — replace the `isEventUpcoming` post-filter and the 30-day
prefilter (nested `and`-in-`or` verified above):

```ts
Query.or([
  Query.greaterThanEqual("end_date", nowIso),
  Query.and([Query.isNull("end_date"), Query.greaterThanEqual("start_date", nowIso)]),
  Query.and([Query.isNull("end_date"), Query.isNull("start_date")]),
])
```

Also lift two filters out of `EventsListClient` into the query:

```ts
// non-members
Query.or([Query.equal("member_only", false), Query.isNull("member_only")])
// main events only — probe: 3/3 rows have collection_id NULL, "" unused,
// but keep the empty-string arm; the admin editor may write "".
Query.or([
  Query.equal("is_collection", true),
  Query.isNull("collection_id"),
  Query.equal("collection_id", ""),
])
```

`listProducts` — lift `member_only` out of `ShopListClient` into the same
`or([equal(false), isNull])` shape, and drop the `useEffect` re-fetch in favour
of URL-driven campus state.

### 3. Search: two-phase

Uniform across all three surfaces.

- **`q` empty** (the common path) — one query against the parent table with all
  filters, order, limit and offset. Correct `total`.
- **`q` present** — two queries:
  1. `content_translations`:
     `or([search("title", q), search("description", q)])` +
     `equal("content_type", <job|event|product>)` + `equal("locale", locale)` +
     `select(["content_id"])` + `limit(SEARCH_CANDIDATE_CAP)`
  2. parent table: `equal("$id", uniqueContentIds)` + every other filter +
     order + limit + offset

`SEARCH_CANDIDATE_CAP = 500`. A deliberately broad probe (`"a"` across all job
translations) returned 186 hits, so there is ample headroom. The cap is a
documented ceiling, not a silent truncation: when phase 1 returns exactly the
cap, the surface must not claim an exact total (see Error handling).

If phase 1 returns zero ids, short-circuit to `emptyResult()` — do not issue
phase 2 with an empty `$id` array.

**Behaviour narrowing, accepted:** `/jobs` search currently also matches
department name and company. Company lives in `metadata` (unqueryable);
`departments.Name` has no fulltext index. Server-side search becomes **title +
description only**. The `jobs.filters.searchPlaceholder` message
("Search positions by title, department, or description...") must be updated to
match, in both `en` and `no`.

### 4. Sorting

| Surface | Options |
|---|---|
| `/jobs` | newest (`orderDesc($createdAt)`), deadline (`orderAsc(application_deadline)`) |
| `/events` | start date (`orderAsc(start_date)`) |
| `/shop` | newest (`orderDesc($createdAt)`), price asc/desc (`regular_price`) |

**A–Z is dropped everywhere.** Titles live on `content_translations`; Appwrite
cannot order a parent query by a related table's column.

### 5. Facets

Filter dropdowns must not be built from the current page or they would list 12
rows' worth of options.

All three are the same cheap shape: a second query over the *filtered* set with
`Query.select([<one column>])` + `Query.limit(300)`, deduped in memory.

- **Jobs departments** — `select(["department_id"])`. Probe returned 28 rows,
  so this is cheap. Doubles as the honest `departmentCount` for `JobsHero`.
- **Jobs unit categories** — `select(["department.type"])` over the filtered
  set, normalised through `parseUnitCategory` and deduped. Rendering the static
  `UNIT_CATEGORIES` list instead would show six options where most return
  nothing, which is the bug `jobs-list-client.tsx` already warns about.
- **Event categories** — `select(["category"])`.
- **Shop categories** — `select(["category"])`.

Categories are facet-derived rather than rendered from the static
`EventsCategory` enum / `SHOP_CATEGORIES` const, for the reason
`jobs-list-client.tsx` already documents about unit categories: *"a static list
of every category would render six options that all return nothing."* With 3
published events, a static list of the 8 enum values would give 6 dead buttons.
The static lists survive only as the source of ordering and label lookup —
render the intersection, ordered by the static list.

### 6. Load-more client

One component per surface (each wraps its own server action), sharing a pattern:

- Server-renders page 1; the client seeds `items` from props and holds a `page`
  counter.
- "Load more" calls the surface's server action for page N+1 and **appends**.
- Filter/search/sort changes arrive as new server props. The client resets by
  **remount via a `key` derived from the filter state** — not a `useEffect`
  sync, which is the classic source of stale-append bugs.
- `useTransition` around the URL write drives a pending state on the grid.
- The button hides when `items.length >= total`, and when the next offset would
  exceed `MAX_OFFSET`.

Existing `motion`/`AnimatePresence` transitions stay; appended items animate in
rather than the whole grid re-keying on every keystroke.

### 7. Events category fix

Switch from `getEventCategory(parseEventMetadata(metadata))` to the
`event.category` column across `events-list-client`, `event-card`,
`event-hero`, `event-detail-modal`, `event-info-cards` and
`home/events-section`. The category filter becomes a server-side
`Query.equal("category", value)`.

i18n: `events.filters` currently keys `Social | Career | Academic | Sports |
Culture`. The real enum is `social | career | workshop | talk | party | sport |
academic | trip`. Both `en` and `no` message bundles need the new key set;
`Sports`→`sport` and `Culture` has no enum equivalent and is removed.

`getEventCategory` / the `eventCategories` const in `lib/types/event.ts` are
deleted once no caller remains. The `category?: string` field stays on the
`EventMetadata` interface only if a reader remains; otherwise remove it too.

### 8. Dropped from the UI

Per the decision to make no schema changes, these come out of `/jobs`:

| Dropped | Why |
|---|---|
| **Paid** filter | `metadata.paid` — JSON string, unqueryable |
| **Employment type** filter | `metadata.employment_type` — same |
| **A–Z** sort | title is on a related table; `orderAsc("department.Name")` is rejected outright |
| **`paidPositions`** hero stat | same source as the paid filter |

**The unit-category filter is retained**, not dropped — see "Unit category" below.
It is the one metadata-shaped filter with a real column behind it.

`JobsHero` keeps `totalPositions` (now the true `total`) and `departmentCount`
(now from the facet query, replacing the `|| 4` fallback). Removing
`paidPositions` changes the hero's stat layout — it drops from three stats to
two.

`jobs.filters.paidOnly` becomes unused and is removed from `en` and `no`. The
unit-category keys (`academicAssociations`, `societies`, `staffFunctions`,
`projects`, `national`, `other`) **stay** — they are still the label source via
`UNIT_CATEGORY_MESSAGE_KEYS`.

### 9. Unit category

Retained as a **server-side** filter, replacing today's client-side
`parseUnitCategory(job.department?.type)` pass:

```ts
Query.equal("department.type", category)   // verified working
```

The contract already exists and needs no schema change:
`packages/shared/utils/unit-categories.ts` defines `UNIT_CATEGORIES`
(`society`, `academic_association`, `project`, `staff_function`, `national`,
`other`), `parseUnitCategory` (folds case, separators and legacy aliases), and
the `string(20)` guard. The admin editor already exposes the picker
(`unit-profile-card.tsx:128`, validated by `z.enum(UNIT_CATEGORIES)` at
`_actions/departments.ts:389`).

`parseUnitCategory` normalises legacy spellings that a raw `Query.equal` will
not match (`committee` → `staff_function`, `forening` → `society`, …). The
backfill below is what makes an exact-match query safe: it writes canonical
values, so the query and the parser agree. Until then the filter returns
nothing — correctly, not erroneously.

**Jobs with no department** are excluded when a category is picked
(`department.type` cannot match on a null relationship), preserving today's
documented behaviour: *"Uncategorised units only drop out when a category is
actively picked."* Backfill 2 is what makes that acceptable.

## Data backfills

The filter is only as good as the data. Two gaps, both measured on 2026-09-07.
**No backfill writes to production without an approved review file.**

### Backfill 1 — `departments.type` (280 rows, all null)

Every department has `type = null`. Scope: **the 141 active departments**; the
139 decommissioned ones (`- nedlagt`, `- inaktiv`, `- flyttet til nasjonalt`)
own no open jobs and never will.

Method — **rules first, AI for the residue, human approval before any write:**

1. **Deterministic rules** for every case stated explicitly. Priority order
   matters, because the exceptions overlap the general rules:
   - `Fadderullan` | `Winter Games` | `Charity` | `Karrieredagene` /
     `Career Days` → `project`
   - `Næringslivsutvalget`, `Branding Committee`, `Accounting Department` →
     `staff_function` *(must precede the `utvalg` rule — `Næringslivsutvalget`
     contains `utvalget` but is not a society)*
   - Administrative units — `Ledelsen *`, `Board`, `HR`, `Control Committee`,
     `Investment Committee`, `Operations Unit`, `Drift BISO`,
     `Academic/Political Forum`, `Organisasjonsstrukturkomiteen`,
     `Samlinger - CL`, `Student groups outside BISO` → `staff_function`
   - `utvalg` | `society` → `society`. Confirmed to include
     `Studentpolitisk utvalg`, `Fagutvalget` and `Korkutvalget` — these read as
     staff functions from outside BISO, and are not.
   - otherwise → residue for step 2

   Note `Ledelsen *` lands in `staff_function` via the administrative-unit rule
   while `Drift *` is excluded from categorisation entirely (backfill 3).
2. **AI pass** (`@repo/ai`) over the residue only, given the name, campus, and
   the rules above as context. It exists to make one judgment regex cannot:
   `OSL IM - International Management` (academic association) vs.
   `OSL PEIB - Private Equity Investment Banking Group` (society) share an
   identical `CODE ABC - Full Name` shape.
3. **CSV** — every row with its proposed category, the rule or model that
   proposed it, and a confidence marker. Rows needing a human call are flagged,
   including **`Alumni`**, the one administrative unit explicitly excluded from
   the `staff_function` rule without a replacement being named. `Drift BISO` is
   resolved — it is accounting-only, see backfill 3.
4. **Apply** only the approved CSV, batched.

### Backfill 2 — job → department links (232 of 253 unlinked)

Only 21 published jobs (10 of the 28 open) have a department. `department_id`
and the relationship are always in sync — admin writes both together
(`_actions/jobs.ts:633-634`) — so there is no split-brain to repair; the links
were simply never made. `department_id` is `.optional().nullable()` in the
admin schema, so nothing enforces it.

`metadata.company` is **null on every unlinked open job**, so it is not the
signal. The **slug** is: `project-manager-fadderullan-bergen-2027` →
`BRG Fadderullan`; `branding-committee-leader-honorert-verv-2` →
`Branding Committee`; `biso-media-pr-content-creator-3` → `OSL Media`. Only 2
of 28 open jobs have an unusable slug (emoji-only, e.g.
`%f0%9f%93%b1-communication-manager`); their `content_translations.title`
should cover those.

Same shape as backfill 1: candidate departments narrowed by the job's
`campus_id`, matched against slug + translated title, AI-assisted for the
ambiguous ones, CSV for approval, then batched write setting **both**
`department_id` and the `department` relationship.

### Backfill 3 — deactivate the `Drift *` accounting rows

**The whole `departments` table is imported and synced from Finago** (24SevenOffice)
via `POST /api/units/sync` (`apps/admin/src/app/api/units/sync/route.ts`). That
changes how this must be done.

The sync upserts a fixed column set — `$id`, `Id`, `Name`, `active`,
`campus_id`, `campus`, and conditionally `slug`:

```ts
active: activeIds.has(department.id),   // route.ts:82
```

Two consequences, both load-bearing:

- ✅ **`type` is not in that write set**, so backfill 1 survives every sync.
  `upsertRow` patches only named columns (the route's own comment spells this
  out for `slug`).
- ❌ **`active` IS in the write set.** A one-off `active = false` write would be
  **reverted by the next sync run**, because Finago reports these departments
  as active. Writing the row directly does not work.

**The fix belongs in the sync route**, keyed on Finago's department number
rather than the name — `$id === Id === `the Finago number for all 280 rows, and
a rename in Finago must not silently un-hide a row:

```ts
/**
 * Finago department numbers that are accounting constructs, not BISO units.
 * Finago is the source of truth for this table, so without this the sync
 * reactivates them on every run.
 */
const ACCOUNTING_ONLY_DEPARTMENT_IDS = new Set(["1", "300", "600", "800", "1000"]);

active:
  activeIds.has(department.id) &&
  !ACCOUNTING_ONLY_DEPARTMENT_IDS.has(department.id),
```

Those five ids are `Drift Campus Oslo` (1), `Drift Campus Bergen` (300),
`Drift Campus Trondheim` (600), `Drift Campus Stavanger` (800) and `Drift BISO`
(1000) — the first id of each campus range under the route's own `getCampusId`
banding. A one-off write applies it immediately; the route change is what makes
it stick.

**`Ledelsen *` (ids 2, 301, 601, 801) is NOT deactivated** — those are real
leadership units and get `staff_function`.

What deactivation actually does, verified: `departments.active` gates the
`/units` listing and 404s the unit page (`units/[...segments]/page.tsx:162`,
`resolve.ts:115`). It does **not** cascade to the department's content — the
2 events and 9 webshop products owned by Drift rows keep rendering, since those
pages filter by status and campus, not by department activity. That is the
intended outcome: the accounting placeholder stops being a browsable unit
without taking published content down with it.

Active department count drops 141 → 136.

## URL parameters

| Param | Surfaces | Notes |
|---|---|---|
| `page` | all | omitted when 1 |
| `q` | all | debounced 300 ms via `useUrlSearch` |
| `campus` | all | already exists on `/jobs`; added to `/events` and `/shop`, replacing the `useEffect` re-fetch |
| `department` | jobs | existing |
| `category` | jobs | unit category → `Query.equal("department.type", …)` |
| `sort` | jobs, shop | omitted at default |
| `category` | events, shop | existing on shop; events switches to enum values |

Any filter change resets `page` — `useListParams` already does this.

`campusScopeIds` continues to govern campus scoping (selected campus + National,
per `lib/campus-scope.ts`); pagination does not change that rule.

## Error handling

- Actions keep their existing `try/catch` → return `emptyResult(params)` rather
  than a bare `[]`, so callers always get a `PaginatedResult` shape.
  **The events search bug was invisible precisely because a catch returned `[]`
  — every caught error must be logged with the failing query context.**
- Junk in the address bar clamps rather than throws (`parseListParams` already
  does this): `?page=abc` renders page 1.
- A `page` past `MAX_OFFSET / size` is clamped before any fetch.
- When phase-1 search hits `SEARCH_CANDIDATE_CAP`, the action sets a
  `capped: true` flag on its result and the surface renders a new
  `filters.showingFirstResults` message ("Showing the first {count} matches —
  refine your search") instead of the exact `filters.showingResults` count. New
  key in `en` and `no` for `jobs`, `events` and `shop`.
- "Load more" failures leave already-loaded items on screen and surface a retry,
  never a blank grid.

## Testing

Vitest, matching the admin PR's approach (`*-pagination.test.ts` colocated with
the actions).

**Unit — pure modules**
- `@repo/shared/utils/list-params`: clamping, `lastReachablePage`,
  `lastPageByOffset` at the `MAX_OFFSET` boundary.
- Admin's re-export shims still export every symbol admin imports today.

**Action tests (mocked `db`) — assert the queries built, not just the rows**
- Jobs: deadline `or` present; no post-fetch open-filter remains; offset
  arithmetic; facet query issued once.
- Events: the three-arm upcoming `or`; member-only arm absent for members and
  present for non-members; main-events-only arm.
- Products: member-only arm; category and campus arms.
- Two-phase search: phase 1 issued only when `q` is non-empty; phase-2 `$id`
  array matches phase-1 ids; **zero phase-1 hits short-circuits without a phase
  2**; cap behaviour at 500.
- Regression: `total` reflects Appwrite's count, never `rows.length`.

**Component tests**
- Load-more appends rather than replaces; remounts (resets to page 1) when the
  filter key changes; button hidden at `items.length >= total`.

**Backfill scripts**
- Rule classifier is a pure function with a table-driven test per stated rule,
  including the two ordering traps: `Næringslivsutvalget` resolves to
  `staff_function` despite containing `utvalget`, and `OSL Charity - nedlagt`
  resolves to `project` despite the suffix.
- Every proposed value passes `isUnitCategory` and the `string(20)` guard
  before reaching the CSV.
- Apply step is a no-op when handed an unapproved or unchanged file, and is
  idempotent on re-run.
- Sync route: a test asserting the five `ACCOUNTING_ONLY_DEPARTMENT_IDS` come
  out `active: false` even when Finago's REST result reports them active —
  the exact condition that would otherwise silently undo backfill 3.
- Sync route: a test asserting the upsert payload still omits `type`, so a
  future column addition cannot quietly start clobbering the categories.

**Manual verification against the live instance**
- `/jobs` shows all 28 open positions across pages — including any open
  vacancy outside the newest 100, which bug 2 currently hides.
- `/events` search returns results (it returns nothing today).
- Event cards show their real categories, not "Social".
- After the backfills: the category filter returns non-empty results for every
  category it offers, and the department dropdown lists more than the single
  option ("OSL Fadderullan") available today.

## Risks

| Risk | Mitigation |
|---|---|
| Promoting the two admin modules regresses live admin | Re-export shims, no behaviour change; admin's existing pagination tests must stay green |
| Two-phase search cap silently truncates | 500 cap vs. a 186-hit worst-case probe; explicit "first N results" messaging at the cap |
| `collection_id` empty-string vs NULL | Query covers both arms; probe confirmed all current rows are NULL |
| Dropped job filters are missed by students | Reversible by promoting `paid` / `employment_type` to real columns later; the query layer is where that change would land |
| **A backfill writes a wrong category to production** | Nothing writes without an approved CSV; rules cover the stated cases deterministically and the AI pass only proposes. Reversible — `type` is a single free-text column with no dependants |
| **Backfill 2 links a job to the wrong department** | Same approval gate. Wrong links are more visible than missing ones, so low-confidence matches are left unlinked rather than guessed |
| **A Finago sync reverts the backfill** | Measured: the sync writes `active` but not `type`, so backfill 1 is safe and backfill 3 is not — which is why 3 is implemented in the sync route, not as a row write. Any future column added to that route's upsert set must be re-checked against this |
| Deactivating the `Drift *` rows hides something in use | Five rows; `active` is reversible; they own no jobs, and their 2 events / 9 products are unaffected because `active` does not gate content. Called out separately in the review file rather than bundled with categorisation |
| An id-based exclusion drifts if Finago renumbers | Ids are Finago's own department numbers and are already load-bearing in the route (`getCampusId` bands on them), so renumbering would break more than this. Keyed on id precisely so a *rename* cannot un-hide a row |
| Category filter ships before the backfill lands | It returns empty rather than wrong — the facet query renders only categories that exist, so no dead filter buttons appear |
| Events i18n key churn | `en` and `no` updated together; a missing key surfaces as a visible `next-intl` error, not a silent blank |
