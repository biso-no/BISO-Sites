# Site search (Meilisearch) — design

Date: 2026-11-23. Branch: `feat/site-search` (worktree `.claude/worktrees/site-search`).
Mockups: `.superpowers/brainstorm/83504-1795438032/content/search-mockups.html`
(local, not committed). The owner picked **option A** there.

## Intent

BISO has set up a Meilisearch server. Students should be able to type into one
search field on biso.no and find anything on the site: events, news, jobs,
shop products, editor-built pages, units, documents, and the pages that are
written in code (About, Membership, Safety, Whistleblowing, Contact and so on).

Two things matter to the owner beyond "search works":

- **Instant.** Something saved in admin is findable within seconds. No cron
  batch. Appwrite row events drive the index (the owner sets up the event
  triggers on the function).
- **Shared with the app.** The search runs through a route in `apps/api`, so the
  Flutter app can use the same route later and get the same results.

Results are always in the visitor's active language.

## Goals

- One search field in the web header that shows results as you type (option A
  in the mockups), and a full results page at `/search?q=…`.
- A new Appwrite Function, `functions/search-sync`, that keeps one Meilisearch
  index in step with the database on every row create, update, upsert and
  delete, plus a protected "reindex everything" call for the first fill and
  for repair.
- `GET /api/search` in `apps/api`, public, used by the web now and the Flutter
  app later.
- Coded pages are searchable through a hand-kept list in shared code.
- Results in the visitor's locale; the visitor's selected campus first.

## Non-goals

- The Flutter search UI. The API is shaped for it; the screen comes later.
- Search inside admin.
- Indexing the student marketplace (`products`), member benefits, partners,
  people or board members, funding programmes.
- Synonyms, semantic or AI search, search analytics dashboards.

## Anti-goals (failure even if it technically works)

- Search shows something the site would not show an anonymous visitor: drafts,
  `authenticated`-only pages, unlisted products, closed jobs, finished events,
  non-public units, or stock counts (buyers only ever see In stock / Out of
  stock).
- The query text reaches analytics. A visitor may search their own name or
  student number. Report only that a search happened and its length, as
  `feed-search.tsx` already does.
- The header gets heavier on first paint or breaks its measured layout at
  1340px.
- Results show up in the wrong language when a translation exists in the right
  one.

## Constraints

- Bun only. Shared versions go in the root `catalog`.
- All Appwrite access through `@repo/api`. Row types from
  `packages/api/types/appwrite.ts`. Do not edit `appwrite.config.json` or the
  generated types; no schema change is needed for this feature.
- Function layout and deploy follow `functions/content-notifier`: Bun runtime,
  root directory = repo root, bundled to `dist/main.js`, `adoptRuntimeApiKey`,
  `reporterFromEnv` for Sentry, accepts both `tablesdb.*` and `databases.*`
  event forms.
- `apps/api` already allows biso.no through CORS (`src/proxy.ts`,
  `lib/allowed-origins.ts`), so the browser can call it directly.
- Server-only secrets never reach a Client Component. The browser never sees
  a Meilisearch key; it talks only to `apps/api`.
- `bun run check-types` is the merge gate. Docs page `covers` rules apply
  (`apps/docs/CLAUDE.md`).
- Work happens in the worktree; never switch the main checkout's branch.

## Approaches considered

1. **One shared index, kept current by the event-driven function (picked).**
   One Meilisearch index with a `type` field and one entry per item per
   locale. The function re-reads the changed item and adds, updates or removes
   its entries. One batched multi-search answers option A in one round trip
   (best match, counts per type, top items per group).
2. **Same function, one index per type.** Lets each type rank differently
   (events by date), but a single best match across types needs federated
   search, and there are seven sets of settings to keep in sync. More work for
   nothing option A shows.
3. **Push to Meilisearch from admin's save actions (ruled out).** Equally
   instant, but misses every write outside admin: the Appwrite console, the
   Tickster import, other functions, `apps/api`. The owner's event triggers
   make an admin-side hook unnecessary.

The owner chose 1.

## Design

### What is searchable

One entry per item per locale (`no`, `en`). "Public" means exactly what the
site shows an anonymous visitor today; reuse the existing rules rather than
restating them.

| Type | Source | Public when | Link | Main text |
|---|---|---|---|---|
| `event` | `events` + `content_translations` (`content_type=event`) | `status=published`; not finished (`end_date`, else `start_date`, as `upcomingQueries` in `apps/web/src/lib/data/queries.ts`). `scheduled_publish_at` is ignored, as the site ignores it for events (it only delays the push) | `/events/<slug>` | title, short description, description, location, category, tags |
| `news` | `news` + translations (`news`) | `status=published` | `/news/<slug>` | title, short description, body |
| `job` | `jobs` + translations (`job`) | `isRecruitmentVacancyOpen` (`@repo/shared/types/recruitment`). A scheduled job stays a draft until the dispatcher publishes it, which fires a row event | `/jobs/<slug>` | title, description, department name |
| `product` | `webshop_products` + translations (`product`) | `status=published` and `listedProductsOnly` (`@repo/shared/utils/product-visibility`) | `/shop/<slug>` | title, description, category, tags |
| `page` | `pages` + `page_translations` | `pages.status=published`, `visibility=public`, translation `is_published` (as `isPublishedPage` in `public-content.ts`) | `/<slug>` | translation title, description, text pulled from `published_doc` (never the draft) |
| `unit` | `departments` (+ optional `department` translation overlay) | `active` and `isPublicUnit` (`@repo/shared/utils/unit-visibility`) | `unitCanonicalPath` | `unitDisplayName(Name)`, overlay description |
| `document` | `documents` | `status=published` | builder's choice: the `/documents` page or the download route | title, description, category |
| `coded` | hand-kept list (below) | always | the route | title, description, keywords |

One result per URL: follow the sitemap's rules (`sitemap.ts`) for pages that a
unit or project owns (`isUnitPageSlug`, `isProjectNamespaceSlug`). A unit with a
published editor page gets one entry, at the unit's URL, carrying the page's
text. Unit sub-pages (`units/<campus>/<dept>/<name>`) get their own entry at
their own URL, using `publishedUnitSubPage`. A project editor page that can be
served (`isServableProjectPage`) replaces the coded hub entry and the redirected
national unit at `/projects/<slug>`, as the sitemap does.

Campus: the National campus (id `"5"`, `apps/web/src/lib/campus-scope.ts`) and
rows with no campus are stored as "all campuses".

### Coded pages

A typed list in shared code (`packages/shared/search/coded-pages.ts`), one entry
per route with `path`, and per locale `title`, `description` and `keywords`.
Start from the static routes in `apps/web/src/app/sitemap.ts` (About, Jobs,
Events, News, Shop, Documents, Campus and the four campus pages, Membership,
Business, Contact, Units, Students, Projects and the project hubs, Financial
support, Resources, Business Hotspot, Safety, Press, Privacy, Terms) plus
Whistleblowing (`/varsling`) and Policies. Keywords carry the words people
actually type ("vedtekter", "medlemskap", "varsling", "faktura"). A test fails
when a public static route exists in the sitemap but not in the list.

The function's reindex call writes these entries. Changing the list means
redeploying the function and running the reindex; the developer docs page says
so.

### Locale

The rule: an item has an entry in a locale exactly when the site serves its
page in that locale. A search link must never 404, and results should be in
the visitor's language. Whether a missing translation falls back depends on
what the detail page does.

- **Events, jobs, products and units** get an entry for `no` and for `en`. If
  the item has no translation in a locale, that locale's entry uses the other
  language's text and records which language its text is in (`text_locale`).
  Their detail pages fall back the same way (`pickContent`, `pickTranslation`),
  so the link works. The `/events` feed instead hides such items. Search falls
  back on purpose: admin writes the source locale and schedules a machine
  translation of the other one, so the fallback only bridges the minutes
  before that translation lands (its row event then replaces the entry) and
  covers older content that was never translated.
- **News** has an entry only in the locales with their own translation, and
  `text_locale` is always that locale. The news page does not fall back:
  `getNewsBySlug` filters on `translation_refs.locale = locale`, so a fallback
  entry would link to a 404.
- **Editor pages** (standalone pages, unit sub-pages and project pages) have
  an entry only in the locales whose own translation is published with
  content. `getPage` matches the exact locale, and `isPublishedPage` and
  `publishedUnitSubPage` need that locale's published translation.
- **Project pages take over per locale.** `/projects/<slug>` serves the editor
  page in a locale where it is servable (`isServableProjectPage` on that
  locale's translation) and the coded hub in the other. So the coded hub entry
  is absent in exactly the locales where the page is servable, and present in
  the rest. A national project's unit entry is replaced the same way, per
  locale.
- A unit's text taken from its own editor page keeps the fallback (the unit
  page exists in both locales; only its text source differs).
- Documents have one `language`; they get an entry in both locales.
- The API always filters on the requested locale. The web passes the
  `NEXT_LOCALE` value; default `no`.

### The search entry

Field names are the builder's; the content is fixed:

- identity: `id` = `<type>_<rowId>_<locale>` (encode characters Meilisearch ids
  do not allow, such as `.`), `type`, `row_id`, `locale`, `text_locale`
- searchable: `title`, `keywords`, `summary` (short), `body` (plain text,
  capped at a few thousand characters)
- display: `url` (path only), `image` or `cover_pattern`, `campus_id` (empty =
  all campuses), campus name, department name, start/end time, price and member
  price, `member_only`, `in_stock` (boolean, never a count), application
  deadline, published date
- visibility: `visible_until` (event end, else start; job deadline) as a Unix
  timestamp

Index settings (applied by the reindex call): searchable attributes in the
order title, keywords, summary, body; filterable `type`, `locale`, `campus_id`,
`row_id`, `visible_until`; highlighting on title and summary.

### Time-based visibility

A job deadline passing or an event ending fires no row event. The entry stores
the time and the API filters at query time (`visible_until >= now`, missing
means open). No cron.

### The sync function (`functions/search-sync`)

Triggers (configured by the owner in the Console, `rows.*` on each):
`events`, `news`, `jobs`, `webshop_products`, `pages`, `page_translations`,
`content_translations`, `departments`, `documents`.

**On a row event:**

1. Work out the item: a parent table gives `(type, $id)`;
   `content_translations` gives it from `content_type` + `content_id`;
   `page_translations` from `page_id`. A `memberBenefit` translation is
   ignored with a 200, so it does not reach Sentry.
2. Re-read the item and its translations with the admin client. The event
   payload is never trusted as the current state.
3. If the item is gone or not public, delete its entries (filter on `type` +
   `row_id`). Otherwise build its entries with the shared mapper and upsert
   them. Entries follow the Locale rules above: news and pages get an entry
   only in a locale with their own translation, other types fall back to the
   other language's text. When an item ends up with one locale only, the
   other locale's entry is deleted, so a removed or unpublished translation
   leaves nothing behind. A product entry has `in_stock` set to
   `inventory_mode === "unlimited" || (stock ?? 1) > 0`.
4. A deleted translation re-syncs its parent, which then keeps entries only in
   the locales it still has, with the fallback rules above.
5. A changed department re-syncs the entries that show its name only when its
   unit's entry changed: the function compares the unit's current index entry
   with the freshly loaded one, in each locale, for existence, title and URL.
   If they differ, it re-syncs the department's published jobs, events (not
   finished), news, products and pages, and writes these before the unit
   entry. The unit entry is the marker the next department event compares
   against, so a failed write leaves it as it was and the next event fans out
   again. An unchanged unit, such as the daily `project_share` update,
   re-reads nothing else. Stock changes arrive as `webshop_products` events;
   variations need no trigger, because the shop reads only `stock === 0`.

Each row event waits a short settle delay before it reads (2 seconds, or
`SYNC_SETTLE_MS`; 0 turns it off). An admin save writes several rows, each
starting its own execution, and executions can finish out of order; the wait
lets the save finish so every execution reads the final rows.

Every step is idempotent, so duplicate or out-of-order events converge on the
current state.

**Reindex (HTTP, guarded by `CRON_SECRET` like `content-notifier`):** apply the
index settings, page through every source table, write every public entry and
the coded pages, and leave no stale entries behind. The builder picks the
method (build a fresh index and swap, or stamp-and-sweep) and handles a row
event that lands mid-reindex.

**Answers:** 200 with counts; 400 for an event it does not handle; 500 with
details when Meilisearch or Appwrite fails, reported to Sentry.

### Shared code

`packages/shared/search/` (add a `./search/*` export): entry types, the row →
entry mappers, the coded page list, index name and settings, the page-text
extractor, and the query builder the API uses. The function and `apps/api`
both import it, so indexing and searching cannot drift. The HTML-to-text
helper in `apps/web/src/lib/content-text.ts` moves here if the mappers need it.
Meilisearch client: the official `meilisearch` package, pinned in the catalog.

### Search API (`GET /api/search` in `apps/api`)

Public, no auth. Parameters: `q`, `locale` (`no`|`en`), `campus` (campus id),
`only_campus` (bool), `type` (one type, for a results-page tab), `page`, and a
mode for the quick panel versus the results page.

- Empty or whitespace `q` returns an empty result. `q` is capped at ~100
  characters; page size is capped.
- **Quick mode** returns the best match, a count per type, and the top two
  items per type, from one Meilisearch multi-search call.
- **Page mode** returns one page of mixed results (or one type's, with `type`)
  plus the counts per type for the tabs.
- **Campus first:** entries for the selected campus and for all campuses rank
  above other campuses' entries. `only_campus` drops the others. Do it with an
  ordinary multi-search call holding two queries per need (this campus plus all
  campuses, then the rest), which works on any Meilisearch version; page the
  mixed list from the two totals.
- **Highlights are returned as segments** (`[{ text, match }]`), not HTML. The
  web renders them without `dangerouslySetInnerHTML`, and Flutter can render
  them natively.
- Each hit carries its display fields and `url`.
- Errors return the API's usual `{ error, code }` with 502 when Meilisearch is
  unreachable.
- Add `https://www.biso.no` to the API's allowed origins (Umami already lists
  it; the API does not).
- The query text is scrubbed from Sentry events for this route.

### Web: quick search (option A)

As in the mockup:

- A search field sits in the header's utility group, with `/` and ⌘K or
  Ctrl+K opening it from anywhere (but not while typing in another field).
- When open, the field takes over the menu row; results drop below it in a
  navy panel styled like `MegaPanel`. The best match is a large card on the
  left; Events, News, Jobs, Shop, Pages and Units are grouped with their counts.
  Documents and coded pages appear under Pages. The footer has "Show all N
  results" and keyboard hints.
- Matched words get the sun (`--biso-sun`) marker behind navy text.
- The browser calls `NEXT_PUBLIC_API_BASE_URL/api/search` directly, debounced,
  cancelling stale requests.
- Keyboard: arrows move, Enter opens, Esc closes and returns focus. Use the
  combobox/listbox ARIA pattern.
- The panel's code loads only when search opens, so first paint is unchanged.
- The header's overflow measurement (`useNavOverflow`) must still leave the
  utility group unsqueezed at 1340px. Verify it there.
- **Before typing:** recent searches (kept in the browser only) and three
  shortcuts: upcoming events at your campus, open jobs, the shop.
- **No results:** says what was searched, suggests checking the spelling or
  using fewer words, and links to events, news and jobs. No "did you mean":
  Meilisearch already forgives typos (one typo in words of five or more
  letters, two in longer ones) and has no suggestion API, so an empty result
  means nothing close matched.
- **Below 1340px:** a search icon beside the cart opens a full-screen navy
  sheet: the best match on top, the groups stacked below.
- Analytics: a `search` event with surface and query length only.

### Web: results page (`/search`)

As in the mockup: a server-rendered page in `(public)` that calls the API
server-side, so it works without JavaScript and the URL can be shared. A navy
band with the big search field, the result count, an "Only <campus>" switch and
type tabs with counts. Below it, one row per result in a type-specific shape:
date block for events, thumbnail for news and products, icon for jobs, pages
and units, breadcrumb path for pages. The page is `noindex`. Strings live in
`packages/i18n` for both locales.

The query sits in the page URL (`?q=`), so extend the Umami before-send
scrubber in `apps/web/src/lib/analytics-privacy` to strip it on `/search`, and
keep it out of Sentry.

### Configuration

- Function: `MEILISEARCH_HOST`, `MEILISEARCH_ADMIN_KEY` (a key scoped to the
  search index with documents, settings, index and task rights), `CRON_SECRET`,
  optional `SENTRY_DSN` / `SENTRY_ENVIRONMENT`. Scopes: `rows.read`. Timeout
  long enough for a full reindex.
- `apps/api`: `MEILISEARCH_HOST`, `MEILISEARCH_SEARCH_KEY` (search-only, scoped
  to the index). Runtime only, so no `turbo.json` change unless the builder
  finds one is needed.
- The index name is a constant in shared code, overridable by env for a test
  index.

### Docs

A developer page under `apps/docs/content/docs/developers/` covering the
function, the shared search code, the API route and the web components: how
sync works, the event list to configure, how to run a reindex, how to add a
coded page. Add a short staff-facing note where the guide explains publishing:
changes show in search within seconds.

## Go-live order

1. Confirm that both the function runtime and `apps/api` can reach the
   Meilisearch server. Create the admin key and the search-only key.
2. Deploy the function with its variables and event triggers. Run the reindex
   call. Check the entry count against the sitemap's.
3. Set the API variables and deploy `apps/api`.
4. Deploy web.
5. Save a news item in admin and confirm it is searchable within seconds; let a
   job deadline pass in a test row and confirm it disappears without an edit.

## Calls I made (check these)

- Units and documents are in scope; the marketplace, benefits and partners are
  out.
- Finished events and closed jobs are hidden from search, as they are from the
  feeds.
- A missing translation falls back to the other language rather than hiding the
  item, for events, jobs, products and units (their detail pages fall back).
  News and editor pages are not indexed in a locale without their own
  translation, because their pages 404 there (see Locale).
- No "did you mean" on an empty result.
- Documents and coded pages show under Pages in the quick panel.
- The reindex call reuses `CRON_SECRET`.
- Highlights travel as segments, not HTML.
- Shared code lives in `packages/shared/search/`, not a new package.
- Recent searches stay in the visitor's browser; nothing about a search is
  stored server-side.

## Left to the builder

- Exact field names, the response JSON shape, and the request mode parameter.
- The reindex method (swap or sweep) and its mid-reindex race handling.
- Which link a document result opens.
- How text is pulled out of `published_doc` (walk the block JSON, strip HTML).
- Debounce timing, page size, cache headers on the API.
- The exact Meilisearch queries that put the campus first, within the rule
  above.
