# Admin List Pagination — Foundation & Simple Surfaces (Plan A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the shared URL-driven pagination contract and prove it on the six simplest admin list surfaces.

**Architecture:** A plain (non-`"use server"`) module exports `ListParams`, a clamping parser, and Appwrite pagination queries. `PaginationBar` gains a page-size picker; a `useListParams` hook writes page/size/search into the address bar. Each surface then reads `searchParams`, passes `ListParams` into its list action, and returns `PaginatedResult<T>` built from Appwrite's true `response.total`.

**Tech Stack:** Next.js 16 App Router (RSC + server actions), Appwrite via `@repo/api`, `bun test` with `bun:test` mocks, next-intl, Biome/Ultracite.

**Spec:** `docs/superpowers/specs/2026-09-03-admin-pagination-design.md`

## Global Constraints

- Package manager is **Bun** (`bun@1.3.1`). Never `npm`/`pnpm`.
- `"use server"` files may export **only** `async function`s. `list-params.ts` and `use-list-params.ts` are plain modules and must NOT carry `"use server"`. `check-types` does not catch a violation — only `bun run build --filter=admin` does.
- Never import `appwrite` / `node-appwrite` directly. Use `Query` from `@repo/api`.
- Every list action keeps its existing campus/department scope queries. Pagination must not drop them.
- `PAGE_SIZES = [25, 50, 100]`, `DEFAULT_PAGE_SIZE = 25`.
- URL params omit defaults: no `?page=1`, no `?size=25`, no empty `?q=`.
- Run `bun x ultracite fix` before each commit.
- Verification for any task touching a `"use server"` file: `bun run check-types --filter=admin` AND `bun run build --filter=admin`.

---

### Task 1: Shared list params module

**Files:**
- Create: `apps/admin/src/lib/list-params.ts`
- Test: `apps/admin/src/lib/list-params.test.ts`

**Interfaces:**
- Consumes: `Query` from `@repo/api`.
- Produces: `PAGE_SIZES`, `DEFAULT_PAGE_SIZE`, type `PageSize`, type `ListParams`, type `ListSearchParams`, type `PaginatedResult<T>`, `parseListParams(sp, opts?)`, `paginationQueries(params)`, `emptyResult<T>(params)`. Every later task imports from here.

- [ ] **Step 1: Write the failing test**

Create `apps/admin/src/lib/list-params.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { Query } from "@repo/api";
import {
  DEFAULT_PAGE_SIZE,
  emptyResult,
  paginationQueries,
  parseListParams,
} from "./list-params";

describe("parseListParams", () => {
  test("defaults when nothing is supplied", () => {
    expect(parseListParams({})).toEqual({
      page: 1,
      size: DEFAULT_PAGE_SIZE,
      q: "",
    });
  });

  test("reads a valid page, size and query", () => {
    expect(parseListParams({ page: "3", size: "50", q: " oslo " })).toEqual({
      page: 3,
      size: 50,
      q: "oslo",
    });
  });

  test("clamps junk page values to 1", () => {
    for (const page of ["0", "-4", "abc", "", "1.9e9999"]) {
      expect(parseListParams({ page }).page).toBeGreaterThanOrEqual(1);
    }
    expect(parseListParams({ page: "abc" }).page).toBe(1);
    expect(parseListParams({ page: "-4" }).page).toBe(1);
    expect(parseListParams({ page: "2.7" }).page).toBe(2);
  });

  test("rejects a size outside PAGE_SIZES", () => {
    expect(parseListParams({ size: "9999" }).size).toBe(DEFAULT_PAGE_SIZE);
    expect(parseListParams({ size: "0" }).size).toBe(DEFAULT_PAGE_SIZE);
    expect(parseListParams({ size: "100" }).size).toBe(100);
  });

  test("takes the first value when Next.js supplies an array", () => {
    expect(parseListParams({ page: ["2", "5"] }).page).toBe(2);
  });

  test("supports an alternate page key for a second table on one route", () => {
    const params = parseListParams(
      { page: "2", opage: "7" },
      { pageKey: "opage" }
    );
    expect(params.page).toBe(7);
  });
});

describe("paginationQueries", () => {
  test("produces limit and offset for page 1", () => {
    expect(paginationQueries({ page: 1, size: 25, q: "" })).toEqual([
      Query.limit(25),
      Query.offset(0),
    ]);
  });

  test("offsets by (page - 1) * size", () => {
    expect(paginationQueries({ page: 4, size: 50, q: "" })).toEqual([
      Query.limit(50),
      Query.offset(150),
    ]);
  });
});

describe("emptyResult", () => {
  test("preserves the requested page and size", () => {
    expect(emptyResult({ page: 3, size: 50, q: "x" })).toEqual({
      rows: [],
      total: 0,
      page: 3,
      size: 50,
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/admin && bun test src/lib/list-params.test.ts`
Expected: FAIL — cannot resolve module `./list-params`.

- [ ] **Step 3: Write the implementation**

Create `apps/admin/src/lib/list-params.ts`:

```ts
import { Query } from "@repo/api";

export const PAGE_SIZES = [25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
export const DEFAULT_PAGE_SIZE: PageSize = 25;

/** Shape Next.js gives us from `await searchParams`. */
export type ListSearchParams = Record<string, string | string[] | undefined>;

export type ListParams = {
  /** 1-based, always >= 1. */
  page: number;
  size: PageSize;
  /** Trimmed; "" when absent. */
  q: string;
};

export type PaginatedResult<T> = {
  rows: T[];
  /** Appwrite's true total for the filtered set, not the page length. */
  total: number;
  page: number;
  size: PageSize;
};

const firstValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const isPageSize = (value: number): value is PageSize =>
  (PAGE_SIZES as readonly number[]).includes(value);

/**
 * Clamps rather than throws: junk in the address bar renders page 1, never an
 * error page.
 */
export function parseListParams(
  searchParams: ListSearchParams,
  opts?: { pageKey?: string }
): ListParams {
  const rawPage = Number(firstValue(searchParams[opts?.pageKey ?? "page"]));
  const page =
    Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;

  const rawSize = Number(firstValue(searchParams.size));
  const size = isPageSize(rawSize) ? rawSize : DEFAULT_PAGE_SIZE;

  return { page, size, q: (firstValue(searchParams.q) ?? "").trim() };
}

export function paginationQueries(params: ListParams): string[] {
  return [Query.limit(params.size), Query.offset((params.page - 1) * params.size)];
}

/** Short-circuit for actions that can prove the result is empty. */
export function emptyResult<T>(params: ListParams): PaginatedResult<T> {
  return { rows: [], total: 0, page: params.page, size: params.size };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/admin && bun test src/lib/list-params.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Type-check and commit**

```bash
bun x ultracite fix
bun run check-types --filter=admin
git add apps/admin/src/lib/list-params.ts apps/admin/src/lib/list-params.test.ts
git commit -m "feat(admin): add shared list pagination params module"
```

---

### Task 2: PaginationBar page-size picker and i18n

**Files:**
- Modify: `apps/admin/src/app/(portal)/_components/pagination-bar.tsx` (whole file)
- Modify: `packages/i18n/messages/en/adminPortal.json` (`common` object)
- Modify: `packages/i18n/messages/no/adminPortal.json` (`common` object)

**Interfaces:**
- Consumes: `PAGE_SIZES`, `PageSize`, `DEFAULT_PAGE_SIZE` from Task 1.
- Produces: `<PaginationBar page={number} size={PageSize} total={number} />`. The module-level `PAGE_SIZE` export is **removed** — nothing in the repo imports it (verified: only `pagination-bar.tsx` referenced it).

- [ ] **Step 1: Add the translation keys**

In `packages/i18n/messages/en/adminPortal.json`, inside the existing `"common"` object add:

```json
"pagination": {
  "summary": "{total} total · page {page} of {pages}",
  "previous": "Previous page",
  "next": "Next page",
  "perPage": "Per page"
}
```

In `packages/i18n/messages/no/adminPortal.json`, inside `"common"` add:

```json
"pagination": {
  "summary": "{total} totalt · side {page} av {pages}",
  "previous": "Forrige side",
  "next": "Neste side",
  "perPage": "Per side"
}
```

- [ ] **Step 2: Replace the component**

Replace the whole of `apps/admin/src/app/(portal)/_components/pagination-bar.tsx`:

```tsx
"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { DEFAULT_PAGE_SIZE, type PageSize, PAGE_SIZES } from "@/lib/list-params";

interface PaginationBarProps {
  page: number;
  size?: PageSize;
  total: number;
  /** Alternate page key for a route rendering two independent tables. */
  pageKey?: string;
}

export function PaginationBar({
  total,
  page,
  size = DEFAULT_PAGE_SIZE,
  pageKey = "page",
}: PaginationBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("adminPortal.common.pagination");
  const totalPages = Math.max(1, Math.ceil(total / size));

  const push = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const goToPage = useCallback(
    (p: number) => {
      push((params) => {
        if (p <= 1) {
          params.delete(pageKey);
        } else {
          params.set(pageKey, String(p));
        }
      });
    },
    [push, pageKey]
  );

  const changeSize = useCallback(
    (next: number) => {
      push((params) => {
        if (next === DEFAULT_PAGE_SIZE) {
          params.delete("size");
        } else {
          params.set("size", String(next));
        }
        // A new page size invalidates the current offset.
        params.delete(pageKey);
      });
    },
    [push, pageKey]
  );

  // Nothing to show for a genuinely empty list — the surface renders its own
  // EmptyState. A single page still renders: the size picker and total matter.
  if (total === 0) {
    return null;
  }

  const pages: (number | "…")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
  } else {
    pages.push(1);
    if (page > 4) {
      pages.push("…");
    }
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    if (page < totalPages - 3) {
      pages.push("…");
    }
    pages.push(totalPages);
  }

  const btnBase =
    "flex items-center justify-center min-w-[32px] h-8 px-2 rounded-lg text-xs font-medium transition-all cursor-pointer";

  return (
    <div
      className="mt-6 flex flex-wrap items-center justify-between gap-3 pt-4"
      style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="flex items-center gap-3">
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.30)" }}>
          {t("summary", { page, pages: totalPages, total })}
        </p>

        <label
          className="flex items-center gap-1.5 text-xs"
          style={{ color: "rgba(255,255,255,0.30)" }}
        >
          {t("perPage")}
          <select
            className="rounded-lg px-2 py-1 text-xs outline-none"
            onChange={(e) => changeSize(Number(e.target.value))}
            style={{
              background: "rgba(255,255,255,0.04)",
              color: "rgba(255,255,255,0.60)",
            }}
            value={size}
          >
            {PAGE_SIZES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            aria-label={t("previous")}
            className={btnBase}
            disabled={page <= 1}
            onClick={() => goToPage(page - 1)}
            style={{
              background: "rgba(255,255,255,0.04)",
              color:
                page <= 1 ? "rgba(255,255,255,0.20)" : "rgba(255,255,255,0.60)",
              cursor: page <= 1 ? "not-allowed" : "pointer",
            }}
            type="button"
          >
            <ChevronLeft size={14} />
          </button>

          {pages.map((p, i) =>
            p === "…" ? (
              <span
                className="flex h-8 w-8 items-center justify-center text-xs"
                key={`ellipsis-${i}`}
                style={{ color: "rgba(255,255,255,0.25)" }}
              >
                …
              </span>
            ) : (
              <button
                aria-current={p === page ? "page" : undefined}
                className={btnBase}
                key={p}
                onClick={() => goToPage(p as number)}
                style={
                  p === page
                    ? { background: "#3DA9E0", color: "#001731" }
                    : {
                        background: "rgba(255,255,255,0.04)",
                        color: "rgba(255,255,255,0.60)",
                      }
                }
                type="button"
              >
                {p}
              </button>
            )
          )}

          <button
            aria-label={t("next")}
            className={btnBase}
            disabled={page >= totalPages}
            onClick={() => goToPage(page + 1)}
            style={{
              background: "rgba(255,255,255,0.04)",
              color:
                page >= totalPages
                  ? "rgba(255,255,255,0.20)"
                  : "rgba(255,255,255,0.60)",
              cursor: page >= totalPages ? "not-allowed" : "pointer",
            }}
            type="button"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify nothing still imports the removed constant**

Run: `cd apps/admin && grep -rn "PAGE_SIZE\b" src/app/\(portal\)/_components/ src/app/\(portal\)/*/`
Expected: no hit importing `PAGE_SIZE` from `pagination-bar`. Existing per-action constants (`NEWS_PAGE_SIZE` etc.) are untouched by this plan.

- [ ] **Step 4: Type-check**

Run: `cd /Users/markus/Documents/dev/BISO-Sites && bun run check-types --filter=admin`
Expected: PASS. The six existing `<PaginationBar page total />` call sites still compile because `size` is optional.

- [ ] **Step 5: Commit**

```bash
bun x ultracite fix
git add apps/admin/src/app/\(portal\)/_components/pagination-bar.tsx packages/i18n/messages/en/adminPortal.json packages/i18n/messages/no/adminPortal.json
git commit -m "feat(admin): add page-size picker and i18n to PaginationBar"
```

---

### Task 3: useListParams client hook

**Files:**
- Create: `apps/admin/src/app/(portal)/_components/use-list-params.ts`

**Interfaces:**
- Produces: `useListParams()` returning `{ get, setParams }`, and `useUrlSearch(key?, delay?)` returning `[value, setValue]`. Tasks 7–9 and all of Plan B consume these.

- [ ] **Step 1: Write the hook**

Create `apps/admin/src/app/(portal)/_components/use-list-params.ts`:

```ts
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type ParamValue = string | number | null | undefined;

export function useListParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const get = useCallback(
    (key: string, fallback = "") => searchParams.get(key) ?? fallback,
    [searchParams]
  );

  /**
   * Writes params into the address bar. Empty / nullish values are deleted so a
   * clean list stays at `/news` rather than `/news?page=1&q=&size=25`.
   * Any filter change resets pagination unless `keepPage` is set.
   */
  const setParams = useCallback(
    (updates: Record<string, ParamValue>, opts?: { keepPage?: boolean }) => {
      const params = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(updates)) {
        const next = value === null || value === undefined ? "" : String(value);
        if (next === "") {
          params.delete(key);
        } else {
          params.set(key, next);
        }
      }

      if (!opts?.keepPage) {
        params.delete("page");
      }

      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  return { get, setParams };
}

/**
 * Debounced search box state bound to a URL param.
 *
 * Known limitation: the input is seeded from the URL on mount and is not
 * re-synced afterwards, so a browser Back that changes `q` updates the results
 * but leaves the text in the box. Re-syncing fights the debounce; the results
 * are the source of truth.
 */
export function useUrlSearch(key = "q", delay = 300) {
  const { get, setParams } = useListParams();
  const [value, setValue] = useState(() => get(key));
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => setParams({ [key]: value }), delay);
    return () => clearTimeout(timer);
  }, [value, key, delay, setParams]);

  return [value, setValue] as const;
}
```

- [ ] **Step 2: Confirm it is not a `"use server"` module**

Run: `head -1 apps/admin/src/app/\(portal\)/_components/use-list-params.ts`
Expected: `"use client";` — this file exports non-async values and would fail the build under `"use server"`.

- [ ] **Step 3: Type-check**

Run: `cd /Users/markus/Documents/dev/BISO-Sites && bun run check-types --filter=admin`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
bun x ultracite fix
git add apps/admin/src/app/\(portal\)/_components/use-list-params.ts
git commit -m "feat(admin): add useListParams and useUrlSearch hooks"
```

---

### Task 4: Paginate the activity log

**Files:**
- Modify: `apps/admin/src/app/(portal)/_actions/activity.ts:8-39`
- Modify: `apps/admin/src/app/(portal)/activity/page.tsx:9-14` and the render block
- Test: `apps/admin/src/app/(portal)/_actions/activity.test.ts` (create)

**Interfaces:**
- Consumes: `ListParams`, `PaginatedResult`, `paginationQueries`, `emptyResult` (Task 1); `PaginationBar` (Task 2).
- Produces: `listActivityLog(params: ListParams & { resourceType?: string }) => Promise<PaginatedResult<AuditLogs>>`. **Breaking change** — it previously returned a bare `AuditLogs[]`.

- [ ] **Step 1: Write the failing test**

Create `apps/admin/src/app/(portal)/_actions/activity.test.ts`:

```ts
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Query } from "@repo/api";
import type { UserAuthContext } from "@/lib/authorization";

const db = { listRows: mock() };

const globalAdminCtx: UserAuthContext = {
  activeCampusId: undefined,
  campusNames: ["Oslo"],
  campusTeamIds: [],
  departmentNames: [],
  departmentTeamIds: [],
  email: "admin@example.com",
  managedCampuses: [],
  managedCampusIds: [],
  name: "Global Admin",
  resolvedCampusIds: [],
  resolvedDepartmentIds: [],
  roles: ["globaladmin"],
  userId: "user-1",
};

let currentCtx: UserAuthContext = globalAdminCtx;

mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db })),
}));

mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => currentCtx),
}));

const { listActivityLog } = await import("./activity");

describe("listActivityLog", () => {
  beforeEach(() => {
    currentCtx = globalAdminCtx;
    db.listRows.mockReset();
  });

  test("returns Appwrite's true total, not the page length", async () => {
    db.listRows.mockResolvedValueOnce({
      rows: [{ $id: "a" }, { $id: "b" }],
      total: 4021,
    });

    const result = await listActivityLog({ page: 1, size: 25, q: "" });

    expect(result.total).toBe(4021);
    expect(result.rows).toHaveLength(2);
    expect(result.page).toBe(1);
    expect(result.size).toBe(25);
  });

  test("offsets by (page - 1) * size", async () => {
    db.listRows.mockResolvedValueOnce({ rows: [], total: 4021 });

    await listActivityLog({ page: 3, size: 50, q: "" });

    const queries = db.listRows.mock.calls[0][2] as string[];
    expect(queries).toContain(Query.limit(50));
    expect(queries).toContain(Query.offset(100));
  });

  test("denies a non-admin without querying Appwrite", async () => {
    currentCtx = { ...globalAdminCtx, roles: ["department"] };

    const result = await listActivityLog({ page: 1, size: 25, q: "" });

    expect(result).toEqual({ rows: [], total: 0, page: 1, size: 25 });
    expect(db.listRows).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/admin && bun test "src/app/(portal)/_actions/activity.test.ts"`
Expected: FAIL — `result.total` is undefined because the action returns an array.

- [ ] **Step 3: Rewrite the action**

Replace `listActivityLog` in `apps/admin/src/app/(portal)/_actions/activity.ts` (keep the `"use server"` directive and existing imports, add the new ones):

```ts
"use server";

import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type { AuditLogs } from "@repo/api/types/appwrite";
import { requireAuth } from "@/lib/authorization";
import {
  emptyResult,
  type ListParams,
  type PaginatedResult,
  paginationQueries,
} from "@/lib/list-params";

export async function listActivityLog(
  params: ListParams & { resourceType?: string }
): Promise<PaginatedResult<AuditLogs>> {
  const ctx = await requireAuth();

  // Only campus admins and global admins can view the activity log
  if (
    !(ctx.roles.includes("globaladmin") || ctx.roles.includes("campusadmin"))
  ) {
    return emptyResult<AuditLogs>(params);
  }

  const { db } = await createAdminClient();

  const queries: string[] = [
    Query.orderDesc("$createdAt"),
    ...paginationQueries(params),
  ];

  if (params.resourceType) {
    queries.push(Query.equal("resource_type", params.resourceType));
  }

  const response = await db.listRows<AuditLogs>("app", "audit_logs", queries);

  return {
    rows: response.rows,
    total: response.total,
    page: params.page,
    size: params.size,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/admin && bun test "src/app/(portal)/_actions/activity.test.ts"`
Expected: PASS, 3 tests.

- [ ] **Step 5: Update the page**

In `apps/admin/src/app/(portal)/activity/page.tsx`, change the imports, signature and data read. Add to the imports:

```tsx
import { parseListParams } from "@/lib/list-params";
import { PaginationBar } from "../_components/pagination-bar";
```

Replace the component signature and fetch:

```tsx
export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireNavAccess("portal.activity");
  const t = await getTranslations("adminPortal.activity");

  const params = parseListParams(await searchParams);
  const { rows: logs, total } = await listActivityLog(params);
```

The existing `idx < logs.length - 1` row-separator check still works unchanged, since `logs` is now the page's rows. Add the bar immediately after the closing `</StudioPanel>`:

```tsx
        </StudioPanel>
      )}

      <PaginationBar page={params.page} size={params.size} total={total} />
    </div>
  );
}
```

- [ ] **Step 6: Type-check and build**

Run: `cd /Users/markus/Documents/dev/BISO-Sites && bun run check-types --filter=admin && bun run build --filter=admin`
Expected: both PASS. The build is the only check that catches a bad `"use server"` export.

- [ ] **Step 7: Commit**

```bash
bun x ultracite fix
git add apps/admin/src/app/\(portal\)/_actions/activity.ts apps/admin/src/app/\(portal\)/_actions/activity.test.ts apps/admin/src/app/\(portal\)/activity/page.tsx
git commit -m "feat(admin): paginate the activity log"
```

---

### Task 5: Paginate pending approvals

**Files:**
- Modify: `apps/admin/src/app/(portal)/_actions/approvals.ts:149-179`
- Modify: `apps/admin/src/app/(portal)/inbox/approvals/page.tsx`
- Modify: `apps/admin/src/app/(portal)/inbox/approvals/_components/approvals-review-client.tsx` (props + render)
- Test: `apps/admin/src/app/(portal)/_actions/approvals.test.ts` (create)

**Interfaces:**
- Consumes: Task 1 exports, `PaginationBar` (Task 2).
- Produces: `listPendingApprovals(params: ListParams) => Promise<{ data: PaginatedResult<ApprovalRequest> } | { error: string }>`. The `{ data } | { error }` envelope is preserved because the page already branches on it.

- [ ] **Step 1: Write the failing test**

Create `apps/admin/src/app/(portal)/_actions/approvals.test.ts`:

```ts
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Query } from "@repo/api";
import type { UserAuthContext } from "@/lib/authorization";

const db = { listRows: mock() };

const baseCtx: UserAuthContext = {
  activeCampusId: undefined,
  campusNames: ["Oslo"],
  campusTeamIds: [],
  departmentNames: [],
  departmentTeamIds: [],
  email: "admin@example.com",
  managedCampuses: ["Oslo"],
  managedCampusIds: ["campus-oslo"],
  name: "Admin",
  resolvedCampusIds: ["campus-oslo"],
  resolvedDepartmentIds: [],
  roles: ["campusadmin"],
  userId: "user-1",
};

let currentCtx: UserAuthContext = baseCtx;

mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db })),
  createSessionClient: mock(async () => ({ db })),
}));

mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => currentCtx),
}));

const { listPendingApprovals } = await import("./approvals");

describe("listPendingApprovals", () => {
  beforeEach(() => {
    currentCtx = baseCtx;
    db.listRows.mockReset();
  });

  test("reports the true total and paginates", async () => {
    db.listRows.mockResolvedValueOnce({ rows: [{ $id: "r1" }], total: 133 });

    const result = await listPendingApprovals({ page: 2, size: 25, q: "" });

    expect("data" in result).toBe(true);
    if (!("data" in result)) {
      throw new Error("expected data");
    }
    expect(result.data.total).toBe(133);
    const queries = db.listRows.mock.calls[0][2] as string[];
    expect(queries).toContain(Query.offset(25));
  });

  test("keeps the campus switcher filter on every page", async () => {
    currentCtx = { ...baseCtx, activeCampusId: "campus-bergen" };
    db.listRows.mockResolvedValueOnce({ rows: [], total: 0 });

    await listPendingApprovals({ page: 3, size: 25, q: "" });

    const queries = db.listRows.mock.calls[0][2] as string[];
    expect(queries).toContain(Query.equal("campus_id", ["campus-bergen"]));
  });

  test("degrades to an empty page when the table is missing", async () => {
    db.listRows.mockRejectedValueOnce(new Error("table not found"));

    const result = await listPendingApprovals({ page: 1, size: 25, q: "" });

    expect(result).toEqual({
      data: { rows: [], total: 0, page: 1, size: 25 },
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/admin && bun test "src/app/(portal)/_actions/approvals.test.ts"`
Expected: FAIL — `result.data.total` is undefined; `data` is an array.

- [ ] **Step 3: Rewrite the action**

Replace `listPendingApprovals` in `apps/admin/src/app/(portal)/_actions/approvals.ts`, adding the Task 1 imports at the top of the file:

```ts
import {
  emptyResult,
  type ListParams,
  type PaginatedResult,
  paginationQueries,
} from "@/lib/list-params";
```

```ts
export async function listPendingApprovals(
  params: ListParams
): Promise<{ data: PaginatedResult<ApprovalRequest> } | { error: string }> {
  const ctx = await requireAuth();

  try {
    const { db } = await createSessionClient();

    // The session client uses row-level permissions, so only rows the user
    // can read (where they are in the approver team) will be returned. On top
    // of that, honor the global-admin campus switcher: when a global admin has
    // scoped themselves to a campus, only show that campus's approvals.
    const queries: string[] = [
      Query.equal("status", "pending"),
      Query.orderDesc("$createdAt"),
      ...paginationQueries(params),
    ];
    if (ctx.activeCampusId) {
      queries.push(Query.equal("campus_id", [ctx.activeCampusId]));
    }
    const result = await db.listRows<ApprovalRequest>(
      DATABASE_ID,
      TABLE,
      queries
    );

    return {
      data: {
        rows: result.rows,
        total: result.total,
        page: params.page,
        size: params.size,
      },
    };
  } catch (_error) {
    // If the table doesn't exist yet, return empty list gracefully
    return { data: emptyResult<ApprovalRequest>(params) };
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/admin && bun test "src/app/(portal)/_actions/approvals.test.ts"`
Expected: PASS, 3 tests.

- [ ] **Step 5: Update the page and client**

In `apps/admin/src/app/(portal)/inbox/approvals/page.tsx`, add imports and thread the params through:

```tsx
import { parseListParams } from "@/lib/list-params";
```

Change the component to accept `searchParams`, parse them, pass them to the action, and pass `page`/`size`/`total` into `ApprovalsReviewClient`:

```tsx
export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // ...existing auth gate unchanged...
  const params = parseListParams(await searchParams);
  const result = await listPendingApprovals(params);
```

Where the page currently reads `result.data` as the request array, it now reads `result.data.rows`, and passes `page={params.page} size={params.size} total={result.data.total}` alongside it.

In `apps/admin/src/app/(portal)/inbox/approvals/_components/approvals-review-client.tsx`, add three props to the interface and render the bar at the end of the returned fragment:

```tsx
import type { PageSize } from "@/lib/list-params";
import { PaginationBar } from "../../../_components/pagination-bar";

// in the props interface:
  page: number;
  size: PageSize;
  total: number;

// at the end of the component's returned JSX, after the request list:
      <PaginationBar page={page} size={size} total={total} />
```

Note the existing `const [requests, setRequests] = useState(initialRequests)` optimistic-removal state stays as-is; approving a row still removes it from the current page without a refetch.

- [ ] **Step 6: Type-check and build**

Run: `cd /Users/markus/Documents/dev/BISO-Sites && bun run check-types --filter=admin && bun run build --filter=admin`
Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
bun x ultracite fix
git add apps/admin/src/app/\(portal\)/_actions/approvals.ts apps/admin/src/app/\(portal\)/_actions/approvals.test.ts apps/admin/src/app/\(portal\)/inbox/approvals/
git commit -m "feat(admin): paginate pending approvals"
```

---

### Task 6: Paginate varsling settings

**Files:**
- Modify: `apps/admin/src/app/(portal)/_actions/varsling.ts:52-70`
- Modify: `apps/admin/src/app/(portal)/varsling/page.tsx`
- Modify: `apps/admin/src/app/(portal)/varsling/_components/varsling-settings-client.tsx` (props + render)
- Test: `apps/admin/src/app/(portal)/_actions/varsling.test.ts` (create)

**Interfaces:**
- Consumes: Task 1 exports, `PaginationBar` (Task 2).
- Produces: `listVarslingSettings(params: ListParams) => Promise<PaginatedResult<VarslingSettings>>`. **Breaking change** — previously returned `VarslingSettings[]`.

- [ ] **Step 1: Write the failing test**

Create `apps/admin/src/app/(portal)/_actions/varsling.test.ts`:

```ts
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Query } from "@repo/api";
import type { UserAuthContext } from "@/lib/authorization";

const db = { listRows: mock() };

const globalAdminCtx: UserAuthContext = {
  activeCampusId: undefined,
  campusNames: [],
  campusTeamIds: [],
  departmentNames: [],
  departmentTeamIds: [],
  email: "admin@example.com",
  managedCampuses: [],
  managedCampusIds: [],
  name: "Global Admin",
  resolvedCampusIds: [],
  resolvedDepartmentIds: [],
  roles: ["globaladmin"],
  userId: "user-1",
};

let currentCtx: UserAuthContext = globalAdminCtx;
let navAccess = true;

mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db })),
}));

mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => currentCtx),
}));

mock.module("@/lib/roles", () => ({
  hasNavAccess: mock(() => navAccess),
}));

const { listVarslingSettings } = await import("./varsling");

describe("listVarslingSettings", () => {
  beforeEach(() => {
    currentCtx = globalAdminCtx;
    navAccess = true;
    db.listRows.mockReset();
  });

  test("returns the true total and the requested slice", async () => {
    db.listRows.mockResolvedValueOnce({ rows: [{ $id: "v1" }], total: 87 });

    const result = await listVarslingSettings({ page: 2, size: 25, q: "" });

    expect(result.total).toBe(87);
    expect(result.page).toBe(2);
    const queries = db.listRows.mock.calls[0][2] as string[];
    expect(queries).toContain(Query.offset(25));
  });

  test("returns an empty page for an unauthorized user", async () => {
    navAccess = false;

    const result = await listVarslingSettings({ page: 1, size: 25, q: "" });

    expect(result).toEqual({ rows: [], total: 0, page: 1, size: 25 });
    expect(db.listRows).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/admin && bun test "src/app/(portal)/_actions/varsling.test.ts"`
Expected: FAIL — `result.total` is undefined.

- [ ] **Step 3: Rewrite the action**

In `apps/admin/src/app/(portal)/_actions/varsling.ts` add the Task 1 imports and replace `listVarslingSettings`. Delete the now-unused `VARSLING_PAGE_LIMIT` constant if nothing else references it (check with `grep -n VARSLING_PAGE_LIMIT` first):

```ts
import {
  emptyResult,
  type ListParams,
  type PaginatedResult,
  paginationQueries,
} from "@/lib/list-params";

export async function listVarslingSettings(
  params: ListParams
): Promise<PaginatedResult<VarslingSettings>> {
  const ctx = await requireAuth();
  if (!canManageVarsling(ctx)) {
    return emptyResult<VarslingSettings>(params);
  }

  const { db } = await createAdminClient();
  const response = await db.listRows<VarslingSettings>(
    "app",
    "varsling_settings",
    [
      Query.orderAsc("campus_id"),
      Query.orderAsc("sort_order"),
      Query.orderAsc("role_name"),
      ...paginationQueries(params),
    ]
  );

  return {
    rows: response.rows,
    total: response.total,
    page: params.page,
    size: params.size,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/admin && bun test "src/app/(portal)/_actions/varsling.test.ts"`
Expected: PASS, 2 tests.

- [ ] **Step 5: Update the page and client**

In `apps/admin/src/app/(portal)/varsling/page.tsx`, add `import { parseListParams } from "@/lib/list-params";`, accept and parse `searchParams`, pass `params` into `listVarslingSettings`, and read `.rows` where the settings array was used. Pass `page`, `size`, `total` into `VarslingSettingsClient`.

In `apps/admin/src/app/(portal)/varsling/_components/varsling-settings-client.tsx`, add the three props and render `<PaginationBar page={page} size={size} total={total} />` at the end of the list, importing:

```tsx
import type { PageSize } from "@/lib/list-params";
import { PaginationBar } from "../../_components/pagination-bar";
```

- [ ] **Step 6: Type-check and build**

Run: `cd /Users/markus/Documents/dev/BISO-Sites && bun run check-types --filter=admin && bun run build --filter=admin`
Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
bun x ultracite fix
git add apps/admin/src/app/\(portal\)/_actions/varsling.ts apps/admin/src/app/\(portal\)/_actions/varsling.test.ts apps/admin/src/app/\(portal\)/varsling/
git commit -m "feat(admin): paginate varsling settings"
```

---

### Task 7: Paginate and search member benefits

**Files:**
- Modify: `apps/admin/src/app/(portal)/_actions/benefits.ts:413-444`
- Modify: `apps/admin/src/app/(portal)/benefits/page.tsx`
- Create: `apps/admin/src/app/(portal)/benefits/_components/benefits-search.tsx`
- Test: `apps/admin/src/app/(portal)/_actions/benefits-pagination.test.ts` (create — `benefits-relationships.test.ts` already exists and must not be disturbed)

**Interfaces:**
- Consumes: Task 1 exports, `PaginationBar` (Task 2), `useUrlSearch` (Task 3), the existing `SearchToolbar`.
- Produces: `listBenefits(params: ListParams & { campusId?: string; status?: string; kind?: string }) => Promise<PaginatedResult<CampusBenefits>>`. **Breaking change** — previously returned `CampusBenefits[]`.

Search uses spec case 2: `campus_benefits` carries `title_nb` / `title_en` on the row, so one `Query.or` of `Query.contains` covers it — no translations lookup.

- [ ] **Step 1: Write the failing test**

Create `apps/admin/src/app/(portal)/_actions/benefits-pagination.test.ts`:

```ts
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Query } from "@repo/api";
import type { UserAuthContext } from "@/lib/authorization";

const db = { listRows: mock() };

const campusAdminCtx: UserAuthContext = {
  activeCampusId: undefined,
  campusNames: ["Oslo"],
  campusTeamIds: ["sg-app-campus-oslo"],
  departmentNames: [],
  departmentTeamIds: [],
  email: "admin@example.com",
  managedCampuses: ["Oslo"],
  managedCampusIds: ["campus-oslo"],
  name: "Oslo Admin",
  resolvedCampusIds: ["campus-oslo"],
  resolvedDepartmentIds: [],
  roles: ["campusadmin"],
  userId: "user-1",
};

mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db })),
  createSessionClient: mock(async () => ({ db })),
}));

mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => campusAdminCtx),
}));

const { listBenefits } = await import("./benefits");

describe("listBenefits pagination", () => {
  beforeEach(() => {
    db.listRows.mockReset();
  });

  test("reports the true total and offsets correctly", async () => {
    db.listRows.mockResolvedValueOnce({ rows: [{ $id: "b1" }], total: 240 });

    const result = await listBenefits({ page: 4, size: 50, q: "" });

    expect(result.total).toBe(240);
    const queries = db.listRows.mock.calls[0][2] as string[];
    expect(queries).toContain(Query.limit(50));
    expect(queries).toContain(Query.offset(150));
  });

  test("searches the row title columns, not a translations table", async () => {
    db.listRows.mockResolvedValueOnce({ rows: [], total: 0 });

    await listBenefits({ page: 1, size: 25, q: "rabatt" });

    expect(db.listRows).toHaveBeenCalledTimes(1);
    const queries = db.listRows.mock.calls[0][2] as string[];
    expect(queries).toContain(
      Query.or([
        Query.contains("title_nb", "rabatt"),
        Query.contains("title_en", "rabatt"),
      ])
    );
  });

  test("adds no search query when q is empty", async () => {
    db.listRows.mockResolvedValueOnce({ rows: [], total: 0 });

    await listBenefits({ page: 1, size: 25, q: "" });

    const queries = db.listRows.mock.calls[0][2] as string[];
    expect(queries.some((query) => query.includes("contains"))).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/admin && bun test "src/app/(portal)/_actions/benefits-pagination.test.ts"`
Expected: FAIL — `result.total` is undefined.

- [ ] **Step 3: Rewrite the action**

In `apps/admin/src/app/(portal)/_actions/benefits.ts` add the Task 1 imports and replace `listBenefits`:

```ts
import {
  type ListParams,
  type PaginatedResult,
  paginationQueries,
} from "@/lib/list-params";

export async function listBenefits(
  params: ListParams & {
    campusId?: string;
    status?: string;
    kind?: string;
  }
): Promise<PaginatedResult<CampusBenefits>> {
  const ctx = await requireAuth();
  // Private admin read: the service client bypasses row security, so the
  // relationship scope filters below are the authorization boundary.
  const { db } = await createAdminClient();

  const queries: string[] = [
    Query.orderAsc("sort_order"),
    Query.orderDesc("$updatedAt"),
    ...paginationQueries(params),
  ];

  if (params.status && params.status !== "all") {
    queries.push(Query.equal("status", params.status));
  }

  if (params.kind) {
    queries.push(Query.equal("kind", params.kind));
  }

  // Titles are duplicated onto the row, so one query covers both locales —
  // no content_translations round trip needed here.
  if (params.q) {
    queries.push(
      Query.or([
        Query.contains("title_nb", params.q),
        Query.contains("title_en", params.q),
      ])
    );
  }

  queries.push(...applyContentRelationshipScopeQueries(ctx));

  const response = await db.listRows<CampusBenefits>(
    "app",
    "campus_benefits",
    queries
  );

  return {
    rows: response.rows,
    total: response.total,
    page: params.page,
    size: params.size,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/admin && bun test "src/app/(portal)/_actions/benefits-pagination.test.ts"`
Expected: PASS, 3 tests.

- [ ] **Step 5: Verify `Query.contains` is accepted on these unindexed columns**

The spec flags this as the one unverified assumption. Start the app and hit the surface with a search:

Run: `cd /Users/markus/Documents/dev/BISO-Sites && bun run dev --filter=admin`
Open `http://localhost:3001/benefits?q=test` and check the terminal for an Appwrite error.
Expected: results render, no `Attribute not found in schema` or index error.

If Appwrite rejects it: add a fulltext index on `title_nb` and `title_en` to `campus_benefits` in the Appwrite console, regenerate with `appwrite types -l ts ./types` and pull `appwrite.config.json` via the CLI, then switch `Query.contains` to `Query.search` in the action and the test. Do not hand-edit `appwrite.config.json`.

- [ ] **Step 6: Add the search box component**

Create `apps/admin/src/app/(portal)/benefits/_components/benefits-search.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import { SearchToolbar } from "../../_components/search-toolbar";
import { useUrlSearch } from "../../_components/use-list-params";

export function BenefitsSearch() {
  const tc = useTranslations("adminPortal.common");
  const [value, setValue] = useUrlSearch();

  return (
    <SearchToolbar
      defaultSearch={value}
      onSearch={setValue}
      placeholder={tc("search")}
    />
  );
}
```

- [ ] **Step 7: Update the page**

In `apps/admin/src/app/(portal)/benefits/page.tsx`:

```tsx
import { parseListParams } from "@/lib/list-params";
import { PaginationBar } from "../_components/pagination-bar";
import { BenefitsSearch } from "./_components/benefits-search";

export default async function BenefitsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireNavAccess("portal.benefits");
  const t = await getTranslations("adminPortal.benefits");

  const params = parseListParams(await searchParams);
  const { rows: benefits, total } = await listBenefits(params);
```

Render `<BenefitsSearch />` directly below `</StudioPageHeader>`, and `<PaginationBar page={params.page} size={params.size} total={total} />` after the closing `</div>` of the benefits grid.

Keep the existing `benefits.length === 0` EmptyState branch, but only show it when there is no active search — an empty search result should say so rather than invite creating a benefit. Change the condition to:

```tsx
      {benefits.length === 0 && !params.q ? (
```

and add, for the searched-but-empty case, immediately after that ternary's closing:

```tsx
      {benefits.length === 0 && params.q ? (
        <EmptyState
          icon={<Gift size={28} />}
          title={t("empty")}
        />
      ) : null}
```

- [ ] **Step 8: Type-check and build**

Run: `cd /Users/markus/Documents/dev/BISO-Sites && bun run check-types --filter=admin && bun run build --filter=admin`
Expected: both PASS.

- [ ] **Step 9: Commit**

```bash
bun x ultracite fix
git add apps/admin/src/app/\(portal\)/_actions/benefits.ts apps/admin/src/app/\(portal\)/_actions/benefits-pagination.test.ts apps/admin/src/app/\(portal\)/benefits/
git commit -m "feat(admin): paginate and search member benefits"
```

---

### Task 8: Paginate and search benefit partners

**Files:**
- Modify: `apps/admin/src/app/(portal)/_actions/benefits.ts` (the `listPartners` function)
- Modify: `apps/admin/src/app/(portal)/benefits/partners/page.tsx`
- Create: `apps/admin/src/app/(portal)/benefits/partners/_components/partners-search.tsx`
- Test: `apps/admin/src/app/(portal)/_actions/benefits-pagination.test.ts` (extend the file from Task 7)

**Interfaces:**
- Consumes: Task 1 exports, `PaginationBar` (Task 2), `useUrlSearch` (Task 3).
- Produces: `listPartners(params: ListParams & { campusId?: string }) => Promise<PaginatedResult<Partners>>`. **Breaking change** — previously returned `Partners[]`.

`partners` has a fulltext index (`idx_name`) on `name`, so this is spec case 1 — search the row directly.

- [ ] **Step 1: Write the failing test**

Append to `apps/admin/src/app/(portal)/_actions/benefits-pagination.test.ts`:

```ts
const { listPartners } = await import("./benefits");

describe("listPartners pagination", () => {
  beforeEach(() => {
    db.listRows.mockReset();
  });

  test("reports the true total and offsets correctly", async () => {
    db.listRows.mockResolvedValueOnce({ rows: [{ $id: "p1" }], total: 312 });

    const result = await listPartners({ page: 2, size: 100, q: "" });

    expect(result.total).toBe(312);
    const queries = db.listRows.mock.calls[0][2] as string[];
    expect(queries).toContain(Query.limit(100));
    expect(queries).toContain(Query.offset(100));
  });

  test("searches the indexed name column", async () => {
    db.listRows.mockResolvedValueOnce({ rows: [], total: 0 });

    await listPartners({ page: 1, size: 25, q: "sats" });

    const queries = db.listRows.mock.calls[0][2] as string[];
    expect(queries).toContain(Query.contains("name", "sats"));
  });

  test("keeps campus scoping for a non-global admin on a deep page", async () => {
    db.listRows.mockResolvedValueOnce({ rows: [], total: 0 });

    await listPartners({ page: 5, size: 25, q: "" });

    const queries = db.listRows.mock.calls[0][2] as string[];
    expect(queries).toContain(Query.equal("campus_id", ["campus-oslo"]));
    expect(queries).toContain(Query.offset(100));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/admin && bun test "src/app/(portal)/_actions/benefits-pagination.test.ts"`
Expected: the three new tests FAIL — `result.total` is undefined.

- [ ] **Step 3: Rewrite the action**

Replace `listPartners` in `apps/admin/src/app/(portal)/_actions/benefits.ts`:

```ts
export async function listPartners(
  params: ListParams & { campusId?: string }
): Promise<PaginatedResult<Partners>> {
  const ctx = await requireAuth();
  // Partner administration keeps its existing narrow, campus-scoped access.
  const { db } = await createSessionClient();

  const queries: string[] = [
    Query.orderAsc("name"),
    ...paginationQueries(params),
  ];

  // `partners` carries a fulltext index on name (idx_name).
  if (params.q) {
    queries.push(Query.contains("name", params.q));
  }

  if (params.campusId) {
    queries.push(Query.equal("campus_id", params.campusId));
  } else if (ctx.activeCampusId) {
    // Global admin scoped to a campus via the switcher.
    queries.push(Query.equal("campus_id", [ctx.activeCampusId]));
  } else if (
    ctx.managedCampusIds.length > 0 &&
    !ctx.roles.includes("globaladmin")
  ) {
    queries.push(Query.equal("campus_id", ctx.managedCampusIds));
  }

  const response = await db.listRows<Partners>("app", "partners", queries);

  return {
    rows: response.rows,
    total: response.total,
    page: params.page,
    size: params.size,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/admin && bun test "src/app/(portal)/_actions/benefits-pagination.test.ts"`
Expected: PASS, 6 tests (3 from Task 7, 3 new).

- [ ] **Step 5: Add the search box and update the page**

Create `apps/admin/src/app/(portal)/benefits/partners/_components/partners-search.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import { SearchToolbar } from "../../../_components/search-toolbar";
import { useUrlSearch } from "../../../_components/use-list-params";

export function PartnersSearch() {
  const tc = useTranslations("adminPortal.common");
  const [value, setValue] = useUrlSearch();

  return (
    <SearchToolbar
      defaultSearch={value}
      onSearch={setValue}
      placeholder={tc("search")}
    />
  );
}
```

In `apps/admin/src/app/(portal)/benefits/partners/page.tsx`, accept and parse `searchParams`, call `listPartners(params)`, read `.rows`, render `<PartnersSearch />` above the list and `<PaginationBar page={params.page} size={params.size} total={total} />` below it.

- [ ] **Step 6: Type-check and build**

Run: `cd /Users/markus/Documents/dev/BISO-Sites && bun run check-types --filter=admin && bun run build --filter=admin`
Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
bun x ultracite fix
git add apps/admin/src/app/\(portal\)/_actions/benefits.ts apps/admin/src/app/\(portal\)/_actions/benefits-pagination.test.ts apps/admin/src/app/\(portal\)/benefits/partners/
git commit -m "feat(admin): paginate and search benefit partners"
```

---

### Task 9: Paginate departments without breaking triage counts

**Files:**
- Modify: `apps/admin/src/app/(portal)/_actions/departments.ts:23-60` (`listDepartments`)
- (No new action file: `countDepartmentTriage` is added to `departments.ts` as another `async` export, since `"use server"` files may only export async functions.)
- Modify: `apps/admin/src/app/(portal)/departments/page.tsx:56-105`
- Test: `apps/admin/src/app/(portal)/_actions/departments.test.ts` (extend the existing file)

**Interfaces:**
- Consumes: Task 1 exports, `PaginationBar` (Task 2), `parseUnitCategory` / `UNIT_CATEGORIES` from `@repo/shared/utils/unit-categories`.
- Produces:
  - `listDepartments(params: ListParams & { campusId?: string; ids?: string[]; includeInactive?: boolean; type?: string }) => Promise<PaginatedResult<Departments>>` — **breaking change**, previously `Departments[]`.
  - `countDepartmentTriage(opts: { ids?: string[]; includeInactive?: boolean; campusId?: string }) => Promise<Record<string, number>>` — keys are `all`, each `UNIT_CATEGORIES` value, `uncategorised`, `missing_logo`.

**Why this task is bigger than the other tier-1 surfaces:** `listDepartments` currently loads 500 rows on purpose. `departments/page.tsx` computes the triage chip counts (`uncategorised`, `missing_logo`, per-category) across that full set, with a comment stating the counts are only truthful if nothing is cut off. Paginating the list alone would silently corrupt every chip. The fix is two queries: a cheap projection for counts, and a paginated query for the visible rows.

- [ ] **Step 1: Write the failing test**

Append to `apps/admin/src/app/(portal)/_actions/departments.test.ts` (reuse the mocks already set up at the top of that file; if it mocks `createSessionClient` with a different `db` name, use that name):

```ts
describe("listDepartments pagination", () => {
  beforeEach(() => {
    db.listRows.mockReset();
  });

  test("returns the true total and the requested slice", async () => {
    db.listRows.mockResolvedValueOnce({ rows: [{ $id: "d1" }], total: 280 });

    const result = await listDepartments({
      page: 3,
      size: 25,
      q: "",
      includeInactive: true,
    });

    expect(result.total).toBe(280);
    const queries = db.listRows.mock.calls[0][2] as string[];
    expect(queries).toContain(Query.limit(25));
    expect(queries).toContain(Query.offset(50));
  });

  test("pushes the uncategorised filter into the query, not into JS", async () => {
    db.listRows.mockResolvedValueOnce({ rows: [], total: 0 });

    await listDepartments({
      page: 1,
      size: 25,
      q: "",
      includeInactive: true,
      type: "uncategorised",
    });

    const queries = db.listRows.mock.calls[0][2] as string[];
    expect(queries).toContain(Query.isNull("type"));
  });

  test("pushes the missing_logo filter into the query", async () => {
    db.listRows.mockResolvedValueOnce({ rows: [], total: 0 });

    await listDepartments({
      page: 1,
      size: 25,
      q: "",
      includeInactive: true,
      type: "missing_logo",
    });

    const queries = db.listRows.mock.calls[0][2] as string[];
    expect(queries).toContain(
      Query.or([Query.equal("logo", ""), Query.isNull("logo")])
    );
  });

  test("searches the indexed Name column", async () => {
    db.listRows.mockResolvedValueOnce({ rows: [], total: 0 });

    await listDepartments({ page: 1, size: 25, q: "biso", includeInactive: true });

    const queries = db.listRows.mock.calls[0][2] as string[];
    expect(queries).toContain(Query.contains("Name", "biso"));
  });

  test("short-circuits an empty id scope without querying", async () => {
    const result = await listDepartments({
      page: 1,
      size: 25,
      q: "",
      ids: [],
    });

    expect(result).toEqual({ rows: [], total: 0, page: 1, size: 25 });
    expect(db.listRows).not.toHaveBeenCalled();
  });
});

describe("countDepartmentTriage", () => {
  beforeEach(() => {
    db.listRows.mockReset();
  });

  test("counts across the full scoped set, not one page", async () => {
    db.listRows.mockResolvedValueOnce({
      rows: [
        { $id: "d1", type: null, logo: "" },
        { $id: "d2", type: null, logo: "https://x/logo.png" },
        { $id: "d3", type: "committee", logo: "" },
      ],
      total: 3,
    });

    const counts = await countDepartmentTriage({ includeInactive: true });

    expect(counts.all).toBe(3);
    expect(counts.uncategorised).toBe(2);
    expect(counts.missing_logo).toBe(2);
    expect(counts.committee).toBe(1);
  });

  test("selects only the three columns it needs", async () => {
    db.listRows.mockResolvedValueOnce({ rows: [], total: 0 });

    await countDepartmentTriage({ includeInactive: true });

    const queries = db.listRows.mock.calls[0][2] as string[];
    expect(queries).toContain(Query.select(["$id", "type", "logo"]));
  });
});
```

Add `countDepartmentTriage` to the file's import of `./departments`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/admin && bun test "src/app/(portal)/_actions/departments.test.ts"`
Expected: FAIL — `countDepartmentTriage` is not exported.

- [ ] **Step 3: Rewrite the action and add the counts function**

In `apps/admin/src/app/(portal)/_actions/departments.ts`, add the imports:

```ts
import {
  parseUnitCategory,
  UNIT_CATEGORIES,
} from "@repo/shared/utils/unit-categories";
import {
  emptyResult,
  type ListParams,
  type PaginatedResult,
  paginationQueries,
} from "@/lib/list-params";
```

Replace `listDepartments`:

```ts
export async function listDepartments(
  params: ListParams & {
    campusId?: string;
    ids?: string[];
    includeInactive?: boolean;
    /** A UnitCategory value, or the triage pseudo-filters. */
    type?: string;
  }
): Promise<PaginatedResult<Departments>> {
  const ctx = await requireAuth();
  const { db } = await createSessionClient();

  const queries: string[] = [
    Query.orderAsc("Name"),
    ...paginationQueries(params),
  ];

  // Explicit id scoping for department users. The departments table is
  // read("any"), so this filter IS the authorization boundary — it cannot be
  // left to row security.
  if (params.ids) {
    if (params.ids.length === 0) {
      return emptyResult<Departments>(params);
    }
    queries.push(Query.equal("$id", params.ids));
  }

  // The SOAP sync persists inactive 24SO units (active === false). By default
  // keep them out of generic pickers; the management view opts in via
  // includeInactive. active is nullable, so legacy rows are treated as active.
  if (!params.includeInactive) {
    queries.push(
      Query.or([Query.equal("active", true), Query.isNull("active")])
    );
  }

  if (params.campusId) {
    queries.push(Query.equal("campus_id", params.campusId));
  }

  // Triage filters used to run in JS over the full 500-row load. They are
  // expressible as queries, so they now run before pagination.
  if (params.type === "uncategorised") {
    queries.push(Query.isNull("type"));
  } else if (params.type === "missing_logo") {
    queries.push(Query.or([Query.equal("logo", ""), Query.isNull("logo")]));
  } else if (params.type) {
    queries.push(Query.equal("type", params.type));
  }

  // `departments` carries a fulltext index (`search`) covering Name.
  if (params.q) {
    queries.push(Query.contains("Name", params.q));
  }

  const response = await db.listRows<Departments>(
    "app",
    "departments",
    queries
  );

  return {
    rows: response.rows,
    total: response.total,
    page: params.page,
    size: params.size,
  };
}

/**
 * Triage chip counts across the FULL scoped set. The list itself is paginated,
 * so the counts cannot be derived from the visible rows — they would report
 * one page's worth. This projects only $id/type/logo, which keeps a 500-row
 * read cheap enough to run alongside the page query.
 */
export async function countDepartmentTriage(opts: {
  campusId?: string;
  ids?: string[];
  includeInactive?: boolean;
}): Promise<Record<string, number>> {
  await requireAuth();
  const { db } = await createSessionClient();

  const counts: Record<string, number> = { all: 0, missing_logo: 0, uncategorised: 0 };
  for (const category of UNIT_CATEGORIES) {
    counts[category] = 0;
  }

  if (opts.ids && opts.ids.length === 0) {
    return counts;
  }

  const queries: string[] = [
    Query.select(["$id", "type", "logo"]),
    Query.limit(500),
  ];

  if (opts.ids) {
    queries.push(Query.equal("$id", opts.ids));
  }
  if (!opts.includeInactive) {
    queries.push(
      Query.or([Query.equal("active", true), Query.isNull("active")])
    );
  }
  if (opts.campusId) {
    queries.push(Query.equal("campus_id", opts.campusId));
  }

  const response = await db.listRows<Departments>(
    "app",
    "departments",
    queries
  );

  counts.all = response.rows.length;
  for (const department of response.rows) {
    const category = parseUnitCategory(department.type);
    const key = category ?? "uncategorised";
    counts[key] = (counts[key] ?? 0) + 1;
    if (!department.logo?.trim()) {
      counts.missing_logo += 1;
    }
  }

  return counts;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/admin && bun test "src/app/(portal)/_actions/departments.test.ts"`
Expected: PASS — the new tests plus every pre-existing test in the file.

- [ ] **Step 5: Find and fix the other callers of `listDepartments`**

Run: `cd apps/admin && grep -rn "listDepartments(" src`
Every caller now gets a `PaginatedResult` and must read `.rows`, and must pass `page`/`size`/`q`. For non-list callers that genuinely want everything (pickers), pass `{ page: 1, size: 100, q: "" }` and read `.rows`; if a picker needs more than 100 rows, add a comment saying so and use a loop rather than silently truncating.
Expected: every call site compiles after the edit.

- [ ] **Step 6: Update the page**

In `apps/admin/src/app/(portal)/departments/page.tsx`:

- Delete the `matchesFilter` and `hasLogo` helpers and the in-JS `counts` loop — the query and `countDepartmentTriage` replace them. Keep `isDepartmentFilter`, `TRIAGE_FILTERS`, and `DepartmentFilter`.
- Change the signature and data fetch:

```tsx
export default async function DepartmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireNavAccess("portal.departments");
  const landing = resolveDepartmentsLanding(ctx);

  if (landing.kind === "forbidden") {
    notFound();
  }
  if (landing.kind === "redirect") {
    redirect(`/departments/${landing.departmentId}`);
  }

  const t = await getTranslations("adminPortal.departments");
  const resolvedSearchParams = await searchParams;
  const params = parseListParams(resolvedSearchParams);
  const rawFilter = Array.isArray(resolvedSearchParams.type)
    ? resolvedSearchParams.type[0]
    : resolvedSearchParams.type;
  const filter: DepartmentFilter = isDepartmentFilter(rawFilter)
    ? rawFilter
    : "all";

  const [departments, counts, campuses] = await Promise.all([
    listDepartments({
      ...params,
      includeInactive: true,
      ids: landing.scopeIds,
      type: filter === "all" ? undefined : filter,
    }),
    countDepartmentTriage({ includeInactive: true, ids: landing.scopeIds }),
    listCampuses(),
  ]);

  const visible = departments.rows;
```

- Replace `counts.get("missing_logo") ?? 0` with `counts.missing_logo`, `counts.get("uncategorised") ?? 0` with `counts.uncategorised`, and `departments.length` in `triageSummary` with `counts.all`.
- Each filter chip `<Link>` must preserve `size` and `q` while dropping `page`. Build its href as:

```tsx
const chipHref = (key: DepartmentFilter) => {
  const next = new URLSearchParams();
  if (key !== "all") {
    next.set("type", key);
  }
  if (params.q) {
    next.set("q", params.q);
  }
  if (params.size !== 25) {
    next.set("size", String(params.size));
  }
  const qs = next.toString();
  return qs ? `/departments?${qs}` : "/departments";
};
```

- Add the bar after the list:

```tsx
      <PaginationBar
        page={params.page}
        size={params.size}
        total={departments.total}
      />
```

with `import { parseListParams } from "@/lib/list-params";` and `import { PaginationBar } from "../_components/pagination-bar";`.

- [ ] **Step 7: Verify the counts against the old behaviour**

Run: `cd /Users/markus/Documents/dev/BISO-Sites && bun run dev --filter=admin`
Open `http://localhost:3001/departments` and note the triage summary numbers. Then open `http://localhost:3001/departments?page=3`.
Expected: the summary and every chip count are **identical** on both pages — they describe the whole set, not the visible page. Only the listed cards change.

- [ ] **Step 8: Type-check and build**

Run: `cd /Users/markus/Documents/dev/BISO-Sites && bun run check-types --filter=admin && bun run build --filter=admin`
Expected: both PASS.

- [ ] **Step 9: Commit**

```bash
bun x ultracite fix
git add apps/admin/src/app/\(portal\)/_actions/departments.ts apps/admin/src/app/\(portal\)/_actions/departments.test.ts apps/admin/src/app/\(portal\)/departments/
git commit -m "feat(admin): paginate departments with full-set triage counts"
```

---

## Done criteria for Plan A

- [ ] `bun test ./src` passes in `apps/admin`.
- [ ] `bun run check-types` passes at the repo root.
- [ ] `bun run build --filter=admin` passes.
- [ ] Every surface in this plan supports `?page=`, `?size=`, and (where added) `?q=` from the address bar, and back/forward works.
- [ ] Departments triage counts are identical on page 1 and page 3.

## What Plan A deliberately leaves out

- `content-search.ts` (the translations two-step) — nothing in Plan A needs it. It lands in Plan B with the first translated surface.
- Tier 2 surfaces: news, documents, communications, pages, members, IT users → **Plan B**.
- Tier 4 surfaces: drafts, submissions → **Plan B**.
- Dashboards: jobs, applications, events, shop → **Plan C**.
- Orders export → **Plan D** (depends on Plan C's shop work).
