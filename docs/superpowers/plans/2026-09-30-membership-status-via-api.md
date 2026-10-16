# Membership Status via `apps/api` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `apps/api` the only place membership status is computed and cached (60s, invalidated on fulfilment), and have `apps/web` read it from there.

**Architecture:** `api` keeps `computeMembershipStatus()` behind its `unstable_cache`, drops the TTL to 60s, and clears a student's entry whenever one of its settlement paths fulfils a membership order. `api` `/api/membership` gains a slim `?view=status` mode returning the raw `MembershipStatus`. `web`'s `lib/actions/membership.ts` keeps its exports but calls that endpoint server-to-server with the student's session JWT instead of computing locally.

**Tech Stack:** Next.js 16 (App Router, route handlers, `unstable_cache`/`revalidateTag`), React `cache()`, Appwrite via `@repo/api`, Vitest, Bun workspaces, Turborepo.

**Spec:** `docs/superpowers/specs/2026-09-30-membership-status-via-api-design.md`

## Global Constraints

- Package manager is Bun; run scripts with `bun run …`, never npm/pnpm.
- `api` membership cache TTL: **60 seconds**.
- `web` → `api` call timeout: **5 seconds** (`MEMBERSHIP_API_TIMEOUT_MS = 5000`).
- Slim view query: `view=status`; refresh query: `refresh=1` (same as the existing full view).
- New transient reasons: `api_unavailable`, `profile_unavailable`.
- No per-student membership rows in the database. Do not edit `packages/api/appwrite.config.json` or `packages/api/types/appwrite.ts`.
- `packages/shared` must not import Next.js cache APIs; it only reports the fulfilled student number.
- Settlement helpers never throw (they run inside webhook/return paths).
- Web never sends a student number to `api`; `api` resolves it from the JWT's user.
- Style: Ultracite/Biome. Run `bun x ultracite fix` on touched files before each commit.
- `bun run check-types` must pass before the branch is finished.

## Review Focus

1. **A fulfilment that succeeds but whose cache invalidation throws** (e.g. `revalidateTag` outside a request store) — the payment webhook/return must still succeed. Pinned in Task 4 (`settleOrder` swallows an invalidation error).
2. **`api` returns 200 with a body that is not a `MembershipStatus`** (proxy error page, old deployment returning the full overview shape without `finagoCategoryIds`) — web must report `api_unavailable`, not crash or say "not a member". Pinned in Task 6 (bad-shape body test).
3. **`createSessionJwt()` throws during an Appwrite outage** — web must report `api_unavailable`, not `unexpected_error` or a thrown render. Pinned in Task 6.
4. **A just-failed Finago read, then the student's purchase is fulfilled** — the failure throttle must not keep serving the stale failure for up to a minute. Pinned in Task 3 (invalidation clears `recentFailures`).
5. **Old Flutter clients calling `/api/membership` without `view`** — response must be byte-for-byte the existing overview. Pinned in Task 5 (existing tests kept, plus one asserting the overview keys when `view` is absent or unknown).

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `packages/shared/utils/membership-gate.ts` | Modify | Transient reason set |
| `packages/shared/utils/membership-fulfilment.ts` | Modify | Report `studentNumber` on success |
| `packages/shared/utils/order-settlement.ts` | Modify | Return `{ membershipStudentNumber? }` |
| `packages/shared/utils/order-settlement.test.ts` | Create | Settlement result tests |
| `apps/api/src/lib/membership-status-cache.ts` | Modify | 60s TTL, `invalidateMembershipStatus` |
| `apps/api/src/lib/settle-order.ts` | Create | Settle + invalidate wrapper |
| `apps/api/src/app/api/payment/return/route.ts` | Modify | Use `settleOrder` |
| `apps/api/src/app/api/payment/[provider]/callback/route.ts` | Modify | Use `settleOrder` |
| `apps/api/src/app/api/payment/orders/[orderId]/route.ts` | Modify | Use `settleOrder` |
| `apps/api/src/app/api/cron/reconcile-orders/route.ts` | Modify | Invalidate after fulfilment |
| `apps/api/src/app/api/membership/route.ts` | Modify | `?view=status` |
| `apps/web/src/lib/actions/membership.ts` | Rewrite | Call `api` instead of computing |
| `apps/web/src/lib/actions/membership.test.ts` | Rewrite | Fetch-based tests |

---

### Task 1: Transient reasons for api/profile failures

**Files:**
- Modify: `packages/shared/utils/membership-gate.ts:19-22`
- Test: `packages/shared/utils/membership-gate.test.ts`

**Interfaces:**
- Produces: `isTransientMembershipReason("api_unavailable") === true`, `isTransientMembershipReason("profile_unavailable") === true`.

- [ ] **Step 1: Write the failing test**

Change the import at the top of `packages/shared/utils/membership-gate.test.ts`:

```ts
import {
  isTransientMembershipReason,
  resolveMembershipGate,
} from "./membership-gate";
```

Append:

```ts
describe("isTransientMembershipReason", () => {
  it.each([
    "finago_error",
    "unexpected_error",
    "api_unavailable",
    "profile_unavailable",
  ])("treats %s as a failed check", (reason) => {
    expect(isTransientMembershipReason(reason)).toBe(true);
  });

  it.each(["no_categories", "expired", "not_authenticated", null, undefined])(
    "treats %s as a real answer",
    (reason) => {
      expect(isTransientMembershipReason(reason)).toBe(false);
    }
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared && bun run test -- utils/membership-gate.test.ts`
Expected: FAIL on `api_unavailable` and `profile_unavailable`.

- [ ] **Step 3: Implement**

In `packages/shared/utils/membership-gate.ts` replace the set:

```ts
// `MembershipStatus.reason` values that mean the check itself failed
// transiently — Finago timed out or errored, the profile could not be read,
// or the website could not reach apps/api — as opposed to a legitimate
// resolved state such as `no_categories` (genuinely not a member) or
// `not_authenticated`/`no_student_id`/`invalid_student_id` (already handled by
// the earlier gate checks in this function, before `status.reason` is even
// consulted).
const TRANSIENT_STATUS_REASONS: ReadonlySet<string> = new Set([
  "api_unavailable",
  "finago_error",
  "profile_unavailable",
  "unexpected_error",
]);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/shared && bun run test -- utils/membership-gate.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
bun x ultracite fix packages/shared/utils/membership-gate.ts packages/shared/utils/membership-gate.test.ts
git add packages/shared/utils/membership-gate.ts packages/shared/utils/membership-gate.test.ts
git commit -m "feat(shared): treat api and profile read failures as transient membership reasons"
```

---

### Task 2: Report the fulfilled student number from settlement

**Files:**
- Modify: `packages/shared/utils/membership-fulfilment.ts` (interface `MembershipFulfilmentResult` ~line 56; final `return` ~line 577)
- Modify: `packages/shared/utils/order-settlement.ts:28-49`
- Modify: `packages/shared/utils/membership-fulfilment.test.ts` (three `toEqual({ fulfilled: true, invoiceId: 556_677 })` assertions, ~lines 166, 338, 363)
- Create: `packages/shared/utils/order-settlement.test.ts`

**Interfaces:**
- Produces:
  - `MembershipFulfilmentResult.studentNumber?: number` — set only when `fulfilled: true`.
  - `export interface SettlementResult { membershipStudentNumber?: number }`
  - `settleOrderIfPaid(orderId: string, db: DbClient): Promise<SettlementResult>` — still never throws.

- [ ] **Step 1: Write the failing tests**

In `packages/shared/utils/membership-fulfilment.test.ts`, change each of the three success assertions to:

```ts
expect(result).toEqual({
  fulfilled: true,
  invoiceId: 556_677,
  studentNumber: 1_715_738,
});
```

(If a success test's fixture uses a different profile `student_id`, use that fixture's sanitised number instead — check `wireReads`/the profile fixture in the file.)

Create `packages/shared/utils/order-settlement.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fulfilMembershipOrder: vi.fn(),
  isMembershipOrder: vi.fn(),
  postFinagoTransactionForOrder: vi.fn(),
}));

vi.mock("./finago-order-posting", () => ({
  postFinagoTransactionForOrder: mocks.postFinagoTransactionForOrder,
}));
vi.mock("./membership-fulfilment", () => ({
  fulfilMembershipOrder: mocks.fulfilMembershipOrder,
  isMembershipOrder: mocks.isMembershipOrder,
}));

import { settleOrderIfPaid } from "./order-settlement";

const db = { getRow: vi.fn() };

describe("settleOrderIfPaid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    db.getRow.mockResolvedValue({ $id: "order-1", status: "paid" });
  });

  it("reports the student whose membership it fulfilled", async () => {
    mocks.isMembershipOrder.mockReturnValue(true);
    mocks.fulfilMembershipOrder.mockResolvedValue({
      fulfilled: true,
      invoiceId: 1,
      studentNumber: 1_715_738,
    });

    await expect(settleOrderIfPaid("order-1", db as never)).resolves.toEqual({
      membershipStudentNumber: 1_715_738,
    });
  });

  it("reports nothing when the membership was not fulfilled on this call", async () => {
    mocks.isMembershipOrder.mockReturnValue(true);
    mocks.fulfilMembershipOrder.mockResolvedValue({
      fulfilled: false,
      reason: "already_fulfilled",
    });

    await expect(settleOrderIfPaid("order-1", db as never)).resolves.toEqual(
      {}
    );
  });

  it("reports nothing for a shop order", async () => {
    mocks.isMembershipOrder.mockReturnValue(false);

    await expect(settleOrderIfPaid("order-1", db as never)).resolves.toEqual(
      {}
    );
    expect(mocks.postFinagoTransactionForOrder).toHaveBeenCalledWith(
      "order-1",
      db
    );
  });

  it("reports nothing for an unpaid order", async () => {
    db.getRow.mockResolvedValue({ $id: "order-1", status: "pending" });

    await expect(settleOrderIfPaid("order-1", db as never)).resolves.toEqual(
      {}
    );
    expect(mocks.fulfilMembershipOrder).not.toHaveBeenCalled();
  });

  it("never throws", async () => {
    db.getRow.mockRejectedValue(new Error("appwrite down"));

    await expect(settleOrderIfPaid("order-1", db as never)).resolves.toEqual(
      {}
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/shared && bun run test -- utils/membership-fulfilment.test.ts utils/order-settlement.test.ts`
Expected: FAIL — `studentNumber` missing; `settleOrderIfPaid` resolves `undefined`.

- [ ] **Step 3: Implement**

In `packages/shared/utils/membership-fulfilment.ts`, add to `MembershipFulfilmentResult` (after `reason?: …;`):

```ts
  /**
   * The buyer's sanitised student number — the key of their membership status
   * cache. Set only when `fulfilled` is true, so the caller can invalidate it.
   */
  studentNumber?: number;
```

and change the final success return of `fulfilMembershipOrder`:

```ts
  return {
    fulfilled: true,
    invoiceId: postResult.invoiceId,
    studentNumber: identity.studentNumber,
  };
```

In `packages/shared/utils/order-settlement.ts`, replace the function (keep the doc comment, and append one paragraph to it):

```ts
export interface SettlementResult {
  /**
   * Set when this call fulfilled a membership order: the student whose
   * membership status cache the caller should now invalidate.
   */
  membershipStudentNumber?: number;
}

/**
 * …existing doc comment…
 *
 * Returns the fulfilled student's number for a membership order settled on
 * this call, so an app with a membership cache can invalidate it.
 */
export async function settleOrderIfPaid(
  orderId: string,
  db: DbClient
): Promise<SettlementResult> {
  try {
    const order = (await db.getRow("app", "orders", orderId, [
      ORDER_ITEMS_SELECT,
    ])) as FinagoOrder | null;
    if (
      !(order && (order.status === "paid" || order.status === "authorized"))
    ) {
      return {};
    }
    if (isMembershipOrder(order)) {
      const result = await fulfilMembershipOrder(orderId, db);
      return result.fulfilled && result.studentNumber !== undefined
        ? { membershipStudentNumber: result.studentNumber }
        : {};
    }
    await postFinagoTransactionForOrder(orderId, db);
    return {};
  } catch (error) {
    console.error(`[order-settlement] failed for ${orderId}:`, error);
    return {};
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/shared && bun run test -- utils/membership-fulfilment.test.ts utils/order-settlement.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
bun x ultracite fix packages/shared/utils/membership-fulfilment.ts packages/shared/utils/membership-fulfilment.test.ts packages/shared/utils/order-settlement.ts packages/shared/utils/order-settlement.test.ts
git add packages/shared/utils/membership-fulfilment.ts packages/shared/utils/membership-fulfilment.test.ts packages/shared/utils/order-settlement.ts packages/shared/utils/order-settlement.test.ts
git commit -m "feat(shared): report the fulfilled student number from order settlement"
```

---

### Task 3: 60s `api` cache with explicit invalidation

**Files:**
- Modify: `apps/api/src/lib/membership-status-cache.ts`
- Test: `apps/api/src/lib/membership-status-cache.test.ts`

**Interfaces:**
- Produces: `export function invalidateMembershipStatus(studentNumber: number): void` — purges the student's cache tag (`revalidateTag(tag, { expire: 0 })`) and their failure-throttle entry.
- Produces: `export const MEMBERSHIP_CACHE_TTL_SECONDS = 60` (exported for the test).

- [ ] **Step 1: Write the failing tests**

In `apps/api/src/lib/membership-status-cache.test.ts`, replace the `next/cache` mock so it records the options:

```ts
const cacheOptions = vi.hoisted(() => ({ last: undefined as unknown }));

vi.mock("next/cache", () => ({
  revalidateTag,
  unstable_cache: (
    work: () => Promise<unknown>,
    _keys: string[],
    options: unknown
  ) => {
    cacheOptions.last = options;
    return work;
  },
}));
```

Change the import:

```ts
import {
  getMembershipStatusForStudent,
  invalidateMembershipStatus,
  MEMBERSHIP_CACHE_TTL_SECONDS,
} from "./membership-status-cache";
```

Append:

```ts
describe("membership cache lifetime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("caches for sixty seconds under the student's tag", async () => {
    computeMembershipStatus.mockResolvedValue(statusCheckedAgo(0));

    await getMembershipStatusForStudent(1_715_738);

    expect(MEMBERSHIP_CACHE_TTL_SECONDS).toBe(60);
    expect(cacheOptions.last).toEqual({
      revalidate: 60,
      tags: ["membership:1715738"],
    });
  });
});

describe("invalidateMembershipStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("purges the student's cache tag immediately", () => {
    invalidateMembershipStatus(1_715_738);

    expect(revalidateTag).toHaveBeenCalledWith("membership:1715738", {
      expire: 0,
    });
  });

  it("clears a recent failure so the next read recomputes", async () => {
    computeMembershipStatus.mockRejectedValueOnce(
      new MembershipComputationError("finago_error")
    );
    await getMembershipStatusForStudent(2_000_001);
    computeMembershipStatus.mockResolvedValue(statusCheckedAgo(0));

    invalidateMembershipStatus(2_000_001);
    const status = await getMembershipStatusForStudent(2_000_001);

    expect(status.isMember).toBe(true);
    expect(computeMembershipStatus).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && bun run test -- src/lib/membership-status-cache.test.ts`
Expected: FAIL — `invalidateMembershipStatus` / `MEMBERSHIP_CACHE_TTL_SECONDS` not exported.

- [ ] **Step 3: Implement**

In `apps/api/src/lib/membership-status-cache.ts`:

Replace `const MEMBERSHIP_CACHE_TTL_SECONDS = 10 * 60;` and the "This cache is app-local…" comment with:

```ts
/**
 * How long a computed status is served before 24SevenOffice is asked again.
 *
 * This is the only membership cache: the website reads status from this app
 * (`/api/membership?view=status`), as the student app does. Purchases this
 * app fulfils invalidate the student's entry at once
 * (`invalidateMembershipStatus`, via `settleOrder` and the reconcile cron), so
 * the TTL only bounds how long a membership bought outside our system — in
 * BI's Student app, which writes the category straight to 24SevenOffice —
 * takes to appear.
 */
export const MEMBERSHIP_CACHE_TTL_SECONDS = 60;
```

Update the `getMembershipStatusForStudent` doc comment's "cached for ten minutes like the website's" to "cached for `MEMBERSHIP_CACHE_TTL_SECONDS`".

Append:

```ts
/**
 * Drop a student's cached status — after this app has assigned them a
 * membership category — so their next read asks 24SevenOffice again.
 */
export function invalidateMembershipStatus(studentNumber: number): void {
  recentFailures.delete(studentNumber);
  revalidateTag(membershipCacheTag(studentNumber), { expire: 0 });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/api && bun run test -- src/lib/membership-status-cache.test.ts`
Expected: PASS (existing tests included).

- [ ] **Step 5: Commit**

```bash
bun x ultracite fix apps/api/src/lib/membership-status-cache.ts apps/api/src/lib/membership-status-cache.test.ts
git add apps/api/src/lib/membership-status-cache.ts apps/api/src/lib/membership-status-cache.test.ts
git commit -m "feat(api): 60s membership cache with explicit invalidation"
```

---

### Task 4: Invalidate on every fulfilment path in `api`

**Files:**
- Create: `apps/api/src/lib/settle-order.ts`
- Create: `apps/api/src/lib/settle-order.test.ts`
- Modify: `apps/api/src/app/api/payment/return/route.ts` (import line 14, call ~line 167)
- Modify: `apps/api/src/app/api/payment/[provider]/callback/route.ts` (import line 12, calls ~lines 75, 122)
- Modify: `apps/api/src/app/api/payment/orders/[orderId]/route.ts` (import line 6, calls ~lines 197, 203)
- Modify: `apps/api/src/app/api/payment/return/route.test.ts` (mock of `@repo/shared/utils/order-settlement`)
- Modify: `apps/api/src/app/api/payment/orders/[orderId]/route.test.ts` (mock of `@repo/shared/utils/order-settlement`)
- Modify: `apps/api/src/app/api/cron/reconcile-orders/route.ts` (~line 209)
- Modify: `apps/api/src/app/api/cron/reconcile-orders/route.test.ts`

**Interfaces:**
- Consumes: `settleOrderIfPaid(orderId, db): Promise<SettlementResult>` (Task 2), `invalidateMembershipStatus(studentNumber)` (Task 3), `MembershipFulfilmentResult.studentNumber` (Task 2).
- Produces: `export async function settleOrder(orderId: string, db: DbClient): Promise<void>` — never throws.

- [ ] **Step 1: Write the failing wrapper test**

Create `apps/api/src/lib/settle-order.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invalidateMembershipStatus: vi.fn(),
  settleOrderIfPaid: vi.fn(),
}));

vi.mock("@repo/shared/utils/order-settlement", () => ({
  settleOrderIfPaid: mocks.settleOrderIfPaid,
}));
vi.mock("@/lib/membership-status-cache", () => ({
  invalidateMembershipStatus: mocks.invalidateMembershipStatus,
}));

import { settleOrder } from "./settle-order";

const db = {} as never;

describe("settleOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("invalidates the buyer's membership status after fulfilling it", async () => {
    mocks.settleOrderIfPaid.mockResolvedValue({
      membershipStudentNumber: 1_715_738,
    });

    await settleOrder("order-1", db);

    expect(mocks.settleOrderIfPaid).toHaveBeenCalledWith("order-1", db);
    expect(mocks.invalidateMembershipStatus).toHaveBeenCalledWith(1_715_738);
  });

  it("leaves the cache alone when nothing was fulfilled", async () => {
    mocks.settleOrderIfPaid.mockResolvedValue({});

    await settleOrder("order-1", db);

    expect(mocks.invalidateMembershipStatus).not.toHaveBeenCalled();
  });

  it("does not throw when invalidation fails", async () => {
    mocks.settleOrderIfPaid.mockResolvedValue({
      membershipStudentNumber: 1_715_738,
    });
    mocks.invalidateMembershipStatus.mockImplementation(() => {
      throw new Error("static generation store missing");
    });

    await expect(settleOrder("order-1", db)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/api && bun run test -- src/lib/settle-order.test.ts`
Expected: FAIL — module `./settle-order` not found.

- [ ] **Step 3: Implement the wrapper**

Create `apps/api/src/lib/settle-order.ts`:

```ts
import "server-only";
import { settleOrderIfPaid } from "@repo/shared/utils/order-settlement";
import type { DbClient } from "@repo/shared/utils/vipps-order-ops";
import { invalidateMembershipStatus } from "@/lib/membership-status-cache";

/**
 * `settleOrderIfPaid`, plus: when this call fulfilled a membership, drop the
 * buyer's cached status so the website and the student app see it on their
 * next read instead of after the cache TTL.
 *
 * Never throws, like `settleOrderIfPaid` — it runs inside webhook and return
 * paths that must answer regardless.
 */
export async function settleOrder(
  orderId: string,
  db: DbClient
): Promise<void> {
  const { membershipStudentNumber } = await settleOrderIfPaid(orderId, db);
  if (membershipStudentNumber === undefined) {
    return;
  }
  try {
    invalidateMembershipStatus(membershipStudentNumber);
  } catch (error) {
    console.error(
      `[settle-order] Could not invalidate membership status for order ${orderId}:`,
      error
    );
  }
}
```

If `apps/api` tests do not already mock `server-only` globally, add `vi.mock("server-only", () => ({}));` at the top of `settle-order.test.ts` (the other api tests do this).

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/api && bun run test -- src/lib/settle-order.test.ts`
Expected: PASS

- [ ] **Step 5: Route the three payment paths through `settleOrder`**

In each of `payment/return/route.ts`, `payment/[provider]/callback/route.ts`, `payment/orders/[orderId]/route.ts`:

```ts
// before
import { settleOrderIfPaid } from "@repo/shared/utils/order-settlement";
// after
import { settleOrder } from "@/lib/settle-order";
```

and replace every `await settleOrderIfPaid(` call with `await settleOrder(` (same arguments). Update doc comments in those files that name `settleOrderIfPaid` to name `settleOrder`.

In `payment/return/route.test.ts` and `payment/orders/[orderId]/route.test.ts`, replace the mock and the mock key:

```ts
// before
vi.mock("@repo/shared/utils/order-settlement", () => ({
  settleOrderIfPaid: mocks.settleOrderIfPaid,
}));
// after
vi.mock("@/lib/settle-order", () => ({
  settleOrder: mocks.settleOrderIfPaid,
}));
```

(Keeping the mock variable name `settleOrderIfPaid` avoids touching every assertion; rename it to `settleOrder` throughout the file if you prefer — both are fine.)

- [ ] **Step 6: Write the failing cron test**

In `apps/api/src/app/api/cron/reconcile-orders/route.test.ts`, add to the hoisted `mocks`:

```ts
  invalidateMembershipStatus: vi.fn(),
```

and a mock after the others:

```ts
vi.mock("@/lib/membership-status-cache", () => ({
  invalidateMembershipStatus: mocks.invalidateMembershipStatus,
}));
```

Add to `describe("reconcile-orders cron: membership sweep", …)`:

```ts
  it("invalidates the buyer's membership status after fulfilling", async () => {
    wireListRows([membershipOrder()]);
    mocks.fulfilMembershipOrder.mockResolvedValue({
      fulfilled: true,
      invoiceId: 556_677,
      studentNumber: 1_715_738,
    });

    await GET(cronRequest());

    expect(mocks.invalidateMembershipStatus).toHaveBeenCalledWith(1_715_738);
  });

  it("leaves the cache alone when fulfilment did not happen", async () => {
    wireListRows([membershipOrder()]);
    mocks.fulfilMembershipOrder.mockResolvedValue({
      fulfilled: false,
      reason: "finago_failed",
    });

    await GET(cronRequest());

    expect(mocks.invalidateMembershipStatus).not.toHaveBeenCalled();
  });
```

Run: `cd apps/api && bun run test -- src/app/api/cron/reconcile-orders/route.test.ts`
Expected: FAIL — `invalidateMembershipStatus` not called.

- [ ] **Step 7: Implement the cron invalidation**

In `apps/api/src/app/api/cron/reconcile-orders/route.ts`, add the import:

```ts
import { invalidateMembershipStatus } from "@/lib/membership-status-cache";
```

and change the success branch:

```ts
      const result = await fulfilMembershipOrder(order.$id, db);
      if (result.fulfilled) {
        fulfilled += 1;
        if (result.studentNumber !== undefined) {
          invalidateMembershipStatus(result.studentNumber);
        }
      } else if (
```

(An invalidation error here is caught by the surrounding per-order `catch` and counted as an error; the fulfilment itself has already been committed.)

- [ ] **Step 8: Run the api suite**

Run: `cd apps/api && bun run test`
Expected: PASS (all files, including `payment/return`, `payment/orders/[orderId]`, `payment/[provider]/callback`, cron).

- [ ] **Step 9: Commit**

```bash
bun x ultracite fix apps/api/src/lib/settle-order.ts apps/api/src/lib/settle-order.test.ts apps/api/src/app/api/payment apps/api/src/app/api/cron/reconcile-orders
git add apps/api/src/lib/settle-order.ts apps/api/src/lib/settle-order.test.ts apps/api/src/app/api/payment apps/api/src/app/api/cron/reconcile-orders
git commit -m "feat(api): invalidate membership status whenever a membership is fulfilled"
```

---

### Task 5: Slim `?view=status` on `api` `/api/membership`

**Files:**
- Modify: `apps/api/src/app/api/membership/route.ts` (`GET`, lines ~81-185)
- Test: `apps/api/src/app/api/membership/route.test.ts`

**Interfaces:**
- Consumes: `getMembershipStatusForStudent(studentNumber, { refresh })` (existing), `emptyMembershipStatus(reason)` (existing).
- Produces: `GET /api/membership?view=status[&refresh=1]` → `200` with a raw `MembershipStatus` JSON body (`checkedAt` as epoch ms); `401` `{ message }` without a valid bearer. Web (Task 6) depends on exactly this.

- [ ] **Step 1: Write the failing tests**

Append inside `describe("GET /api/membership", …)` in `apps/api/src/app/api/membership/route.test.ts`:

```ts
  describe("view=status", () => {
    it("returns the raw status without reading the catalog", async () => {
      const member = status({
        finagoCategoryIds: [113_178],
        isMember: true,
        memberships: [{ id: "71", name: "BISO Membership" }],
        reason: undefined,
      });
      getMembershipStatusForStudent.mockResolvedValue(member);

      const response = await GET(overviewRequest("?view=status"));

      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(await response.json()).toEqual(
        JSON.parse(JSON.stringify(member))
      );
      expect(getMembershipStatusForStudent).toHaveBeenCalledWith(1_715_738, {
        refresh: false,
      });
      expect(getMembershipOfferCandidates).not.toHaveBeenCalled();
    });

    it("forces a refresh when asked", async () => {
      await GET(overviewRequest("?view=status&refresh=1"));

      expect(getMembershipStatusForStudent).toHaveBeenCalledWith(1_715_738, {
        refresh: true,
      });
    });

    it("requires a bearer token", async () => {
      const response = await GET(overviewRequest("?view=status", ""));

      expect(response.status).toBe(401);
    });

    it("reports an unlinked student without touching 24SevenOffice", async () => {
      getRow.mockResolvedValue({ $id: "user-1", student_id: null });

      const body = await (await GET(overviewRequest("?view=status"))).json();

      expect(body).toMatchObject({ isMember: false, reason: "no_student_id" });
      expect(body).not.toHaveProperty("state");
      expect(getMembershipStatusForStudent).not.toHaveBeenCalled();
    });

    it("reports an unreadable student id", async () => {
      getRow.mockResolvedValue({ $id: "user-1", student_id: "no-digits" });

      const body = await (await GET(overviewRequest("?view=status"))).json();

      expect(body).toMatchObject({
        isMember: false,
        reason: "invalid_student_id",
      });
    });

    it("reports profile_unavailable when the profile cannot be read", async () => {
      getRow.mockRejectedValue(
        Object.assign(new Error("timeout"), { code: 500 })
      );

      const body = await (await GET(overviewRequest("?view=status"))).json();

      expect(body).toMatchObject({
        isMember: false,
        reason: "profile_unavailable",
      });
      expect(body).not.toHaveProperty("state");
    });

    it("passes a failed Finago read through as its reason", async () => {
      getMembershipStatusForStudent.mockResolvedValue(
        status({ reason: "finago_error" })
      );

      const body = await (await GET(overviewRequest("?view=status"))).json();

      expect(body).toMatchObject({ isMember: false, reason: "finago_error" });
    });
  });

  it.each(["", "?view=overview"])(
    "keeps the full overview for %j",
    async (query) => {
      const body = await (await GET(overviewRequest(query))).json();

      expect(body).toHaveProperty("state");
      expect(body).toHaveProperty("offeredPlans");
      expect(body).toHaveProperty("campuses");
    }
  );
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd apps/api && bun run test -- src/app/api/membership/route.test.ts`
Expected: FAIL — the `view=status` tests get the overview shape (`state` present, catalog read).

- [ ] **Step 3: Implement**

In `apps/api/src/app/api/membership/route.ts`:

Update the `GET` doc comment by appending:

```ts
 *
 * `?view=status` returns only the raw `MembershipStatus` — no gate, plans or
 * campuses. The website reads membership this way so there is one cache, here.
```

Inside `GET`, right after the `json` helper, add:

```ts
  const params = new URL(req.url).searchParams;
  const statusView = params.get("view") === "status";
  const refresh = params.get("refresh") === "1";
```

Delete the later `const refresh = new URL(req.url).searchParams.get("refresh") === "1";` line.

In the profile-read `catch`, before the existing `return json(overviewBody(…))`, add:

```ts
      if (statusView) {
        return json(emptyMembershipStatus("profile_unavailable"));
      }
```

In the `studentNumber === null` branch, compute the reason once and branch:

```ts
    if (studentNumber === null) {
      const reason = studentId ? "invalid_student_id" : "no_student_id";
      if (statusView) {
        return json(emptyMembershipStatus(reason));
      }
      return json(
        overviewBody(
          "needs_bi_link",
          emptyMembershipStatus(reason),
          NO_GATE,
          studentId,
          defaultCampusId
        )
      );
    }

    if (statusView) {
      return json(
        await getMembershipStatusForStudent(studentNumber, { refresh })
      );
    }
```

In the outer `catch`, before the existing `return json(overviewBody(…))`, add:

```ts
    if (statusView) {
      return json(emptyMembershipStatus("unexpected_error"));
    }
```

(`statusView` is declared before the `try`, so it is in scope in the outer `catch`.)

- [ ] **Step 4: Run to verify they pass**

Run: `cd apps/api && bun run test -- src/app/api/membership/route.test.ts`
Expected: PASS (new and existing tests).

- [ ] **Step 5: Commit**

```bash
bun x ultracite fix apps/api/src/app/api/membership/route.ts apps/api/src/app/api/membership/route.test.ts
git add apps/api/src/app/api/membership/route.ts apps/api/src/app/api/membership/route.test.ts
git commit -m "feat(api): slim view=status mode on /api/membership"
```

---

### Task 6: Web reads membership from `api`

**Files:**
- Rewrite: `apps/web/src/lib/actions/membership.ts`
- Rewrite: `apps/web/src/lib/actions/membership.test.ts`

**Interfaces:**
- Consumes: `GET ${NEXT_PUBLIC_API_BASE_URL}/api/membership?view=status[&refresh=1]` (Task 5); `createSessionJwt(): Promise<string | null>` from `@repo/api/server` (existing; returns `null` with no session, throws on outage); `api_unavailable` transient reason (Task 1).
- Produces (unchanged names, all `Promise<MembershipStatus>`): `getMembershipStatus()` (deduped per request), `getLiveMembershipStatus()`, `refreshMembershipStatus()`; type re-exports `MembershipInfo`, `MembershipStatus`.

- [ ] **Step 1: Write the failing tests**

Replace `apps/web/src/lib/actions/membership.test.ts` with:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createSessionJwt = vi.hoisted(() => vi.fn());
const getLoggedInUser = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn());
// React's `cache()` only memoizes inside a server render; stand in for one
// render per test so the per-request dedupe is observable.
const requestScope = vi.hoisted(() => ({ resets: [] as Array<() => void> }));

vi.mock("react", () => ({
  cache: <T>(fn: () => T) => {
    let hit = false;
    let value: T;
    requestScope.resets.push(() => {
      hit = false;
    });
    return () => {
      if (!hit) {
        hit = true;
        value = fn();
      }
      return value;
    };
  },
}));
vi.mock("next/server", () => ({ connection: vi.fn(async () => undefined) }));
vi.mock("next/navigation", () => ({ unstable_rethrow: vi.fn() }));
vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(),
  createSessionJwt,
}));
vi.mock("@repo/connectors/24sevenoffice", () => ({
  getCustomerCategories: vi.fn(),
}));
vi.mock("@/lib/actions/user", () => ({ getLoggedInUser }));

import {
  getLiveMembershipStatus,
  getMembershipStatus,
  refreshMembershipStatus,
} from "./membership";

const API = "https://api.biso.test";

const MEMBER = {
  checkedAt: 1_790_000_000_000,
  expiredMemberships: [],
  finagoCategoryIds: [113_178],
  isMember: true,
  memberships: [
    {
      category: "113178",
      expiryDate: "2027-06-30",
      id: "71",
      name: "BISO Membership fall 2026 and spring 2027",
      startDate: "2026-07-01",
    },
  ],
  upcomingMemberships: [],
};

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

describe("web membership actions", () => {
  beforeEach(() => {
    for (const reset of requestScope.resets) {
      reset();
    }
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", API);
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    getLoggedInUser.mockResolvedValue({
      profile: { student_id: "s1715738" },
      user: { $id: "user-1" },
    });
    createSessionJwt.mockResolvedValue("jwt-1");
    fetchMock.mockResolvedValue(reply(MEMBER));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    fetchMock.mockReset();
    createSessionJwt.mockReset();
    getLoggedInUser.mockReset();
  });

  it("reads the status from the api with the session JWT", async () => {
    await expect(getMembershipStatus()).resolves.toEqual(MEMBER);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API}/api/membership?view=status`);
    expect(init).toMatchObject({
      cache: "no-store",
      headers: { Authorization: "Bearer jwt-1" },
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("asks the api once per request", async () => {
    await getMembershipStatus();
    await getMembershipStatus();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["refreshMembershipStatus", refreshMembershipStatus],
    ["getLiveMembershipStatus", getLiveMembershipStatus],
  ])("%s asks the api to refresh", async (_name, read) => {
    await read();

    expect(fetchMock.mock.calls[0][0]).toBe(
      `${API}/api/membership?view=status&refresh=1`
    );
  });

  it("does not call the api for a visitor who is not signed in", async () => {
    getLoggedInUser.mockResolvedValue(null);

    await expect(getMembershipStatus()).resolves.toMatchObject({
      isMember: false,
      reason: "not_authenticated",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not call the api without a student id", async () => {
    getLoggedInUser.mockResolvedValue({
      profile: { student_id: null },
      user: { $id: "user-1" },
    });

    await expect(getMembershipStatus()).resolves.toMatchObject({
      reason: "no_student_id",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not call the api with an unreadable student id", async () => {
    getLoggedInUser.mockResolvedValue({
      profile: { student_id: "no-digits" },
      user: { $id: "user-1" },
    });

    await expect(getMembershipStatus()).resolves.toMatchObject({
      reason: "invalid_student_id",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("treats a missing session JWT as signed out", async () => {
    createSessionJwt.mockResolvedValue(null);

    await expect(getMembershipStatus()).resolves.toMatchObject({
      reason: "not_authenticated",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports api_unavailable when minting the JWT fails", async () => {
    createSessionJwt.mockRejectedValue(new Error("appwrite down"));

    await expect(getMembershipStatus()).resolves.toMatchObject({
      isMember: false,
      reason: "api_unavailable",
    });
  });

  it("treats a 401 from the api as signed out", async () => {
    fetchMock.mockResolvedValue(reply({ message: "nope" }, 401));

    await expect(getMembershipStatus()).resolves.toMatchObject({
      reason: "not_authenticated",
    });
  });

  it("reports api_unavailable on a server error", async () => {
    fetchMock.mockResolvedValue(reply({ message: "boom" }, 502));

    await expect(getMembershipStatus()).resolves.toMatchObject({
      isMember: false,
      reason: "api_unavailable",
    });
  });

  it("reports api_unavailable on a timeout", async () => {
    fetchMock.mockRejectedValue(
      new DOMException("The operation timed out.", "TimeoutError")
    );

    await expect(getMembershipStatus()).resolves.toMatchObject({
      reason: "api_unavailable",
    });
  });

  it("reports api_unavailable when the body is not JSON", async () => {
    fetchMock.mockResolvedValue(new Response("<html>bad gateway</html>"));

    await expect(getMembershipStatus()).resolves.toMatchObject({
      reason: "api_unavailable",
    });
  });

  it("reports api_unavailable when the body is not a membership status", async () => {
    fetchMock.mockResolvedValue(
      reply({ isMember: true, state: "already_member" })
    );

    await expect(getMembershipStatus()).resolves.toMatchObject({
      isMember: false,
      reason: "api_unavailable",
    });
  });

  it("reports api_unavailable when the api url is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");

    await expect(getMembershipStatus()).resolves.toMatchObject({
      reason: "api_unavailable",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes the api's own failure reason through", async () => {
    fetchMock.mockResolvedValue(
      reply({ ...MEMBER, isMember: false, memberships: [], reason: "finago_error" })
    );

    await expect(getMembershipStatus()).resolves.toMatchObject({
      isMember: false,
      reason: "finago_error",
    });
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd apps/web && bun run test -- src/lib/actions/membership.test.ts`
Expected: FAIL — the current implementation never calls `fetch`.

- [ ] **Step 3: Implement**

Replace `apps/web/src/lib/actions/membership.ts` with:

```ts
"use server";

import { createSessionJwt } from "@repo/api/server";
import { sanitizeStudentNumber } from "@repo/shared/utils/bi-student";
import {
  emptyMembershipStatus,
  type MembershipStatus,
} from "@repo/shared/utils/membership-status";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { getLoggedInUser } from "@/lib/actions/user";

export type {
  MembershipInfo,
  MembershipStatus,
} from "@repo/shared/utils/membership-status";

// Membership status is owned by apps/api (`/api/membership?view=status`): it
// holds the only cache, which it invalidates when it fulfils a purchase, and
// the student app reads the same endpoint. This module only forwards the
// signed-in student's session to it — it never talks to 24SevenOffice itself.

const MEMBERSHIP_API_TIMEOUT_MS = 5000;
const HTTP_UNAUTHORIZED = 401;

function isMembershipStatus(value: unknown): value is MembershipStatus {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<MembershipStatus>;
  return (
    typeof candidate.isMember === "boolean" &&
    typeof candidate.checkedAt === "number" &&
    Array.isArray(candidate.memberships) &&
    Array.isArray(candidate.finagoCategoryIds)
  );
}

/**
 * The answer for a visitor with nothing to look up (not signed in, no or an
 * unreadable student id), or `null` when the api should be asked.
 */
async function statusWithoutLookup(): Promise<MembershipStatus | null> {
  // Membership status is per-request state. `connection()` declares that
  // explicitly, so prerendering stops here instead of running on with an
  // empty cookie store.
  await connection();
  try {
    const userData = await getLoggedInUser();
    if (!userData) {
      return emptyMembershipStatus("not_authenticated");
    }
    const studentId = userData.profile?.student_id;
    if (!studentId) {
      return emptyMembershipStatus("no_student_id");
    }
    if (sanitizeStudentNumber(studentId) === null) {
      return emptyMembershipStatus("invalid_student_id");
    }
    return null;
  } catch (error) {
    // Preserve Next.js control-flow signals (prerender bailout, redirect).
    unstable_rethrow(error);
    console.error("[Membership] Unexpected error:", error);
    return emptyMembershipStatus("unexpected_error");
  }
}

async function readFromApi(refresh: boolean): Promise<MembershipStatus> {
  const early = await statusWithoutLookup();
  if (early) {
    return early;
  }

  try {
    // Null only without a usable session; an Appwrite outage throws below.
    const jwt = await createSessionJwt();
    if (!jwt) {
      return emptyMembershipStatus("not_authenticated");
    }

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!apiBaseUrl) {
      console.error("[Membership] NEXT_PUBLIC_API_BASE_URL is not set");
      return emptyMembershipStatus("api_unavailable");
    }

    const query = refresh ? "view=status&refresh=1" : "view=status";
    const response = await fetch(`${apiBaseUrl}/api/membership?${query}`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${jwt}` },
      signal: AbortSignal.timeout(MEMBERSHIP_API_TIMEOUT_MS),
    });

    if (response.status === HTTP_UNAUTHORIZED) {
      return emptyMembershipStatus("not_authenticated");
    }
    if (!response.ok) {
      console.error(`[Membership] api answered ${response.status}`);
      return emptyMembershipStatus("api_unavailable");
    }

    const body: unknown = await response.json().catch(() => null);
    if (!isMembershipStatus(body)) {
      console.error("[Membership] api returned an unexpected body");
      return emptyMembershipStatus("api_unavailable");
    }
    return body;
  } catch (error) {
    unstable_rethrow(error);
    console.error("[Membership] Could not reach the api:", error);
    return emptyMembershipStatus("api_unavailable");
  }
}

// One api call per server render: the layout, the page and nested components
// all ask for membership, and they should share a single answer.
const readOncePerRequest = cache(() => readFromApi(false));

/**
 * Membership status for the signed-in student — for prices, badges, the
 * portal and the member pass. Served from apps/api's short-lived cache.
 */
export async function getMembershipStatus(): Promise<MembershipStatus> {
  return await readOncePerRequest();
}

/**
 * Membership status for a gate that is about to REFUSE something (members-only
 * products, members-only vacancies). Asks apps/api to recompute rather than
 * serve its cache, subject to its once-a-minute-per-student floor.
 */
export async function getLiveMembershipStatus(): Promise<MembershipStatus> {
  return await readFromApi(true);
}

/**
 * Force a fresh status — the `/api/membership?refresh=true` route, after a
 * purchase or when the student asks.
 */
export async function refreshMembershipStatus(): Promise<MembershipStatus> {
  return await readFromApi(true);
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `cd apps/web && bun run test -- src/lib/actions/membership.test.ts`
Expected: PASS

- [ ] **Step 5: Run the web suite**

Run: `cd apps/web && bun run test`
Expected: PASS. Callers (`/api/membership` route, member-pass routes, cart/orders/jobs actions) mock `@/lib/actions/membership` and are unaffected. If a test imported the real module and relied on the Finago path, update it to mock `@/lib/actions/membership` instead.

- [ ] **Step 6: Commit**

```bash
bun x ultracite fix apps/web/src/lib/actions/membership.ts apps/web/src/lib/actions/membership.test.ts
git add apps/web/src/lib/actions/membership.ts apps/web/src/lib/actions/membership.test.ts
git commit -m "feat(web): read membership status from apps/api instead of computing it"
```

---

### Task 7: Whole-branch verification

**Files:** none new.

- [ ] **Step 1: Type-check the monorepo**

Run: `bun run check-types`
Expected: exit 0. Likely failures and fixes: a caller that relied on `settleOrderIfPaid` returning `void` in a type position (change to ignore the result), or an unused import left in a payment route.

- [ ] **Step 2: Run the affected test suites**

Run: `bun run test --filter=web --filter=api --filter=@repo/shared`
Expected: all PASS.

- [ ] **Step 3: Lint**

Run: `bun x ultracite check`
Expected: no errors in touched files.

- [ ] **Step 4: Confirm web no longer computes membership**

Run: `grep -rn "computeMembershipStatus\|getCustomerCategories\|unstable_cache" apps/web/src/lib/actions/membership.ts`
Expected: no output.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "chore: type and lint fixes for membership-via-api"
```

(Skip if there is nothing to commit.)
