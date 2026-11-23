# search-sync (Appwrite Function)

Keeps the Meilisearch site-search index in step with Appwrite. Each indexed
item has one entry per locale (`no`, `en`) in which the site serves it: events,
jobs, products, units and documents in both (a missing translation falls back
to the other language, as their pages do); news and editor pages only in the
locales with their own (published) translation, because their pages 404 in the
other. A servable project page takes `/projects/<slug>` over from its coded hub
per locale. The site's search reads only from that index.

## How it works

Two kinds of execution reach this one function:

1. **Appwrite row events** on `events`, `news`, `jobs`, `webshop_products`,
   `pages`, `page_translations`, `content_translations`, `departments` and
   `documents`. The function re-reads the affected item with the admin client,
   maps it with the shared mappers (`@repo/shared/search`) and upserts its
   entries, or deletes them when the item is gone or no longer public. Items
   that depend on it are re-synced too. A department change re-syncs that
   unit's published events (not yet finished), jobs, news, products and pages,
   but only when the unit's own entry changes (it appears or disappears, or its
   title or URL changes, in either locale). The daily `project_share` update
   from the Finago project sync touches many departments and changes none of
   that, so it re-reads only the units. A table or translation type that is
   not indexed answers `200 {"ignored"}`.
2. **The full reindex**, a secret-guarded HTTP call (`x-cron-secret` or
   `Authorization: Bearer <CRON_SECRET>`). It applies the index settings, then
   stamp-and-sweep: every item of every type and the coded pages are written
   with the run's start time as `synced_at`, then every entry older than that
   is deleted. Entries that row events write while it runs are stamped later,
   so the sweep keeps them. It answers
   `200 {"ok":true,"entries","byType","sweptBefore"}`. A failed read or write
   stops it before the sweep, and a run that finds no items in any table
   (coded pages aside) refuses to sweep and answers 500, so an empty read
   (wrong database, missing scope) cannot empty the index. Each reindex write
   waits up to 120 s for its Meilisearch task; row events wait 10 s.

A failed Appwrite read or Meilisearch write (including a Meilisearch task that
ends `failed`) answers **500** and reaches Sentry.

### The settle delay

A row event waits `SYNC_SETTLE_MS` (default 2000 ms) before it reads
anything. An admin save writes several rows one after another: publishing a
page updates each `page_translations` row and then the `pages` row, and each
write starts its own execution. Those executions run in parallel and can
finish out of order, so one that reads too early can write an older state
after a later one wrote the newer. The pause lets the save finish, so every
execution reads the final rows. Set it to `0` to turn it off. The reindex and
ignored events do not wait.

The delay narrows the window; it does not close it. A save that takes longer
than the delay can still leave an entry one step behind until the item's next
event or the next reindex. A nightly repair reindex would bound that. It is
not set up (there is no schedule); the owner can add one later.

### The reindex and row events

Row events keep running during a reindex. An entry an event writes is stamped
later than the reindex's start, so the sweep keeps it. The other way round is
not covered: an item made non-public (or deleted) after the reindex read it
but before the reindex wrote it is written back by the reindex, after its own
event removed it. It stays in search until its next event or the next
reindex. Avoid editing content while a reindex runs, or run it again
afterwards.

### What only the reindex corrects

- A page whose slug is changed away from a project or unit address: the old
  slug is not known on update, so the coded hub it replaced comes back with the
  next reindex.
- A department change to a unit with no entry in either locale (an operating
  ledger, an inactive unit, or a national unit whose project page serves its
  URL in both locales) does not re-sync its linked items. A renamed
  department's name on its events, jobs, news and products, or a national
  project page whose unit was deactivated, waits for the reindex.
- A unit page (`units/<campus>/<unit>`) re-bound to another department: the
  page event names only the new department, so the old unit's entry keeps the
  page's text.
- An item unpublished while a reindex was running (see above).
- Anything that changed while the event triggers were disabled.
- Changes to `CODED_PAGES` (`packages/shared/search/coded-pages.ts`): redeploy
  the function, then run the reindex.

## Console setup (not in code)

- Runtime: Bun. **Root directory: the repository root**, not this folder (the
  function depends on `@repo/*` workspace packages and the root `catalog`).
- Build command:

  ```bash
  bun install --filter search-sync && bun run --cwd functions/search-sync bundle && rm -rf node_modules
  ```

- Entrypoint: `functions/search-sync/dist/main.js`.
- Events (Settings → Events), added **after** the first reindex (see Go-live):
  - `databases.app.tables.events.rows.*`
  - `databases.app.tables.news.rows.*`
  - `databases.app.tables.jobs.rows.*`
  - `databases.app.tables.webshop_products.rows.*`
  - `databases.app.tables.pages.rows.*`
  - `databases.app.tables.page_translations.rows.*`
  - `databases.app.tables.content_translations.rows.*`
  - `databases.app.tables.departments.rows.*`
  - `databases.app.tables.documents.rows.*`

  These match any row event (create, update, upsert, delete). Admin saves use
  upsert, so subscribing to `.create`/`.update` alone misses them. For
  tablesdb-type databases use `tablesdb.app.tables.<table>.rows.*` instead
  (the function accepts both forms, and `collections`/`documents` too).
- Scopes: `rows.read`.
- Execute access: none needed for events. The reindex is run from the Console
  (below), not through a public domain.
- Timeout: 900 s.
- Variables: `MEILISEARCH_HOST`, `MEILISEARCH_ADMIN_KEY`, `CRON_SECRET`;
  optional `MEILISEARCH_INDEX` (default index name) and `SYNC_SETTLE_MS`
  (default 2000, see "The settle delay"). Do **not** set `APPWRITE_*`
  variables.
- Meilisearch **1.2 or later**. Deletes go by filter (`type` and `row_id`, and
  `synced_at` for the sweep), which older servers do not support.
- Sentry (optional): `SENTRY_DSN` (the biso-functions DSN; without it nothing
  is sent) and `SENTRY_ENVIRONMENT` (default `production`). Thrown errors and
  answers of 400 or above are reported (tag `function_name: search-sync`).
- Keep execution logging on.

## Running the reindex

From the Console, open the function, then Executions → Create execution:

- Method: `POST`
- Header: `x-cron-secret: <CRON_SECRET>`
- **Run it asynchronously.** A synchronous HTTP execution times out at 30 s,
  long before a full reindex finishes. Read the result in the execution's
  response body and logs.

## Go-live order

Follow this order. Adding the triggers first makes every event fail.

1. **Deploy the function** and set its variables (`MEILISEARCH_HOST`,
   `MEILISEARCH_ADMIN_KEY`, `CRON_SECRET`). Do not add the event triggers yet.
2. **Run the reindex once** (async execution, as above). It applies the index
   settings first. Until then `row_id`, `type` and `synced_at` are not
   filterable, and every delete-by-filter task fails (500 and Sentry).
3. **Check the counts per type.** `byType` in the response counts entries,
   one per item per locale. Compare each type with the rows in Appwrite:
   - `event`: 2 × published events that have not finished (end date, else
     start date, now or later, or neither date) and are standalone or a
     collection's parent, with a slug and a translation.
   - `job`: 2 × published vacancies whose deadline has not passed (or has
     none), with a slug and a translation.
   - `news`: published news with a slug, counted once per translation: the
     ones with a `no` translation plus the ones with an `en` one.
   - `product`: 2 × published products that are not unlisted, with a slug and
     a translation.
   - `page`: public, published editor pages (not unit pages, which count
     under `unit`), once per locale whose translation is published with
     content.
   - `unit`: 2 × the units listed on `/units`, less one for each locale in
     which a national project's page serves its URL.
   - `document`: 2 × published documents.
   - `coded`: 2 × the `CODED_PAGES` entries, less one for each locale in which
     a project page serves its hub's URL.

   A small difference is expected (a row without a slug or translation, an
   event that just finished). A type at zero, or far off, is not.
4. **Add the event triggers** listed under "Console setup".
5. **Deploy check:** save a news row in admin and confirm a non-400 `event`
   execution appears and the entry shows up in search.

Re-run the reindex after changing `CODED_PAGES`, after a period with the
triggers disabled, or when a slug change away from a project or unit address
needs correcting.
