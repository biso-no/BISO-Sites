# @repo/wp-import

One-shot migration tool that pulls job postings, WooCommerce products and
WooCommerce orders from the BISO WordPress site (`biso.no`) and writes them
into Appwrite as `jobs`, `webshop_products`, `orders` and `content_translations`
rows. It is not a long-running service — it is a CLI you run by hand during the
WordPress → Appwrite cutover, and it is safe to re-run because every write is
an upsert keyed by a deterministic id (see below).

There is deliberately **no events importer**: The Events Calendar on
`biso.no` was surveyed across 2015–2030 and returned zero published events, so
there is nothing to migrate.

## Prerequisites

Copy `.env.example` to `.env` and fill in:

| Variable | Where it comes from |
|---|---|
| `WP_BASE_URL` | The WordPress origin, e.g. `https://biso.no`. |
| `WC_CONSUMER_KEY` / `WC_CONSUMER_SECRET` | WooCommerce → Settings → Advanced → REST API. Create a **read-only** key; the importer never writes back to WordPress. Only needed for `--orders` — job and product extraction uses public/ACF REST endpoints that don't require WooCommerce auth. |
| `NEXT_PUBLIC_APPWRITE_ENDPOINT` | Same value used by `apps/admin`/`apps/web` (e.g. `https://<region>.cloud.appwrite.io/v1`). |
| `NEXT_PUBLIC_APPWRITE_PROJECT` | The Appwrite project id (`biso`, not `dev`). |
| `APPWRITE_API_KEY` | A server API key with read/write scope on the `app` database (tables, rows) and the `media` storage bucket. Generate a scoped key in the Appwrite console — do not reuse a key that has broader scope than needed. |
| `OPENAI_API_KEY` | Used by `translateFields()` (`gpt-5-nano`, same model the admin app uses) to generate the missing-locale translation on `load --apply`. Not needed for `extract`, `transform`, or a dry-run `load`. |

`.env` is gitignored. Never commit real credentials, and never copy
production credentials into a shell an automated agent can read.

## The pipeline

Three phases, run in this order, with a manual review step in the middle:

```bash
cd packages/wp-import

# 1. Pull raw data from WordPress/WooCommerce into snapshots/*.json
bun run extract --since=3m --jobs --products
#   --since accepts "Nd" / "Nm" / "Ny" (days/months/years), an ISO date, or
#   "all". Omit --jobs/--products/--orders to extract everything.
#   Re-extract right before cutover — HR keeps posting jobs, so an old
#   snapshot under-counts.

# 2. Transform snapshots into Appwrite-shaped rows + a department mapping file
#    (transform has no --since of its own — the window was already applied
#    at extract time, above; transform just processes whatever is in
#    snapshots/*.json)
bun run transform

# 3. Review mappings/departments.csv (see below), fill in `resolved_id`,
#    commit it, then re-run transform so it picks up your resolutions:
bun run transform

# 4. Dry run — prints what would be written, makes no network writes and no
#    AI calls
bun run load --jobs --products

# 5. Apply — writes rows, uploads images, and calls OpenAI for translations
bun run load --jobs --products --apply
```

Orders follow the same `extract` → `transform` → `load` shape, gated on
`WC_CONSUMER_KEY`/`WC_CONSUMER_SECRET` being present:

```bash
bun run extract --since=3m --orders
bun run transform
bun run load --orders            # dry run
bun run load --orders --apply
```

If those two env vars are empty, `extract --orders` prints a warning and
skips orders entirely rather than failing.

### Why products don't need a review step

Product ACF fields store the *exact* Appwrite IDs already: `acf.campus` is a
literal `campus.$id`, and `acf.department_<campus>` is a literal
`departments.Id`. `resolveAcfCampusAndDepartment()` in
`src/transform/products.ts` reads them directly — no fuzzy matching, no
review file, no manual step. The one product that omits `acf.campus`
rejects by design (see "Known rejects" below); there is no mapping that
would fix it.

### The department review loop (jobs only)

Jobs carry free-text taxonomy names (e.g. `"OSL HR"`, `"BI Bergen — nedlagt"`)
instead of IDs, so `transform` fuzzy-matches each distinct
`(campus, WP department name)` pair against `departments` in Appwrite
(`src/transform/departments.ts`, Sørensen–Dice token similarity over a
normalized name) and writes every pair it saw to
`mappings/departments.csv`:

| column | meaning |
|---|---|
| `wp_name` / `wp_campus_id` | The raw WordPress taxonomy value and the resolved Appwrite `campus.$id`. |
| `suggested_id` / `suggested_name` | Filled in automatically when match confidence ≥ 0.85; otherwise blank. |
| `confidence` | 0–1 match score. Rows are sorted low-confidence first, so the ones needing attention are at the top. |
| `resolved_id` | **You fill this in.** A `departments.Id` value. Leave the `suggested_id` in place if it's correct, or replace/add one where it's blank or wrong. |

Re-running `transform` reloads any `resolved_id` you've filled in (keyed by
`campus_id + wp_name`) and rebuilds the CSV from the current snapshot,
preserving your resolutions for pairs it sees again — and also for pairs it
*doesn't* see again (a narrower `--since` window, or a job that no longer
appears): any previously-resolved row is carried forward unchanged rather
than silently dropped, since `resolved_id` is hand-entered work. Commit
`mappings/departments.csv` once it's reviewed — it is checked-in state, not a
throwaway artifact.

**Sanity-check `mappings/departments.csv` before loading — this is the one
manual step in the whole pipeline, and nothing after it double-checks your
work.** A `resolved_id` naming a department that doesn't exist fails loudly
at write time (Appwrite rejects the row). A `resolved_id` that's a typo
landing on a *different, valid* department id fails silently: the row writes
fine, the job just gets attributed to the wrong department, and nothing in
this pipeline, in Appwrite, or in the admin UI will flag it. Read every row
you touch against the actual `departments` list before committing the file.

## Deterministic IDs and idempotency

Every imported row uses a fixed row id derived from the WordPress/WooCommerce
numeric id:

- Jobs: `wpjob<wp_post_id>` (e.g. `wpjob4821`)
- Products: `wpprod<wp_post_id>` (e.g. `wpprod193`)
- Orders: `wporder<wc_order_id>` (e.g. `wporder5502`)

`load` always calls `db.upsertRow`, never `createRow`. Re-running
`load --apply` on the same data writes to the same row ids, so row counts
stay flat and content simply gets overwritten in place. This also means
every row imported by this tool is identifiable by its `$id` prefix, which
is what rollback and verification below rely on.

**Rows are idempotent; image storage is not.** The `mediaCache` in
`scripts/load.ts` is a plain `Map` created fresh for the lifetime of one
`load --products --apply` run, so it only dedupes source URLs *within* that
run. Re-running `load --products --apply` re-downloads and re-uploads every
product image, each one gets a **new** Appwrite file id, the product rows
are rewritten to point at those new ids, and the files from the previous run
stay in the `media` bucket, now referenced by nothing. Rows always end up
pointing at valid files, so nothing breaks — but each re-apply leaves behind
one orphaned copy of every product image. There is no persisted
source-URL → file-id cache across runs (deliberately — building one is
disproportionate for a one-time migration), so prefer getting the dry run
right and applying once. If you do re-apply, plan to clean up orphaned files
in the `media` bucket afterward (see Rollback).

## Rollback

Delete every row written by this tool for a given content type by prefix,
using the Appwrite CLI's bulk `delete-rows` command (`appwrite` — see the
`appwrite:cli` skill for setup/login). `--queries` takes the same raw
query-string format `Query.startsWith()` produces
(`{"method":"startsWith","attribute":"$id","values":["<prefix>"]}`), so the
CLI and the SDK stay in lockstep:

```bash
# Jobs
appwrite tables-db delete-rows --database-id app --table-id jobs \
  --queries '{"method":"startsWith","attribute":"$id","values":["wpjob"]}'

# Products
appwrite tables-db delete-rows --database-id app --table-id webshop_products \
  --queries '{"method":"startsWith","attribute":"$id","values":["wpprod"]}'

# Orders
appwrite tables-db delete-rows --database-id app --table-id orders \
  --queries '{"method":"startsWith","attribute":"$id","values":["wporder"]}'
```

`delete-rows` runs asynchronously server-side; re-run the matching
`list-rows` command below (or check the Appwrite console's row count) to
confirm it finished before treating the rollback as done:

```bash
appwrite tables-db list-rows --database-id app --table-id jobs \
  --queries '{"method":"startsWith","attribute":"$id","values":["wpjob"]}' \
  --queries '{"method":"limit","values":[1]}'
```

Or equivalently with a one-off `node-appwrite` script, mirroring the query
shape already used in this package's `src/appwrite.ts` (useful if you want
per-row confirmation rather than a bulk fire-and-forget delete):

```ts
import { Query } from "node-appwrite";
import { createDb } from "./src/appwrite";

const db = createDb();
const prefix = "wpjob"; // or "wpprod" / "wporder"
const tableId = "jobs"; // or "webshop_products" / "orders"

let cursor: string | undefined;
for (;;) {
  const queries = [Query.startsWith("$id", prefix), Query.limit(100)];
  if (cursor) queries.push(Query.cursorAfter(cursor));
  const page = await db.listRows({ databaseId: "app", tableId, queries });
  for (const row of page.rows) {
    await db.deleteRow({ databaseId: "app", tableId, rowId: row.$id });
  }
  if (page.rows.length < 100) break;
  cursor = page.rows.at(-1)?.$id;
}
```

`content_translations` rows are written as a relationship attribute on the
parent row (`translations` on `jobs`, `translation_refs` on
`webshop_products`), so deleting the parent row removes its translations
too — no separate cleanup pass needed there.

**Images are not covered by row deletion.** `delete-rows --queries
startsWith("$id","wpprod")` removes the product rows but never touches the
`media` bucket, and the uploaded file ids are `ID.unique()` — random, not
`wpprod`-prefixed — so they can't be swept by an id-prefix query the way
rows can. Capture the file ids from the rows' `images` column **before**
deleting the rows, then delete each file individually
(`appwrite storage delete-file` has no bulk/query form, unlike
`delete-rows`):

```ts
import { Query } from "node-appwrite";
import { Storage } from "node-appwrite";
import { clientFromEnv, createDb } from "./src/appwrite";

const db = createDb();
const storage = new Storage(clientFromEnv());
const fileIds = new Set<string>();

let cursor: string | undefined;
for (;;) {
  const queries = [Query.startsWith("$id", "wpprod"), Query.limit(100)];
  if (cursor) queries.push(Query.cursorAfter(cursor));
  const page = await db.listRows({
    databaseId: "app",
    tableId: "webshop_products",
    queries,
  });
  for (const row of page.rows) {
    for (const id of (row.images as string[] | undefined) ?? []) {
      fileIds.add(id);
    }
  }
  if (page.rows.length < 100) break;
  cursor = page.rows.at(-1)?.$id;
}

for (const fileId of fileIds) {
  await storage.deleteFile({ bucketId: "media", fileId });
}
```

Run this (or at least the collection half) before `delete-rows` on
`webshop_products` — once the rows are gone, the `images` column that names
which files belong to this import is gone with them.

## Dry-run semantics

`load` without `--apply`:

- Writes nothing to Appwrite (`upsert()` in `scripts/load.ts` short-circuits
  to a `console.log` before calling `db.upsertRow`).
- Uploads no images (`mirrorImage()` is only called `if (apply)`).
- Makes **no paid OpenAI calls** (`translateFields()` is only called
  `if (apply)`; this was a deliberate fix so an operator can inspect a dry
  run repeatedly for free). The row it would write contains only the
  source-locale translation row; the target-locale row (and its title/
  description) is generated for real on `--apply`.

Always dry-run (`load --jobs` / `load --products` / `load --orders`, no
`--apply`) before the `--apply` run, and read the console output — it prints
one line per row it would touch plus a `succeeded/failed` summary.

## Known rejects to expect

Transform writes `reports/<name>-rejects.csv` (source id, label, reason) for
anything it couldn't map to a valid row, and `reports/warnings.txt` for
things it imported but flagged (e.g. low language-detection confidence, a
truncated description, a member-status product variant that needs its price
set by hand). Expected, by-design rejects:

- **One of the 56 published WooCommerce products has no ACF `campus` field
  set.** `webshop_products.campus_id` is required, so this product rejects
  with reason `"No ACF campus set; webshop_products.campus_id is required"`.
  There is no mapping fix for this — it needs a campus assigned in WordPress
  (or the product created manually in Appwrite) if it should exist at all.
- **Orders extract to zero rows without WooCommerce REST credentials.**
  `extract --orders` prints a warning and skips instead of failing if
  `WC_CONSUMER_KEY`/`WC_CONSUMER_SECRET` are unset.

Review every row in `reports/*-rejects.csv` after each `transform` run — a
reject that isn't one of the two above is a real problem worth
investigating before `load --apply`.

## Known data characteristics

- The live site had ~126 published jobs at time of writing; a `--since=3m`
  window keeps ~104 of them (open positions turn over — HR keeps posting —
  so re-extract close to cutover rather than reusing an old snapshot).
- 56 published WooCommerce products, 55 of which have a resolvable campus
  (see "Known rejects").
- 23 of those 56 products have an **empty `description` field** in the
  WooCommerce Store API response (`WcStoreProduct.description`).
  `transformProduct()` falls back to the WordPress post content
  (`input.content.rendered`) whenever the WooCommerce description is empty —
  this fallback is load-bearing for roughly 41% of the catalogue, not a rare
  edge case.

## Working directories: what's committed vs. generated

| Path | Committed? | Contents |
|---|---|---|
| `fixtures/` | Yes | Committed reference snapshots of real WordPress/WooCommerce API responses, kept for context when reading or extending the transforms — nothing in this package's test suite reads them; the unit tests use their own inline fixtures. |
| `mappings/` | Yes (after first review) | `departments.csv` — the reviewed job-department mapping. This is the one piece of generated output that must be committed. |
| `snapshots/` | No (gitignored) | Raw `extract` output and the intermediate `transformed.json` from `transform`. Regenerate by re-running the pipeline; never commit a stale snapshot. `snapshots/orders.json` and `transformed.json` hold buyer names, emails and phone numbers — delete the whole `snapshots/` directory once the cutover is verified and this tool won't be run again; being gitignored keeps it out of the repo, but it still sits on disk until you remove it. |
| `reports/` | No (gitignored) | `*-rejects.csv` and `warnings.txt` from the most recent `transform` run. Read these locally after each run; they aren't meant to be historical record. |

## Verification checklist (for the operator running the real import)

This package's own `bun test` / `bun run check-types` / `ultracite check`
only prove the transform logic is correct in isolation. None of that touches
a live Appwrite project. Before trusting an `--apply` run against the real
`app` database, confirm the following by hand:

1. **Row counts per table** match expectations (jobs drift with HR activity —
   ~104 was the count for a `--since=3m` window at time of writing; re-check
   against a fresh extract rather than treating that as a fixed target):

   ```bash
   bun -e '
   import { Query } from "node-appwrite";
   import { createDb } from "./src/appwrite";
   const db = createDb();
   for (const tableId of ["jobs", "webshop_products", "orders"]) {
     const res = await db.listRows({ databaseId: "app", tableId, queries: [Query.limit(1)] });
     console.log(tableId, res.total);
   }
   '
   ```

2. **Every imported job/product has two `content_translations` rows** (one
   `no`, one `en`) — spot-check a few ids:

   ```bash
   bun -e '
   import { Query } from "node-appwrite";
   import { createDb } from "./src/appwrite";
   const db = createDb();
   const rows = await db.listRows({
     databaseId: "app",
     tableId: "content_translations",
     queries: [Query.equal("content_id", "wpjob4821")],
   });
   console.log(rows.total, rows.rows.map((r) => r.locale));
   '
   ```

   Expect `total: 2` and `["no", "en"]` (order may vary).

3. **Permissions**: a published job/product row has `read("any")` in
   `$permissions`; a closed job does not. Check via the Appwrite console row
   inspector, or:

   ```bash
   bun -e '
   import { createDb } from "./src/appwrite";
   const db = createDb();
   const row = await db.getRow({ databaseId: "app", tableId: "jobs", rowId: "wpjob4821" });
   console.log(row.status, row.$permissions);
   '
   ```

4. **Idempotency**: note the row counts from step 1, re-run
   `bun run load --jobs --products --apply` (and `--orders` if applicable),
   then repeat step 1. Row counts must be unchanged — the run should log the
   same `succeeded` total with zero net new rows, because every write is an
   upsert against the same `wpjob`/`wpprod`/`wporder` id. (The `media`
   bucket's file count is expected to *grow* on this re-run — see "Rows are
   idempotent; image storage is not" above — so don't read that growth as a
   defect.)

5. **Admin studio spot check**: start the admin app
   (`bun run dev --filter=admin`), open the recruitment/job studio and the
   shop studio, and open one imported job and one imported product. Confirm:
   paragraph/heading/list formatting survived the HTML round-trip (this is
   the check that proves `normalizeDescriptionHtml` produced editor-safe
   markup, not just valid-looking HTML), the campus and department shown
   match the source WordPress post, and both locale tabs are populated with
   text (not empty, not literally untranslated source text repeated in both
   tabs).

6. **`mappings/departments.csv` is committed** with every `resolved_id`
   filled in and manually checked against the live `departments` table (see
   "The department review loop" above — a wrong-but-valid id here is silent).

7. **`reports/*-rejects.csv` has been read** for the run just performed, and
   every rejection is either the known campus-less product or something
   newly investigated and understood.
