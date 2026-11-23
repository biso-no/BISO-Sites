# Site search, stage 1: shared search core + sync function — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared search entry model and the `functions/search-sync` Appwrite Function that keeps one Meilisearch index in step with the database (row events + a protected reindex).

**Architecture:** Pure mappers in `packages/shared/search/` turn Appwrite rows into `SearchEntry` documents (one per item per locale). The function classifies each execution (row event or reindex), resolves the affected item(s), re-reads them through `@repo/api`, maps them, and upserts or deletes their entries. Reindex stamps every write with `synced_at` and sweeps older entries.

**Tech Stack:** TypeScript (strict), Bun runtime for the function (`bun test`), Vitest in `packages/shared`, `meilisearch` JS client (catalog `^0.63.0`), `@repo/api` (TablesDB admin client), `@repo/observability/functions`.

**Spec:** `docs/superpowers/specs/2026-11-23-site-search-design.md`

Work in the worktree `/Users/markus/Documents/dev/BISO-Sites/.claude/worktrees/site-search` only. Run `bun install` there before the first test run.

## Global Constraints

- Bun only (`bun add`, `bun test`); shared versions in the root `catalog`, referenced as `"catalog:"`.
- Appwrite access only through `@repo/api` / `@repo/api/server`; row types from `@repo/api/types/appwrite`. Never edit `appwrite.config.json` or `types/appwrite.ts`.
- Locales are exactly `"no"` and `"en"`. Every indexed item gets an entry for both.
- Missing translation in a locale → that locale's entry uses the other language's text and sets `text_locale` to that language.
- "All campuses" is stored as `campus_id: "all"` (National id `"5"` and empty campus both map to it).
- Open-ended visibility is stored as `visible_until: 32503680000` (year 3000), never null, so filters work on every Meilisearch version.
- Stock is only ever `in_stock: boolean`; no count in an entry.
- Search entries hold only what an anonymous visitor can see on the site.
- Function layout mirrors `functions/content-notifier` (root-directory build, `dist/main.js`, `adoptRuntimeApiKey`, `reporterFromEnv`, accepts `tablesdb.*` and `databases.*` event names).
- Biome/Ultracite style; run `bun x ultracite fix` on touched files before each commit.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. A row event for a table/action the function does not handle (e.g. `memberBenefit` translation, unknown table) must answer 200 `{ ignored }`, never 4xx/5xx — Sentry noise otherwise. (Task 6 tests.)
2. An Appwrite id containing characters Meilisearch rejects (`.`) must still produce a valid, deterministic entry id. (Task 1 tests.)
3. A page translation that is `is_published` but whose `published_doc` is empty/legacy must not produce an entry (the site shows no page for it). (Task 4 tests.)
4. A reindex while row events keep arriving must not sweep entries written by those events. (Task 8 tests.)
5. A Meilisearch task that ends `failed` must surface as a thrown error (→ 500 + Sentry), not a silent 200. (Task 7 tests.)

---

### Task 1: Shared foundations (entry model, settings, client, plain-text helper)

**Files:**
- Modify: `package.json` (root catalog: `"meilisearch": "^0.63.0"`)
- Modify: `packages/shared/package.json` (dependency `"meilisearch": "catalog:"`; export `"./search/*": "./search/*.ts"`)
- Create: `packages/shared/search/types.ts`
- Create: `packages/shared/search/settings.ts`
- Create: `packages/shared/search/client.ts`
- Create: `packages/shared/utils/content-text.ts` (moved from `apps/web/src/lib/content-text.ts`, unchanged)
- Modify: `apps/web/src/lib/content-text.ts` → `export { decodeHtmlEntities, toPlainText, truncateAtWord, toSentenceExcerpt, buildTeaser } from "@repo/shared/utils/content-text";` (keeps its 15 importers and its test working)
- Test: `packages/shared/search/types.test.ts`, `packages/shared/search/settings.test.ts`

**Interfaces:**
- Produces (`search/types.ts`):
  ```ts
  export type SearchType = "event" | "news" | "job" | "product" | "page" | "unit" | "document" | "coded";
  export type SearchLocale = "no" | "en";
  export const SEARCH_LOCALES: readonly SearchLocale[] = ["no", "en"];
  export const ALL_CAMPUSES = "all";
  export const OPEN_ENDED = 32_503_680_000;
  export interface SearchEntry {
    id: string; type: SearchType; row_id: string; locale: SearchLocale; text_locale: SearchLocale;
    title: string; keywords: string[]; summary: string; body: string;
    url: string;                 // path, starts with "/"
    campus_id: string;           // "1".."4" or ALL_CAMPUSES
    department: string | null;   // display name (unitDisplayName)
    image: string | null; cover_pattern: string | null;
    starts_at: number | null; ends_at: number | null;   // Unix seconds
    price: number | null; member_price: number | null; member_only: boolean;
    in_stock: boolean | null; deadline: number | null; published_at: number | null;
    location: string | null; category: string | null;
    visible_until: number;       // Unix seconds, OPEN_ENDED when none
    synced_at: number;           // Unix ms of the write (reindex sweep)
  }
  export function searchEntryId(type: SearchType, rowId: string, locale: SearchLocale): string;
  export function campusBucket(campusId: string | null | undefined): string;
  export function toUnixSeconds(iso: string | null | undefined): number | null;
  ```
- Produces (`search/settings.ts`): `SEARCH_INDEX_DEFAULT = "site_content"`, `searchIndexName(env?: Record<string, string | undefined>): string` (reads `MEILISEARCH_INDEX`), `SEARCH_INDEX_SETTINGS` with `searchableAttributes: ["title","keywords","summary","body","department","location","category"]`, `filterableAttributes: ["type","locale","campus_id","row_id","visible_until","synced_at"]`, `pagination: { maxTotalHits: 1000 }`.
- Produces (`search/client.ts`): `createSearchClient(host: string | undefined, apiKey: string | undefined): Meilisearch` — throws `Error("MEILISEARCH_HOST is not configured")` / `("Meilisearch API key is not configured")` when missing.

- [ ] **Step 1: Write the failing tests**

```ts
// types.test.ts
expect(searchEntryId("event", "abc123", "no")).toBe("event_abc123_no");
expect(searchEntryId("page", "a.b", "en")).toMatch(/^[A-Za-z0-9_-]+$/);
expect(searchEntryId("page", "a.b", "en")).not.toBe(searchEntryId("page", "a-b", "en")); // encoding is injective
expect(campusBucket("2")).toBe("2");
expect(campusBucket("5")).toBe(ALL_CAMPUSES);
expect(campusBucket("")).toBe(ALL_CAMPUSES);
expect(campusBucket(null)).toBe(ALL_CAMPUSES);
expect(toUnixSeconds("2027-02-12T09:00:00.000Z")).toBe(1_802_422_800);
expect(toUnixSeconds(null)).toBeNull();
expect(toUnixSeconds("not a date")).toBeNull();
// settings.test.ts
expect(searchIndexName({})).toBe("site_content");
expect(searchIndexName({ MEILISEARCH_INDEX: "site_content_test" })).toBe("site_content_test");
expect(SEARCH_INDEX_SETTINGS.filterableAttributes).toEqual(expect.arrayContaining(["type","locale","campus_id","row_id","visible_until","synced_at"]));
```

- [ ] **Step 2: Run to verify they fail** — `cd packages/shared && bunx vitest run search/` → FAIL (modules missing).
- [ ] **Step 3: Implement the three modules and move `content-text`.** `searchEntryId` keeps `[A-Za-z0-9_-]` as is and encodes any other character as `-<hex>-` (so `a.b` ≠ `a-b`). Add the catalog entry and `bun install`.
- [ ] **Step 4: Run tests** — `bunx vitest run search/` PASS; `cd apps/web && bunx vitest run src/lib/content-text.test.ts` PASS; `bun run check-types --filter=@repo/shared --filter=web` PASS.
- [ ] **Step 5: Commit** — `feat(search): shared entry model, index settings and client`

---

### Task 2: Page text extractor

**Files:**
- Create: `packages/shared/search/page-text.ts`
- Test: `packages/shared/search/page-text.test.ts`

**Interfaces:**
- Produces: `pageDocText(doc: unknown, maxLength?: number): string` (default `maxLength` 4000).

`@repo/editor` depends on `@repo/shared`, so this cannot import editor types. Walk the parsed JSON (objects and arrays, any depth) and collect string values only under these keys: `title, heading, eyebrow, lede, label, text, body, caption, name, role, intro, description, topic, q, a, question, answer, quote`. Each value goes through `toPlainText` (it may be HTML or Plate JSON). Skip empty strings, drop exact duplicates, join with `" "`, cut with `truncateAtWord(…, maxLength)`.

- [ ] **Step 1: Failing tests**

```ts
const doc = { version: 2, meta: { title: "Winter Games", slug: "projects/winter-games" },
  header: { title: "Winter Games", lede: "<p>Three days in <b>Hafjell</b></p>", eyebrow: "", crumbs: [{ label: "Projects", href: "/projects" }], buttons: [], variant: "split" },
  sections: [{ id: "s1", layout: "one", columns: [{ id: "c1", blocks: [
    { id: "b1", type: "text", props: { body: "<p>Bring your student card &amp; a costume.</p>" } },
    { id: "b2", type: "image", props: { src: "https://x/y.png", alt: "Bus" } },
  ] }] }] };
expect(pageDocText(doc)).toBe("Winter Games Three days in Hafjell Projects Bring your student card & a costume.");
expect(pageDocText(null)).toBe("");
expect(pageDocText("garbage")).toBe("");
expect(pageDocText({ sections: [{ text: "a ".repeat(3000) }] }, 100).length).toBeLessThanOrEqual(101);
```
- [ ] **Step 2: Run** `bunx vitest run search/page-text.test.ts` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(search): plain text from editor page documents`

---

### Task 3: Entry mappers for translated content (event, news, job, product) and documents

**Files:**
- Create: `packages/shared/search/entries/common.ts`
- Create: `packages/shared/search/entries/event.ts`, `news.ts`, `job.ts`, `product.ts`, `document.ts`
- Modify: `packages/shared/utils/product-visibility.ts` (add `isListedProduct(row: { unlisted?: boolean | null }): boolean` → `row.unlisted !== true`, the predicate twin of `listedProductsOnly`)
- Test: `packages/shared/search/entries/*.test.ts`

**Interfaces:**
- Produces (`common.ts`):
  ```ts
  export interface TranslationText { locale: SearchLocale; title: string; description: string | null; short_description: string | null; additional_fields?: string | null }
  export interface MapContext { now: Date; syncedAt: number; departmentName: (id: string | null | undefined) => string | null }
  /** The translation for `locale`, else the other one, else null. */
  export function textFor(translations: TranslationText[], locale: SearchLocale): TranslationText | null;
  export function summaryOf(t: TranslationText): string;   // short_description, else toSentenceExcerpt/truncateAtWord(description, 200)
  export function bodyOf(t: TranslationText): string;      // toPlainText(description) cut to 4000
  ```
- Produces (one per file, each returns `[]` when the item is not public, else exactly one entry per `SEARCH_LOCALES`):
  ```ts
  export function eventEntries(row: Pick<Events,"$id"|"slug"|"status"|"campus_id"|"department_id"|"start_date"|"end_date"|"image"|"cover_pattern"|"price"|"member_price"|"pricing_mode"|"member_only"|"location"|"category"|"tags"|"collection_id"|"is_collection">, translations: TranslationText[], ctx: MapContext): SearchEntry[];
  export function newsEntries(row: Pick<News,"$id"|"$createdAt"|"slug"|"status"|"campus_id"|"department_id"|"image">, translations: TranslationText[], ctx: MapContext): SearchEntry[];
  export function jobEntries(row: Pick<Jobs,"$id"|"slug"|"status"|"campus_id"|"department_id"|"application_deadline">, translations: TranslationText[], ctx: MapContext): SearchEntry[];
  export function productEntries(row: Pick<WebshopProducts,"$id"|"slug"|"status"|"campus_id"|"departmentId"|"regular_price"|"member_price"|"member_only"|"category"|"tags"|"image"|"images"|"cover_pattern"|"stock"|"inventory_mode"|"unlisted">, translations: TranslationText[], ctx: MapContext): SearchEntry[];
  export function documentEntries(row: Pick<Documents,"$id"|"title"|"description"|"category"|"status"|"campus_id"|"scope">, ctx: MapContext): SearchEntry[];
  ```

Rules (values from the spec):
- **event:** public when `status === "published"`, it is a collection or standalone (`is_collection === true` or `collection_id` empty/null — the `/events` feed rule in `apps/web/src/lib/data/queries.ts`), and not finished: `end = end_date ?? start_date`; if `end` exists and is before `ctx.now`, not public. `scheduled_publish_at` is ignored. `visible_until = toUnixSeconds(end) ?? OPEN_ENDED`. `url = /events/<slug>`. `keywords` = `tags` split on commas, trimmed. `price` = `pricing_mode === "free" ? 0 : price`.
- **news:** public when `status === "published"`. `published_at = toUnixSeconds($createdAt)`. `url = /news/<slug>`.
- **job:** public when `isRecruitmentVacancyOpen(status, application_deadline, ctx.now)`. `deadline` and `visible_until` from `application_deadline` (else `OPEN_ENDED`). `url = /jobs/<slug>`. `department = ctx.departmentName(department_id)`.
- **product:** public when `status === "published"` and `isListedProduct(row)`. `in_stock = inventory_mode === "unlimited" || stock !== 0`. `price = regular_price`. `url = /shop/<slug>`. `department = ctx.departmentName(departmentId)`.
- **document:** public when `status === "published"`. No translations: both locale entries carry the row's own `title`/`description` with `text_locale` = `"no"` (the row's `language` decides it when present: `language === "en" ? "en" : "no"`; add `"language"` to the Pick). `url = /api/documents/<$id>/download`. `campus_id = scope === "national" ? ALL_CAMPUSES : campusBucket(campus_id)`.
- All: no slug → `[]` (no URL to link). No translation in either locale → `[]` (event/news/job/product). `synced_at = ctx.syncedAt`.

- [ ] **Step 1: Failing tests (per type file).** Minimum assertions:

```ts
// event.test.ts
const t = [{ locale: "no", title: "Vinterleker", description: "<p>Tre dager</p>", short_description: null }];
const e = eventEntries(publishedEvent({ end_date: "2027-02-14T20:00:00Z", campus_id: "5", tags: "ski, fest" }), t, ctx({ now: new Date("2026-11-23") }));
expect(e.map((x) => x.locale)).toEqual(["no", "en"]);
expect(e[1]).toMatchObject({ text_locale: "no", title: "Vinterleker", campus_id: "all", url: "/events/winter-games-2027", keywords: ["ski", "fest"], visible_until: 1_802_635_200 });
expect(eventEntries(publishedEvent({ end_date: "2026-01-01T00:00:00Z" }), t, ctx({ now: new Date("2026-11-23") }))).toEqual([]);
expect(eventEntries(publishedEvent({ collection_id: "parent1", is_collection: false }), t, ctx())).toEqual([]);
expect(eventEntries(publishedEvent({ status: "draft" }), t, ctx())).toEqual([]);
expect(eventEntries(publishedEvent({ end_date: null, start_date: null }), t, ctx())[0].visible_until).toBe(OPEN_ENDED);
// product.test.ts
expect(productEntries(product({ stock: 0, inventory_mode: "tracked" }), t, ctx())[0].in_stock).toBe(false);
expect(productEntries(product({ stock: 0, inventory_mode: "unlimited" }), t, ctx())[0].in_stock).toBe(true);
expect(productEntries(product({ unlisted: true }), t, ctx())).toEqual([]);
expect(JSON.stringify(productEntries(product({ stock: 7 }), t, ctx()))).not.toContain('"stock"');
// job.test.ts
expect(jobEntries(job({ application_deadline: "2026-11-01T00:00:00Z" }), t, ctx({ now: new Date("2026-11-23") }))).toEqual([]);
// common.test.ts
expect(textFor([{ locale: "en", title: "A" } as TranslationText], "no")?.title).toBe("A");
expect(textFor([], "no")).toBeNull();
// document.test.ts
expect(documentEntries(doc({ language: "en", scope: "national" }), ctx())[0]).toMatchObject({ text_locale: "en", campus_id: "all", url: "/api/documents/doc1/download" });
```
- [ ] **Step 2: Run** `bunx vitest run search/entries/` → FAIL.
- [ ] **Step 3: Implement** `common.ts`, the five mappers and `isListedProduct`.
- [ ] **Step 4: Run** → PASS; `bun run check-types --filter=@repo/shared` PASS.
- [ ] **Step 5: Commit** — `feat(search): map events, news, jobs, products and documents to entries`

---

### Task 4: Page and unit mappers, with URL ownership

**Files:**
- Create: `packages/shared/search/entries/page.ts`, `packages/shared/search/entries/unit.ts`
- Modify: `packages/shared/utils/project-units.ts` (move `nationalProjectForUnit` here from `apps/web/src/lib/unit-page.ts`; web's `unit-page.ts` re-exports it so its callers are unchanged)
- Test: `packages/shared/search/entries/page.test.ts`, `unit.test.ts`

**Interfaces:**
- Consumes: Task 1 types, Task 3 `MapContext`, Task 2 `pageDocText`, `jsonToPageDoc` from `@repo/api/page-builder`.
- Produces:
  ```ts
  export interface PageTranslationText { locale: SearchLocale; title: string | null; description: string | null; is_published: boolean | null; published_doc: string | null }
  export type PageOwner =
    | { kind: "standalone" }                           // indexed as a page at /<slug>
    | { kind: "unit"; unitSlug: string }               // "units/<campus>/<unit>": text folds into that unit's entry
    | { kind: "unitSubPage"; unitSlug: string }        // "units/<campus>/<unit>/<name>"; unitSlug is the parent "units/<campus>/<unit>"
    | { kind: "project"; project: ProjectSlug }        // "projects/<project>"
    | { kind: "reserved" };                            // anything else under units/ or projects/: never indexed
  export function pageOwner(slug: string): PageOwner;
  /** Whether a translation has a published, non-empty document (the site's hasPageContent rule). */
  export function hasPublishedContent(t: PageTranslationText): boolean;
  export function pageEntries(row: Pick<Pages,"$id"|"slug"|"status"|"visibility"|"campus_id">, translations: PageTranslationText[], ctx: MapContext): SearchEntry[];
  export function unitEntries(row: Pick<Departments,"$id"|"Name"|"slug"|"campus_id"|"active"|"logo"|"hero">, extras: { overlay: TranslationText[]; page: PageTranslationText[] | null; replacedByProjectPage: boolean }, ctx: MapContext): SearchEntry[];
  ```

`pageOwner` is pure and decides from the slug alone, in this order: `parseUnitSubPageSlug(slug)` → `unitSubPage` with its `unitSlug`; a trimmed, lowercased slug of exactly three segments under `units/` → `unit`; any other `isUnitPageSlug` slug → `reserved`; `isProjectNamespaceSlug(slug)` with a second segment that `isProjectSlug` accepts → `project`, otherwise `reserved`; everything else → `standalone`. The function's loader (Task 7) resolves the department behind a `unitSlug` (`campusSegmentToId` + `departments` by `slug` and `campus_id`).

Rules:
- `hasPublishedContent`: `is_published === true` and `jsonToPageDoc(published_doc)` has `sections.length > 0` or a `header` (mirrors `hasPageContent` in `apps/web/src/lib/unit-page.ts`; a legacy doc with no sections and no header is no page).
- `pageEntries` (standalone, unit sub-page, servable project page): public when `status === "published"`, `visibility === "public"`, and at least one translation has published content. A locale whose translation lacks published content falls back to the other locale's published translation. `title` = translation title; `summary` = translation description; `body` = `pageDocText(jsonToPageDoc(published_doc))`; `url = "/" + slug`. Never read `draft_doc`, `puck_document` or `draft_document`.
- `unitEntries`: public when `active` and `isPublicUnit(row)` and not `replacedByProjectPage`. `title = unitDisplayName(Name)`; `url = unitCanonicalPath({ campusId: campus_id, slug })` (null → `[]`); `summary`/`body` from the overlay translation if any, else from the unit's published page (title/description/doc text) if any, else empty; `image = logo`; `campus_id = campusBucket(campus_id)`.

- [ ] **Step 1: Failing tests**

```ts
expect(pageOwner("om-oss")).toEqual({ kind: "standalone" });
expect(pageOwner("units/oslo/fadderullan")).toEqual({ kind: "unit", unitSlug: "units/oslo/fadderullan" });
expect(pageOwner("units/oslo/fadderullan/program")).toEqual({ kind: "unitSubPage", unitSlug: "units/oslo/fadderullan" });
expect(pageOwner("units/oslo")).toEqual({ kind: "reserved" });
expect(pageOwner("projects/winter-games")).toEqual({ kind: "project", project: "winter-games" });
expect(pageOwner("projects/unknown")).toEqual({ kind: "reserved" });
expect(hasPublishedContent({ locale: "no", is_published: true, published_doc: JSON.stringify({ version: 2, meta: {}, sections: [] }), title: "x", description: null })).toBe(false);
expect(hasPublishedContent({ locale: "no", is_published: false, published_doc: validDoc, title: "x", description: null })).toBe(false);
expect(pageEntries(page({ visibility: "authenticated" }), [publishedNo], ctx())).toEqual([]);
const p = pageEntries(page({ slug: "packing-list" }), [publishedNo, { ...unpublishedEn }], ctx());
expect(p[1]).toMatchObject({ locale: "en", text_locale: "no", url: "/packing-list", type: "page" });
expect(unitEntries(unit({ Name: "Drift BISO" }), noExtras, ctx())).toEqual([]);
expect(unitEntries(unit({ Name: "OSL Fadderullan", slug: "fadderullan", campus_id: "1" }), noExtras, ctx())[0]).toMatchObject({ title: "Fadderullan", url: "/units/oslo/fadderullan", campus_id: "1" });
expect(unitEntries(unit(), { ...noExtras, replacedByProjectPage: true }, ctx())).toEqual([]);
```
- [ ] **Step 2: Run** `bunx vitest run search/entries/page.test.ts search/entries/unit.test.ts` → FAIL.
- [ ] **Step 3: Implement**, move `nationalProjectForUnit` and re-export it from web.
- [ ] **Step 4: Run** → PASS; `cd apps/web && bunx vitest run src/lib` PASS; `bun run check-types --filter=@repo/shared --filter=web` PASS.
- [ ] **Step 5: Commit** — `feat(search): map editor pages and units, one entry per URL`

---

### Task 5: Coded pages

**Files:**
- Create: `packages/shared/search/coded-pages.ts`
- Create: `apps/web/src/app/sitemap-static.ts` (the static route list moved out of `sitemap.ts`, exported as `STATIC_SITEMAP_PATHS: readonly string[]` plus the existing per-route `changeFrequency`/`priority`; `sitemap.ts` builds from it, output unchanged)
- Test: `packages/shared/search/coded-pages.test.ts`, `apps/web/src/app/sitemap-static.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface CodedPage { path: string; campusId?: string; text: Record<SearchLocale, { title: string; description: string; keywords: string[] }> }
  export const CODED_PAGES: readonly CodedPage[];
  export function codedPageEntries(ctx: Pick<MapContext, "syncedAt">, skipPaths?: ReadonlySet<string>): SearchEntry[];
  export function codedRowId(path: string): string; // "/" → "home", "/campus/bergen" → "campus-bergen"
  ```

Paths (each with Norwegian and English title, one-sentence description, and keywords people type — take titles/descriptions from each page's existing metadata and `packages/i18n/messages/{no,en}` where they exist): `/`, `/about`, `/jobs`, `/events`, `/news`, `/shop`, `/documents`, `/campus`, `/campus/oslo`, `/campus/bergen`, `/campus/trondheim`, `/campus/stavanger`, `/campus/national`, `/membership`, `/business`, `/business-hotspot`, `/contact`, `/units`, `/students`, `/projects`, `/projects/fadderullan`, `/projects/karrieredagene`, `/projects/winter-games`, `/okonomisk-stotte`, `/resources`, `/safety`, `/press`, `/privacy`, `/terms`, `/varsling`, `/policies`. Campus landing pages set `campusId` to their campus id (`oslo` 1, `bergen` 2, `trondheim` 3, `stavanger` 4); the rest are all campuses. Keywords must include at least: `/membership` → "medlemskap", "membership"; `/varsling` → "varsling", "whistleblowing"; `/documents` → "vedtekter", "statutes"; `/okonomisk-stotte` → "støtte", "funding".

Entries: `type: "coded"`, `row_id: codedRowId(path)`, `text_locale = locale`, `body = description`, everything display-only null, `visible_until = OPEN_ENDED`. `skipPaths` drops paths a servable project page has taken over (Task 7 passes it).

- [ ] **Step 1: Failing tests**

```ts
// coded-pages.test.ts
expect(new Set(CODED_PAGES.map((p) => p.path)).size).toBe(CODED_PAGES.length);
for (const p of CODED_PAGES) { expect(p.text.no.title).not.toBe(""); expect(p.text.en.title).not.toBe(""); }
expect(CODED_PAGES.find((p) => p.path === "/varsling")?.text.no.keywords).toContain("varsling");
expect(codedRowId("/")).toBe("home");
expect(codedPageEntries({ syncedAt: 1 }, new Set(["/projects/winter-games"])).some((e) => e.url === "/projects/winter-games")).toBe(false);
expect(codedPageEntries({ syncedAt: 1 }).find((e) => e.url === "/campus/bergen")?.campus_id).toBe("2");
// sitemap-static.test.ts
const coded = new Set(CODED_PAGES.map((p) => p.path));
for (const path of STATIC_SITEMAP_PATHS) expect(coded.has(path), `${path} missing from CODED_PAGES`).toBe(true);
```
`STATIC_SITEMAP_PATHS` excludes the `ABOUT_SUBROUTES` redirects (they redirect into `/about`).
- [ ] **Step 2: Run** both tests → FAIL.
- [ ] **Step 3: Implement** the list and the sitemap extraction.
- [ ] **Step 4: Run** → PASS; also `cd apps/web && bunx vitest run src/app` PASS (sitemap unchanged).
- [ ] **Step 5: Commit** — `feat(search): index the pages written in code`

---

### Task 6: Function scaffold — trigger classification and target resolution

**Files:**
- Create: `functions/search-sync/package.json` (copy `content-notifier`'s shape: name `search-sync`, scripts `check-types`, `test: bun test ./src`, `bundle: bun build src/main.ts --target=bun --outfile dist/main.js`; deps `@repo/api`, `@repo/observability`, `@repo/shared`, `meilisearch: catalog:`)
- Create: `functions/search-sync/tsconfig.json` (copy of `content-notifier`'s)
- Create: `functions/search-sync/src/trigger.ts`, `src/resolve.ts`, `src/runtime-key.ts` (copy), `src/report.ts` (copy, message `search-sync answered <status>`)
- Test: `src/trigger.test.ts`, `src/resolve.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // trigger.ts
  export type RowAction = "create" | "update" | "upsert" | "delete";
  export type Trigger =
    | { kind: "row"; table: string; id: string; action: RowAction; body: Record<string, unknown> | null }
    | { kind: "reindex" }
    | { kind: "reject"; reason: string; status: number };
  export function classifyTrigger(headers: Record<string, string | undefined>, secret: string | undefined, body: Record<string, unknown> | null): Trigger;
  // resolve.ts
  export type SyncTarget = { type: Exclude<SearchType, "coded">; id: string } | { type: "department-related"; id: string };
  export type Resolution = { kind: "targets"; targets: SyncTarget[] } | { kind: "ignored"; reason: string };
  export function resolveTargets(trigger: Extract<Trigger, { kind: "row" }>): Resolution;
  ```

Rules:
- `classifyTrigger`: `x-appwrite-trigger: event` → parse `x-appwrite-event` with the same 7-part shapes as `content-notifier/src/trigger.ts` (`tablesdb|databases` + `tables/rows`, legacy `collections/documents`), `*` segments filled from body `$tableId`/`$collectionId`/`$id`. Unparseable → reject 400. `http` → `CRON_SECRET` via `x-cron-secret` or `Authorization: Bearer`, constant-time compare (copy `safeSecretCompare`); match → `reindex`, mismatch → 401, no secret configured → 500. `schedule` → reject 400 (`"No schedule: reindex runs by HTTP"`). Anything else → 400.
- `resolveTargets`: `events→event`, `news→news`, `jobs→job`, `webshop_products→product`, `pages→page`, `documents→document`, `departments→[unit, department-related]`; `content_translations` → read `content_type` + `content_id` from the body (`job|event|news|product|page` → that type; `department` → `unit`; `memberBenefit` or missing → `ignored`); `page_translations` → `page` with body `page_id` (missing → `ignored`). Any other table → `ignored`.

- [ ] **Step 1: Failing tests**

```ts
expect(classifyTrigger({ "x-appwrite-trigger": "event", "x-appwrite-event": "tablesdb.app.tables.events.rows.e1.update" }, "s", null)).toMatchObject({ kind: "row", table: "events", id: "e1", action: "update" });
expect(classifyTrigger({ "x-appwrite-trigger": "event", "x-appwrite-event": "databases.app.tables.*.rows.*.delete" }, "s", { $tableId: "news", $id: "n1" })).toMatchObject({ kind: "row", table: "news", id: "n1", action: "delete" });
expect(classifyTrigger({ "x-appwrite-trigger": "http", "x-cron-secret": "s" }, "s", null)).toEqual({ kind: "reindex" });
expect(classifyTrigger({ "x-appwrite-trigger": "http", authorization: "Bearer nope" }, "s", null)).toMatchObject({ kind: "reject", status: 401 });
expect(classifyTrigger({ "x-appwrite-trigger": "http" }, undefined, null)).toMatchObject({ kind: "reject", status: 500 });
const row = (table: string, body: Record<string, unknown> | null = null) => ({ kind: "row", table, id: "r1", action: "update", body }) as const;
expect(resolveTargets(row("content_translations", { content_type: "event", content_id: "e9" }))).toEqual({ kind: "targets", targets: [{ type: "event", id: "e9" }] });
expect(resolveTargets(row("content_translations", { content_type: "memberBenefit", content_id: "b1" })).kind).toBe("ignored");
expect(resolveTargets(row("page_translations", { page_id: "p7" }))).toEqual({ kind: "targets", targets: [{ type: "page", id: "p7" }] });
expect(resolveTargets(row("departments"))).toEqual({ kind: "targets", targets: [{ type: "unit", id: "r1" }, { type: "department-related", id: "r1" }] });
expect(resolveTargets(row("orders")).kind).toBe("ignored");
```
- [ ] **Step 2: Run** `cd functions/search-sync && bun test ./src` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS; `bun run check-types` in the function PASS.
- [ ] **Step 5: Commit** — `feat(search-sync): classify executions and resolve the affected items`

---

### Task 7: Loading, syncing and writing

**Files:**
- Create: `functions/search-sync/src/writer.ts` (Meilisearch writes), `src/source.ts` (Appwrite reads + mapping), `src/sync.ts` (one target → index), `src/handler.ts`, `src/main.ts`
- Test: `src/sync.test.ts`, `src/handler.test.ts`, `src/writer.test.ts`

**Interfaces:**
- Consumes: Task 3–5 mappers, Task 6 `classifyTrigger`/`resolveTargets`/`SyncTarget`.
- Produces:
  ```ts
  // writer.ts
  export interface IndexWriter {
    upsert(entries: SearchEntry[]): Promise<void>;
    deleteItem(type: SearchType, rowId: string): Promise<void>;     // filter: type = X AND row_id = Y
    deleteOlderThan(syncedAt: number): Promise<void>;               // filter: synced_at < N
    applySettings(): Promise<void>;
  }
  export function meiliWriter(client: Meilisearch, indexName: string, opts?: { timeoutMs?: number }): IndexWriter;
  // source.ts
  export interface LoadedItem { entries: SearchEntry[]; related: SyncTarget[]; codedSkip?: { path: string; skip: boolean } }
  export interface Source {
    load(target: Exclude<SyncTarget, { type: "department-related" }>, ctx: MapContext): Promise<LoadedItem>;
    departmentRelated(departmentId: string): Promise<SyncTarget[]>;
    listIds(type: Exclude<SearchType, "coded">): AsyncIterable<string[]>;   // pages of ids, used by reindex
    servableProjectPaths(): Promise<Set<string>>;                          // "/projects/<slug>" taken over by a page
  }
  export type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];
  /** `departmentName` is async (cached per execution); `load` awaits the name first, then hands the mapper a `MapContext` whose sync `departmentName` returns it. */
  export function appwriteSource(db: AdminDb, opts: { departmentName: (id: string | null | undefined) => Promise<string | null> }): Source;
  // sync.ts
  export interface SyncDeps { source: Source; writer: IndexWriter; now: () => Date; log: (m: string) => void }
  export function syncTargets(deps: SyncDeps, targets: SyncTarget[]): Promise<{ upserted: number; deleted: number }>;
  // handler.ts
  export interface RequestLike { bodyJson?: unknown; bodyText?: string; headers?: Record<string, string | undefined> }
  export function handleRequest(input: { deps: SyncDeps; req: RequestLike; secret: string | undefined; reindex: () => Promise<Record<string, unknown>> }): Promise<{ status: number; body: unknown }>;
  ```

Rules:
- **writer:** every Meilisearch call waits for its task (`timeoutMs` default 10000) and throws `Error("Meilisearch task <uid> failed: <error.message>")` when the task ends `failed`. Entries are upserted with primary key `id`. `upsert([])` is a no-op.
- **source.load** reads with the admin `db` (`createAdminClient().db`), never trusting the event body for content:
  - event/news/job/product: `getRow` on the table (404 → item gone → `entries: []`), translations via `listRows("app","content_translations",[Query.equal("content_type",t),Query.equal("content_id",id),Query.limit(10)])`, mapped through Task 3.
  - document: `getRow("documents")` → `documentEntries`.
  - page: `listRows("app","pages",[Query.equal("$id",id), Query.select([...])])` with the same select list as `getPage` in `packages/api/page-builder.ts` (published fields only). By `pageOwner(slug)` (`reserved` → `entries: []`):
    - standalone / unit sub-page (sub-page only if `page.department_id` is the department at `units/<campus>/<unit>`) → `pageEntries`.
    - unit → `entries: []`, `related: [{ type: "unit", id: department_id }]` (the unit entry carries the page text).
    - project → servable when the page has published content and is genuine (hub project: `department_id == null`; national project: `department_id` is the campus-5 unit with slug `PROJECT_UNIT_SLUGS[project]`, mirroring `projectPageIsGenuine`). Servable → `pageEntries`, `codedSkip: { path: "/projects/<project>", skip: true }`, and for a national project `related: [{ type: "unit", id: <that unit> }]`. Not servable → `entries: []`, `codedSkip: { path, skip: false }`.
  - unit: `getRow("departments")`, overlay translations (`content_type: "department"`), the published unit page at `unitPageSlug(...)` bound to this department, and `replacedByProjectPage` = `nationalProjectForUnit(row)` is non-null and that project path is in `servableProjectPaths()`.
  - `departmentRelated(id)`: ids from `events`/`jobs`/`news` (`department_id = id`) and `webshop_products` (`departmentId = id`) → targets.
- **sync:** for each target: `department-related` → expand via `source.departmentRelated` and sync those; otherwise `load`; entries non-empty → `upsert`, empty → `deleteItem(type, id)`; `related` targets are synced once each (track visited `type:id`, never loop); `codedSkip` → `skip` ? `deleteItem("coded", codedRowId(path))` : `upsert(codedPageEntries(ctx).filter(e => e.url === path))`. `ctx.syncedAt = Date.now()`, `ctx.now = deps.now()`.
- **handler:** reject → its status + `{ ok: false, error }`; row event → `resolveTargets` → `ignored` answers 200 `{ ok: true, ignored: reason }`; targets → `syncTargets` → 200 `{ ok: true, ...counts }`; `reindex` → 200 with its result. Any thrown error → 500 `{ ok: false, error: message }`. Read the event body like `content-notifier`'s `readEventBody` (`bodyText` first, `bodyJson` inside try/catch).
- **main.ts:** as `content-notifier/src/main.ts`: `reporterFromEnv(process.env, "search-sync")`, `adoptRuntimeApiKey`, `createAdminClient()`, `createSearchClient(process.env.MEILISEARCH_HOST, process.env.MEILISEARCH_ADMIN_KEY)`, `searchIndexName()`, `reportResponse` on the status, `reporter.flush()` in `finally`. A department-name cache (Map) lives for one execution.

- [ ] **Step 1: Failing tests** (fakes for `Source` and `IndexWriter`; writer test fakes the Meilisearch client)

```ts
// sync.test.ts
await syncTargets(deps({ load: async () => ({ entries: [entryNo, entryEn], related: [] }) }), [{ type: "event", id: "e1" }]);
expect(writer.upserted).toEqual([entryNo, entryEn]);
await syncTargets(deps({ load: async () => ({ entries: [], related: [] }) }), [{ type: "event", id: "gone" }]);
expect(writer.deleted).toContainEqual(["event", "gone"]);
// related targets synced once even when they point back
await syncTargets(deps({ load: async (t) => ({ entries: [], related: [{ type: "page", id: "p1" }, { type: "unit", id: "u1" }] }) }), [{ type: "unit", id: "u1" }]);
expect(source.loadCalls).toEqual(["unit:u1", "page:p1"]);
// project page taken over → coded entry removed
await syncTargets(deps({ load: async () => ({ entries: [pageEntry], related: [], codedSkip: { path: "/projects/winter-games", skip: true } }) }), [{ type: "page", id: "p2" }]);
expect(writer.deleted).toContainEqual(["coded", "projects-winter-games"]);
// department-related expands
await syncTargets(deps({ departmentRelated: async () => [{ type: "job", id: "j1" }] }), [{ type: "department-related", id: "d1" }]);
expect(source.loadCalls).toContain("job:j1");
// handler.test.ts
expect(await handleRequest(input({ headers: { "x-appwrite-trigger": "event", "x-appwrite-event": "tablesdb.app.tables.content_translations.rows.t1.update" }, bodyText: JSON.stringify({ content_type: "memberBenefit", content_id: "b1" }) }))).toMatchObject({ status: 200, body: { ok: true, ignored: expect.any(String) } });
expect((await handleRequest(input({ source: throwingSource }))).status).toBe(500);
// writer.test.ts
await expect(meiliWriter(fakeClient({ taskStatus: "failed", error: "bad filter" }), "site_content").deleteItem("event", "e1")).rejects.toThrow(/failed: bad filter/);
```
- [ ] **Step 2: Run** `bun test ./src` → FAIL.
- [ ] **Step 3: Implement** writer, source, sync, handler, main. Check the installed `meilisearch` client's task-wait API (`node_modules/meilisearch`) rather than assuming it.
- [ ] **Step 4: Run** `bun test ./src` PASS; `bun run check-types` PASS; `bun run bundle` produces `dist/main.js`.
- [ ] **Step 5: Commit** — `feat(search-sync): keep entries in step with row events`

---

### Task 8: Reindex, README and final checks

**Files:**
- Create: `functions/search-sync/src/reindex.ts`, `functions/search-sync/README.md`
- Modify: `functions/search-sync/src/main.ts` (wire `reindex`)
- Test: `src/reindex.test.ts`

**Interfaces:**
- Consumes: Task 7 `Source`, `IndexWriter`, `SyncDeps`.
- Produces: `export interface ReindexResult { ok: true; entries: number; byType: Record<SearchType, number>; sweptBefore: number }` and `export function runReindex(deps: SyncDeps): Promise<ReindexResult>`.

Rules (stamp and sweep):
1. `startedAt = Date.now()`; `writer.applySettings()`.
2. For each type (`event, news, job, product, page, unit, document`): iterate `source.listIds(type)`; for each page of ids, `load` each (concurrency 5), collect entries, `upsert` in batches of 500. `related` and `codedSkip` are ignored here (every item is visited anyway).
3. Coded pages: `upsert(codedPageEntries(ctx, await source.servableProjectPaths()))`.
4. `writer.deleteOlderThan(startedAt)` — entries written by row events during the run carry `synced_at >= startedAt`, so they survive.
5. Return counts.

`source.listIds(type)` pages with `Query.cursorAfter` and `Query.select(["$id"])` (100 per page) and pre-filters on the cheap public conditions (`status = published` where the table has it; `active = true` for departments) — the mappers still decide.

README (copy `content-notifier/README.md`'s structure): what it does; Console setup — Bun runtime, **root directory = repository root**, build command `bun install --filter search-sync && bun run --cwd functions/search-sync bundle && rm -rf node_modules`, entrypoint `functions/search-sync/dist/main.js`; events `databases.app.tables.<t>.rows.*` (or `tablesdb.…`) for `events, news, jobs, webshop_products, pages, page_translations, content_translations, departments, documents`; scopes `rows.read`; execute access: none needed for events — the reindex is run from the Console as an **async** execution (synchronous HTTP executions time out at 30 s) with header `x-cron-secret: <CRON_SECRET>`; timeout 900 s; variables `MEILISEARCH_HOST`, `MEILISEARCH_ADMIN_KEY`, `CRON_SECRET`, optional `MEILISEARCH_INDEX`, `SENTRY_DSN`, `SENTRY_ENVIRONMENT`; do not set `APPWRITE_*`. Go-live: deploy → run reindex → compare `entries` with the sitemap's URL count × 2 locales. Note: changing `CODED_PAGES` needs a redeploy + reindex.

- [ ] **Step 1: Failing tests**

```ts
const r = await runReindex(deps({ ids: { event: [["e1", "e2"]], page: [["p1"]] }, entriesPer: 2 }));
expect(writer.settingsApplied).toBe(true);
expect(r.byType.event).toBe(4);
expect(writer.upserted.some((e) => e.type === "coded")).toBe(true);
expect(writer.sweptBefore).toBe(r.sweptBefore);
expect(writer.sweptBefore).toBeLessThanOrEqual(writer.upserted[0].synced_at); // nothing written this run is swept
expect(writer.upserted.filter((e) => e.url === "/projects/winter-games" && e.type === "coded")).toEqual([]); // when servableProjectPaths has it
```
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `reindex.ts`, wire it in `main.ts`, write the README.
- [ ] **Step 4: Verify** — `bun test ./src` PASS; from the repo root `bun run check-types --filter=search-sync --filter=@repo/shared --filter=web` PASS; `cd packages/shared && bunx vitest run` PASS; `cd functions/search-sync && bun run bundle` succeeds; `bun x ultracite check functions/search-sync packages/shared/search` clean.
- [ ] **Step 5: Commit** — `feat(search-sync): full reindex with stamp-and-sweep`
