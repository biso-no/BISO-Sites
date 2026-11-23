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
   unit's events, jobs, news, products and pages. A table or translation type
   that is not indexed answers `200 {"ignored"}`.
2. **The full reindex**, a secret-guarded HTTP call (`x-cron-secret` or
   `Authorization: Bearer <CRON_SECRET>`). It applies the index settings, then
   stamp-and-sweep: every item of every type and the coded pages are written
   with the run's start time as `synced_at`, then every entry older than that
   is deleted. Entries that row events write while it runs are stamped later,
   so the sweep keeps them. It answers
   `200 {"ok":true,"entries","byType","sweptBefore"}`.

A failed Appwrite read or Meilisearch write (including a Meilisearch task that
ends `failed`) answers **500** and reaches Sentry.

### What only the reindex corrects

- A page whose slug is changed away from a project or unit address: the old
  slug is not known on update, so the coded hub it replaced comes back with the
  next reindex.
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
  optional `MEILISEARCH_INDEX` (default index name). Do **not** set
  `APPWRITE_*` variables.
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
3. **Check the count.** Compare `entries` in the response with the sitemap's
   URL count times 2 locales. A small difference is expected where the sitemap
   and search differ (for example hidden or expired items); a large one is not.
4. **Add the event triggers** listed under "Console setup".
5. **Deploy check:** save a news row in admin and confirm a non-400 `event`
   execution appears and the entry shows up in search.

Re-run the reindex after changing `CODED_PAGES`, after a period with the
triggers disabled, or when a slug change away from a project or unit address
needs correcting.
