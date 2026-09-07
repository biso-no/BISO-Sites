# Admin list pagination & orders export

Date: 2026-09-03
Status: Approved for planning

## Background

Appwrite now returns the true row count in `response.total` on `listRows`,
rather than the count within the query's `limit`. Every admin list can
therefore paginate properly instead of loading a fixed window.

Today the admin app is inconsistent:

- Six surfaces already paginate via `?page=` and the shared `PaginationBar`:
  news, documents, events, jobs, job applications, announcements.
- The rest load a fixed window and stop: shop products (100), shop orders
  (50), pages (100), benefits (100), partners (100), departments (500),
  members (200), IT users (500), drafts (3x50), activity (50), submissions
  (50), varsling, approvals (50).
- Search and filter chips run **client-side over the loaded window** in most
  list clients. Once real pagination lands this is a correctness bug: a search
  on page 3 would only search those rows.
- `listJobs` and `listEvents` already work around this by fetching a 200-300
  row window and slicing in memory, which is silently wrong past the cap.

Return shapes differ three ways: `{rows,total}`, `{rows,total,page,pageSize}`,
and a bare array.

## Goals

1. Every admin list paginates against Appwrite's true `total`, driven by URL
   search params so pages are linkable and back/forward works.
2. Search and filters are server-side and live in the URL, so they apply to the
   whole table rather than the current page.
3. Page size is user-selectable via `?size=`.
4. The orders export covers every matching order, scoped by product and/or date
   range, rather than the rows currently on screen.

## Non-goals

- The `web` app. Same change there is a separate session.
- Rewriting list row rendering. The shop / jobs / events dashboards keep their
  markup; only data flow and toolbar state change.
- Lists that feed dropdowns or batch jobs rather than tables: `listCampuses`,
  `listDepartmentsForCampus`, `listAssignableDepartments`, `palette-search`,
  and the segment/attendee sweeps in `event-segments.ts`.

## Design

### Shared contract

`src/lib/list-params.ts` — a plain module (not `"use server"`, so it may export
constants and sync functions):

```ts
export const PAGE_SIZES = [25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;

export type ListParams = {
  page: number;   // 1-based, clamped >= 1
  size: number;   // clamped to PAGE_SIZES, else DEFAULT_PAGE_SIZE
  q: string;      // trimmed; "" when absent
};

export function parseListParams(
  sp: Record<string, string | undefined>
): ListParams;

export function paginationQueries(p: ListParams): string[]; // [limit, offset]

export type PaginatedResult<T> = {
  rows: T[];
  total: number;  // Appwrite's true total for the filtered set
  page: number;
  size: number;
};
```

Every `list*` action converges on
`(opts: ListParams & <surface filters>) => Promise<PaginatedResult<T>>`,
replacing the current three-way return-shape split.

`parseListParams` clamps rather than throws: a non-numeric or negative `page`
becomes 1, a `size` outside `PAGE_SIZES` becomes `DEFAULT_PAGE_SIZE`. Garbage
in the address bar renders page 1, never an error page.

### URL params

| Param    | Meaning                                    |
|----------|--------------------------------------------|
| `page`   | 1-based page number; omitted when 1        |
| `size`   | page size; omitted when `DEFAULT_PAGE_SIZE`|
| `q`      | free-text search; omitted when empty       |
| `status` | status filter; omitted when `all`          |

Surface-specific params (`category`, `timeframe`, `topic`, `product`, `from`,
`to`, `tab`) follow the same omit-when-default rule, so a clean list is `/news`
rather than `/news?page=1&q=&size=25`.

The shop dashboard has two independent tables behind tabs. It uses `?tab=`
plus `page` for the catalog and `opage` for orders, so switching tabs does not
reset the other table's position.

### Client hook

`_components/use-list-params.ts` wraps `useRouter` / `usePathname` /
`useSearchParams` and exposes `{ params, setParam(key, value) }`.

- Any filter change resets `page` to 1.
- Empty / default values are deleted from the query string.
- Search input debounces ~300ms before pushing.
- Pushes use `scroll: false` so the viewport does not jump.

### PaginationBar changes

- Takes `size` as a prop; the module-level `PAGE_SIZE` const is removed.
- Renders a 25 / 50 / 100 size picker that writes `?size=` and resets to page 1.
- No longer returns `null` when `totalPages <= 1` — it still shows the total and
  the size picker. It renders nothing only when `total` is 0.

### Server-side search

Search targets differ per table, so there is no single mechanism. Three cases:

**1. Title on the row, fulltext index present** — one query against the row,
using `Query.search` (fulltext) or `Query.contains`:

| Table         | Surface        | Fulltext index      |
|---------------|----------------|---------------------|
| `user`        | members        | `name`, `email`     |
| `partners`    | benefits/partners | `idx_name`       |
| `departments` | departments    | `search`            |

`listMembers` already does this with
`Query.or([Query.contains("name", q), Query.contains("email", q)])`; the other
two follow the same shape.

**2. Title on the row, no fulltext index** — search with `Query.contains`:

| Table          | Surface        | Searchable columns        |
|----------------|----------------|---------------------------|
| `documents`      | documents      | `title`, `description`      |
| `announcements`  | communications | `title_en`, `title_no`      |
| `campus_benefits`| benefits       | `title_nb`, `title_en`      |

`campus_benefits` also has a `contentTranslations` relationship, but its titles
are duplicated onto the row, so one query covers the same text.

**3. Title in a related translations table** — two-step lookup:

| Table              | Relationship field   | `content_type`  |
|--------------------|----------------------|-----------------|
| `news`             | `translation_refs`   | `news`          |
| `events`           | `translation_refs`   | `event`         |
| `webshop_products` | `translation_refs`   | `product`       |
| `jobs`             | `translations`       | `job`           |
| `pages`            | -> `page_translations` | n/a           |

`departments` also has a `translations` relationship (`content_type`
`department`), but it carries a searchable `Name` column with a fulltext index,
so the departments surface uses case 1 — one query, not two.

Note the relationship field name is **not** uniform: `translation_refs`,
`translations` and `contentTranslations` all appear. Do not assume one name.

`content_translations` has a fulltext index on `title` and `description`.
`page_translations` has none, so pages use `Query.contains` on
`page_translations.title`.

`src/lib/content-search.ts`:

```ts
export const SEARCH_ID_CAP = 500;

// Fulltext search on content_translations.title scoped by content_type.
// Returns up to SEARCH_ID_CAP matching content ids.
export async function searchContentIds(
  db: Databases,
  contentType: string,
  q: string
): Promise<string[]>;

// Same contract against page_translations, which has no fulltext index.
export async function searchPageIds(
  db: Databases,
  q: string
): Promise<string[]>;
```

The calling action adds `Query.equal("$id", ids)` to its normal query, so campus
scope, status filters, ordering and pagination all still apply and `total`
stays correct for the intersection. An empty id list short-circuits to
`{ rows: [], total: 0 }` without a second round trip.

**Known limitation:** a search matching more than `SEARCH_ID_CAP` distinct rows
is truncated to the first 500. This is accepted; a search that broad is refined
rather than paged.

**Verify before relying on case 2:** confirm during implementation that Appwrite
accepts `Query.contains` on a column with no index for these tables. If it
rejects the query or performs badly, add a fulltext index in Appwrite and
regenerate `packages/api/appwrite.config.json` with the CLI. No schema change is
planned otherwise.

### Per-surface work

**Tier 1 — server-rendered, no client filter state today.** Add `searchParams` to
the page component, pass `ListParams` into the action, render `<PaginationBar>`.

- Pagination only, no new search UI: `activity`, `inbox/approvals`, `varsling`.
- Pagination plus a `SearchToolbar` wired to `?q=`, since the search mechanism
  is already defined above for each: `benefits` (case 2), `benefits/partners`
  (case 1), `departments` (case 1).

**Tier 2 — client list holding search/filter in `useState`.** Replace local
state with `useListParams`, delete the in-browser `.filter()`, add server-side
search: `news`, `documents`, `communications`, `pages`. `members` and `it/users`
already push `q` to the URL via `SearchToolbar`; they need `page` / `size` plus
their post-query status `.filter()` moved into the Appwrite query.

**Tier 3 — dashboards.** Data flow only, no markup rewrite: `shop`, `jobs`,
`events`, `jobs/applications`. The fetch-300-and-slice hack in `listJobs`,
`listEvents` and `listJobApplications` is deleted in favour of real
`limit`/`offset` plus `searchContentIds`.

**Tier 4 — special cases.**

- `drafts` merges three tables into one list, so a globally correct ordered page
  cannot be built from three independent offsets. Fetch `page * size` rows from
  each source ordered by `$updatedAt` descending, merge, sort, then slice the
  requested window. Report `total` as the sum of the three `total` values. This
  is exact and simple; it reads more rows per request as `page` grows, which is
  acceptable because the drafts list is small and bounded in practice.
- `inbox/submissions` paginates per topic. `listSubmissions` already takes
  `limit` / `offset` and returns a true `total`; it needs URL wiring under
  `?topic=&page=`.

### Deep-paging bound

Appwrite caps `offset` at roughly 5000, so paging stops near page 200 at size
25. Every current surface is far below that. The lists that could grow (orders,
activity, members) carry date and status filters to narrow instead. This is a
documented bound, not a blocker.

## Orders export

### Delivery

A route handler at `apps/admin/src/app/api/shop/orders/export/route.ts`, not a
server action — returning a multi-megabyte CSV string across the RSC boundary is
the wrong mechanism. The handler:

1. Authenticates with `getUserAuthContext()`, then `canViewShopOperations()`,
   then applies the same campus scope as `listOrders`. This is the authorization
   boundary; the route is not otherwise protected.
2. Accepts `product`, `from`, `to`, `status` query params.
3. Streams CSV with `Content-Disposition: attachment; filename="orders-<scope>-<date>.csv"`.

### Paging

The export loops with `Query.cursorAfter`, not `Query.offset`, so the 5000-offset
cap cannot truncate it — a product with 8000 orders exports completely. A
50,000-row safety ceiling guards against runaway queries; hitting it ends the
CSV with a truncation marker row rather than failing silently.

### Product scoping

`orders` has no product column; the path is `orders -> order_items -> product`.
The route resolves `order_items` where `product.$id = X` (cursor-paged),
collects the parent order ids, and batches them back into `orders` queries
alongside the date range and campus scope.

The orders **list view** uses the same helper with a cap, since it only needs a
page. The **export** path is uncapped.

### Dialog

`ExportOrdersDialog` opens prefilled from the current toolbar filters (product,
date range, status), each editable before confirming. A `countOrdersForExport()`
server action drives a live "N orders / M line items" preview so nobody exports
40,000 rows by accident.

The existing toolbar filters move into the URL as `product`, `from`, `to` and
feed the server query, so the visible orders list is itself properly filtered
and paginated.

### CSV shape

One row per **order item**, always — a single shape to maintain regardless of
scope. Orders containing several products produce several rows.

```
order_id, order_date, status, buyer_name, buyer_email, buyer_phone, campus,
product_name, product_id, variation, quantity, unit_price, line_total,
currency, order_subtotal, order_discount_total, order_total,
member_discount_percent, payment_provider, receipt_url, custom_fields
```

- `custom_fields` flattens `order_items.custom_fields_json` to
  `key=value; key=value`. This is where garment sizes and event answers live;
  they are currently unexportable.
- Order-level totals repeat on every item row. Redundant, but it makes
  spreadsheet pivots work without a lookup.
- The existing client-side `exportOrdersCSV` in `shop-studio-dashboard.tsx` is
  deleted; escaping logic moves to a shared server-side CSV helper.

## Testing

- **Unit** — `parseListParams` clamping (negative, zero, non-numeric, oversized
  `size`); `paginationQueries` offset arithmetic; CSV escaping for values
  containing commas, quotes and newlines; `custom_fields_json` flattening,
  including malformed JSON.
- **Integration** — each `list*` action returns a correct `total` and the right
  slice for pages 1, 2 and one past the end (which must return empty rows with
  a nonzero total, not an error). Campus scoping still holds on every page:
  extend the existing `admin-content-boundary.test.ts` and `content-scoping.test.ts`
  patterns so a campus admin cannot reach another campus's rows via `?page=`.
- **Export** — a product-scoped export includes orders beyond the first page of
  `order_items`; the row count matches `countOrdersForExport`; a non-shop role
  receives 403 from the route handler.
- **Manual** — `bun run check-types`, then `bun run build --filter=admin`, which
  is the only thing that catches a non-async export from a `"use server"` file.

## Risks

- **Widest-touching change:** roughly 15 actions, 15 pages and 15 client
  components. Mitigated by tiering: tier 1 surfaces land first and prove the
  contract before the dashboards are touched.
- **Scope regressions:** every list action carries campus/department filters.
  Adding pagination must not drop them. Integration tests assert scoping per
  page, not just on page 1.
- **`"use server"` export rule:** `list-params.ts` and `content-search.ts` must
  stay plain modules. Exporting a const from a `"use server"` file fails the
  build and `check-types` does not catch it.
- **Search cap and offset cap** are both documented bounds rather than solved
  problems. If either becomes a real constraint, the fix is a dedicated search
  index or cursor-based list pagination, both out of scope here.
