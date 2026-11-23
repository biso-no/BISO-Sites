# Site search, stage 3: web UI + docs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The quick search the owner picked (option A: the search field takes over the header row and results drop in a navy panel; a full-screen navy sheet on phones) and a server-rendered `/search` results page, both reading `GET /api/search` from stage 2; plus the developer docs page and a staff-guide note.

**Architecture:** A small client data layer (`apps/web/src/lib/search/`) calls `apps/api` directly from the browser (CORS already allows biso.no). Quick-search UI lives in `apps/web/src/components/search/`, lazy-loaded when search opens. `/search` is an RSC page under `(public)` that fetches the API server-side, so it works without JavaScript.

**Tech Stack:** Next.js 16 App Router (RSC, `cacheComponents: true` → request-time pages need `<Suspense>` + `connection()`), React 19, next-intl, Tailwind tokens from `.biso-surface-v2`, `motion/react` (user-triggered only), Vitest (+ `// @vitest-environment happy-dom` with `react-dom/client` `createRoot` + `act`, as in `src/components/expense-v3/expense-type-combobox.test.tsx`).

**Spec:** `docs/superpowers/specs/2026-11-23-site-search-design.md` ("Web: quick search (option A)", "Web: results page", "Docs"). API types: `packages/shared/search/response.ts` (stage 2). Mockups the owner approved (option A + results page): `/Users/markus/Documents/dev/BISO-Sites/.superpowers/brainstorm/83504-1795438032/content/search-mockups.html`.

Work in the worktree `/Users/markus/Documents/dev/BISO-Sites/.claude/worktrees/site-search` only.

## Global Constraints

- Read `apps/web/CLAUDE.md` "Design system" first. Use only registered tokens (`bg-surface`, `bg-surface-raised`, `bg-surface-sunken`, `text-ink`, `text-ink-muted`, `text-ink-accent`, `border-edge`, `bg-action`, `text-action-ink`, `bg-marker`, `text-deep`, `ring-focus-ring`); `src/app/styles.test.ts` fails on anything else. No `backdrop-blur`, no brand gradients, no decorative icon tiles, no hover-lift, no scroll-triggered motion. Motion only in response to a user action (the panel's open fade may copy `MegaPanel`'s 0.15 s).
- Navy surfaces use `data-surface="deep"` (aliases flip; never hand-pick white text).
- Matched words: `bg-marker text-deep` with a small radius and `[box-decoration-break:clone]`, rendered from API segments — never `dangerouslySetInnerHTML`.
- Fonts: Museo Slab for headings/query text, Museo Sans for body; `font-semibold`/`font-bold` for emphasis.
- Every user-visible string in `packages/i18n/messages/{no,en}/search.json` (namespace `search`); natural bokmål, plain sentence case, no self-praise. The slogan stays English if used.
- Analytics: only `trackEvent("search", { surface, queryLength })` (event name already in the union); never the query text. Umami must not receive `?q=` from `/search` URLs.
- The browser calls `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/search` without credentials; requests are debounced and stale ones aborted.
- `src/components/nav/header.test.ts` asserts the utility group class string and the overflow drop order — don't change either. First paint of the header must not load the quick-search code (lazy import on open).
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_014NDgSQY3WssKw3UU1yJNnL`.

## Review Focus

1. Typing fast must never show results for an older query after a newer one (abort + sequence guard). (Task 2.)
2. `/` must not open search while the visitor types in another field; Escape closes search and returns focus to the trigger. (Task 3.)
3. The API being down must leave a readable message in the panel and on `/search`, not an empty box or a crash. (Tasks 2, 4.)
4. `/search` with no `q`, an absurd `page`, or an unknown `type` must render, not 404/500. (Task 4.)
5. Keyboard-only use: arrows move through results, Enter opens one, screen readers get combobox/listbox semantics and a live result count. (Task 2.)

---

### Task 1: Data layer, highlight rendering, strings, privacy

**Files:**
- Create: `apps/web/src/lib/search/fetch.ts`, `apps/web/src/lib/search/recent.ts`, `apps/web/src/components/search/highlighted.tsx`
- Create: `packages/i18n/messages/no/search.json`, `packages/i18n/messages/en/search.json`; Modify: `packages/i18n/messages/no.ts`, `en.ts` (and `messages/index.ts` / `types.ts` if they list namespaces)
- Modify: `apps/web/src/lib/analytics-privacy.ts` (strip the whole query on `/search` like auth paths), `apps/web/src/app/robots.ts` (`Disallow: /search`)
- Test: `apps/web/src/lib/search/fetch.test.ts`, `recent.test.ts`, `apps/web/src/components/search/highlighted.test.tsx`, `apps/web/src/lib/analytics-privacy.test.ts`, the existing robots/SEO test (`seo-surface.test.ts`)

**Interfaces:**
- Produces:
  ```ts
  // fetch.ts
  export interface SearchQueryInput { q: string; locale: "no" | "en"; campus?: string | null; onlyCampus?: boolean; group?: SearchGroup | null; page?: number; mode: "quick" | "page" }
  export function searchUrl(input: SearchQueryInput, base?: string): string;      // base defaults to NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3003"
  export async function fetchSearch<M extends "quick" | "page">(input: SearchQueryInput & { mode: M }, init?: { signal?: AbortSignal; timeoutMs?: number }): Promise<M extends "quick" ? QuickSearchResponse : PageSearchResponse>;  // throws SearchUnavailableError on non-2xx / network / timeout
  export class SearchUnavailableError extends Error {}
  // recent.ts  (localStorage key "biso.search.recent", max 5, newest first, de-duplicated case-insensitively, every access in try/catch)
  export function readRecentSearches(): string[];
  export function rememberSearch(q: string): void;
  export function clearRecentSearches(): void;
  // highlighted.tsx
  export function Highlighted({ segments, className }: { segments: Segment[]; className?: string }): JSX.Element;
  ```
- `search.json` keys (both locales; the implementer writes the copy): `field.label`, `field.placeholder`, `open`, `close`, `submit`, `showAll` (with `{count}` and `{query}`), `groups.{event,news,job,product,page,unit}`, `best`, `recent.title`, `recent.clear`, `shortcuts.title`, `shortcuts.events`, `shortcuts.jobs`, `shortcuts.shop`, `empty.title` (with `{query}`), `empty.body`, `empty.links`, `error.title`, `error.body`, `hints.move`, `hints.open`, `hints.close`, `resultsCount` (ICU plural), `page.title`, `page.metaTitle`, `page.onlyCampus` (with `{campus}`), `page.previous`, `page.next`, `page.pageOf` (`{page}`/`{total}`), `meta.membersFrom` (`{price}`), `meta.freeForMembers`, `meta.applyBy` (`{date}`), `meta.inStock`, `meta.outOfStock`, `meta.allCampuses`.

- [ ] **Step 1: Failing tests**

```ts
expect(searchUrl({ q: "winter games", locale: "en", campus: "2", mode: "quick" }, "https://api.biso.no")).toBe("https://api.biso.no/api/search?q=winter+games&locale=en&campus=2&mode=quick");
expect(searchUrl({ q: "x", locale: "no", group: "job", page: 2, onlyCampus: true, campus: "1", mode: "page" }, "https://a")).toContain("type=job");
await expect(fetchSearch({ q: "x", locale: "no", mode: "quick" })).rejects.toBeInstanceOf(SearchUnavailableError);   // fetch mocked to 502
rememberSearch("Winter"); rememberSearch("winter"); rememberSearch("Jobs");
expect(readRecentSearches()).toEqual(["Jobs", "winter"]);
// localStorage throwing → no throw, empty list
// highlighted.test.tsx (renderToStaticMarkup)
expect(html).toBe('<span><mark class="…">Winter</mark> Games</span>');   // assert the <mark> wraps only matched text, no innerHTML from content: a segment "<b>x</b>" renders escaped
// analytics-privacy
expect(umamiBeforeSend("pageview", { url: "/search?q=ola+nordmann&type=job" }).url).toBe("/search");
// robots: Disallow includes "/search"
```
- [ ] **Step 2: Run** `cd apps/web && bunx vitest run src/lib/search src/components/search src/lib/analytics-privacy.test.ts` (+ the robots test) → FAIL.
- [ ] **Step 3: Implement.** Add `@repo/shared` search response types via `@repo/shared/search/response`.
- [ ] **Step 4: Run** → PASS; `bun run check-types --filter=web --filter=@repo/i18n` PASS.
- [ ] **Step 5: Commit** — `feat(web): search data layer, highlights and strings`

---

### Task 2: Quick search results (hook + panel content)

**Files:**
- Create: `apps/web/src/components/search/use-quick-search.ts`, `apps/web/src/components/search/quick-search-results.tsx`, `apps/web/src/components/search/quick-search-input.tsx`
- Test: `apps/web/src/components/search/use-quick-search.test.tsx`, `quick-search-results.test.tsx`

**Interfaces:**
- Consumes: Task 1 `fetchSearch`, `Highlighted`, `readRecentSearches`/`rememberSearch`.
- Produces:
  ```ts
  export type QuickSearchState =
    | { status: "idle" }                                   // empty query
    | { status: "loading"; previous: QuickSearchResponse | null }
    | { status: "ready"; response: QuickSearchResponse }
    | { status: "error" };
  export function useQuickSearch(opts: { locale: "no" | "en"; campus: string | null; debounceMs?: number; fetcher?: typeof fetchSearch }): { query: string; setQuery: (q: string) => void; state: QuickSearchState };
  export interface QuickOption { id: string; href: string }              // flattened, in display order: best, then groups in SEARCH_GROUPS order, then "show all"
  export function quickOptions(response: QuickSearchResponse, query: string): QuickOption[];
  export function QuickSearchResults(props: { state: QuickSearchState; query: string; activeId: string | null; layout: "panel" | "sheet"; campusSlug: string | null; onNavigate: (href: string) => void }): JSX.Element;
  export function QuickSearchInput(props: { value: string; onChange: (v: string) => void; onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void; listboxId: string; activeId: string | null; expanded: boolean; inputRef: React.Ref<HTMLInputElement> }): JSX.Element;   // role="combobox", aria-controls, aria-activedescendant, aria-autocomplete="list"
  ```

Rules:
- Debounce 150 ms; each request gets an `AbortController`; a response is applied only if it belongs to the latest query (sequence number) — stale responses are dropped even if they resolve late.
- Trimmed query shorter than 1 character → `idle`. While loading, keep showing `previous` results (no flash).
- **Panel layout** (desktop, from the mockup A): best match large on the left (event → date block; image → `ChevronFrame` thumbnail; else no media), the six groups in a 3-column grid on the right, each with its translated name and count, items as title (`Highlighted`) + one meta line. Empty groups are omitted. Footer row: "Show all N results for “q”" link to `/search?q=…` and the keyboard hints. **Sheet layout** (phone): best match on top, groups stacked, "Show all" at the bottom.
- **Idle:** recent searches (each a button that fills the query) with "Clear", then shortcuts: upcoming events at your campus (`/events?campus=<slug>` when a campus slug is known, else `/events`), open jobs (`/jobs`), the shop (`/shop`).
- **No results** (`total === 0`): `empty.title` with the query, `empty.body` (check spelling, fewer words), links to `/events`, `/news`, `/jobs`.
- **Error:** `error.title` / `error.body` and a link to `/search?q=…`.
- Accessibility: results container `role="listbox"` with each option `role="option"` + `id` + `aria-selected`; a polite live region announces `resultsCount`. `onNavigate` is called for clicks and Enter.

- [ ] **Step 1: Failing tests** (happy-dom; fake fetcher with controllable promises; `vi.useFakeTimers()`)

```ts
// use-quick-search
setQuery("w"); setQuery("wi"); setQuery("win"); advance(150);
expect(fetcher).toHaveBeenCalledTimes(1);                         // debounced
// stale: query A resolves after query B
resolveB(responseB); resolveA(responseA);
expect(state.status === "ready" && state.response.query).toBe("winter");   // B's query
expect(abortSignalOfA.aborted).toBe(true);
fetcherRejects(); → state.status === "error"
setQuery("   ") → state.status === "idle"
// quick-search-results
expect(quickOptions(resp, "winter").map((o) => o.id)).toEqual([resp.best!.id, ...flatGroups, "show-all"]);
render(<QuickSearchResults state={{ status: "ready", response: resp }} … />);
expect(container.querySelectorAll('[role="option"]').length).toBe(quickOptions(resp, "winter").length);
expect(container.textContent).toContain("23");                    // count in show-all / live region
expect(container.querySelector("mark")?.textContent).toBe("Winter");
render error state → contains error.title text and a link to "/search?q=winter"
render idle with recent ["jobs"] → button "jobs"; shortcuts link to "/events?campus=bergen" when campusSlug="bergen"
render ready with total 0 → empty.title, links /events /news /jobs
```
- [ ] **Step 2: Run** `bunx vitest run src/components/search` → FAIL.
- [ ] **Step 3: Implement** (mock `next-intl` in tests as the model test does).
- [ ] **Step 4: Run** → PASS; check-types PASS; `bunx vitest run src/app/styles.test.ts src/app/motion.test.ts` PASS.
- [ ] **Step 5: Commit** — `feat(web): quick search results and input`

---

### Task 3: Header integration (option A desktop + phone sheet)

**Files:**
- Create: `apps/web/src/components/search/search-trigger.tsx`, `apps/web/src/components/search/quick-search.tsx` (the lazily loaded container: input row + results + keyboard + close), `apps/web/src/components/search/use-search-shortcut.ts`
- Modify: `apps/web/src/components/nav/mega-nav-v2.tsx`
- Test: `apps/web/src/components/search/use-search-shortcut.test.tsx`, `apps/web/src/components/search/quick-search.test.tsx`, and extend `apps/web/src/components/nav/header.test.ts`

**Interfaces:**
- Consumes: Task 2 components; `useLocale()` (next-intl); `useCampus()` (`@/components/context/campus`) for `activeCampusId`; `campusIdToSegment` from `@repo/shared/utils/unit-urls`; `MegaPanel` shell classes (`src/components/nav/mega-panel.tsx`).
- Produces:
  ```ts
  export function SearchTrigger(props: { onOpen: () => void; expanded: boolean; controls: string; triggerRef: React.Ref<HTMLButtonElement> }): JSX.Element;   // icon button (lucide Search, size-5, like CartButton), aria-label search.open, aria-keyshortcuts="/ Control+K Meta+K"
  export function useSearchShortcut(onOpen: () => void): void;   // "/" (no modifiers) and Ctrl/Cmd+K; ignored when the event target is an input, textarea, select or contenteditable, or when a modifier other than Ctrl/Cmd is held
  export default function QuickSearch(props: { layout: "panel" | "sheet"; onClose: () => void; locale: "no" | "en"; campusId: string | null }): JSX.Element;
  ```

Rules:
- `NavigationV2` gets `searchOpen` state (separate from `useMegaPanels`; opening search calls `closeNow()`, opening a mega panel closes search). The header is solid while search is open (add to the `solid` condition).
- Desktop (≥1340px): `SearchTrigger` sits in the utility group right before `CartButton` (inside the existing group — don't edit its class string). When open, an input row is drawn **over** the header row (absolutely positioned from the logo's right edge to the container's right edge, `bg-surface`, so the measured nav row and its ghost stay mounted): search icon, the query in Museo Slab 900 (~1.6rem), an `esc` hint and a close button. The results render below the bar in the `MegaPanel` shell (same classes and `role="region"`, `id="nav-panel-search"`), as a child of `<nav>`.
- Phone (<1340px): a second `SearchTrigger` next to the mobile `CartButton` opens a full-screen sheet (`fixed inset-0 z-[60] bg-surface` with `data-surface="deep"`, scroll inside, input row with a "Cancel"/close button, `layout="sheet"`). It closes the mobile drawer if open. Lock body scroll while open.
- `QuickSearch` is loaded with `next/dynamic(() => import("…/quick-search"), { ssr: false })` and rendered only while open; the input autofocuses on open.
- Close on Escape (from the input or anywhere in the panel), on the close button, on outside `pointerdown` (desktop), and on navigation. Focus returns to the trigger that opened it. Mouse leaving the nav does NOT close search.
- Keyboard in the input: ArrowDown/ArrowUp move `activeId` through `quickOptions` (wrapping), Enter opens the active option or, with none active and a non-empty query, `/search?q=…`. Navigation uses `router.push` and calls `rememberSearch(query)` and `trackEvent("search", { surface: layout === "panel" ? "quick" : "quick-mobile", queryLength })`.
- `useSearchShortcut` is mounted in `NavigationV2` and opens the right layout for the viewport (`window.matchMedia("(min-width: 1340px)")`).

- [ ] **Step 1: Failing tests**

```ts
// use-search-shortcut
fire keydown "/" on document.body → onOpen called once
fire keydown "/" with target <input> → not called
fire keydown "k" with metaKey → called; with ctrlKey → called; "k" alone → not called
// quick-search (happy-dom, mocked fetcher/router)
type "winter", advance timers, ArrowDown ×1, Enter → router.push(best.href); rememberSearch called; trackEvent("search", { surface: "quick", queryLength: 6 })
Enter with no active option → router.push("/search?q=winter")
Escape → onClose called
// header.test.ts (source assertions, like the existing ones)
expect(source).toContain('dynamic(');                 // lazy import of quick-search
expect(source).toMatch(/<SearchTrigger[\s\S]*<CartButton/);   // trigger before cart in the utility group
utility group class string unchanged (existing assertion still passes)
```
- [ ] **Step 2: Run** `bunx vitest run src/components/search src/components/nav` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS; `bunx vitest run src/app` PASS (styles/motion/redesign tests); check-types PASS.
- [ ] **Step 5: Commit** — `feat(web): open search from the header`

---

### Task 4: `/search` results page

**Files:**
- Create: `apps/web/src/app/(public)/search/page.tsx`, `apps/web/src/components/search/search-results-page.tsx`, `apps/web/src/components/search/search-result-row.tsx`, `apps/web/src/lib/search/page-params.ts`
- Test: `apps/web/src/lib/search/page-params.test.ts`, `apps/web/src/components/search/search-result-row.test.tsx`, `apps/web/src/components/search/search-results-page.test.tsx`

**Interfaces:**
- Consumes: Task 1 `fetchSearch` (server-side call with `timeoutMs: 8000`), `Highlighted`; primitives `PageHeader`/`Section`/`Container`/`FilterChips`/`DateBlock`/`ChevronFrame`/`Pill`/`StatusPanel`/`FeedSkeleton`; `getLocale` (`@/app/actions/locale`), `getUserPreferences` (`@/lib/auth-utils`), `resolveRequestCampus` (`@/lib/campus-scope`).
- Produces:
  ```ts
  export interface SearchPageParams { q: string; group: SearchGroup | null; page: number; onlyCampus: boolean }
  export function parseSearchPageParams(sp: Record<string, string | string[] | undefined>): SearchPageParams;   // reuses parseSearchParams rules from @repo/shared/search/params
  export function searchPageHref(params: Partial<SearchPageParams> & { q: string }): string;                   // canonical param order: q, type, only, page (page omitted when 1)
  export function SearchResultRow({ hit, locale }: { hit: SearchHit; locale: "no" | "en" }): JSX.Element;
  ```

Rules:
- Page: `generateMetadata` → title from `search.page.metaTitle`, `robots: { index: false, follow: true }`, `alternates: { canonical: "/search" }`. Body inside `<Suspense fallback={<FeedSkeleton />}>` with an async list component that `await connection()`s.
- Navy band (`PageHeader` / `Section tone="deep"`): `<h1>` from `search.page.title`; a GET `<form action="/search">` with a large input `name="q"` (Museo Slab 900, white field on navy as in the mockup) and a submit button (`bg-action text-action-ink`); hidden inputs keep `type` and `only`. Under it: the result count and, when a study campus is selected, a link toggling "Only <campus>" (`only=1`) rendered as a switch (`role="switch"`-styled link with `aria-pressed`, no JS needed). Then `FilterChips` for All + the six groups with counts (`param="type"`, other params preserved).
- List: one `SearchResultRow` per hit separated by `border-edge` rules (no cards). Lead: events → `DateBlock` of `starts_at`; news/products with `image` → `ChevronFrame` thumbnail (`ImageWithFallback` from `@repo/ui/components/image`); everything else → no lead (no icon tiles; the text column aligns). Title (`Highlighted`, Museo Slab 700) links to `hit.url`; a meta line with the type name, campus (`Pill tone="accent"` when it is the visitor's campus), date/place/department; snippet (`Highlighted`); a right column with price (`meta.membersFrom` / `meta.freeForMembers` / plain price), job deadline (`meta.applyBy`), or stock (`meta.inStock`/`meta.outOfStock`). Page entries show their path as a breadcrumb line.
- Pagination: previous/next links (`searchPageHref`) and `page.pageOf`; hidden when `totalPages <= 1`.
- States: no `q` → the band with the empty field and the shortcuts list; `total === 0` → `StatusPanel` with `empty.*` and links; `SearchUnavailableError` → `StatusPanel` with `error.*` (HTTP 200, the band and form still render).
- Submitting the form is tracked by a tiny client wrapper like `FeedSearch` (`surface: "search-page"`, `queryLength`).

- [ ] **Step 1: Failing tests**

```ts
expect(parseSearchPageParams({ q: "  winter ", type: "foo", page: "-2", only: "1" })).toEqual({ q: "winter", group: null, page: 1, onlyCampus: true });
expect(searchPageHref({ q: "winter games", group: "job", page: 1 })).toBe("/search?q=winter+games&type=job");
expect(searchPageHref({ q: "x", page: 3, onlyCampus: true })).toBe("/search?q=x&only=1&page=3");
// row (renderToStaticMarkup)
event hit → contains DateBlock day "12", link href "/events/winter-games-2027", a <mark>
product hit with in_stock false → meta.outOfStock text; never a number of items
job hit → meta.applyBy with formatted deadline; no <img>
page hit → breadcrumb text "biso.no / projects / winter-games / packing-list"
// results page component (pure props → markup)
error prop → error.title rendered, form still present
total 0 → empty.title with the query
totalPages 1 → no pagination links
```
- [ ] **Step 2: Run** `bunx vitest run src/lib/search src/components/search` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS; `bunx vitest run src/app` PASS; `bun run check-types --filter=web` PASS.
- [ ] **Step 5: Commit** — `feat(web): search results page`

---

### Task 5: Documentation

**Files:**
- Create: `apps/docs/content/docs/developers/<the section that documents platform features — pick it by reading the folder and its meta.json>/search.mdx`
- Modify: that folder's `meta.json`; the staff-guide page that explains publishing content (find it under `apps/docs/content/docs/guide/`) — add one short note; `functions/search-sync/README.md` only if a cross-link is useful
- Test: the docs app's content tests (`cd apps/docs && bunx vitest run`)

Rules (read `apps/docs/CLAUDE.md` first): front matter with `title`, `description`, `covers` (globs for `functions/search-sync/**`, `packages/shared/search/**`, `apps/api/src/app/api/search/**`, `apps/api/src/lib/search.ts`, `apps/web/src/components/search/**`, `apps/web/src/lib/search/**`, `apps/web/src/app/(public)/search/**`). Content: what is searchable and the visibility rules (one per type), locales (fallback for events/jobs/products/units/documents; news and pages only in their own language), how sync works (row events → re-read → upsert/delete; the settle delay; department fan-out), the event list to configure, running a reindex (async Console execution with `x-cron-secret`) and what only a reindex corrects, adding a coded page (`CODED_PAGES` + `STATIC_SITEMAP_ROUTES`, then redeploy + reindex), the API parameters and response shape (for the Flutter app later), environment variables per app. The guide note (plain words for staff): published changes show up in search within seconds; unpublishing removes them.

Also clear the docs PR check's warnings left by stages 1–2: update the pages whose `covers` match code this branch changed — at least `developers/…/packages.mdx` (shared `search/` folder, `utils/content-text.ts`, `nationalProjectForUnit` in `utils/project-units.ts`), `local-setup.mdx`, `guide/…/department-pages.mdx`, and the pages that still say "three functions" (`backups-and-recovery`, `secrets-and-environment`, `known-limitations`) — and `apps/api`'s env/route docs if stage 2 didn't. Find them with `grep -rl` on their `covers`.

- [ ] **Step 1:** Write the page and the note; add to `meta.json`; fix the stale pages above.
- [ ] **Step 2: Run** `cd apps/docs && bunx vitest run` → PASS (content structure, front matter, covers).
- [ ] **Step 3: Commit** — `docs(search): how site search works`
