# Site search, stage 2: search API route — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `GET /api/search` in `apps/api`, a public route the web uses now and the Flutter app later, answering the quick panel (option A) and the results page from the Meilisearch index stage 1 fills.

**Architecture:** Pure code in `packages/shared/search/` normalises request parameters, builds Meilisearch multi-search queries (campus first: "this campus + all campuses" before "the rest"), and assembles typed responses with highlights as segments. The route in `apps/api` only wires env, the client, CORS and errors.

**Tech Stack:** TypeScript, Next.js 16 route handler (`apps/api`), Vitest, `meilisearch` client 0.63 (`multiSearch`).

**Spec:** `docs/superpowers/specs/2026-11-23-site-search-design.md` (section "Search API"). Stage 1 plan: `docs/superpowers/plans/2026-11-23-site-search-stage1-sync.md` (entry model in `packages/shared/search/types.ts`).

Work in the worktree `/Users/markus/Documents/dev/BISO-Sites/.claude/worktrees/site-search` only.

## Global Constraints

- Public route, no auth. The browser never sees a Meilisearch key; `apps/api` holds `MEILISEARCH_SEARCH_KEY` (search-only).
- Every query filters `locale = <requested>` and `visible_until >= <now in Unix seconds>`.
- `q` is trimmed, inner whitespace collapsed, capped at 100 characters; empty `q` answers an empty result without calling Meilisearch.
- Locale is `"no"` or `"en"`; anything else → `"no"`.
- Highlights travel as segments `{ text: string; match: boolean }[]`, never HTML.
- Groups shown to users: `event, news, job, product, page, unit`; entry types `page`, `document`, `coded` all belong to group `page`.
- Campus first: with a study campus selected (`"1"`–`"4"`), entries with `campus_id` in `[<campus>, "all"]` rank above all others; `only_campus` drops the others. No campus, unknown campus or `"5"` (National) → no split.
- Never log the query text (a visitor may search their own name or student number). Sentry already drops URL query strings (`packages/observability/src/scrub.ts`).
- Errors: Meilisearch unreachable or failing → `502 { error: "Search is unavailable", code: "UPSTREAM_ERROR" }`; missing env → `503 { error: "Search is not configured", code: "NOT_CONFIGURED" }`.
- `Cache-Control: private, no-store` (results must reflect edits within seconds).
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_014NDgSQY3WssKw3UU1yJNnL`.

## Review Focus

1. A query that matches only in the body (not title/summary) must still show a useful snippet with the match highlighted. (Task 1 `toSegments`, Task 2 snippet test.)
2. The same item must not appear twice in the quick panel (best match card and its group). (Task 2.)
3. Page 2+ of the results page across the campus boundary must neither skip nor repeat items. (Task 2 paging tests.)
4. Malformed parameters (`page=-3`, `page=abc`, `type=foo`, `locale=de`, 5 000-character `q`) must never 4xx/5xx. (Task 1.)
5. A highlight tag string occurring in content must not break segment parsing. (Task 1 — use control characters as tags.)

---

### Task 1: Response types, parameter normalisation, highlight segments

**Files:**
- Create: `packages/shared/search/response.ts`, `packages/shared/search/params.ts`, `packages/shared/search/highlight.ts`
- Test: `packages/shared/search/params.test.ts`, `packages/shared/search/highlight.test.ts`

**Interfaces:**
- Produces (`response.ts`):
  ```ts
  export const SEARCH_GROUPS = ["event", "news", "job", "product", "page", "unit"] as const;
  export type SearchGroup = (typeof SEARCH_GROUPS)[number];
  export function groupOf(type: SearchType): SearchGroup;        // page|document|coded → "page"
  export function typesOf(group: SearchGroup): SearchType[];      // inverse
  export interface Segment { text: string; match: boolean }
  export interface SearchHit {
    id: string; type: SearchType; group: SearchGroup; url: string; text_locale: SearchLocale;
    title: Segment[]; snippet: Segment[];
    campus_id: string; campus_name: string;   // campusIdToLabel(campus_id); "all" → "Alle campus" (no) / "All campuses" (en), by the request locale
    department: string | null; image: string | null; cover_pattern: string | null;
    starts_at: number | null; ends_at: number | null; price: number | null; member_price: number | null;
    member_only: boolean; in_stock: boolean | null; deadline: number | null; published_at: number | null;
    location: string | null; category: string | null;
  }
  export type GroupCounts = Record<SearchGroup, number>;
  export interface QuickSearchResponse { mode: "quick"; query: string; locale: SearchLocale; total: number; counts: GroupCounts; best: SearchHit | null; groups: Record<SearchGroup, SearchHit[]> }
  export interface PageSearchResponse { mode: "page"; query: string; locale: SearchLocale; group: SearchGroup | null; total: number; counts: GroupCounts; hits: SearchHit[]; page: number; pageSize: number; totalPages: number }
  export type SearchResponse = QuickSearchResponse | PageSearchResponse;
  export function emptyCounts(): GroupCounts;
  ```
- Produces (`params.ts`):
  ```ts
  export const SEARCH_QUERY_MAX = 100;
  export const SEARCH_PAGE_SIZE = 20;
  export const QUICK_GROUP_SIZE = 2;
  export interface SearchRequest { q: string; locale: SearchLocale; campus: string | null; onlyCampus: boolean; group: SearchGroup | null; page: number; mode: "quick" | "page" }
  export function parseSearchParams(params: URLSearchParams): SearchRequest;
  ```
  Parameters: `q`, `locale`, `campus`, `only_campus` (`"1"`/`"true"` → true), `type` (a `SearchGroup`, else null), `page` (integer ≥ 1, else 1; capped at 50), `mode` (`"page"` → page, else quick). `campus` is kept only when it is `"1"`–`"4"`; `"5"`, empty or anything else → null.
- Produces (`highlight.ts`):
  ```ts
  export const HIGHLIGHT_PRE = "\u0001";
  export const HIGHLIGHT_POST = "\u0002";
  export function toSegments(formatted: string): Segment[];   // merges adjacent same-kind segments, drops empty ones
  export function hasMatch(segments: Segment[]): boolean;
  ```

- [ ] **Step 1: Failing tests**

```ts
// params.test.ts
const p = (s: string) => parseSearchParams(new URLSearchParams(s));
expect(p("q=  winter   games ")).toMatchObject({ q: "winter games", locale: "no", campus: null, onlyCampus: false, group: null, page: 1, mode: "quick" });
expect(p(`q=${"a".repeat(5000)}`).q.length).toBe(100);
expect(p("q=x&locale=en&campus=2&only_campus=1&type=job&page=3&mode=page")).toMatchObject({ locale: "en", campus: "2", onlyCampus: true, group: "job", page: 3, mode: "page" });
expect(p("q=x&locale=de&campus=5&type=foo&page=-3")).toMatchObject({ locale: "no", campus: null, group: null, page: 1 });
expect(p("q=x&page=abc").page).toBe(1);
expect(p("q=x&page=9999").page).toBe(50);
expect(groupOf("coded")).toBe("page");
expect(typesOf("page").sort()).toEqual(["coded", "document", "page"]);
// highlight.test.ts
expect(toSegments("\u0001Winter\u0002 Games")).toEqual([{ text: "Winter", match: true }, { text: " Games", match: false }]);
expect(toSegments("plain")).toEqual([{ text: "plain", match: false }]);
expect(toSegments("<em>not a tag</em> \u0001x\u0002")).toEqual([{ text: "<em>not a tag</em> ", match: false }, { text: "x", match: true }]);
expect(toSegments("")).toEqual([]);
expect(hasMatch(toSegments("a \u0001b\u0002"))).toBe(true);
```
- [ ] **Step 2: Run** `cd packages/shared && bunx vitest run search/params.test.ts search/highlight.test.ts` → FAIL.
- [ ] **Step 3: Implement** the three modules.
- [ ] **Step 4: Run** → PASS; `bun run check-types` in packages/shared PASS.
- [ ] **Step 5: Commit** — `feat(search): request parsing, response types and highlight segments`

---

### Task 2: Query building and response assembly

**Files:**
- Create: `packages/shared/search/query.ts`
- Test: `packages/shared/search/query.test.ts`

**Interfaces:**
- Consumes: Task 1 types; `SearchEntry` from `types.ts`; `MultiSearchQuery`, `SearchResponse as MeiliResponse` types from `meilisearch`.
- Produces:
  ```ts
  export interface SearchRunner { multiSearch(queries: MultiSearchQuery[]): Promise<MeiliResponse<SearchEntry>[]> }
  export function runSearch(runner: SearchRunner, indexName: string, req: SearchRequest, now: Date): Promise<SearchResponse>;
  export function baseFilter(req: SearchRequest, now: Date): string[];               // exported for tests
  export function toHit(hit: Hit<SearchEntry>, locale: SearchLocale): SearchHit;      // exported for tests
  ```

Query parameters common to every query: `indexUid: indexName`, `q: req.q`, `attributesToHighlight: ["title", "summary"]`, `attributesToCrop: ["body"]`, `cropLength: 24`, `highlightPreTag: HIGHLIGHT_PRE`, `highlightPostTag: HIGHLIGHT_POST`, `attributesToRetrieve` = every `SearchEntry` field except `body`, `keywords`, `synced_at`. Filters are arrays of strings (AND): `locale = "<locale>"`, `visible_until >= <unix seconds>`, plus `type IN [...]` for a group and `campus_id IN ["<c>", "all"]` / `campus_id NOT IN ["<c>", "all"]` for the campus split. Quote values with `JSON.stringify`.

`toHit(hit, locale)`: `title = toSegments(_formatted.title)`; `snippet` = `toSegments(_formatted.summary)` when it has a match or the cropped body has none, else `toSegments(_formatted.body)` (cropped, matched); `group = groupOf(type)`; `campus_name` = `campusIdToLabel(campus_id)` (`packages/shared/utils/unit-urls.ts`) or, for `"all"`, `"Alle campus"` / `"All campuses"` by `locale`; display fields copied. (Signature in the Interfaces block becomes `toHit(hit: Hit<SearchEntry>, locale: SearchLocale): SearchHit`.)

**Quick mode** (`req.mode === "quick"`), one `multiSearch` call:
- `counts`: one query with the base filter, `limit: 0`, `facets: ["type"]` → sum `facetDistribution.type` into groups; `total` = sum of counts.
- With a campus split (`campus` set and not `onlyCampus`): per scope (`mine`, `rest`) one "best" query (`limit: 1`) and per group one query (`limit: QUICK_GROUP_SIZE + 1`). Without a split: one scope with the base filter (plus the `mine` filter when `onlyCampus`).
- `best` = first hit of `mine`-best, else `rest`-best. Each group = `mine` hits then `rest` hits, minus the best hit's `id`, first `QUICK_GROUP_SIZE`.
- `onlyCampus` also applies the `mine` filter to the counts query.

**Page mode**, at most two `multiSearch` calls:
- Call 1: counts query (as above, without the group filter so the tabs always show every group's count), then with a split: `mine` query with `hitsPerPage: SEARCH_PAGE_SIZE, page: req.page` (exact `totalHits` = M) and `rest` query with `hitsPerPage: 1, page: 1` (exact `totalHits` = R); without a split: one query with `hitsPerPage`/`page`. The group filter (`req.group`) applies to these result queries.
- With a split, the page covers positions `start = (page-1)*20` to `start+20` of the list "all of mine, then all of rest". If `mine` returned fewer than 20 hits on this page and R > 0, call 2 fetches `rest` with `offset: max(0, start - M)`, `limit: 20 - mine.hits.length` and appends them.
- Filter strings are built exactly as `field IN [v1, v2]` / `field NOT IN [v1, v2]` with each value `JSON.stringify`-ed and joined by `", "` — e.g. `campus_id IN ["2", "all"]`, `type IN ["page", "document", "coded"]`.
- `total` = M + R (or the single `totalHits`); `totalPages = ceil(total / 20)`; `counts` from the counts query.

- [ ] **Step 1: Failing tests** with a fake `SearchRunner` that records queries and serves canned results (build hits with `_formatted`).

```ts
expect(baseFilter(req({ locale: "en" }), new Date("2026-11-23T12:00:00Z"))).toEqual(['locale = "en"', "visible_until >= 1795435200"]);
// quick, no campus
const q1 = await runSearch(fake(cannedQuick), "site_content", req({ q: "winter" }), now);
expect(fake.calls).toHaveLength(1);
expect(q1.mode).toBe("quick");
expect(q1.counts).toEqual({ event: 6, news: 5, job: 2, product: 4, page: 4, unit: 2 });  // facet {event:6,news:5,job:2,product:4,page:2,document:1,coded:1,unit:2}
expect(q1.total).toBe(23);
expect(Object.values(q1.groups).flat().some((h) => h.id === q1.best?.id)).toBe(false);   // best never repeated
expect(q1.groups.event.length).toBeLessThanOrEqual(2);
// quick, campus 2: mine first
const q2 = await runSearch(fake(cannedSplit), "site_content", req({ q: "winter", campus: "2" }), now);
expect(fake.calls[0].flatMap((q) => q.filter ?? [])).toContain('campus_id IN ["2", "all"]');
expect(fake.calls[0].flatMap((q) => q.filter ?? [])).toContain('campus_id NOT IN ["2", "all"]');
expect(q2.groups.event[0].campus_id).toMatch(/^(2|all)$/);
// snippet falls back to the cropped body when only the body matched
expect(toHit(hitWith({ _formatted: { title: "Packing list", summary: "Bring warm clothes", body: "…rent \u0001ski\u0002 gear on site…" } }), "en").snippet.some((s) => s.match)).toBe(true);
expect(toHit(hitWith({ campus_id: "all" }), "no").campus_name).toBe("Alle campus");
expect(toHit(hitWith({ campus_id: "2" }), "en").campus_name).toBe("Bergen");
// page mode across the boundary: M = 25, R = 30
const pg2 = await runSearch(fake(pagedSplit({ M: 25, R: 30 })), "site_content", req({ q: "x", campus: "2", mode: "page", page: 2 }), now);
expect(pg2.hits.map((h) => h.id)).toEqual([...mineIds.slice(20, 25), ...restIds.slice(0, 15)]);
const pg3 = await runSearch(fake(pagedSplit({ M: 25, R: 30 })), "site_content", req({ q: "x", campus: "2", mode: "page", page: 3 }), now);
expect(pg3.hits.map((h) => h.id)).toEqual(restIds.slice(15, 30) /* 15 left */.slice(0, 20));
expect(pg2.total).toBe(55);
expect(pg2.totalPages).toBe(3);
// group filter applies to results, not to counts
const pj = await runSearch(fake(cannedQuick), "site_content", req({ q: "x", mode: "page", group: "job" }), now);
expect(fake.calls[0].slice(1).flatMap((q) => q.filter ?? [])).toContain('type IN ["job"]');   // result queries
expect(fake.calls[0][0].filter).not.toContain('type IN ["job"]');                              // counts query
```
(The fake records each call's query array in `fake.calls` and must actually slice canned arrays by `offset`/`limit`/`page`/`hitsPerPage` and filter them by the `campus_id` / `type` filter strings, so the paging assertions test real arithmetic. `1795435200` is 2026-11-23T12:00:00Z.)
- [ ] **Step 2: Run** `bunx vitest run search/query.test.ts` → FAIL.
- [ ] **Step 3: Implement** `query.ts`.
- [ ] **Step 4: Run** → PASS; `bun run check-types` PASS.
- [ ] **Step 5: Commit** — `feat(search): build campus-first queries and assemble results`

---

### Task 3: The API route

**Files:**
- Create: `apps/api/src/lib/search.ts`, `apps/api/src/app/api/search/route.ts`
- Modify: `apps/api/src/lib/allowed-origins.ts` (add `"https://www.biso.no"` to `PRODUCTION_ORIGINS`) and its test
- Modify: `apps/api/package.json` (add `"meilisearch": "catalog:"` if the route imports the client type directly; `@repo/shared` is already a dependency — check)
- Modify: wherever `apps/api`'s environment variables are documented (find it: `apps/api/README.md`, `docs/operations/*`, or the developer docs) — add `MEILISEARCH_HOST`, `MEILISEARCH_SEARCH_KEY`, optional `MEILISEARCH_INDEX`
- Test: `apps/api/src/app/api/search/route.test.ts`, `apps/api/src/lib/allowed-origins.test.ts`

**Interfaces:**
- Consumes: `parseSearchParams`, `runSearch`, `SearchRunner`, `createSearchClient`, `searchIndexName`.
- Produces: `GET` and `OPTIONS` exports; `apps/api/src/lib/search.ts` → `searchRunnerFromEnv(env = process.env): { runner: SearchRunner; indexName: string } | null` (null when `MEILISEARCH_HOST` or `MEILISEARCH_SEARCH_KEY` is missing; the client is created once per process and reused).

Route (model on `apps/api/src/app/api/benefits/route.ts`): `export const dynamic = "force-dynamic"`; parse params; empty `q` → 200 with an empty response of the requested mode (`counts` all zero, `best: null`, empty groups/hits, `page: 1`, `totalPages: 0`) and no Meilisearch call; `searchRunnerFromEnv()` null → 503 `NOT_CONFIGURED`; `runSearch` throws → `console.error("[Search] failed:", <error name and code only>)` and 502 `UPSTREAM_ERROR`; success → 200 JSON. Every response goes through `applyCorsHeaders` with `Cache-Control: private, no-store`. `OPTIONS` → `corsPreflightResponse`.

- [ ] **Step 1: Failing tests** (mock `@/lib/search` or the meilisearch client the way `benefits/route.test.ts` mocks `@repo/api/server`)

```ts
expect((await GET(request("?q="))).status).toBe(200);
expect(await (await GET(request("?q=&mode=page"))).json()).toMatchObject({ mode: "page", hits: [], total: 0, totalPages: 0 });
expect(multiSearch).not.toHaveBeenCalled();
const ok = await GET(request("?q=winter&locale=en&campus=2", { origin: "https://biso.no" }));
expect(ok.status).toBe(200);
expect(ok.headers.get("access-control-allow-origin")).toBe("https://biso.no");
expect(ok.headers.get("cache-control")).toBe("private, no-store");
expect((await ok.json()).mode).toBe("quick");
multiSearch.mockRejectedValueOnce(Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }));
const bad = await GET(request("?q=winter"));
expect(bad.status).toBe(502);
expect(await bad.json()).toEqual({ error: "Search is unavailable", code: "UPSTREAM_ERROR" });
expect(consoleError.mock.calls.flat().join(" ")).not.toContain("winter");   // never log the query
// not configured
expect((await GET(request("?q=winter"))).status).toBe(503);                 // with env unset
// allowed-origins.test.ts
expect(isAllowedOrigin("https://www.biso.no", "production")).toBe(true);
```
- [ ] **Step 2: Run** `cd apps/api && bunx vitest run src/app/api/search src/lib/allowed-origins.test.ts` → FAIL.
- [ ] **Step 3: Implement** `lib/search.ts`, the route, the origin, the env docs.
- [ ] **Step 4: Verify** — the focused tests PASS; `cd apps/api && bunx vitest run` PASS; from the repo root `bun run check-types --filter=api --filter=@repo/shared` PASS; `bun x ultracite check apps/api/src/app/api/search apps/api/src/lib/search.ts packages/shared/search` clean.
- [ ] **Step 5: Commit** — `feat(api): public search route backed by Meilisearch`
