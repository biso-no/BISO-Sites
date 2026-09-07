# Web List Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/jobs`, `/events` and `/shop` in `apps/web` paginate, search, filter and sort against Appwrite instead of fetching a fixed window and filtering in the browser.

**Architecture:** Two admin modules are promoted to shared packages (admin keeps its behaviour via re-export shims). Each of the three server actions returns `WebPaginatedResult<T>` with Appwrite's true `total`, and every filter that currently runs after the fetch moves into the query — mandatory, because a post-fetch filter makes `total` overcount and punches holes in page slices. Search cannot traverse relationships, so it runs two-phase: fulltext on `content_translations` for candidate ids, then the parent table filtered by those ids. The UI is "Load more", with filter state in the URL and reset-by-remount via a `key`.

**Tech Stack:** Next.js 16 (App Router, RSC), React 19, Appwrite via `@repo/api` (node-appwrite 28), `next-intl`, Vitest, Bun 1.3.1, Biome/Ultracite.

**Spec:** `docs/superpowers/specs/2026-09-07-web-list-pagination-design.md` — read it before Task 1. It carries the probe results this plan assumes.

## Global Constraints

- **Package manager is Bun.** Never `npm`/`pnpm`. Tests: `bun run test --filter=web`.
- **`bun run check-types` is the only signal that matters.** `apps/web/next.config.ts` sets `typescript.ignoreBuildErrors: true`, so `next build` will not catch type errors.
- **Never import `appwrite` / `node-appwrite` directly.** Go through `@repo/api`.
- **Do not edit** `packages/api/appwrite.config.json` or `packages/api/types/appwrite.ts` — both generated.
- **No Appwrite schema changes in this plan.** Every query here was verified against the live instance on 2026-09-07.
- `WEB_PAGE_SIZE = 12`. `SEARCH_CANDIDATE_CAP = 500`. `MAX_OFFSET = 5000`.
- Run `bun x ultracite fix` before each commit; `lefthook` enforces it.
- **Admin must not change behaviour.** Its only intentional change in this plan is two re-export shims.

## Verified query facts (do not re-derive)

| Fact | Status |
|---|---|
| `Query.or([…, Query.and([…]), …])` — one nesting level | ✅ works |
| `Query.search` on a relationship attr (`translation_refs.title`) | ❌ **rejected** — this is why search is two-phase |
| `Query.search` on `content_translations.title` / `.description` | ✅ works |
| `Query.equal("$id", [260 ids])` | ✅ works |
| `Query.equal("department.type", …)` — filter through a relationship | ✅ works |
| `Query.orderAsc("department.Name")` — order through a relationship | ❌ **rejected** — this is why A–Z sort is dropped |

---

### Task 1: Shared list-params foundation

**Files:**
- Create: `packages/shared/utils/list-params.ts`
- Create: `packages/shared/utils/list-params.test.ts`
- Modify: `apps/admin/src/lib/list-params.ts` (re-export the moved half)
- Create: `apps/web/src/lib/list-params.ts`
- Create: `apps/web/src/lib/list-params.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `@repo/shared/utils/list-params`: `MAX_OFFSET: 5000`, `type ListSearchParams = Record<string, string | string[] | undefined>`, `firstParam(sp, key): string | undefined`, `lastPageByOffset(size: number): number`, `lastReachablePage(total: number, size: number): number`
  - `@/lib/list-params` (web): `WEB_PAGE_SIZE: 12`, `SEARCH_CANDIDATE_CAP: 500`, `interface WebPaginatedResult<T> { rows: T[]; total: number; page: number; size: number; capped: boolean }`, `interface WebListParams { page: number; q: string }`, `parseWebListParams(sp: ListSearchParams): WebListParams`, `emptyWebResult<T>(page: number): WebPaginatedResult<T>`, `webOffset(page: number): number`

- [ ] **Step 1: Write the failing test for the shared module**

Create `packages/shared/utils/list-params.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  firstParam,
  lastPageByOffset,
  lastReachablePage,
  MAX_OFFSET,
} from "./list-params";

describe("list-params primitives", () => {
  it("exposes Appwrite's offset ceiling", () => {
    expect(MAX_OFFSET).toBe(5000);
  });

  it("takes the first value of a repeated search param", () => {
    expect(firstParam({ q: ["a", "b"] }, "q")).toBe("a");
    expect(firstParam({ q: "solo" }, "q")).toBe("solo");
    expect(firstParam({}, "q")).toBeUndefined();
  });

  it("caps the last page at the offset ceiling, not the row count", () => {
    // 5000/12 = 416.67 -> 416 full pages, +1 for the partial page at the top.
    expect(lastPageByOffset(12)).toBe(417);
    // A million rows cannot outrun the ceiling.
    expect(lastReachablePage(1_000_000, 12)).toBe(417);
  });

  it("caps the last page at the row count when that is the tighter bound", () => {
    expect(lastReachablePage(25, 12)).toBe(3);
    expect(lastReachablePage(12, 12)).toBe(1);
  });

  it("never reports a last page below 1, even for an empty result", () => {
    expect(lastReachablePage(0, 12)).toBe(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun run test --filter=@repo/shared -- list-params`
Expected: FAIL — `Cannot find module './list-params'`

- [ ] **Step 3: Create the shared module**

Create `packages/shared/utils/list-params.ts`:

```ts
/**
 * Pure, dependency-free list params.
 *
 * Imported by CLIENT components, so it must NEVER import `@repo/api` or
 * anything reaching `node-appwrite` — that drags the server SDK (and
 * `undici` -> `node:net`) into the browser bundle and breaks every page
 * rendering a pagination control at dev runtime.
 *
 * Size-dependent helpers (`PAGE_SIZES`, `parseListParams`) stay in
 * `apps/admin/src/lib/list-params.ts`: admin's `PageSize` union is 25|50|100,
 * which web's fixed size of 12 cannot satisfy.
 */

/** Appwrite rejects an offset past this, so deeper pages cannot be served. */
export const MAX_OFFSET = 5000;

/** Shape Next.js gives us from `await searchParams`. */
export type ListSearchParams = Record<string, string | string[] | undefined>;

/** Reads a single search param, taking the first of a repeated key. */
export function firstParam(
  searchParams: ListSearchParams,
  key: string
): string | undefined {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Last page the offset ceiling allows, independent of how many rows exist.
 *
 * Knowable without a count, which is what lets a parser clamp a hand-typed
 * page before anything is fetched.
 */
export function lastPageByOffset(size: number): number {
  return Math.floor(MAX_OFFSET / size) + 1;
}

/**
 * Last page reachable at all — bounded both by the row count and by
 * `MAX_OFFSET`, since Appwrite rejects an offset past that regardless of how
 * many rows would otherwise remain. Takes `number` rather than a size union so
 * both apps can share it.
 */
export function lastReachablePage(total: number, size: number): number {
  const byTotal = Math.max(1, Math.ceil(total / size));
  return Math.min(byTotal, lastPageByOffset(size));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test --filter=@repo/shared -- list-params`
Expected: PASS (5 tests)

- [ ] **Step 5: Point admin at the shared module**

In `apps/admin/src/lib/list-params.ts`, delete the local definitions of `MAX_OFFSET`, `ListSearchParams`, `firstParam`, `lastPageByOffset` and `lastReachablePage`, and re-export them instead. Add at the top of the file, below the existing header comment:

```ts
export {
  firstParam,
  type ListSearchParams,
  lastPageByOffset,
  lastReachablePage,
  MAX_OFFSET,
} from "@repo/shared/utils/list-params";

import {
  lastPageByOffset,
  type ListSearchParams,
} from "@repo/shared/utils/list-params";
```

Keep `PAGE_SIZES`, `PageSize`, `DEFAULT_PAGE_SIZE`, `parseListParams`, `PaginatedResult` and `emptyResult` exactly as they are — `parseListParams` already calls `lastPageByOffset`, which now resolves to the import.

- [ ] **Step 6: Verify admin still passes its own pagination tests**

Run: `bun run test --filter=admin`
Expected: PASS — no admin test changes. If any admin test fails, the shim dropped a symbol; re-add it rather than editing the test.

- [ ] **Step 7: Write the failing test for the web module**

Create `apps/web/src/lib/list-params.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  emptyWebResult,
  parseWebListParams,
  SEARCH_CANDIDATE_CAP,
  WEB_PAGE_SIZE,
  webOffset,
} from "./list-params";

describe("web list params", () => {
  it("pages by 12 so both the 2-col and 3-col grids fill evenly", () => {
    expect(WEB_PAGE_SIZE).toBe(12);
    expect(SEARCH_CANDIDATE_CAP).toBe(500);
  });

  it("defaults to page 1 with an empty query", () => {
    expect(parseWebListParams({})).toEqual({ page: 1, q: "" });
  });

  it("clamps junk in the address bar to page 1 rather than throwing", () => {
    expect(parseWebListParams({ page: "abc" }).page).toBe(1);
    expect(parseWebListParams({ page: "0" }).page).toBe(1);
    expect(parseWebListParams({ page: "-3" }).page).toBe(1);
    expect(parseWebListParams({ page: "2.7" }).page).toBe(2);
  });

  it("clamps a page past the offset ceiling before anything is fetched", () => {
    // Carrying ?page=99999 forward would report a page it never fetched.
    expect(parseWebListParams({ page: "99999" }).page).toBe(417);
  });

  it("trims the search term and takes the first of a repeated key", () => {
    expect(parseWebListParams({ q: "  hello  " }).q).toBe("hello");
    expect(parseWebListParams({ q: ["first", "second"] }).q).toBe("first");
  });

  it("converts a 1-based page to a 0-based Appwrite offset", () => {
    expect(webOffset(1)).toBe(0);
    expect(webOffset(3)).toBe(24);
  });

  it("builds an empty result that is not capped", () => {
    expect(emptyWebResult(2)).toEqual({
      rows: [],
      total: 0,
      page: 2,
      size: 12,
      capped: false,
    });
  });
});
```

- [ ] **Step 8: Run it to verify it fails**

Run: `bun run test --filter=web -- list-params`
Expected: FAIL — `Cannot find module './list-params'`

- [ ] **Step 9: Create the web module**

Create `apps/web/src/lib/list-params.ts`:

```ts
import {
  firstParam,
  lastPageByOffset,
  type ListSearchParams,
} from "@repo/shared/utils/list-params";

/**
 * Rows per page on the public list surfaces.
 *
 * 12 divides both the 2-column jobs grid and the 3-column events/shop grids
 * evenly, so a full page never leaves a ragged final row.
 */
export const WEB_PAGE_SIZE = 12;

/**
 * Ceiling on phase-1 search candidates.
 *
 * Search runs two-phase because Appwrite fulltext cannot traverse a
 * relationship: `content_translations` yields candidate ids, then the parent
 * table is filtered by them. A deliberately broad probe returned 186 hits, so
 * this is headroom rather than a limit anyone should reach — but when it IS
 * reached the result is marked `capped` rather than silently truncated.
 */
export const SEARCH_CANDIDATE_CAP = 500;

export interface WebPaginatedResult<T> {
  /** True when phase-1 search hit the cap, so `total` is a floor. */
  capped: boolean;
  page: number;
  rows: T[];
  size: number;
  /** Appwrite's count for the filtered set, never `rows.length`. */
  total: number;
}

export interface WebListParams {
  /** 1-based, always >= 1 and never past the offset ceiling. */
  page: number;
  /** Trimmed; "" when absent. */
  q: string;
}

/** Clamps rather than throws: junk in the address bar renders page 1. */
export function parseWebListParams(
  searchParams: ListSearchParams
): WebListParams {
  const rawPage = Number(firstParam(searchParams, "page"));
  const requested =
    Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  // A page past the offset ceiling cannot be served, so carrying it forward
  // would have the surface report a page it never fetched.
  const page = Math.min(requested, lastPageByOffset(WEB_PAGE_SIZE));

  return { page, q: (firstParam(searchParams, "q") ?? "").trim() };
}

/** 1-based page to the 0-based offset Appwrite wants. */
export function webOffset(page: number): number {
  return (page - 1) * WEB_PAGE_SIZE;
}

/** Short-circuit for actions that can prove the result is empty. */
export function emptyWebResult<T>(page: number): WebPaginatedResult<T> {
  return { rows: [], total: 0, page, size: WEB_PAGE_SIZE, capped: false };
}
```

- [ ] **Step 10: Run both test files to verify they pass**

Run: `bun run test --filter=web -- list-params && bun run test --filter=@repo/shared -- list-params`
Expected: PASS

- [ ] **Step 11: Type-check the whole repo**

Run: `bun run check-types`
Expected: no errors. This is the gate that catches the admin shim dropping a symbol.

- [ ] **Step 12: Commit**

```bash
bun x ultracite fix
git add packages/shared/utils/list-params.ts packages/shared/utils/list-params.test.ts \
        apps/admin/src/lib/list-params.ts \
        apps/web/src/lib/list-params.ts apps/web/src/lib/list-params.test.ts
git commit -m "feat(web): add shared list-params foundation

Promotes the size-independent half of admin's list-params to
@repo/shared so web can page by 12 without inheriting admin's
25|50|100 PageSize union. Admin re-exports, unchanged."
```

---

### Task 2: Promote `useListParams` to `@repo/ui`

**Files:**
- Create: `packages/ui/hooks/use-list-params.tsx` (moved from admin, unchanged)
- Modify: `packages/ui/package.json` (add the export entry)
- Modify: `apps/admin/src/app/(portal)/_components/use-list-params.tsx` (becomes a re-export)

**Interfaces:**
- Consumes: nothing.
- Produces: `@repo/ui/hooks/use-list-params` exporting `ListParamsProvider({ children }: { children: ReactNode })`, `useListParams(): { get(key: string, fallback?: string): string; setParams(updates: Record<string, string | number | null | undefined>, opts?: { keepPage?: boolean; pageKey?: string }): void }`, and `useUrlSearch(key?: string, delay?: number, opts?: { pageKey?: string }): readonly [string, (v: string) => void]`.

**Why this moves rather than being rewritten:** `/jobs` has search, department, category and sort all writing the same URL. Writing straight to `router.replace` drops whichever write has not yet committed — the exact bug the pending-write context in this hook already solves. It has no admin-specific imports (`next/navigation` + `react` only), and `@repo/ui` already depends on both.

- [ ] **Step 1: Copy the file into `@repo/ui` verbatim**

```bash
cp "apps/admin/src/app/(portal)/_components/use-list-params.tsx" \
   packages/ui/hooks/use-list-params.tsx
```

Do not edit the contents. Every comment in it documents a bug that was hit in production.

- [ ] **Step 2: Add the export entry**

`packages/ui/package.json` maps `"./hooks/*": "./hooks/*.ts"` — `.ts` only, so a `.tsx` hook needs its own entry. Add to `exports`, after the `"./hooks/*"` line:

```json
    "./hooks/use-list-params": "./hooks/use-list-params.tsx",
```

- [ ] **Step 3: Replace admin's copy with a re-export**

Overwrite `apps/admin/src/app/(portal)/_components/use-list-params.tsx` with:

```tsx
/**
 * Moved to `@repo/ui/hooks/use-list-params` so `apps/web`'s list surfaces can
 * share the pending-write merging. Re-exported from the original path so the
 * admin import sites stay put.
 */
export {
  ListParamsProvider,
  useListParams,
  useUrlSearch,
} from "@repo/ui/hooks/use-list-params";
```

- [ ] **Step 4: Verify admin's hook tests still pass against the moved implementation**

Run: `bun run test --filter=admin -- use-list-params`
Expected: PASS — all 400+ lines of `use-list-params.test.tsx` green, unchanged. These tests are the proof the move was lossless; if any fail, the copy was not verbatim.

- [ ] **Step 5: Verify the rest of admin still passes**

Run: `bun run test --filter=admin && bun run check-types`
Expected: PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
bun x ultracite fix
git add packages/ui/hooks/use-list-params.tsx packages/ui/package.json \
        "apps/admin/src/app/(portal)/_components/use-list-params.tsx"
git commit -m "refactor(ui): promote useListParams to @repo/ui

Web's /jobs has four controls writing one URL, which needs the same
pending-write merging admin already solved. Moved verbatim; admin
re-exports from the original path."
```

---

### Task 3: Two-phase search helper

**Files:**
- Create: `apps/web/src/lib/data/search-content.ts`
- Create: `apps/web/src/lib/data/search-content.test.ts`

**Interfaces:**
- Consumes: `SEARCH_CANDIDATE_CAP` from `@/lib/list-params`.
- Produces: `findContentIdsBySearch(db: Db, contentType: "job" | "event" | "product", search: string, locale?: string): Promise<{ capped: boolean; ids: string[] }>`

**Why two-phase:** `Query.search("translation_refs.title", …)` is rejected by Appwrite — *"Searching by attribute … requires a fulltext index"* — because fulltext does not traverse relationships. The indexes exist on `content_translations` (`search_title`, `search_description`). `jobs.translations` is additionally `twoWay: false`, so jobs has no reverse column to filter from either. Both facts are verified in the spec.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/data/search-content.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { findContentIdsBySearch } from "./search-content";

const db = { listRows: vi.fn() };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asDb = () => db as any;

describe("findContentIdsBySearch", () => {
  beforeEach(() => {
    db.listRows.mockReset();
  });

  it("returns no ids and issues no query for a blank search", async () => {
    const result = await findContentIdsBySearch(asDb(), "job", "   ", "en");

    expect(result).toEqual({ ids: [], capped: false });
    expect(db.listRows).not.toHaveBeenCalled();
  });

  it("searches title and description on content_translations", async () => {
    db.listRows.mockResolvedValue({ rows: [{ content_id: "j1" }], total: 1 });

    await findContentIdsBySearch(asDb(), "job", "analyst", "en");

    const [database, table, queries] = db.listRows.mock.calls[0];
    expect(database).toBe("app");
    // NOT the parent table: fulltext cannot traverse a relationship.
    expect(table).toBe("content_translations");
    const serialized = queries.join("|");
    expect(serialized).toContain("analyst");
    expect(serialized).toContain("title");
    expect(serialized).toContain("description");
    expect(serialized).toContain("job");
    expect(serialized).toContain("en");
  });

  it("dedupes content ids across the two locales of one row", async () => {
    db.listRows.mockResolvedValue({
      rows: [
        { content_id: "j1" },
        { content_id: "j1" },
        { content_id: "j2" },
      ],
      total: 3,
    });

    const result = await findContentIdsBySearch(asDb(), "job", "analyst");

    expect(result.ids).toEqual(["j1", "j2"]);
    expect(result.capped).toBe(false);
  });

  it("drops rows with a missing content_id rather than emitting empty ids", async () => {
    db.listRows.mockResolvedValue({
      rows: [{ content_id: "j1" }, { content_id: null }, {}],
      total: 3,
    });

    const result = await findContentIdsBySearch(asDb(), "job", "analyst");

    expect(result.ids).toEqual(["j1"]);
  });

  it("marks the result capped when phase 1 fills the cap", async () => {
    db.listRows.mockResolvedValue({
      rows: Array.from({ length: 500 }, (_, i) => ({ content_id: `j${i}` })),
      total: 900,
    });

    const result = await findContentIdsBySearch(asDb(), "job", "a");

    expect(result.ids).toHaveLength(500);
    expect(result.capped).toBe(true);
  });

  it("returns empty rather than throwing when Appwrite rejects the search", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    db.listRows.mockRejectedValue(new Error("fulltext index missing"));

    const result = await findContentIdsBySearch(asDb(), "job", "analyst");

    expect(result).toEqual({ ids: [], capped: false });
    // The events search bug was invisible for months because a catch
    // returned [] silently. Every caught error must be logged.
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun run test --filter=web -- search-content`
Expected: FAIL — `Cannot find module './search-content'`

- [ ] **Step 3: Implement the helper**

Create `apps/web/src/lib/data/search-content.ts`:

```ts
import { Query } from "@repo/api";
import type { ContentTranslations } from "@repo/api/types/appwrite";
import { SEARCH_CANDIDATE_CAP } from "@/lib/list-params";
import type { Db } from "./queries";

export type SearchableContentType = "event" | "job" | "product";

export interface ContentSearchResult {
  /** True when the cap was filled, so callers must not claim an exact total. */
  capped: boolean;
  ids: string[];
}

const EMPTY: ContentSearchResult = { ids: [], capped: false };

/**
 * Phase 1 of the two-phase search: resolve a query to parent row ids.
 *
 * Appwrite fulltext cannot traverse a relationship — `Query.search` on
 * `translation_refs.title` is rejected outright — and `jobs.translations` is
 * `twoWay: false`, so jobs cannot be filtered from the translations side
 * either. Searching `content_translations` directly is the one shape that
 * works for all three surfaces, so all three use it.
 *
 * Callers pass the returned ids to `Query.equal("$id", ids)` on the parent
 * table alongside their own filters, which keeps `total` correct.
 */
export async function findContentIdsBySearch(
  db: Db,
  contentType: SearchableContentType,
  search: string,
  locale?: string
): Promise<ContentSearchResult> {
  const term = search.trim();
  if (!term) {
    return EMPTY;
  }

  const queries = [
    Query.or([Query.search("title", term), Query.search("description", term)]),
    Query.equal("content_type", contentType),
    Query.select(["content_id"]),
    Query.limit(SEARCH_CANDIDATE_CAP),
  ];

  if (locale) {
    queries.push(Query.equal("locale", locale));
  }

  try {
    const response = await db.listRows<ContentTranslations>(
      "app",
      "content_translations",
      queries
    );

    const ids: string[] = [];
    const seen = new Set<string>();
    for (const row of response.rows) {
      const id = row.content_id;
      // One content row has a translation per locale, so the same parent id
      // arrives twice whenever the search is not locale-scoped.
      if (id && !seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }

    return { ids, capped: response.rows.length >= SEARCH_CANDIDATE_CAP };
  } catch (error) {
    // Logged, never swallowed: `queryEvents` returning [] on a rejected
    // Query.search is exactly how the events search stayed broken in prod.
    console.error(
      `Content search failed (type=${contentType}, term=${term}):`,
      error
    );
    return EMPTY;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test --filter=web -- search-content`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
bun x ultracite fix
git add apps/web/src/lib/data/search-content.ts apps/web/src/lib/data/search-content.test.ts
git commit -m "feat(web): add two-phase content search helper

Appwrite fulltext cannot traverse a relationship, so searching
translation_refs.title is rejected. Resolve the term against
content_translations first, then filter the parent by the ids."
```

---

### Task 4: Load-more hook and button

**Files:**
- Create: `apps/web/src/lib/use-load-more.ts`
- Create: `apps/web/src/lib/use-load-more.test.tsx`
- Create: `apps/web/src/components/ui/load-more-button.tsx`

**Interfaces:**
- Consumes: `WebPaginatedResult` from `@/lib/list-params`.
- Produces:
  - `useLoadMore<T>({ initial, total, fetchPage }: { initial: T[]; total: number; fetchPage: (page: number) => Promise<{ rows: T[]; total: number }> }): { canLoadMore: boolean; error: boolean; isLoading: boolean; items: T[]; loadMore: () => void; total: number }`
  - `<LoadMoreButton canLoadMore isLoading error onLoadMore label loadingLabel retryLabel />`

**Reset semantics:** this hook does **not** watch `initial` for changes. Filter changes reset the list by remounting the client component via a `key` in the page (Tasks 6, 9, 11). A `useEffect` syncing `initial` into state is the classic source of stale-append bugs — appending page 2 of the *old* filter onto page 1 of the new one.

- [ ] **Step 1: Add the test dependencies if absent**

Check whether `@testing-library/react` is already available to web:

```bash
grep -n "@testing-library/react" apps/web/package.json package.json
```

If it is not listed, add it:

```bash
bun add -D @testing-library/react @testing-library/dom --filter=web
```

- [ ] **Step 2: Write the failing test**

Create `apps/web/src/lib/use-load-more.test.tsx`:

```tsx
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useLoadMore } from "./use-load-more";

const item = (id: string) => ({ id });

describe("useLoadMore", () => {
  it("starts with the server-rendered page and knows more remain", () => {
    const { result } = renderHook(() =>
      useLoadMore({
        initial: [item("a")],
        total: 3,
        fetchPage: vi.fn(),
      })
    );

    expect(result.current.items).toEqual([item("a")]);
    expect(result.current.canLoadMore).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });

  it("appends the next page rather than replacing the list", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValue({ rows: [item("b")], total: 2 });
    const { result } = renderHook(() =>
      useLoadMore({ initial: [item("a")], total: 2, fetchPage })
    );

    act(() => result.current.loadMore());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(fetchPage).toHaveBeenCalledWith(2);
    expect(result.current.items).toEqual([item("a"), item("b")]);
  });

  it("hides the control once every row is loaded", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValue({ rows: [item("b")], total: 2 });
    const { result } = renderHook(() =>
      useLoadMore({ initial: [item("a")], total: 2, fetchPage })
    );

    act(() => result.current.loadMore());

    await waitFor(() => expect(result.current.canLoadMore).toBe(false));
  });

  it("hides the control when the list is already complete", () => {
    const { result } = renderHook(() =>
      useLoadMore({ initial: [item("a")], total: 1, fetchPage: vi.fn() })
    );

    expect(result.current.canLoadMore).toBe(false);
  });

  it("adopts a total that shrank underneath us", async () => {
    // A row was unpublished between page 1 and page 2.
    const fetchPage = vi.fn().mockResolvedValue({ rows: [], total: 1 });
    const { result } = renderHook(() =>
      useLoadMore({ initial: [item("a")], total: 9, fetchPage })
    );

    act(() => result.current.loadMore());

    await waitFor(() => expect(result.current.canLoadMore).toBe(false));
    expect(result.current.total).toBe(1);
  });

  it("keeps loaded items on screen and offers a retry when a page fails", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const fetchPage = vi.fn().mockRejectedValue(new Error("network"));
    const { result } = renderHook(() =>
      useLoadMore({ initial: [item("a")], total: 5, fetchPage })
    );

    act(() => result.current.loadMore());

    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.items).toEqual([item("a")]);
    expect(result.current.canLoadMore).toBe(true);
    consoleError.mockRestore();
  });

  it("retries the same page after a failure, not the one after it", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const fetchPage = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ rows: [item("b")], total: 2 });
    const { result } = renderHook(() =>
      useLoadMore({ initial: [item("a")], total: 2, fetchPage })
    );

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.error).toBe(true));

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.items).toHaveLength(2));

    expect(fetchPage).toHaveBeenNthCalledWith(1, 2);
    expect(fetchPage).toHaveBeenNthCalledWith(2, 2);
    consoleError.mockRestore();
  });

  it("ignores a second click while a page is already in flight", async () => {
    let release: (v: { rows: never[]; total: number }) => void = () => undefined;
    const fetchPage = vi.fn(
      () =>
        new Promise<{ rows: never[]; total: number }>((resolve) => {
          release = resolve;
        })
    );
    const { result } = renderHook(() =>
      useLoadMore({ initial: [item("a")], total: 9, fetchPage })
    );

    act(() => result.current.loadMore());
    act(() => result.current.loadMore());

    expect(fetchPage).toHaveBeenCalledTimes(1);
    await act(async () => release({ rows: [], total: 9 }));
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `bun run test --filter=web -- use-load-more`
Expected: FAIL — `Cannot find module './use-load-more'`

- [ ] **Step 4: Add a jsdom environment for the component tests**

`apps/web/vitest.config.ts` sets `environment: "node"`, which has no DOM. Add a per-file override as **the very first line** of `use-load-more.test.tsx`, above every import — Vitest only reads the docblock at the top of the file:

```tsx
// @vitest-environment jsdom
```

Then ensure `jsdom` is available:

```bash
grep -n '"jsdom"' apps/web/package.json package.json || bun add -D jsdom --filter=web
```

- [ ] **Step 5: Implement the hook**

Create `apps/web/src/lib/use-load-more.ts`:

```ts
"use client";

import { useCallback, useRef, useState } from "react";
import { MAX_OFFSET } from "@repo/shared/utils/list-params";
import { WEB_PAGE_SIZE } from "./list-params";

interface UseLoadMoreArgs<T> {
  /** The server-rendered first page. */
  initial: T[];
  /** Appwrite's total for the filtered set, from the same render. */
  total: number;
  fetchPage: (page: number) => Promise<{ rows: T[]; total: number }>;
}

/**
 * Appends successive pages onto a server-rendered first page.
 *
 * Deliberately does NOT watch `initial`. A filter change re-renders the page
 * with new props, and the surface resets this hook by remounting the client
 * component with a new `key`. Syncing `initial` in an effect instead would
 * append page 2 of the previous filter onto page 1 of the new one.
 */
export function useLoadMore<T>({ initial, total, fetchPage }: UseLoadMoreArgs<T>) {
  const [items, setItems] = useState<T[]>(initial);
  const [knownTotal, setKnownTotal] = useState(total);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  // The page to request next. Held in a ref so a failed attempt retries the
  // same page instead of skipping it, and so a double click cannot advance it
  // twice before the first request resolves.
  const nextPage = useRef(2);
  const inFlight = useRef(false);

  const loadMore = useCallback(() => {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    setIsLoading(true);
    setError(false);

    fetchPage(nextPage.current)
      .then((result) => {
        setItems((current) => [...current, ...result.rows]);
        // The set can shrink under us — a row unpublished between pages.
        setKnownTotal(result.total);
        nextPage.current += 1;
      })
      .catch((cause) => {
        console.error("Failed to load more rows:", cause);
        setError(true);
      })
      .finally(() => {
        inFlight.current = false;
        setIsLoading(false);
      });
  }, [fetchPage]);

  // Appwrite rejects an offset past MAX_OFFSET, so a page beyond it must never
  // be offered even when rows remain.
  const withinOffsetCeiling = nextPage.current * WEB_PAGE_SIZE <= MAX_OFFSET;

  return {
    canLoadMore: items.length < knownTotal && withinOffsetCeiling,
    error,
    isLoading,
    items,
    loadMore,
    total: knownTotal,
  };
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `bun run test --filter=web -- use-load-more`
Expected: PASS (8 tests)

- [ ] **Step 7: Create the button**

Create `apps/web/src/components/ui/load-more-button.tsx`:

```tsx
"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Loader2 } from "lucide-react";

interface LoadMoreButtonProps {
  canLoadMore: boolean;
  error: boolean;
  isLoading: boolean;
  label: string;
  loadingLabel: string;
  onLoadMore: () => void;
  retryLabel: string;
}

/**
 * Shared "Load more" control for the public list grids.
 *
 * A failed page keeps the already-loaded rows on screen and turns the control
 * into a retry — never a blank grid.
 */
export function LoadMoreButton({
  canLoadMore,
  error,
  isLoading,
  label,
  loadingLabel,
  onLoadMore,
  retryLabel,
}: LoadMoreButtonProps) {
  if (!canLoadMore) {
    return null;
  }

  return (
    <div className="mt-12 flex flex-col items-center gap-3">
      {error && (
        <p className="text-muted-foreground text-sm" role="alert">
          {retryLabel}
        </p>
      )}
      <Button
        className="min-w-48"
        disabled={isLoading}
        onClick={onLoadMore}
        size="lg"
        variant="outline"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {loadingLabel}
          </>
        ) : (
          label
        )}
      </Button>
    </div>
  );
}
```

- [ ] **Step 8: Commit**

```bash
bun x ultracite fix
git add apps/web/src/lib/use-load-more.ts apps/web/src/lib/use-load-more.test.tsx \
        apps/web/src/components/ui/load-more-button.tsx apps/web/package.json
git commit -m "feat(web): add load-more hook and button

Appends pages onto the server-rendered first page. Resets by remount
rather than by syncing props in an effect, which would append the old
filter's page 2 onto the new filter's page 1."
```

---

### Task 5: Paginate the jobs action

**Files:**
- Modify: `packages/shared/recruitment.ts` (add `fetchRecruitmentListPage`)
- Modify: `apps/web/src/app/actions/jobs.ts:53-128`
- Create: `apps/web/src/app/actions/jobs-pagination.test.ts`

**Interfaces:**
- Consumes: `findContentIdsBySearch` (Task 3), `WEB_PAGE_SIZE` / `webOffset` / `emptyWebResult` / `WebPaginatedResult` (Task 1).
- Produces:
  - `fetchRecruitmentListPage(db: DbClient, queries: string[]): Promise<{ rows: RecruitmentVacancy[]; total: number }>`
  - `listJobs(params: { campus?: string | null; category?: string | null; department?: string | null; locale?: string; page?: number; search?: string; sort?: JobSort }): Promise<WebPaginatedResult<RecruitmentVacancy>>`
  - `listJobFacets(params: { campus?: string | null }): Promise<{ categories: UnitCategory[]; departments: [string, string][] }>`
  - `type JobSort = "deadline" | "newest"`

**The correctness fix in this task:** `_listJobs` currently fetches the 100 newest published jobs and *then* filters with `isRecruitmentVacancyOpen`. Only 28 of 253 published jobs are open, so any open vacancy outside that newest-100 window is invisible on the live site today. Moving the predicate into the query fixes that and is mandatory for pagination — a post-fetch filter makes `total` overcount.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/app/actions/jobs-pagination.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionDb = vi.hoisted(() => ({ listRows: vi.fn() }));

vi.mock("@repo/api/server", () => ({
  createSessionClient: vi.fn(async () => ({ db: sessionDb })),
  createAdminClient: vi.fn(async () => ({ db: sessionDb })),
}));

import { listJobs } from "./jobs";

const queriesOf = (call: number): string[] =>
  sessionDb.listRows.mock.calls[call][2].map(String);

describe("listJobs pagination", () => {
  beforeEach(() => {
    sessionDb.listRows.mockReset();
    sessionDb.listRows.mockResolvedValue({ rows: [], total: 0 });
  });

  it("filters open vacancies in the query, not after the fetch", async () => {
    await listJobs({ page: 1 });

    const serialized = queriesOf(0).join("|");
    expect(serialized).toContain("published");
    expect(serialized).toContain("application_deadline");
    // A post-fetch filter would make Appwrite's total overcount and leave
    // holes in every page slice.
    expect(serialized).toContain("or");
  });

  it("pages by 12 and offsets from the 1-based page", async () => {
    await listJobs({ page: 3 });

    const serialized = queriesOf(0).join("|");
    expect(serialized).toContain("12");
    expect(serialized).toContain("24");
  });

  it("reports Appwrite's total rather than the page length", async () => {
    sessionDb.listRows.mockResolvedValue({
      rows: [{ $id: "j1", translations: [], metadata: "{}" }],
      total: 28,
    });

    const result = await listJobs({ page: 1 });

    expect(result.total).toBe(28);
    expect(result.page).toBe(1);
    expect(result.size).toBe(12);
    expect(result.capped).toBe(false);
  });

  it("filters unit category through the department relationship", async () => {
    await listJobs({ category: "society" });

    // Verified working against the live instance: filter operators traverse
    // relationships even though ordering does not.
    expect(queriesOf(0).join("|")).toContain("department.type");
  });

  it("orders by deadline ascending when asked, newest first by default", async () => {
    await listJobs({ sort: "deadline" });
    expect(queriesOf(0).join("|")).toContain("application_deadline");

    sessionDb.listRows.mockClear();
    await listJobs({});
    expect(queriesOf(0).join("|")).toContain("$createdAt");
  });

  it("resolves a search to ids first, then filters jobs by them", async () => {
    sessionDb.listRows
      .mockResolvedValueOnce({ rows: [{ content_id: "j7" }], total: 1 })
      .mockResolvedValueOnce({ rows: [], total: 0 });

    await listJobs({ search: "analyst", locale: "en" });

    expect(sessionDb.listRows.mock.calls[0][1]).toBe("content_translations");
    expect(sessionDb.listRows.mock.calls[1][1]).toBe("jobs");
    expect(queriesOf(1).join("|")).toContain("j7");
  });

  it("short-circuits without a second query when the search matches nothing", async () => {
    sessionDb.listRows.mockResolvedValueOnce({ rows: [], total: 0 });

    const result = await listJobs({ search: "nothingmatchesthis" });

    // Issuing Query.equal("$id", []) would be meaningless and may throw.
    expect(sessionDb.listRows).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      rows: [],
      total: 0,
      page: 1,
      size: 12,
      capped: false,
    });
  });

  it("returns an empty result rather than throwing when Appwrite fails", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    sessionDb.listRows.mockRejectedValue(new Error("appwrite down"));

    const result = await listJobs({ page: 2 });

    expect(result.rows).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.page).toBe(2);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun run test --filter=web -- jobs-pagination`
Expected: FAIL — `listJobs` returns an array, so `result.total` is undefined.

- [ ] **Step 3: Add the paginating fetch to `@repo/shared`**

`fetchRecruitmentListRows` discards `response.total`. Add a sibling in `packages/shared/recruitment.ts`, directly below it (around line 273):

```ts
/**
 * Like `fetchRecruitmentListRows`, but keeps Appwrite's total.
 *
 * The public jobs list pages against this, so the count must be the one
 * Appwrite computed for the filtered set — never `rows.length`, which is only
 * ever the size of the current page.
 */
export async function fetchRecruitmentListPage(
  db: DbClient,
  queries: string[]
): Promise<{ rows: RecruitmentVacancy[]; total: number }> {
  const response = await db.listRows<Jobs>("app", "jobs", [
    Query.select([...JOB_SELECT]),
    ...queries,
  ]);
  return {
    rows: response.rows.map((job) => buildRecruitmentVacancy(job)),
    total: response.total,
  };
}
```

- [ ] **Step 4: Rewrite the jobs action**

Replace `apps/web/src/app/actions/jobs.ts` lines 53–128 (from the `// ---------- public reads` comment through the end of `listJobs`) with:

```ts
// ---------- public reads (session/guest client — enforces row permissions) ----------

export type JobSort = "deadline" | "newest";

/**
 * Open vacancies, as an Appwrite query rather than a post-fetch filter.
 *
 * `isRecruitmentVacancyOpen` used to run over an already-fetched window, which
 * meant any open vacancy outside the newest 100 rows never reached the page —
 * only 28 of 253 published jobs are open. It also made `total` overcount, which
 * pagination cannot tolerate. The helper's "unparseable date -> keep" branch is
 * unreachable for a datetime column, so this is equivalent.
 */
function openVacancyQueries(): string[] {
  return [
    Query.equal("status", JobsStatus.PUBLISHED),
    Query.or([
      Query.isNull("application_deadline"),
      Query.greaterThanEqual("application_deadline", new Date().toISOString()),
    ]),
  ];
}

// Primitive arguments only: React cache() keys on argument identity
// (Object.is), so an options object allocated fresh at each call site would
// never hit the memo. See WEB_APP_APPWRITE_INCIDENT_AUDIT.md (F-6b).
const _listJobs = cache(
  async (
    campus: string | null,
    department: string | null,
    category: string | null,
    locale: string,
    page: number,
    search: string,
    sort: JobSort
  ): Promise<WebPaginatedResult<RecruitmentVacancy>> => {
    try {
      const { db } = await createSessionClient();

      let capped = false;
      const idQueries: string[] = [];
      if (search.trim()) {
        const found = await findContentIdsBySearch(db, "job", search, locale);
        if (found.ids.length === 0) {
          return emptyWebResult<RecruitmentVacancy>(page);
        }
        capped = found.capped;
        idQueries.push(Query.equal("$id", found.ids));
      }

      const queries: string[] = [
        ...openVacancyQueries(),
        ...idQueries,
        sort === "deadline"
          ? Query.orderAsc("application_deadline")
          : Query.orderDesc("$createdAt"),
        Query.limit(WEB_PAGE_SIZE),
        Query.offset(webOffset(page)),
      ];

      const campusScope = campusScopeIds(campus);
      if (campusScope) {
        queries.push(Query.equal("campus_id", campusScope));
      }
      if (department) {
        queries.push(Query.equal("department_id", department));
      }
      if (category) {
        // Filter operators traverse relationships (verified); ordering does
        // not, which is why there is no A-Z sort.
        queries.push(Query.equal("department.type", category));
      }

      const { rows, total } = await fetchRecruitmentListPage(db, queries);

      return {
        rows: rows.map((v) => localizeVacancy(v, locale)),
        total,
        page,
        size: WEB_PAGE_SIZE,
        capped,
      };
    } catch (error) {
      console.error("listJobs failed:", error);
      return emptyWebResult<RecruitmentVacancy>(page);
    }
  }
);

// biome-ignore lint/suspicious/useAwait: async required by "use server" — returns cached promise
export async function listJobs(params: {
  campus?: string | null;
  category?: string | null;
  department?: string | null;
  locale?: string;
  page?: number;
  search?: string;
  sort?: JobSort;
}): Promise<WebPaginatedResult<RecruitmentVacancy>> {
  return _listJobs(
    params.campus ?? null,
    params.department ?? null,
    params.category ?? null,
    params.locale ?? "en",
    params.page ?? 1,
    params.search ?? "",
    params.sort ?? "newest"
  );
}

/**
 * Filter options drawn from the whole filtered set, not the current page.
 *
 * Building the dropdowns from page 1 would offer twelve rows' worth of
 * options. Two cheap projections over the open set (28 rows today) give the
 * true lists, and the department count doubles as the hero's stat.
 */
export async function listJobFacets(params: {
  campus?: string | null;
}): Promise<{ categories: UnitCategory[]; departments: [string, string][] }> {
  try {
    const { db } = await createSessionClient();
    const queries = [
      ...openVacancyQueries(),
      Query.select([
        "$id",
        "department_id",
        "department.$id",
        "department.Name",
        "department.type",
      ]),
      Query.limit(300),
    ];
    const campusScope = campusScopeIds(params.campus ?? null);
    if (campusScope) {
      queries.push(Query.equal("campus_id", campusScope));
    }

    const response = await db.listRows<Jobs>("app", "jobs", queries);

    const departments = new Map<string, string>();
    const categories = new Set<UnitCategory>();
    for (const job of response.rows) {
      const dept = job.department as
        | { $id?: string; Name?: string; type?: string | null }
        | null
        | undefined;
      if (job.department_id && dept?.Name) {
        departments.set(job.department_id, dept.Name);
      }
      const parsed = parseUnitCategory(dept?.type);
      if (parsed) {
        categories.add(parsed);
      }
    }

    return {
      // Ordered by the canonical list so the chips never reshuffle between
      // renders; only categories actually present are offered.
      categories: UNIT_CATEGORIES.filter((c) => categories.has(c)),
      departments: [...departments.entries()],
    };
  } catch (error) {
    console.error("listJobFacets failed:", error);
    return { categories: [], departments: [] };
  }
}
```

- [ ] **Step 5: Fix the imports at the top of `jobs.ts`**

Add to the existing import block:

```ts
import {
  parseUnitCategory,
  UNIT_CATEGORIES,
  type UnitCategory,
} from "@repo/shared/utils/unit-categories";
import { fetchRecruitmentListPage } from "@repo/shared/recruitment";
import { findContentIdsBySearch } from "@/lib/data/search-content";
import {
  emptyWebResult,
  WEB_PAGE_SIZE,
  type WebPaginatedResult,
  webOffset,
} from "@/lib/list-params";
```

Remove `fetchRecruitmentListRows` and `isRecruitmentVacancyOpen` from the imports **only if** no other function in the file still uses them — `getJobBySlug` uses `isRecruitmentVacancyOpen`, so that one stays.

- [ ] **Step 6: Run the test to verify it passes**

Run: `bun run test --filter=web -- jobs-pagination`
Expected: PASS (8 tests)

- [ ] **Step 7: Update the two first-N call sites so the repo type-checks**

`listJobs` now returns an object. Update both consumers to read `.rows`:

- `apps/web/src/app/(public)/campus/page.tsx:41` — `listJobs({ campus, status: "published", limit: 10, locale })` becomes `listJobs({ campus, locale })` and the consumer reads `.rows`. Drop `status` and `limit`: status is implied by `openVacancyQueries`, and the page size is now fixed. If the page needs exactly 10, slice `.rows` at the call site.
- `apps/web/src/app/(public)/students/page.tsx:25` — same change.

Both inherit the query-level open filter, which is a fix: asking for 10 open jobs currently returns however many of the 10 newest *published* jobs happen to be open.

- [ ] **Step 8: Type-check**

Run: `bun run check-types`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
bun x ultracite fix
git add packages/shared/recruitment.ts apps/web/src/app/actions/jobs.ts \
        apps/web/src/app/actions/jobs-pagination.test.ts \
        "apps/web/src/app/(public)/campus/page.tsx" \
        "apps/web/src/app/(public)/students/page.tsx"
git commit -m "feat(web): paginate listJobs against Appwrite

Moves the open-vacancy predicate into the query. It used to run over
an already-fetched window of 100, so open vacancies outside the newest
100 of 253 published jobs never reached the page. Adds server-side
search, unit-category filtering via department.type, and a facet query
for the dropdowns."
```

---

### Task 6: Rewire the jobs page and client

**Files:**
- Modify: `apps/web/src/app/(public)/jobs/page.tsx`
- Modify: `apps/web/src/components/jobs/jobs-list-client.tsx`
- Modify: `apps/web/src/components/jobs/jobs-hero.tsx`
- Modify: `packages/i18n/messages/en/jobs.json`, `packages/i18n/messages/no/jobs.json`

**Interfaces:**
- Consumes: `listJobs`, `listJobFacets`, `JobSort` (Task 5); `useLoadMore` (Task 4); `LoadMoreButton` (Task 4); `useListParams` / `useUrlSearch` from `@repo/ui/hooks/use-list-params` (Task 2); `parseWebListParams` (Task 1).
- Produces: nothing consumed by later tasks.

**Removals in this task** (all `metadata`-backed, unqueryable — see the spec's "Dropped from the UI"): the **paid** filter and its button, the **employment type** filter, the **A–Z** sort option, and the **`paidPositions`** hero stat. The unit-category filter **stays** and becomes server-side.

- [ ] **Step 1: Update the i18n messages**

In `packages/i18n/messages/en/jobs.json`, inside `filters`:
- **Delete** `"paidOnly"`.
- **Change** `"searchPlaceholder"` to `"Search positions by title or description..."` — server-side search covers title and description only. Company lives in `metadata` (unqueryable) and `departments.Name` has no fulltext index, so the old promise of "department" matching is no longer kept.
- **Keep** `academicAssociations`, `societies`, `staffFunctions`, `projects`, `national`, `other` — still the label source via `UNIT_CATEGORY_MESSAGE_KEYS`.
- **Add** `"showingFirstResults": "Showing the first {count} matches — refine your search"`.
- **Add** `"loadMore": "Load more positions"`, `"loading": "Loading..."`, `"loadMoreFailed": "Could not load more positions."`.

Mirror every one of these in `packages/i18n/messages/no/jobs.json` with Norwegian copy. A missing key surfaces as a visible `next-intl` error, not a silent blank.

- [ ] **Step 2: Rewrite the page**

Replace `apps/web/src/app/(public)/jobs/page.tsx` with:

```tsx
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Suspense } from "react";
import { type JobSort, listJobFacets, listJobs } from "@/app/actions/jobs";
import { JobsHero } from "@/components/jobs/jobs-hero";
import { JobsListClient } from "@/components/jobs/jobs-list-client";
import { getUserPreferences } from "@/lib/auth-utils";
import { parseWebListParams } from "@/lib/list-params";
import type { ListSearchParams } from "@repo/shared/utils/list-params";

export const metadata = {
  title: "Join Our Team | BISO",
  description: "Discover open positions at BISO and apply today.",
};

interface JobsPageProps {
  searchParams: Promise<ListSearchParams>;
}

const asSort = (value: string | undefined): JobSort =>
  value === "deadline" ? "deadline" : "newest";

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

async function JobsList({
  campus,
  category,
  department,
  locale,
  page,
  search,
  sort,
}: {
  campus: string | null;
  category: string | null;
  department: string | null;
  locale: string;
  page: number;
  search: string;
  sort: JobSort;
}) {
  const [result, facets] = await Promise.all([
    listJobs({ campus, category, department, locale, page, search, sort }),
    listJobFacets({ campus }),
  ]);

  return (
    <>
      <JobsHero
        departmentCount={facets.departments.length}
        totalPositions={result.total}
      />
      <JobsListClient
        // Remounts on any filter change so the load-more list resets to the
        // new page 1 instead of appending onto the previous filter's rows.
        key={`${campus}|${category}|${department}|${search}|${sort}`}
        capped={result.capped}
        categories={facets.categories}
        departments={facets.departments}
        initialJobs={result.rows}
        initialSearch={search}
        locale={locale}
        selectedCategory={category}
        selectedDepartment={department}
        sort={sort}
        total={result.total}
      />
    </>
  );
}

function JobsListSkeleton() {
  return (
    <>
      <div className="relative h-[60vh]">
        <Skeleton className="h-full w-full" />
      </div>
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-2">
          {[...new Array(6)].map((_, i) => (
            <div className="space-y-4" key={i}>
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const [sp, prefs] = await Promise.all([searchParams, getUserPreferences()]);
  const { page, q } = parseWebListParams(sp);

  // URL param wins, then user prefs, then "all"
  const campus = first(sp.campus) ?? prefs?.campusId ?? null;
  const locale = prefs?.locale ?? "en";

  return (
    <div className="min-h-screen bg-linear-to-b from-section to-background">
      <Suspense
        fallback={<JobsListSkeleton />}
        key={`${campus}|${q}|${page}`}
      >
        <JobsList
          campus={campus}
          category={first(sp.category) ?? null}
          department={first(sp.department) ?? null}
          locale={locale}
          page={page}
          search={q}
          sort={asSort(first(sp.sort))}
        />
      </Suspense>
    </div>
  );
}
```

- [ ] **Step 3: Rewrite the client component**

In `apps/web/src/components/jobs/jobs-list-client.tsx`:

1. Replace the props interface:

```tsx
interface JobsListClientProps {
  capped: boolean;
  categories: UnitCategory[];
  departments: [string, string][];
  initialJobs: RecruitmentVacancy[];
  initialSearch: string;
  locale: string;
  selectedCategory: string | null;
  selectedDepartment: string | null;
  sort: JobSort;
  total: number;
}
```

`JobSort` is imported from `@/app/actions/jobs` (Task 5) — do not redeclare a local `SortOption` union, or the page and the client will drift apart.

2. Delete `sortJobs`, `vacancyCategory`, `filteredJobs`, the `employmentTypes` / `categories` / `departments` `useMemo` blocks, and the `showPaidOnly` / `employmentType` state. All of that is now server-side or dropped.

3. Reduce `SORT_OPTIONS` to two — A–Z is impossible, since `Query.orderAsc("department.Name")` is rejected and titles live on a related table:

```tsx
const SORT_OPTIONS = [
  { label: "Newest first", value: "newest" },
  { label: "Deadline (soonest)", value: "deadline" },
] as const;
```

4. Replace the local state and `updateUrl` with the shared hook:

```tsx
const { setParams } = useListParams();
const [searchValue, setSearchValue] = useUrlSearch("q");

const { canLoadMore, error, isLoading, items, loadMore } = useLoadMore({
  initial: initialJobs,
  total,
  fetchPage: useCallback(
    (page: number) =>
      listJobs({
        campus: activeCampusId ?? null,
        category: selectedCategory,
        department: selectedDepartment,
        locale,
        page,
        search: initialSearch,
        sort,
      }),
    [
      activeCampusId,
      selectedCategory,
      selectedDepartment,
      locale,
      initialSearch,
      sort,
    ]
  ),
});
```

Import `listJobs` directly — a client component may call a server action, which `shop-list-client.tsx` already does today.

5. Keep the campus-sync `useEffect` but route it through `setParams` instead of `router.replace`, so it merges with an in-flight search write:

```tsx
useEffect(() => {
  if (activeCampusId === undefined) {
    return; // still loading
  }
  const current = new URLSearchParams(window.location.search).get("campus");
  const next = activeCampusId ?? "all";
  if (current !== next && !(current === null && next === "all")) {
    setParams({ campus: next === "all" ? null : next });
  }
}, [activeCampusId, setParams]);
```

6. Every filter control now writes the URL and lets the server re-render. Department:

```tsx
onValueChange={(v) => setParams({ department: v === "all" ? null : v })}
value={selectedDepartment ?? "all"}
```

Category and sort follow the same shape, with `sort` clearing at `"newest"`.

7. Render `items` instead of `filteredJobs`, drive the count line from `total`, and add the button below the grid:

```tsx
<p className="text-center text-muted-foreground text-sm">
  {capped
    ? t("filters.showingFirstResults", { count: total })
    : t("filters.showingResults", { count: total })}
</p>
```

```tsx
<LoadMoreButton
  canLoadMore={canLoadMore}
  error={error}
  isLoading={isLoading}
  label={t("filters.loadMore")}
  loadingLabel={t("filters.loading")}
  onLoadMore={loadMore}
  retryLabel={t("filters.loadMoreFailed")}
/>
```

8. Change the grid's `key` so it no longer re-keys on every keystroke — the whole grid currently remounts on each search character. Use a stable key and let appended items animate individually:

```tsx
key="jobs-grid"
```

9. `hasActiveFilters` becomes:

```tsx
const hasActiveFilters =
  searchValue.length > 0 ||
  selectedDepartment !== null ||
  selectedCategory !== null ||
  sort !== "newest";
```

and `clearAllFilters` becomes a single write:

```tsx
function clearAllFilters() {
  setSearchValue("");
  setParams({ q: null, category: null, department: null, sort: null });
}
```

- [ ] **Step 4: Drop the `paidPositions` stat from the hero**

In `apps/web/src/components/jobs/jobs-hero.tsx`, remove the `paidPositions` prop and its stat block. The hero goes from three stats to two (`totalPositions`, `departmentCount`); rebalance the flex/grid so two tiles are centred rather than leaving a gap.

- [ ] **Step 5: Verify the app builds and types**

Run: `bun run check-types && bun run lint --filter=web`
Expected: no errors. Any "declared but never read" error names a leftover from the deleted client-side filtering — delete it rather than suppressing it.

- [ ] **Step 6: Verify by hand against the live data**

```bash
bun run dev --filter=web
```

Check at `http://localhost:3000/jobs`:
- The grid shows 12 cards and a "Load more" button; the count line reports the true total (28 today, not 12).
- "Load more" appends a second page without replacing the first.
- Typing in search updates the URL after ~300 ms and resets to page 1.
- Changing department or sort resets the list to page 1 rather than appending.
- The unit-category dropdown renders **no options** until the backfill plan runs — this is correct, not a bug. `departments.type` is null for all 280 rows today, so the facet query legitimately finds none.

- [ ] **Step 7: Commit**

```bash
bun x ultracite fix
git add "apps/web/src/app/(public)/jobs/page.tsx" \
        apps/web/src/components/jobs/jobs-list-client.tsx \
        apps/web/src/components/jobs/jobs-hero.tsx \
        packages/i18n/messages/en/jobs.json packages/i18n/messages/no/jobs.json
git commit -m "feat(web): drive the jobs list from the server

Search, department, unit category and sort now live in the URL and
resolve to Appwrite queries. Drops the paid and employment-type
filters and the A-Z sort, which cannot be expressed as queries."
```

---

### Task 7: Fix the events category to read the real column

**Files:**
- Modify: `apps/web/src/lib/types/event.ts`
- Modify: `apps/web/src/components/events/event-card.tsx:148`
- Modify: `apps/web/src/components/events/event-hero.tsx:38`
- Modify: `apps/web/src/components/events/event-detail-modal.tsx:164`
- Modify: `apps/web/src/components/events/event-info-cards.tsx:123`
- Modify: `apps/web/src/components/home/events-section.tsx:54`
- Modify: `packages/i18n/messages/en/events.json`, `packages/i18n/messages/no/events.json`
- Create: `apps/web/src/lib/types/event-category.test.ts`

**Interfaces:**
- Consumes: `EventsCategory` from `@repo/api/types/appwrite`.
- Produces: `resolveEventCategory(event: { category?: EventsCategory | null }): EventsCategory | null`, `EVENT_CATEGORY_MESSAGE_KEYS: Record<EventsCategory, string>`.

**The bug:** the admin editor writes the real `events.category` enum column (`_actions/events.ts:474`) but the web reads `metadata.category` through `getEventCategory()`, which returns `"Social"` whenever the field is absent. It is absent on every row — so **every event on the live site is labelled "Social"**, and the category filter is decorative. All 3 published events have the column set.

This task lands before Task 8 so the category filter has real values to query.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/types/event-category.test.ts`:

```ts
import { EventsCategory } from "@repo/api/types/appwrite";
import { describe, expect, it } from "vitest";
import {
  EVENT_CATEGORY_MESSAGE_KEYS,
  resolveEventCategory,
} from "./event";

describe("resolveEventCategory", () => {
  it("reads the real column", () => {
    expect(resolveEventCategory({ category: EventsCategory.CAREER })).toBe(
      "career"
    );
  });

  it("returns null for an uncategorised event instead of defaulting", () => {
    // The old getEventCategory() defaulted to "Social", which is why every
    // event on the live site rendered as Social.
    expect(resolveEventCategory({ category: null })).toBeNull();
    expect(resolveEventCategory({})).toBeNull();
  });

  it("has a message key for every enum value", () => {
    for (const value of Object.values(EventsCategory)) {
      expect(EVENT_CATEGORY_MESSAGE_KEYS[value]).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun run test --filter=web -- event-category`
Expected: FAIL — `resolveEventCategory is not exported`

- [ ] **Step 3: Replace the metadata-based helper**

In `apps/web/src/lib/types/event.ts`, delete `eventCategories`, `EventCategory` and `getEventCategory`, and add:

```ts
import { EventsCategory } from "@repo/api/types/appwrite";

/**
 * The event's category, from the real `events.category` column.
 *
 * The admin editor writes this column; the web used to read
 * `metadata.category` and fall back to "Social" when absent — which it always
 * was, so every event rendered as Social. Returns null rather than defaulting,
 * so an uncategorised event shows no badge instead of a wrong one.
 */
export function resolveEventCategory(event: {
  category?: EventsCategory | null;
}): EventsCategory | null {
  return event.category ?? null;
}

/** i18n key under the `events.filters` namespace, per enum value. */
export const EVENT_CATEGORY_MESSAGE_KEYS: Record<EventsCategory, string> = {
  [EventsCategory.SOCIAL]: "social",
  [EventsCategory.CAREER]: "career",
  [EventsCategory.WORKSHOP]: "workshop",
  [EventsCategory.TALK]: "talk",
  [EventsCategory.PARTY]: "party",
  [EventsCategory.SPORT]: "sport",
  [EventsCategory.ACADEMIC]: "academic",
  [EventsCategory.TRIP]: "trip",
};
```

Leave `parseEventMetadata` in place — other fields still come from `metadata`. Remove only `category?: string` from the `EventMetadata` interface once no reader remains.

- [ ] **Step 4: Update all five call sites**

In each of `event-card.tsx:148`, `event-hero.tsx:38`, `event-detail-modal.tsx:164` and `event-info-cards.tsx:123`, replace:

```tsx
const category = getEventCategory(metadata);
```

with:

```tsx
const category = resolveEventCategory(event);
```

and guard the badge so an uncategorised event renders nothing rather than a wrong label:

```tsx
{category && <Badge>{t(`filters.${EVENT_CATEGORY_MESSAGE_KEYS[category]}`)}</Badge>}
```

In `home/events-section.tsx:54`, replace `return metadata.category as string;` with `return event.category ?? null;` and handle the null at its call site.

- [ ] **Step 5: Replace the i18n category keys**

In `packages/i18n/messages/en/events.json`, inside `filters`, **delete** `Social`, `Career`, `Academic`, `Sports`, `Culture` and **add** the eight real values:

```json
"social": "Social",
"career": "Career",
"workshop": "Workshop",
"talk": "Talk",
"party": "Party",
"sport": "Sport",
"academic": "Academic",
"trip": "Trip",
```

Mirror in `no/events.json` with Norwegian copy. `Culture` has no enum equivalent and is removed outright.

- [ ] **Step 6: Run the test and type-check**

Run: `bun run test --filter=web -- event-category && bun run check-types`
Expected: PASS, no type errors. Any error naming `getEventCategory` is a call site missed in Step 4.

- [ ] **Step 7: Commit**

```bash
bun x ultracite fix
git add apps/web/src/lib/types/event.ts apps/web/src/lib/types/event-category.test.ts \
        apps/web/src/components/events/ apps/web/src/components/home/events-section.tsx \
        packages/i18n/messages/en/events.json packages/i18n/messages/no/events.json
git commit -m "fix(web): read the real events.category column

Admin writes events.category; web read metadata.category and defaulted
to Social when absent — which it always was, so every event on the site
rendered as Social. Uncategorised events now show no badge rather than
a wrong one."
```

---

### Task 8: Paginate the events query

**Files:**
- Modify: `apps/web/src/lib/data/queries.ts:127-191`
- Modify: `apps/web/src/app/actions/events.ts:23-32`
- Create: `apps/web/src/app/actions/events-pagination.test.ts`
- Modify: `apps/web/src/lib/data/nav-featured.ts:84`, `apps/web/src/lib/data/public-content.ts:67`
- Modify: `apps/web/src/app/(public)/page.tsx:57`, `apps/web/src/app/(public)/campus/page.tsx:40`, `apps/web/src/app/(public)/students/page.tsx:24`

**Interfaces:**
- Consumes: `findContentIdsBySearch` (Task 3), web list-params (Task 1).
- Produces: `queryEvents(db, params): Promise<{ capped: boolean; rows: Events[]; total: number }>`, `listEvents(params): Promise<WebPaginatedResult<Events>>` where params gains `category?: string | null`, `isMember?: boolean`, `page?: number`.

**Two bugs fixed here:** `queryEvents:179` calls `Query.search("translation_refs.title", …)`, which Appwrite **rejects**; `listEvents`'s catch swallows it and returns `[]`, so **searching events on the live site returns nothing**. And `isEventUpcoming` runs after the fetch, which pagination cannot tolerate.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/app/actions/events-pagination.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionDb = vi.hoisted(() => ({ listRows: vi.fn() }));

vi.mock("@repo/api/server", () => ({
  createSessionClient: vi.fn(async () => ({ db: sessionDb })),
}));

import { listEvents } from "./events";

const queriesOf = (call: number): string[] =>
  sessionDb.listRows.mock.calls[call][2].map(String);

describe("listEvents pagination", () => {
  beforeEach(() => {
    sessionDb.listRows.mockReset();
    sessionDb.listRows.mockResolvedValue({ rows: [], total: 0 });
  });

  it("expresses 'not finished yet' as a query, keeping undated rows", async () => {
    await listEvents({ upcomingOnly: true });

    const serialized = queriesOf(0).join("|");
    expect(serialized).toContain("end_date");
    expect(serialized).toContain("start_date");
    // Rows with neither date must survive, so the or() needs an isNull arm.
    expect(serialized).toContain("isNull");
  });

  it("hides member-only events from non-members in the query", async () => {
    await listEvents({ isMember: false });

    const serialized = queriesOf(0).join("|");
    expect(serialized).toContain("member_only");
  });

  it("does not filter member_only for a member", async () => {
    await listEvents({ isMember: true });

    expect(queriesOf(0).join("|")).not.toContain("member_only");
  });

  it("shows only collections and standalone events", async () => {
    await listEvents({});

    const serialized = queriesOf(0).join("|");
    expect(serialized).toContain("is_collection");
    expect(serialized).toContain("collection_id");
  });

  it("filters by the real category column", async () => {
    await listEvents({ category: "career" });

    expect(queriesOf(0).join("|")).toContain("career");
  });

  it("searches via content_translations, never through the relationship", async () => {
    sessionDb.listRows
      .mockResolvedValueOnce({ rows: [{ content_id: "e1" }], total: 1 })
      .mockResolvedValueOnce({ rows: [], total: 0 });

    await listEvents({ search: "gala", locale: "en" });

    expect(sessionDb.listRows.mock.calls[0][1]).toBe("content_translations");
    // The live bug: Query.search on translation_refs.title is rejected by
    // Appwrite and the catch swallowed it, so search returned nothing.
    expect(queriesOf(1).join("|")).not.toContain("translation_refs.title");
    expect(queriesOf(1).join("|")).toContain("e1");
  });

  it("reports Appwrite's total, not the page length", async () => {
    sessionDb.listRows.mockResolvedValue({
      rows: [{ $id: "e1", translation_refs: [] }],
      total: 3,
    });

    const result = await listEvents({ page: 1 });

    expect(result.total).toBe(3);
    expect(result.size).toBe(12);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun run test --filter=web -- events-pagination`
Expected: FAIL — `listEvents` returns an array.

- [ ] **Step 3: Rewrite `queryEvents`**

Replace `apps/web/src/lib/data/queries.ts` lines 127–191 with:

```ts
/**
 * "Has not finished yet", as a query rather than a post-fetch filter.
 *
 * Prefers `end_date`, falls back to `start_date`, and keeps rows with neither
 * (both columns are optional). Appwrite allows one level of `and` nested in
 * `or`, which is what makes the fallback expressible — verified against the
 * live instance.
 */
function upcomingQueries(nowIso: string): string[] {
  return [
    Query.or([
      Query.greaterThanEqual("end_date", nowIso),
      Query.and([
        Query.isNull("end_date"),
        Query.greaterThanEqual("start_date", nowIso),
      ]),
      Query.and([Query.isNull("end_date"), Query.isNull("start_date")]),
    ]),
  ];
}

export async function queryEvents(
  db: Db,
  params: ListEventsQuery = {}
): Promise<{ capped: boolean; rows: Events[]; total: number }> {
  const {
    campus,
    category,
    isMember = false,
    limit = WEB_PAGE_SIZE,
    locale,
    offset = 0,
    search,
    status = "published",
    upcomingOnly = false,
  } = params;

  const queries = [Query.select([...EVENT_SELECT])];

  if (search?.trim()) {
    const found = await findContentIdsBySearch(db, "event", search, locale);
    if (found.ids.length === 0) {
      return { rows: [], total: 0, capped: false };
    }
    queries.push(Query.equal("$id", found.ids));
  }

  if (upcomingOnly) {
    queries.push(...upcomingQueries(new Date().toISOString()));
    queries.push(Query.orderAsc("start_date"));
  } else {
    queries.push(Query.orderDesc("$createdAt"));
  }

  if (locale) {
    queries.push(
      Query.equal("translation_refs.locale", locale as ContentTranslationsLocale)
    );
  }

  if (status !== "all") {
    queries.push(Query.equal("status", status));
  }

  const campusScope = campusScopeIds(campus);
  if (campusScope) {
    queries.push(Query.equal("campus_id", campusScope));
  }

  if (category) {
    queries.push(Query.equal("category", category));
  }

  if (!isMember) {
    // Was a client-side filter, which pagination cannot tolerate: dropping
    // rows after the fetch makes `total` overcount and leaves page holes.
    queries.push(
      Query.or([
        Query.equal("member_only", false),
        Query.isNull("member_only"),
      ])
    );
  }

  // Collections and standalone events only — never an item inside a
  // collection. Also formerly client-side. The empty-string arm is defensive:
  // every current row has collection_id NULL, but the admin editor may write "".
  queries.push(
    Query.or([
      Query.equal("is_collection", true),
      Query.isNull("collection_id"),
      Query.equal("collection_id", ""),
    ])
  );

  queries.push(Query.limit(limit), Query.offset(offset));

  const response = await db.listRows<Events>("app", "events", queries);

  return {
    rows: response.rows.map((event) => filterTranslationRefs(event, locale)),
    total: response.total,
    capped: false,
  };
}
```

Extend `ListEventsQuery` with `category?: string | null`, `isMember?: boolean`, `offset?: number`. Delete `isEventUpcoming` and `UPCOMING_PREFILTER_DAYS` once no caller remains — check with `grep -rn "isEventUpcoming" apps/ packages/` and remove its test if it has a dedicated one.

Add the imports `findContentIdsBySearch` from `./search-content` and `WEB_PAGE_SIZE` from `@/lib/list-params`.

- [ ] **Step 4: Update `listEvents`**

In `apps/web/src/app/actions/events.ts`, replace the body of `listEvents`:

```ts
export async function listEvents(
  params: ListEventsParams = {}
): Promise<WebPaginatedResult<Events>> {
  const page = params.page ?? 1;
  try {
    const { db } = await createSessionClient();
    const { rows, total, capped } = await queryEvents(db, {
      ...params,
      limit: WEB_PAGE_SIZE,
      offset: webOffset(page),
    });
    return { rows, total, page, size: WEB_PAGE_SIZE, capped };
  } catch (error) {
    // Logged with context: this catch returning [] is exactly how the
    // rejected Query.search stayed invisible in production.
    console.error("Error fetching events:", error);
    return emptyWebResult<Events>(page);
  }
}
```

Extend `ListEventsParams` with `category?: string | null`, `isMember?: boolean`, `page?: number`.

- [ ] **Step 5: Update the five first-N call sites**

`queryEvents` and `listEvents` now return objects. These consumers are **not** becoming paginated surfaces — they read `.rows` and are otherwise untouched:

- `apps/web/src/lib/data/nav-featured.ts:84` — `queryEvents(db, {...})` → destructure `.rows`
- `apps/web/src/lib/data/public-content.ts:67` — same
- `apps/web/src/app/(public)/page.tsx:57` — `listEvents({...})` → `.rows`
- `apps/web/src/app/(public)/campus/page.tsx:40` — `.rows`; drop `limit: 10` and slice if exactly 10 are needed
- `apps/web/src/app/(public)/students/page.tsx:24` — `.rows`; same for `limit: 24`

- [ ] **Step 6: Run the test and type-check**

Run: `bun run test --filter=web -- events-pagination && bun run check-types`
Expected: PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
bun x ultracite fix
git add apps/web/src/lib/data/queries.ts apps/web/src/app/actions/events.ts \
        apps/web/src/app/actions/events-pagination.test.ts \
        apps/web/src/lib/data/nav-featured.ts apps/web/src/lib/data/public-content.ts \
        "apps/web/src/app/(public)/page.tsx" "apps/web/src/app/(public)/campus/page.tsx" \
        "apps/web/src/app/(public)/students/page.tsx"
git commit -m "feat(web): paginate events and fix the broken search

Query.search cannot traverse a relationship, so the search on
translation_refs.title was rejected and swallowed by the catch —
searching events returned nothing on the live site. Moves the upcoming,
member-only and collection filters into the query."
```

---

### Task 9: Rewire the events page and client

**Files:**
- Modify: `apps/web/src/app/(public)/events/page.tsx`
- Modify: `apps/web/src/components/events/events-list-client.tsx`
- Modify: `packages/i18n/messages/en/events.json`, `packages/i18n/messages/no/events.json`

**Interfaces:**
- Consumes: `listEvents` (Task 8), `resolveEventCategory` / `EVENT_CATEGORY_MESSAGE_KEYS` (Task 7), `useLoadMore` / `LoadMoreButton` (Task 4), `useListParams` / `useUrlSearch` (Task 2).
- Produces: nothing consumed later.

- [ ] **Step 1: Add the load-more i18n keys**

Add to `filters` in both `en/events.json` and `no/events.json`:

```json
"loadMore": "Load more events",
"loading": "Loading...",
"loadMoreFailed": "Could not load more events.",
"showingFirstResults": "Showing the first {count} matches — refine your search",
```

- [ ] **Step 2: Rewrite the page**

`apps/web/src/app/(public)/events/page.tsx` follows the same shape as the jobs page in Task 6: read `searchParams`, call `parseWebListParams`, resolve campus from prefs, call `listEvents` with `page`, `search`, `category`, `campus`, `isMember`, and pass a `key` to the client built from the filter state.

Two changes beyond the jobs shape: `getMembershipStatus()` moves up into the page component (the query needs `isMember`), and the `EVENTS_FETCH_LIMIT = 200` constant is deleted — the fetch is now one page.

```tsx
export default async function EventsPage({ searchParams }: EventsPageProps) {
  const [sp, locale, prefs, membership] = await Promise.all([
    searchParams,
    getLocale(),
    getUserPreferences(),
    getMembershipStatus(),
  ]);
  const { page, q } = parseWebListParams(sp);
  const campus = first(sp.campus) ?? prefs?.campusId ?? "all";
  const category = first(sp.category) ?? null;

  return (
    <div className="min-h-screen bg-linear-to-b from-section to-background">
      <EventsHero />
      <Suspense fallback={<EventsListSkeleton />} key={`${campus}|${q}|${page}`}>
        <EventsList
          campus={campus}
          category={category}
          isMember={membership.isMember}
          locale={locale}
          page={page}
          search={q}
        />
      </Suspense>
    </div>
  );
}
```

- [ ] **Step 3: Rewrite the client component**

In `apps/web/src/components/events/events-list-client.tsx`:

1. Delete the entire `filteredEvents` filter chain — member-only, collection-item hiding, category matching and search are all server-side now.
2. Replace the `categories` const with a `categories` prop carrying only the values actually present. Add this facet action to `apps/web/src/app/actions/events.ts`:

```ts
/**
 * Categories present in the current event set.
 *
 * Rendering all eight `EventsCategory` values would give six chips that
 * return nothing — only 3 events are published today.
 */
export async function listEventFacets(params: {
  campus?: string;
  isMember?: boolean;
}): Promise<{ categories: EventsCategory[] }> {
  try {
    const { db } = await createSessionClient();
    const queries = [
      Query.equal("status", "published"),
      Query.select(["category"]),
      Query.limit(300),
    ];
    const campusScope = campusScopeIds(params.campus ?? null);
    if (campusScope) {
      queries.push(Query.equal("campus_id", campusScope));
    }
    if (!params.isMember) {
      queries.push(
        Query.or([
          Query.equal("member_only", false),
          Query.isNull("member_only"),
        ])
      );
    }

    const response = await db.listRows<Events>("app", "events", queries);
    const present = new Set(
      response.rows.map((e) => e.category).filter(Boolean)
    );
    // Ordered by the enum so chips never reshuffle between renders.
    return {
      categories: Object.values(EventsCategory).filter((c) => present.has(c)),
    };
  } catch (error) {
    console.error("listEventFacets failed:", error);
    return { categories: [] };
  }
}
```

Call it alongside `listEvents` in a `Promise.all` inside `EventsList`, and pass `categories` to the client.

3. Replace `selectedCategory` / `searchQuery` state with `useUrlSearch("q")` and `setParams({ category })`.
4. Wire `useLoadMore` with a `fetchPage` closure calling `listEvents`:

```tsx
const { canLoadMore, error, isLoading, items, loadMore } = useLoadMore({
  initial: initialEvents,
  total,
  fetchPage: useCallback(
    (page: number) =>
      listEvents({
        campus,
        category: selectedCategory,
        isMember,
        locale,
        page,
        search: initialSearch,
        status: "published",
        upcomingOnly: true,
      }),
    [campus, selectedCategory, isMember, locale, initialSearch]
  ),
});
```
5. Render `items`; count line from `total`, using `showingFirstResults` when `capped`.
6. Add `<LoadMoreButton />` below the grid.
7. Change the grid `key` from `selectedCategory + searchQuery` to a stable `"events-grid"` so the grid stops remounting on every keystroke.
8. Keep `EventDetailModal` and its `selectedEvent` state exactly as they are.

- [ ] **Step 4: Type-check and verify by hand**

Run: `bun run check-types && bun run dev --filter=web`

At `http://localhost:3000/events`:
- Category chips show the real categories (not eight buttons where six return nothing).
- **Search returns results** — it returns nothing on the live site today. This is the headline fix for this page.
- Cards show real category badges, not all "Social".

- [ ] **Step 5: Commit**

```bash
bun x ultracite fix
git add "apps/web/src/app/(public)/events/page.tsx" \
        apps/web/src/components/events/events-list-client.tsx \
        packages/i18n/messages/en/events.json packages/i18n/messages/no/events.json
git commit -m "feat(web): drive the events list from the server"
```

---

### Task 10: Paginate the products action

**Files:**
- Modify: `apps/web/src/app/actions/webshop.ts:16-98`
- Create: `apps/web/src/app/actions/webshop-pagination.test.ts`

**Interfaces:**
- Consumes: `findContentIdsBySearch` (Task 3), web list-params (Task 1).
- Produces: `listProducts(params: { campus?: string; category?: string; isMember?: boolean; locale?: "en" | "no"; page?: number; search?: string; sort?: ProductSort; status?: string }): Promise<WebPaginatedResult<WebshopProducts>>`, `listProductFacets(params: { campus?: string }): Promise<{ categories: string[] }>`, `type ProductSort = "newest" | "price-asc" | "price-desc"`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/app/actions/webshop-pagination.test.ts`, mirroring the jobs test structure from Task 5 with these cases:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionDb = vi.hoisted(() => ({ listRows: vi.fn() }));
vi.mock("@repo/api/server", () => ({
  createSessionClient: vi.fn(async () => ({ db: sessionDb })),
}));

import { listProducts } from "./webshop";

const queriesOf = (call: number): string[] =>
  sessionDb.listRows.mock.calls[call][2].map(String);

describe("listProducts pagination", () => {
  beforeEach(() => {
    sessionDb.listRows.mockReset();
    sessionDb.listRows.mockResolvedValue({ rows: [], total: 0 });
  });

  it("hides member-only products from non-members in the query", async () => {
    await listProducts({ isMember: false });
    expect(queriesOf(0).join("|")).toContain("member_only");
  });

  it("does not filter member_only for a member", async () => {
    await listProducts({ isMember: true });
    expect(queriesOf(0).join("|")).not.toContain("member_only");
  });

  it("pages by 12 with a 1-based offset", async () => {
    await listProducts({ page: 2 });
    const serialized = queriesOf(0).join("|");
    expect(serialized).toContain("12");
  });

  it("sorts by price in both directions", async () => {
    await listProducts({ sort: "price-asc" });
    expect(queriesOf(0).join("|")).toContain("regular_price");
  });

  it("reports Appwrite's total, not the page length", async () => {
    sessionDb.listRows.mockResolvedValue({
      rows: [{ $id: "p1", translation_refs: [] }],
      total: 52,
    });
    const result = await listProducts({ page: 1 });
    expect(result.total).toBe(52);
  });

  it("resolves search through content_translations first", async () => {
    sessionDb.listRows
      .mockResolvedValueOnce({ rows: [{ content_id: "p9" }], total: 1 })
      .mockResolvedValueOnce({ rows: [], total: 0 });

    await listProducts({ search: "hoodie", locale: "en" });

    expect(sessionDb.listRows.mock.calls[0][1]).toBe("content_translations");
    expect(queriesOf(1).join("|")).toContain("p9");
  });

  it("short-circuits when the search matches nothing", async () => {
    sessionDb.listRows.mockResolvedValueOnce({ rows: [], total: 0 });
    const result = await listProducts({ search: "zzzz" });
    expect(sessionDb.listRows).toHaveBeenCalledTimes(1);
    expect(result.total).toBe(0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun run test --filter=web -- webshop-pagination`
Expected: FAIL — `listProducts` returns an array.

- [ ] **Step 3: Rewrite `listProducts`**

Modify `apps/web/src/app/actions/webshop.ts`. Keep the existing `Query.select([...])` block verbatim. Add, before the `listRows` call:

```ts
let capped = false;
if (search?.trim()) {
  const found = await findContentIdsBySearch(db, "product", search, locale);
  if (found.ids.length === 0) {
    return emptyWebResult<WebshopProducts>(page);
  }
  capped = found.capped;
  queries.push(Query.equal("$id", found.ids));
}

if (!isMember) {
  // Was a client-side filter in ShopListClient.
  queries.push(
    Query.or([Query.equal("member_only", false), Query.isNull("member_only")])
  );
}
```

Replace `Query.limit(limit)` with `Query.limit(WEB_PAGE_SIZE), Query.offset(webOffset(page))`, and replace the hardcoded `Query.orderDesc("$createdAt")` with:

```ts
sort === "price-asc"
  ? Query.orderAsc("regular_price")
  : sort === "price-desc"
    ? Query.orderDesc("regular_price")
    : Query.orderDesc("$createdAt"),
```

Return `{ rows: productsResponse.rows, total: productsResponse.total, page, size: WEB_PAGE_SIZE, capped }` and make the catch return `emptyWebResult<WebshopProducts>(page)`.

Add `listProductFacets` mirroring `listJobFacets` from Task 5, projecting `Query.select(["category"])` over the published set and returning the categories present, ordered by `SHOP_CATEGORIES`.

- [ ] **Step 4: Run the test and type-check**

Run: `bun run test --filter=web -- webshop-pagination && bun run check-types`
Expected: PASS. Type errors will name `shop/page.tsx` and `shop-list-client.tsx` — those are Task 11.

- [ ] **Step 5: Commit**

```bash
bun x ultracite fix
git add apps/web/src/app/actions/webshop.ts apps/web/src/app/actions/webshop-pagination.test.ts
git commit -m "feat(web): paginate listProducts with server-side search and sort"
```

---

### Task 11: Rewire the shop page and client

**Files:**
- Modify: `apps/web/src/app/(public)/shop/page.tsx`
- Modify: `apps/web/src/components/shop/shop-list-client.tsx`
- Modify: `packages/i18n/messages/en/shop.json`, `packages/i18n/messages/no/shop.json`

**Interfaces:**
- Consumes: `listProducts` / `listProductFacets` / `ProductSort` (Task 10), `useLoadMore` / `LoadMoreButton` (Task 4), `useListParams` / `useUrlSearch` (Task 2).
- Produces: nothing consumed later.

**The deletion that matters:** `shop-list-client.tsx:52-70` re-fetches **all 100 products** in a `useEffect` on every campus or locale change. That whole effect goes; campus becomes a URL param and the server re-renders.

- [ ] **Step 1: Add the i18n keys**

Add to `filters` in both `en/shop.json` and `no/shop.json`:

```json
"loadMore": "Load more products",
"loading": "Loading...",
"loadMoreFailed": "Could not load more products.",
"showingFirstResults": "Showing the first {count} matches — refine your search",
"sortNewest": "Newest first",
"sortPriceAsc": "Price: low to high",
"sortPriceDesc": "Price: high to low",
```

- [ ] **Step 2: Rewrite the page**

Same shape as Tasks 6 and 9: `parseWebListParams`, campus from URL then prefs, `listProducts` + `listProductFacets` in a `Promise.all`, and a `key` on the client from the filter state. `getMembershipStatus()` is already called there — pass `isMember` into `listProducts` so the member-only filter runs server-side.

- [ ] **Step 3: Rewrite the client component**

In `apps/web/src/components/shop/shop-list-client.tsx`:

1. **Delete** the `useEffect` at lines 52–70 and the `products` / `isLoading` state it drives. This is the 100-row refetch.
2. **Delete** the `useEffect` at lines 46–48 syncing `selectedCategory` from `searchParams` — the category now arrives as a prop.
3. **Delete** the `filteredProducts` chain, including the `toPlainText` search matching and the `member_only` check.
4. Replace category state with `setParams({ category })`, and search with `useUrlSearch("q")`.
5. Add a sort `<Select>` bound to `setParams({ sort })` with the three `ProductSort` options:

```tsx
const SORT_OPTIONS = [
  { key: "sortNewest", value: "newest" },
  { key: "sortPriceAsc", value: "price-asc" },
  { key: "sortPriceDesc", value: "price-desc" },
] as const;

<Select
  onValueChange={(v) => setParams({ sort: v === "newest" ? null : v })}
  value={sort}
>
  <SelectTrigger className="h-9 w-48">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    {SORT_OPTIONS.map((opt) => (
      <SelectItem key={opt.value} value={opt.value}>
        {t(`filters.${opt.key}`)}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

6. Wire `useLoadMore` with a `fetchPage` closure calling `listProducts`:

```tsx
const { canLoadMore, error, isLoading, items, loadMore } = useLoadMore({
  initial: initialProducts,
  total,
  fetchPage: useCallback(
    (page: number) =>
      listProducts({
        campus,
        category: selectedCategory ?? undefined,
        isMember,
        locale,
        page,
        search: initialSearch,
        sort,
        status: "published",
      }),
    [campus, selectedCategory, isMember, locale, initialSearch, sort]
  ),
});
```
7. Render `items`; count line from `total`, `showingFirstResults` when `capped`.
8. Add `<LoadMoreButton />` below the grid, above the pickup-info block.
9. Change the grid `key` from `selectedCategory + searchQuery` to a stable `"shop-grid"`.
10. Render category chips from the `categories` facet prop, ordered by `SHOP_CATEGORIES`.

Check whether `toPlainText` (`@/lib/content-text`) still has callers — `grep -rn "toPlainText" apps/web/src` — and leave it if so.

- [ ] **Step 4: Type-check, lint and verify by hand**

Run: `bun run check-types && bun run lint --filter=web && bun run dev --filter=web`

At `http://localhost:3000/shop`:
- 12 products, "Load more" appends the next 12; the count says 52.
- Switching campus updates the URL and re-renders **without** the old 100-row refetch — confirm in the Network tab that no bulk fetch fires.
- Sorting by price reorders across the whole catalogue, not just the loaded page.

- [ ] **Step 5: Full verification sweep**

```bash
bun run check-types
bun run lint
bun run test
```

Expected: all green, including every admin test — the Task 1 and 2 shims are what those prove.

- [ ] **Step 6: Commit**

```bash
bun x ultracite fix
git add "apps/web/src/app/(public)/shop/page.tsx" \
        apps/web/src/components/shop/shop-list-client.tsx \
        packages/i18n/messages/en/shop.json packages/i18n/messages/no/shop.json
git commit -m "feat(web): drive the shop list from the server

Deletes the useEffect that re-fetched all 100 products on every campus
or locale change; campus is a URL param and the server re-renders."
```

---

## Done when

- [ ] `bun run check-types`, `bun run lint` and `bun run test` all pass from the repo root.
- [ ] All three pages page by 12 with a working "Load more", and report Appwrite's true total.
- [ ] Searching `/events` returns results (it returns nothing on the live site today).
- [ ] `/jobs` lists all 28 open positions across its pages, including any outside the newest-100 window that is invisible today.
- [ ] Event cards show real category badges rather than every event reading "Social".
- [ ] No admin test was modified to make it pass.

## Follow-on plan

The unit-category filter on `/jobs` will render **no options** until the department data lands — correct behaviour, since the facet query only offers categories that exist, and `departments.type` is null on all 280 rows.

That work is the second plan: the `departments.type` backfill (141 active rows, rules-first with an AI pass over the residue and a CSV approval gate), the job→department link backfill (232 of 253 published jobs unlinked), and the `Drift *` deactivation — which must be implemented in `apps/admin/src/app/api/units/sync/route.ts`, because the Finago sync rewrites `active` on every run and would revert a direct row write. See the spec's "Data backfills" section.
