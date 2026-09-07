# WordPress → Appwrite Content Import — Design

**Date:** 2026-08-18
**Package:** `packages/wp-import` (new)
**Status:** Approved design, pending implementation plan

## Context

`biso.no` runs on WordPress and is being replaced by the new site (`apps/web` +
`apps/admin`). Before launch, historical content must be migrated from WordPress
into the Appwrite `app` database.

Requested scope was **job positions, events, products, and orders**, keeping in
mind the Advanced Custom Fields (ACF) campus/department field group.

### Source survey (performed 2026-08-18 against live biso.no)

The WordPress REST API is publicly readable and everything needed is exposed.
Relevant namespaces: `wp/v2`, `wc/v3`, `wc/store/v1`, `tribe/events/v1`,
`pll/v1` (Polylang), plus two BISO-authored namespaces `custom/v1` and `biso/v1`.

| Content | Post type | Count | Availability |
|---|---|---|---|
| Job positions | `awsm_job_openings` (WP Job Openings) | **121** published | Public |
| Events | `tribe_events` (The Events Calendar) | **0** | Public |
| Products | `product` (WooCommerce) | **56** published (50 simple, 6 variable) | Public |
| Orders | WooCommerce | unknown | `/wc/v3/orders` → **401**, needs key/secret |

Findings that drive the design:

- **Events are empty.** `wp/v2/tribe_events` (`X-WP-Total: 0`),
  `tribe/events/v1/events` queried 2015→2030 with `status=publish` (`total: 0`),
  `biso/v1/events` (`total_events: 0`), and the live `/events` page all return
  nothing. There is no event data to migrate.
- **ACF on products stores the exact Appwrite IDs.** A product's ACF payload is
  `{campus, department_oslo, department_bergen, department_stavanger,
  department_trondheim, department_national}`, where `campus` is the Appwrite
  `campus.$id` and the populated `department_<campus>` field is the Appwrite
  `departments.Id`. Verified against live Appwrite data: ACF `campus:"1"` →
  campus `$id=1` (Oslo); `department_oslo:"21"` → `21: OSL Bergensbaneløpet`;
  `801` → Stavanger; `600` → Trondheim; `1000/1003/1005/1013` → National.
  **Products therefore need no fuzzy matching.**
- **Jobs do not use ACF at all.** `acf` is `[]` on every `awsm_job_openings`
  post. Campus/department/verv live in the `campus`, `interesser`, and `verv`
  taxonomies, which are **not registered with `show_in_rest`** — they are absent
  from `wp/v2/taxonomies` and the CPT reports `taxonomies: []`. They surface only
  as `class_list` slugs (`campus-bergen`, `verv-naeringslivsutvalget`) and as
  resolved **names** via the BISO-authored `/custom/v1/jobs` endpoint
  (`campus: ["Oslo"], department: ["Karrieredagene"], verv: [...]`).
- **Polylang gives no pairing signal over REST.** ~23% of job posts are `/en/`
  variants of a Norwegian post. `pll/v1` exposes only `languages` and `settings`
  — no per-post translation links — `wp/v2` exposes no `lang` field, and the
  `?lang=` query parameter is ignored (`X-WP-Total: 121` for both `lang=no` and
  `lang=en`). NO/EN posts cannot be reliably paired from the API.
- **Product prices are public.** `/wc/store/v1/products` returns
  `prices: {price, regular_price, sale_price, currency_code: "NOK",
  currency_minor_unit: 0}` without credentials. Only orders need a key/secret.
- **Target tables are empty.** `jobs`, `events`, and `webshop_products` have 0
  rows; `orders` has 3 and `content_translations` has 4 (test data). Clean slate.
- **Date distribution.** 99 of the 121 jobs are dated 2026-08; the remaining 22
  span 2023–2025. A 3-month window captures the current recruitment season.

### Target-side facts

- **`products` is NOT the WooCommerce target.** That table is the student
  marketplace (`seller_id`, `condition`, `is_negotiable`). The WooCommerce
  equivalent is **`webshop_products`**.
- **Titles and descriptions do not live on content rows.** They live in
  `content_translations` (`content_type` enum `job|event|news|product|department|
  memberBenefit|page`, `locale` enum `en|no`), with a unique index
  `uniq_content_locale(content_type, content_id, locale)`.
- **`description` is HTML, but a narrow subset.** `htmlToDescriptionBlocks()`
  (`apps/admin/src/app/(portal)/_components/description-blocks.ts`) strips all
  inline markup via `stripHtml` and keeps only top-level `<p>`, `<h*>`,
  `<ul><li>`, and `<figure>` media blocks. Column size is **8000**.
- **No unique index on `slug`** for `jobs` or `webshop_products`, so imported
  slugs cannot collide at the database level.
- **Row permissions gate public visibility.** `buildJobRowPermissions()`
  (`apps/admin/src/lib/recruitment.ts`) returns `read(any)` for published+public,
  `read(team:<members>)` for published+members, and staff-only for draft/closed.
  `buildContentTranslationPermissions()` (`apps/admin/src/lib/utils.ts`) returns
  `[]` for unpublished rows.

## Decisions (confirmed with user)

- **Events: dropped from scope.** The calendar is genuinely empty; no events
  importer will be written.
- **Orders: historical archive.** User supplies a read-only WooCommerce consumer
  key/secret. Orders import as completed historical records — no payment
  re-processing, no Finago posting.
- **Jobs: last 3 months only, with AI translation.** BISO's HR teams do not
  write manual translations, so the authored locale is whichever language the
  post is actually written in — *not* the Polylang locale it was created under.
  The importer must **detect the written language** and AI-translate to the other
  locale.
- **Departments for jobs: auto-match plus a reviewable mapping file.**
- **Media: mirrored into the Appwrite `media` bucket**, because biso.no is being
  decommissioned and 17 products carry images hosted there.
- **Structure: `packages/wp-import`, extract → transform → load.**

## Architecture

A new workspace package (`packages/*` is already in the root `workspaces` glob),
built as three phases with a JSON snapshot between extract and load.

```
packages/wp-import/
  src/
    wp/client.ts            # WP REST fetch: pagination, retry, rate limiting
    extract/{jobs,products,orders,media}.ts
    transform/
      jobs.ts               # WP job     → Jobs row + 2 content_translations
      products.ts           # WP product → WebshopProducts row + translations
      orders.ts             # Woo order  → Orders row + order_items rows
      departments.ts        # name → Appwrite departments.Id matcher
      html.ts               # WP/Gutenberg HTML → studio-safe subset
      locale.ts             # language detection + AI translation
    load/{jobs,products,orders,media}.ts
    permissions.ts          # replicated row-ACL builders
  scripts/{extract,transform,load}.ts
  snapshots/                # gitignored: raw WP JSON
  mappings/departments.csv  # committed: reviewed department mapping
  reports/                  # gitignored: per-run results + rejects
```

### Why three phases

1. **Extract runs without Appwrite credentials** and preserves the source data
   after WordPress is decommissioned.
2. **Transform is pure and offline**, so the risky logic (263-department fuzzy
   matching, HTML flattening, price/status mapping) is unit-testable without
   network or credentials.
3. **AI translation is the expensive step** (~99 jobs × detect + translate).
   Caching it in the snapshot means a re-run costs nothing.
4. **Department review is a human stop-and-resume boundary** that the pipeline
   needs regardless.

### CLI

Follows the dry-run/`--apply` convention already used by
`packages/api/scripts/cutover-content-permissions.ts`.

```bash
bun run extract   --since=3m      # WP → snapshots/ (no Appwrite creds needed)
bun run transform --since=3m      # snapshots → transformed + review CSVs
bun run load      --jobs          # dry run: print planned writes
bun run load      --jobs --apply  # write to Appwrite
```

`--since` is a flag, defaulting to `3m`, so the window can be widened later.

## Components

### Extract

Each content type joins two endpoints on the WordPress post `id`, because
neither source alone is sufficient:

| Target | Sources |
|---|---|
| Jobs | `/custom/v1/jobs?includeExpired=true&per_page=100` (campus/department/verv **names**, `expiry_date`, `is_expired`) **+** `/wp/v2/awsm_job_openings` (raw `content`, `slug`, `date`, `link`, `class_list`) |
| Products | `/wp/v2/product` (**ACF campus/department IDs**) **+** `/wc/store/v1/products` (NOK prices, images, `type`, `variations`) |
| Orders | `/wc/v3/orders?per_page=100` (consumer key/secret) |

`/custom/v1/jobs` is the only place the non-REST taxonomies resolve to names;
`/wp/v2/product` is the only place ACF appears. Both joins are mandatory.

### Jobs transform

Filtered to posts with `date >= now - 3 months` (~99 posts), then per post:

1. **Detect the written language**, ignoring the Polylang locale. A heuristic
   scorer runs first — `æøå` frequency plus Norwegian stopwords (`og`, `som`,
   `til`, `ikke`, `være`) versus English equivalents. Only low-confidence cases
   escalate to `gpt-5-nano`. This is required because the `/en/` posts are not
   reliably English and vice versa.
2. **Write the detected locale verbatim** into its `content_translations` row.
   The authored copy is never sent through the model, so nothing is reworded.
3. **Translate to the other locale** using the same `generateObject` +
   `gpt-5-nano` approach as `translateContentFields`, caching the result in the
   snapshot.

**Each WP post becomes its own `jobs` row.** With no Polylang pairing signal,
merging NO/EN posts would be guesswork.

The importer keeps its own translation code rather than importing
`apps/admin/src/lib/content-translation.server.ts`: that module imports
`next/server` at the top level (for `after()` in `scheduleContentTranslation`),
and the importer needs language *detection*, which does not exist there.

Other mappings:

- `status`: `is_expired` → `closed`, otherwise `published`.
- `application_deadline`: from `expiry_date`.
- `campus_id`: from the `campus` taxonomy name → `campus.$id`.
- `metadata`: serialized `RecruitmentVacancyMetadata` — `location`, `tags` from
  `verv` (schema caps at 4 items × 40 chars), `cover_image_file_id` after
  mirroring, `auto_translate: false`.

### Department matching

WordPress supplies names (`"Karrieredagene"`, `"HR advisor"`,
`"academic association"`); Appwrite has 263 departments whose names carry campus
prefixes (`OSL `, `BRG `, `TRD `, `STV `) and status suffixes (`- nedlagt`,
`- overført til BIA`, `- lagt ned`). The matcher strips both, folds diacritics,
lowercases, then scores exact → alias → token overlap.

Output `mappings/departments.csv`:

```csv
wp_name,wp_campus,suggested_id,suggested_name,confidence,resolved_id
Karrieredagene,Oslo,,,0.00,
Næringslivsutvalget,Bergen,313,BRG Næringslivsutvalget,0.94,
```

The file is **committed**, so the load is reproducible and a re-run never
re-asks. `resolved_id` (human-entered) wins over `suggested_id`. The auto-accept
threshold is **confidence ≥ 0.85**; below that a suggestion is still written to
the CSV for review but is not used. Rows that are neither resolved nor above
threshold import with `department_id` **null** — the column is optional — and are
listed in the report. **Departments are never guessed.**

### Products transform

ACF maps straight through, no fuzzy matching:

- `acf.campus` → `campus_id` and the `campus` relationship.
- `acf.department_<campus>` → `departmentId` and the `department` relationship.
  (`departmentId` is size 4; the largest observed department Id is `1018`.)
- `regular_price` from `/wc/store/v1/` `prices.price`, divided by
  `10^currency_minor_unit` rather than assuming the current value of `0`.
- `status`: WP `publish` → `published`.
- The 6 variable products → `variants_json`.
- Images → `image` (first) + `images[]` after mirroring.
- Same detect-and-translate pass as jobs, since the shop studio expects both
  locales.

### Orders transform

Historical records only: no payment re-processing, no Finago posting,
`transition_lock` and `finago_posting_lock` left at 0.

- **Status mapping** to the `pending|authorized|paid|cancelled|failed|refunded`
  enum: `completed`/`processing` → `paid`; `on-hold`/`pending` → `pending`;
  `cancelled`, `refunded`, `failed` map directly.
- **Line items are rows in `order_items`**, not a JSON blob. See "Order items
  table" below. `product_id` points at the **new Appwrite** product IDs so
  order history links to imported products.
- **Buyer identity**: `billing` → `buyer_name`, `buyer_email`, `buyer_phone`.
  Email is matched against the `user` table to populate `userId`; unmatched
  orders keep `buyer_email` with `userId` null.
- **Currency**: the column is a `NOK`-only enum, so non-NOK orders are rejected
  into the report rather than coerced.
- `campus_id` is derived from the ACF campus of the ordered products.
- **Original dates preserved.** See "Historical timestamps" below.

### Order items table

`orders.items_json` is replaced by an `order_items` table. The columns mirror
the shape the apps already read out of that JSON, so the app-side migration is
close to a rename plus an opt-in query rather than a reshaping.

`ParsedOrderItem` declares eight fields but carries `[key: string]: unknown`,
and the live checkout (`buildStoredOrderItems`,
`packages/shared/utils/vipps-order-ops.ts`) writes more than those eight. The
table covers the full set actually persisted:

| Group | Columns |
|---|---|
| `ParsedOrderItem` core | `name`, `title`, `price`, `unit_price`, `quantity`, `category`, `product_type`, `product_id` |
| Variant / fulfilment | `variation_id`, `variation_name`, `custom_fields_json` |
| Membership snapshot | `membership_id`, `category_id`, `duration`, `accrual_months`, `start_date` |

The membership snapshot is load-bearing, not incidental: `resolvePurchasedPlan`
prefers it over a fresh `memberships` read because an administrator can edit
the catalogue between payment and fulfilment, and the invoice must book what
the student actually paid. Dropping it would have been a silent regression.

`custom_fields` stays JSON (`custom_fields_json`) — it is a `[{id, label,
value}]` list of arbitrary per-product questions, which is genuinely
variable-shape rather than a missing table.

**Relationships**

| Column | Target | Type | On delete |
|---|---|---|---|
| `orders.order_items` ↔ `order_items.order` | two-way | `oneToMany` (orders is parent) | `cascade` |
| `order_items.product` → `webshop_products` | one-way | `manyToOne` | `setNull` |

`cascade` on the order side means deleting an order removes its lines.
`setNull` on the product side is deliberate: deleting a product must never
delete order history. The flat `product_id` string is written alongside the
relationship, so a line still records what was bought after its product row is
gone.

The product link is **one-way** — `webshop_products` gains no column. Sales per
product are queried from the item side, which Appwrite now supports via
dot-notation filters: `Query.equal("product.$id", [productId])` on
`order_items`. This keeps the publicly readable catalogue table free of a
traversal path into order data.

**Reading them back.** Appwrite no longer returns related rows by default —
relationship loading is opt-in as of the recent versions. A reader that wants
the lines must ask for them:

```ts
db.getRow({
  databaseId: "app",
  tableId: "orders",
  rowId,
  queries: [Query.select(["*", "order_items.*"])],
});
```

Without the `select`, `order_items` comes back absent, not empty — a
distinction worth holding onto when migrating the app call sites.

**Writing them.** The importer nests the children inside the parent upsert.
Each child carries its own `$id` (derived from the WooCommerce line-item id, so
a re-run updates in place instead of appending duplicates) and its own
`$permissions` mirroring the order's. Nesting depth here is orders →
order_items → product, which is within Appwrite's max depth of three.

### Historical timestamps

`orders`, `jobs` and `webshop_products` have no creation-date column; the app
reads `$createdAt` for the shop dashboard's revenue date filter and for the
default ordering of every job, product and order list. Left to Appwrite, the
whole archive would be stamped at cutover.

Appwrite lets a server SDK holding an API key set `$createdAt` / `$updatedAt`
inside `data` on create/update/upsert routes — the documented mechanism for
migrating historical records. **No schema change is required**, which
supersedes the earlier note that preserving order dates would need a new
column.

`buildTimestampOverrides()` maps each source's UTC `*_gmt` dates onto those
columns: `date_created_gmt`/`date_modified_gmt` for orders, post
`date_gmt`/`modified_gmt` for jobs and products. The site-local variants are
deliberately unused — they carry no timezone suffix and would be parsed in the
host's local time, shifting every row by the operator's UTC offset. An absent
or unparseable date omits the key so Appwrite stamps its own, degrading to
today rather than failing the row.

### Media mirroring

Images are downloaded from biso.no and uploaded to the existing `media` bucket,
keyed by source URL so re-runs do not re-upload. URLs are rewritten to Appwrite
file IDs **before** rows are written, so no imported row depends on biso.no
remaining online.

### Idempotency

Deterministic row IDs derived from the WordPress post ID: `wpjob<id>`,
`wpprod<id>`, `wporder<id>`. Re-runs upsert in place instead of duplicating,
imported rows stay identifiable by prefix, and **no Appwrite schema push is
required** (no table has an `external_id` column for these types).

Every write sends a **complete payload**, per `db.upsertRow`'s full-document
replace semantics — the same behaviour that caused the
`Missing required attribute "slug"` failure in the job translation flow.

### Permissions

`src/permissions.ts` replicates `buildJobRowPermissions` and
`buildContentTranslationPermissions`: published+public → `read(any)` plus the
static recruitment staff grants; closed/draft → staff only. Pinned by a unit
test, because wrong ACLs mean imported content is invisible on the public site.
Expired jobs import as `closed`, which correctly carries no public read.

### Required-column fallbacks

Several target columns are `required` but their WordPress counterparts can be
absent. Each needs an explicit rule so a run cannot die mid-load:

| Column | Table | Rule when source is missing |
|---|---|---|
| `campus_id` | `jobs`, `webshop_products` | **Reject the row** into the report. Both are required and there is no safe default — a wrongly-campused job or product leaks across campus scoping. One of the 56 products currently has no ACF campus and will reject until fixed in WP. |
| `regular_price` | `webshop_products` | Simple products use `prices.price`. **Variable** products use the *lowest* variation price as `regular_price` and record the full range in `variants_json`; a variable product with no resolvable price rejects. |
| `title` | `content_translations` | Fall back to the WP post title; if that is empty too, reject — an untitled row is not publishable. |
| `description` | `content_translations` | Empty WP content becomes a single empty `<p></p>` block rather than rejecting, since a job or product can legitimately carry its detail in metadata. Over-length content is truncated at 8000 chars on a block boundary and flagged in the report. |
| `subtotal`, `total`, `currency` | `orders` | Required; a Woo order missing any of them rejects rather than importing a financially wrong record. |

## Error handling

- **Extract**: retry with backoff on 5xx/429; fail loudly on 401 (orders) rather
  than importing a partial set.
- **Transform**: never drops a record silently. Anything unmappable — unresolved
  department, non-NOK order, over-length description, unparseable price — lands
  in `reports/<type>-rejects.csv` with a reason.
- **Description length**: the 8000-char cap is enforced in transform, so a run
  cannot die mid-load on an Appwrite validation error.
- **Load**: dry-run by default, prints planned writes with counts; `--apply`
  writes. Per-row failures are collected and reported without aborting the run,
  and re-running is always safe because IDs are deterministic.

## Testing

`bun:test`, all pure and offline, against fixtures captured from the real
responses pulled on 2026-08-18:

- Department matching, including messy values (`"HR advisor"`,
  `"academic association"`) and prefix/suffix stripping.
- HTML flattening into the `<p>/<h*>/<ul>/<figure>` subset that
  `htmlToDescriptionBlocks` round-trips.
- The 8000-char `description` cap.
- WooCommerce → Appwrite status and price mapping, including `currency_minor_unit`.
- Language detection on known NO and EN job bodies.
- Permission strings for published/closed × public/members.
- Every required-column fallback in the table above, including the campus-less
  product that currently exists in WordPress.

## Runbook

1. Generate a read-only WooCommerce consumer key/secret
   (WooCommerce → Settings → Advanced → REST API), add to the package `.env`.
2. `bun run extract --since=3m` — snapshots written, no Appwrite writes.
3. `bun run transform --since=3m` — review CSVs written.
4. Review and fill `mappings/departments.csv`, then commit it.
5. `bun run transform --since=3m` again to pick up the resolved mapping.
6. `bun run load --products` (dry run) → inspect → `--apply`.
7. Repeat for `--jobs`, then `--orders`.
8. Spot-check in the admin: a job opens in the recruitment studio with intact
   formatting and both locales; a product shows the right campus/department;
   an order renders its line items.

## Out of scope

- **Events** — the source is empty.
- **Articles/news** — the user confirmed the ACF group also appears on articles,
  but articles were never really used.
- **WordPress pages** — the new site's pages are authored in `@repo/editor`.
- **Customers/users** — orders match against existing Appwrite users by email;
  no user accounts are created.

## Assumptions

- The 3-month job window (~99 posts) is the intended set; `--since` makes it
  adjustable without a code change.
- Products get the same AI translation pass as jobs.
- Imported orders are read-only history and will not be reconciled against
  Vipps/Stripe or posted to Finago.
