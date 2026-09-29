# Membership Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mirror every 24SO membership product into `app.memberships`, count a membership only between its start and expiry, and decide what's for sale from dates, offering next season's plan in June and December.

**Architecture:** The roster function gains a catalog step (the existing `syncMembershipsFrom24SO`, fixed to 24SO-owned prices and a 1 July fall start). A new pure module `membership-seasons.ts` in `@repo/shared` decides current/next offers per duration; every place that shows or sells plans goes through it (catalog → candidates, gate → per-student selection). `computeMembershipStatus` classifies held rows as active / upcoming / expired.

**Tech Stack:** Bun, TypeScript, vitest (`@repo/shared`), `bun:test` (connectors, function, admin/web/api), Next.js 16, next-intl.

**Spec:** `docs/superpowers/specs/2026-09-29-membership-catalog-design.md`

## Global Constraints

- Seasons: spring = `YYYY-01-01`…`YYYY-06-30`; fall = `YYYY-07-01`…`YYYY-12-31`. Last month of a season = June or December.
- A membership counts only while `startDate ≤ Oslo today ≤ expiryDate`.
- Prices and names come from 24SO; `canPurchase` is written `false` and never read; `status` is written (expiry not passed) and never read for decisions.
- Catalog failure fails the function run before any roster write.
- Checkout must only accept a plan id that the gate currently offers to that student.
- Bun only; `bun x ultracite fix` before each commit; stage files explicitly; commits end with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- `"use server"` files export only async functions (admin/web rule); run `bun run build --filter=web` after touching web server actions.

## Review Focus

1. **Boundary dates in Oslo time** — 30 Jun 23:30 Oslo is still spring/June; 1 Jul 00:30 Oslo is fall and not a last month; 1 Dec is a last month. Test in Task 2.
2. **A member who already holds next season's plan** (bought in June) must not be offered it again, and is not a member until it starts. Tests in Task 3 (status) and Task 4 (gate).
3. **Renewal outside the last month** — a fall-semester member in October sees no current semester (doesn't extend) but must be offered next semester. Test in Task 4.
4. **Checkout with a crafted plan id** of a past or far-future plan (e.g. a 2030 product now in the table) is refused. Test in Task 6.
5. **Catalog rows with odd names** (a product with no season words) must not become purchasable or break the run. Test in Task 1.

---

### Task 1: Catalog sync — 24SO-owned rows, 1 July fall start

**Files:**
- Modify: `packages/connectors/src/24sevenoffice/membership-sync.ts` (`parseStartDate`, add `syncMembershipCatalog`)
- Modify: `packages/connectors/src/24sevenoffice/membership-sync-merge.ts` (`mergeMembershipRow`)
- Modify: `packages/connectors/src/24sevenoffice/index.ts` (export `syncMembershipCatalog`)
- Test: `packages/shared/utils/membership-sync-merge.test.ts` (vitest, re-exported merge), `packages/connectors/src/24sevenoffice/membership-sync.test.ts` (new, bun)

**Interfaces:**
- Produces: `syncMembershipCatalog(): Promise<{ created: number; updated: number; skipped: number }>` — throws `Error` when the sync reports failure or any item errored. `parseStartDate("BISO Membership fall 2026") === "2026-07-01"`.

- [ ] **Step 1: Failing tests**

`packages/connectors/src/24sevenoffice/membership-sync.test.ts`:

```ts
import { expect, test } from "bun:test";
import { parseExpiryDate, parseStartDate } from "./membership-sync";

test("fall starts 1 July, spring 1 January", () => {
  expect(parseStartDate("BISO Membership fall 2026")).toBe("2026-07-01");
  expect(parseStartDate("BISO Membership spring 2027")).toBe("2027-01-01");
});

test("multi-term plans run from the first season's start to the last season's end", () => {
  const name = "BISO Membership fall 2025 - spring 2028";
  expect(parseStartDate(name)).toBe("2025-07-01");
  expect(parseExpiryDate(name)).toBe("2028-06-30");
  const oneYear = "BISO Membership spring 2026 - fall 2026";
  expect(parseStartDate(oneYear)).toBe("2026-01-01");
  expect(parseExpiryDate(oneYear)).toBe("2026-12-31");
});
```

Replace the body of `packages/shared/utils/membership-sync-merge.test.ts` `describe("mergeMembershipRow")` with:

```ts
describe("mergeMembershipRow", () => {
  it("writes the 24SO price and never marks a row purchasable", () => {
    expect(mergeMembershipRow({ ...syncItem, price: 350 })).toEqual({
      canPurchase: false,
      category: String(syncItem.categoryId),
      expiryDate: syncItem.expiryDate,
      membership_id: String(syncItem.productId),
      name: syncItem.productName,
      price: 350,
      startDate: syncItem.startDate,
      status: syncItem.isActive,
    });
  });

  it("writes a null category when the product has no matching category", () => {
    expect(mergeMembershipRow({ ...syncItem, categoryId: null }).category).toBeNull();
  });
});
```

(Keep the file's existing `syncItem` fixture and `parsePrice` tests.)

- [ ] **Step 2: Run to see RED**

Run: `cd packages/connectors && bun test src/24sevenoffice/membership-sync.test.ts` — Expected: FAIL, fall start is `2026-08-01`.
Run: `cd packages/shared && bunx vitest run utils/membership-sync-merge.test.ts` — Expected: FAIL (signature takes `existing`, preserves admin price).

- [ ] **Step 3: Implement**

In `membership-sync.ts` `parseStartDate`, change the fall branch `return \`${year}-08-01\`;` to `return \`${year}-07-01\`;` and update its doc comment: "Fall starts 1 July so there is no summer gap between spring (ends 30 June) and fall."

Replace `mergeMembershipRow` in `membership-sync-merge.ts` (and its header comment) with:

```ts
/**
 * Builds the `memberships` row written by the 24SevenOffice catalog sync.
 * 24SO is the source of truth for name, price and dates. `canPurchase` is
 * written false and no longer read — what is for sale is decided from dates
 * (`@repo/shared/utils/membership-seasons`). `status` mirrors "not expired"
 * for older readers and is not used for decisions.
 */
export function mergeMembershipRow(
  item: MembershipSyncItemLike
): Record<string, unknown> {
  return {
    canPurchase: false,
    category: item.categoryId ? String(item.categoryId) : null,
    expiryDate: item.expiryDate,
    membership_id: String(item.productId),
    name: item.productName,
    price: Number(item.price ?? 0),
    startDate: item.startDate,
    status: item.isActive,
  };
}
```

Delete the `ExistingMembershipRow` interface and its export from `index.ts`. In `membership-sync.ts` `upsertMembership`, keep the existence read (to report created vs updated) but call `mergeMembershipRow(syncItem)`; update its doc comment accordingly.

Skip products whose name has no season words: in `syncMembershipsFrom24SO`'s loop, before `buildSyncItem`, add

```ts
      if (!SEASON_PATTERN.test(product.Name)) {
        result.skipped += 1;
        continue;
      }
```

with a top-level `const SEASON_PATTERN = /(spring|fall)\s+\d{4}/i;` (`parseExpiryDate` otherwise defaults to "end of this year", which would put a junk product on sale).

Add below `syncMembershipsFrom24SO`:

```ts
/**
 * Catalog step for the member-roster-sync function: runs the sync and throws
 * if it failed or any product errored, so the run stops before the roster
 * step reads a half-written catalog.
 */
export async function syncMembershipCatalog(): Promise<{
  created: number;
  skipped: number;
  updated: number;
}> {
  const result = await syncMembershipsFrom24SO();
  if (!result.success || result.errors.length > 0) {
    throw new Error(`Membership catalog sync failed: ${result.errors.join("; ")}`);
  }
  return { created: result.created, skipped: result.skipped, updated: result.updated };
}
```

Export `syncMembershipCatalog` from `index.ts` next to `syncMembershipsFrom24SO`.

- [ ] **Step 4: GREEN + types**

Run: `cd packages/connectors && bun test src/24sevenoffice && bun run check-types` and `cd packages/shared && bunx vitest run utils/membership-sync-merge.test.ts` — Expected: PASS. Fix any other `mergeMembershipRow(x, y)` call site the type-check reports.

- [ ] **Step 5: Commit**

```bash
git add packages/connectors/src/24sevenoffice/{membership-sync,membership-sync-merge,index}.ts packages/connectors/src/24sevenoffice/membership-sync.test.ts packages/shared/utils/membership-sync-merge.test.ts
git commit -m "feat(24so): catalog sync owns prices; fall starts 1 July"
```

---

### Task 2: Seasons and offer selection (pure)

**Files:**
- Create: `packages/shared/utils/membership-seasons.ts`
- Modify: `packages/shared/utils/membership-plans.ts` (add `offer?` to `MembershipPlan`)
- Test: `packages/shared/utils/membership-seasons.test.ts`

**Interfaces:**
- Consumes: `osloToday(now)` from `./membership-dates`; `MembershipPlan`, `MembershipDuration` from `./membership-plans`.
- Produces:
  - `type MembershipOffer = "current" | "next"` (exported from `membership-plans.ts`; `MembershipPlan` gains `offer?: MembershipOffer`)
  - `currentSeasonStart(now: Date): string`, `nextSeasonStart(now: Date): string` (`YYYY-MM-DD`)
  - `isLastMonthOfSeason(now: Date): boolean`
  - `offerFor(startDate: string, now: Date): MembershipOffer | null`
  - `selectOffers(candidates: MembershipPlan[], options: { heldThrough: string | null; now: Date }): MembershipPlan[]`

- [ ] **Step 1: Failing tests**

```ts
// packages/shared/utils/membership-seasons.test.ts
import { describe, expect, it } from "vitest";
import type { MembershipPlan } from "./membership-plans";
import {
  currentSeasonStart,
  isLastMonthOfSeason,
  nextSeasonStart,
  offerFor,
  selectOffers,
} from "./membership-seasons";

// Oslo is UTC+2 in summer, UTC+1 in winter.
const at = (iso: string) => new Date(iso);

describe("seasons", () => {
  it("uses the Oslo date at the 30 June / 1 July boundary", () => {
    const lateJune = at("2026-06-30T21:30:00Z"); // 23:30 Oslo, 30 June
    expect(currentSeasonStart(lateJune)).toBe("2026-01-01");
    expect(nextSeasonStart(lateJune)).toBe("2026-07-01");
    expect(isLastMonthOfSeason(lateJune)).toBe(true);
    const earlyJuly = at("2026-06-30T22:30:00Z"); // 00:30 Oslo, 1 July
    expect(currentSeasonStart(earlyJuly)).toBe("2026-07-01");
    expect(nextSeasonStart(earlyJuly)).toBe("2027-01-01");
    expect(isLastMonthOfSeason(earlyJuly)).toBe(false);
  });

  it("December is the last month of fall; November is not", () => {
    expect(isLastMonthOfSeason(at("2026-11-30T12:00:00Z"))).toBe(false);
    expect(isLastMonthOfSeason(at("2026-12-01T12:00:00Z"))).toBe(true);
    expect(nextSeasonStart(at("2026-12-31T12:00:00Z"))).toBe("2027-01-01");
  });

  it("tags a plan by its start date", () => {
    const now = at("2026-09-29T12:00:00Z");
    expect(offerFor("2026-07-01", now)).toBe("current");
    expect(offerFor("2027-01-01", now)).toBe("next");
    expect(offerFor("2026-01-01", now)).toBeNull();
    expect(offerFor("2030-07-01", now)).toBeNull();
  });
});

function plan(
  duration: MembershipPlan["duration"],
  offer: "current" | "next",
  expiryDate: string
): MembershipPlan {
  const accrualMonths = { semester: 6, three_years: 36, year: 12 }[duration] as 6 | 12 | 36;
  return {
    accrualMonths,
    categoryId: 1,
    duration,
    expiryDate,
    id: `${duration}-${offer}`,
    name: `${duration} ${offer}`,
    offer,
    price: 350,
    productId: 1,
    startDate: offer === "current" ? "2026-07-01" : "2027-01-01",
  };
}

const candidates = [
  plan("semester", "current", "2026-12-31"),
  plan("semester", "next", "2027-06-30"),
  plan("year", "current", "2027-06-30"),
  plan("year", "next", "2027-12-31"),
  plan("three_years", "current", "2029-06-30"),
  plan("three_years", "next", "2029-12-31"),
];
const ids = (plans: MembershipPlan[]) => plans.map((p) => p.id);

describe("selectOffers", () => {
  it("offers only this season's plans outside the last month", () => {
    const offers = selectOffers(candidates, {
      heldThrough: null,
      now: at("2026-10-15T12:00:00Z"),
    });
    expect(ids(offers)).toEqual(["semester-current", "year-current", "three_years-current"]);
  });

  it("offers this season and next season in December", () => {
    const offers = selectOffers(candidates, {
      heldThrough: null,
      now: at("2026-12-10T12:00:00Z"),
    });
    expect(ids(offers)).toEqual([
      "semester-current",
      "semester-next",
      "year-current",
      "year-next",
      "three_years-current",
      "three_years-next",
    ]);
  });

  it("renews with next season when this season's plan would not extend what they hold", () => {
    const offers = selectOffers(candidates, {
      heldThrough: "2026-12-31",
      now: at("2026-10-15T12:00:00Z"),
    });
    expect(ids(offers)).toEqual(["semester-next", "year-current", "three_years-current"]);
  });

  it("offers nothing that ends on or before what they already hold", () => {
    const offers = selectOffers(candidates, {
      heldThrough: "2027-06-30",
      now: at("2026-12-10T12:00:00Z"),
    });
    expect(ids(offers)).toEqual(["year-next", "three_years-current", "three_years-next"]);
  });
});
```

- [ ] **Step 2: RED**

Run: `cd packages/shared && bunx vitest run utils/membership-seasons.test.ts` — Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

In `membership-plans.ts`, add after `MembershipDuration`:

```ts
/** Whether a purchasable plan starts this season or next (see membership-seasons). */
export type MembershipOffer = "current" | "next";
```

and add `offer?: MembershipOffer;` to `MembershipPlan` (alphabetical position, after `name`).

```ts
// packages/shared/utils/membership-seasons.ts
/**
 * What is for sale, decided from dates. Spring runs 1 Jan – 30 Jun and fall
 * 1 Jul – 31 Dec (Oslo). Each duration has one 24SO product per start season,
 * so a plan is on offer when it starts this season ("current") or next
 * season ("next"). Next season's plans are offered in the last month of a
 * season (June, December), or earlier when this season's plan would not
 * extend what the student already holds (a renewal).
 */

import { osloToday } from "./membership-dates";
import type {
  MembershipDuration,
  MembershipOffer,
  MembershipPlan,
} from "./membership-plans";

const FIRST_FALL_MONTH = 7;
const LAST_MONTHS = new Set([6, 12]);
const DURATION_ORDER: MembershipDuration[] = ["semester", "year", "three_years"];

function todayParts(now: Date): { month: number; year: number } {
  const today = osloToday(now);
  return { month: Number(today.slice(5, 7)), year: Number(today.slice(0, 4)) };
}

export function currentSeasonStart(now: Date): string {
  const { month, year } = todayParts(now);
  return month >= FIRST_FALL_MONTH ? `${year}-07-01` : `${year}-01-01`;
}

export function nextSeasonStart(now: Date): string {
  const { month, year } = todayParts(now);
  return month >= FIRST_FALL_MONTH ? `${year + 1}-01-01` : `${year}-07-01`;
}

export function isLastMonthOfSeason(now: Date): boolean {
  return LAST_MONTHS.has(todayParts(now).month);
}

export function offerFor(startDate: string, now: Date): MembershipOffer | null {
  if (startDate === currentSeasonStart(now)) {
    return "current";
  }
  if (startDate === nextSeasonStart(now)) {
    return "next";
  }
  return null;
}

/**
 * Per duration: this season's plan when it extends `heldThrough`, plus next
 * season's in the last month of the season; next season's alone when this
 * season's would not extend what they hold. `candidates` must carry `offer`.
 */
export function selectOffers(
  candidates: MembershipPlan[],
  options: { heldThrough: string | null; now: Date }
): MembershipPlan[] {
  const extendsHeld = (plan: MembershipPlan) =>
    options.heldThrough === null || plan.expiryDate > options.heldThrough;
  const lastMonth = isLastMonthOfSeason(options.now);
  const offers: MembershipPlan[] = [];

  for (const duration of DURATION_ORDER) {
    const current = candidates.find((p) => p.duration === duration && p.offer === "current");
    const next = candidates.find((p) => p.duration === duration && p.offer === "next");
    const currentOffered = current !== undefined && extendsHeld(current);
    if (currentOffered) {
      offers.push(current);
    }
    if (next && extendsHeld(next) && (lastMonth || !currentOffered)) {
      offers.push(next);
    }
  }
  return offers;
}
```

- [ ] **Step 4: GREEN** — `cd packages/shared && bunx vitest run utils/membership-seasons.test.ts utils/membership-plans.test.ts` → PASS.

- [ ] **Step 5: Commit** `git add packages/shared/utils/membership-seasons.ts packages/shared/utils/membership-seasons.test.ts packages/shared/utils/membership-plans.ts && git commit -m "feat(membership): date-driven current/next offers"`

---

### Task 3: Live status — active / upcoming / expired

**Files:**
- Modify: `packages/shared/utils/membership-status.ts`
- Test: `packages/shared/utils/membership-status.test.ts`

**Interfaces:**
- Produces:
  - `membershipRowState(startDate, expiryDate, now?): "active" | "upcoming" | "expired"` (unreadable dates → `"expired"`)
  - `isMembershipRowActive(startDate, expiryDate, now?)` — **signature changes** (start added first); `= membershipRowState(...) === "active"`
  - `MembershipStatus.upcomingMemberships?: MembershipInfo[]` (earliest start first)
  - `computeMembershipStatus` no longer filters `status = true`; query is `[Query.limit(200)]` plus `Query.isNotNull("category")`.

- [ ] **Step 1: Failing tests** — in `membership-status.test.ts`:
  - Change every existing `isMembershipRowActive(expiry, now)` call to `isMembershipRowActive("2020-01-01", expiry, now)` (a start long passed keeps the expiry assertions).
  - Update the query expectation that lists `"limit(200)"` to the new query (`"isNotNull(category)"`, `"limit(200)"` — match however the file's `Query` mock renders `isNotNull`; add `isNotNull: (a: string) => \`isNotNull(${a})\`` to the mock).
  - Add:

```ts
describe("membershipRowState", () => {
  it("is upcoming before the start date and active from it", () => {
    expect(membershipRowState("2027-01-01", "2027-06-30", new Date("2026-12-13T12:00:00Z"))).toBe("upcoming");
    expect(membershipRowState("2027-01-01", "2027-06-30", new Date("2026-12-31T23:30:00Z"))).toBe("active"); // 00:30 Oslo, 1 Jan
  });
  it("treats an unreadable start as expired", () => {
    expect(membershipRowState("soon", "2027-06-30", new Date())).toBe("expired");
  });
});

it("a held plan that has not started is upcoming, not membership", async () => {
  // reuse the file's db/finago mocks: finago returns [113179]; memberships rows contain
  // { $id: "55", category: "113179", startDate: "2027-01-01", expiryDate: "2027-06-30", name: "BISO Membership spring 2027" }
  const status = await computeMembershipStatus(2_117_936, new Date("2026-12-13T12:00:00Z"));
  expect(status.isMember).toBe(false);
  expect(status.upcomingMemberships?.map((m) => m.id)).toEqual(["55"]);
  expect(status.reason).toBe("upcoming");
});
```

(Wire the last test through the same mock setup the existing "counts only unexpired rows…" test uses.)

- [ ] **Step 2: RED** — `cd packages/shared && bunx vitest run utils/membership-status.test.ts` → FAIL.

- [ ] **Step 3: Implement** in `membership-status.ts`:

```ts
export type MembershipRowState = "active" | "upcoming" | "expired";

/**
 * Where a `memberships` row stands on Oslo's today: counts from the whole of
 * its start day through the whole of its expiry day. Unreadable dates count
 * as expired — this check exists so memberships stop counting; bad data must
 * not slip through it.
 */
export function membershipRowState(
  startDate: string | null | undefined,
  expiryDate: string | null | undefined,
  now: Date = new Date()
): MembershipRowState {
  const start = normalizeMembershipDate(startDate);
  const expiry = normalizeMembershipDate(expiryDate);
  if (!(start && expiry)) {
    return "expired";
  }
  const today = osloToday(now);
  if (today < start) {
    return "upcoming";
  }
  return expiry >= today ? "active" : "expired";
}

export function isMembershipRowActive(
  startDate: string | null | undefined,
  expiryDate: string | null | undefined,
  now: Date = new Date()
): boolean {
  return membershipRowState(startDate, expiryDate, now) === "active";
}
```

In `computeMembershipStatus`: query `[Query.isNotNull("category"), Query.limit(200)]`; replace the active/expired loop with a three-way split on `membershipRowState(m.startDate, m.expiryDate, now)` (keep the unreadable-date warning for the expired branch when either date is unreadable); return `upcomingMemberships: upcoming.map(toInfo).sort((a, b) => a.startDate.localeCompare(b.startDate))`; `reason`: when not a member, `"upcoming"` if any upcoming, else `"expired"` if any expired (as today). Add `upcomingMemberships?: MembershipInfo[]` to `MembershipStatus` and `upcomingMemberships: []` to `emptyMembershipStatus`. Update the doc comments ("A category counts only while start ≤ today ≤ expiry").

- [ ] **Step 4: GREEN + callers** — `cd packages/shared && bunx vitest run` → PASS; `bun run check-types` (root) — fix every other `isMembershipRowActive(` call site it reports by passing the row's start date first.

- [ ] **Step 5: Commit** — `git add packages/shared/utils/membership-status.ts packages/shared/utils/membership-status.test.ts <any fixed call sites> && git commit -m "feat(membership): memberships count only from their start date"`

---

### Task 4: Catalog candidates and the gate

**Files:**
- Modify: `packages/shared/utils/membership-catalog.ts`
- Modify: `packages/shared/utils/membership-gate.ts`
- Test: `packages/shared/utils/membership-gate.test.ts`, `packages/shared/utils/membership-catalog.test.ts` (new)

**Interfaces:**
- Consumes: Task 2 (`offerFor`, `selectOffers`), Task 3 (`upcomingMemberships`).
- Produces:
  - `getMembershipOfferCandidates(now?: Date): Promise<MembershipPlan[]>` — catalog rows starting this or next season, `offer` set, valid via `toMembershipPlan`.
  - `getPurchasableMembershipPlans(now?)` = `selectOffers(candidates, { heldThrough: null, now })` (non-member view).
  - `getMembershipPlanById(planId, now?)` — resolves among **candidates** (the gate/checkout decide eligibility).
  - `MembershipGateInput` gains `now?: Date`; `status` gains `upcomingMemberships?: Array<{ expiryDate: string }>`; `input.plans` are **candidates**. `currentExpiry` = latest expiry across active **and** upcoming memberships (null when neither).
  - Pure helper `toOfferCandidates(rows: MembershipRowLike[], now: Date): MembershipPlan[]` exported from `membership-catalog.ts`-adjacent pure file `membership-offers.ts` for testing without Appwrite.

- [ ] **Step 1: Failing tests**

`packages/shared/utils/membership-catalog.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { toOfferCandidates } from "./membership-offers";

const row = (id: string, startDate: string, expiryDate: string, price = 350) => ({
  $id: id, canPurchase: false, category: `9${id}`, expiryDate,
  membership_id: id, name: `plan ${id}`, price, startDate, status: true,
});

describe("toOfferCandidates", () => {
  it("keeps plans starting this or next season and tags them", () => {
    const plans = toOfferCandidates(
      [
        row("54", "2026-07-01", "2026-12-31"),
        row("55", "2027-01-01", "2027-06-30"),
        row("53", "2026-01-01", "2026-06-30"),
        row("60", "2029-07-01", "2029-12-31"),
      ],
      new Date("2026-09-29T12:00:00Z")
    );
    expect(plans.map((p) => [p.id, p.offer])).toEqual([["54", "current"], ["55", "next"]]);
  });

  it("drops a plan with no price", () => {
    expect(toOfferCandidates([row("54", "2026-07-01", "2026-12-31", 0)], new Date("2026-09-29T12:00:00Z"))).toEqual([]);
  });
});
```

In `membership-gate.test.ts`, update fixtures so `plans` carry `offer` and add:

```ts
it("does not sell a plan the student already holds for next season, and counts it as held", () => {
  const gate = resolveMembershipGate({
    employeeId: "e", isAuthenticated: true, now: new Date("2026-12-13T12:00:00Z"),
    plans: [semesterCurrent /* ends 2026-12-31 */, semesterNext /* ends 2027-06-30 */],
    status: { isMember: false, memberships: [], upcomingMemberships: [{ expiryDate: "2027-06-30" }] },
    studentId: "s",
  });
  expect(gate.offeredPlans).toEqual([]);
  expect(gate.state).toBe("already_member");
  expect(gate.currentExpiry).toBe("2027-06-30");
});

it("renews a fall member with next semester in October", () => {
  const gate = resolveMembershipGate({
    employeeId: "e", isAuthenticated: true, now: new Date("2026-10-15T12:00:00Z"),
    plans: [semesterCurrent, semesterNext],
    status: { isMember: true, memberships: [{ expiryDate: "2026-12-31" }] },
    studentId: "s",
  });
  expect(gate.offeredPlans.map((p) => p.id)).toEqual([semesterNext.id]);
});
```

(Define `semesterCurrent` / `semesterNext` with the same shape as Task 2's `plan()` helper; adjust existing gate tests to include `offer: "current"` on their plans and a `now` inside a non-last month so their expectations hold.)

- [ ] **Step 2: RED** — `cd packages/shared && bunx vitest run utils/membership-gate.test.ts utils/membership-catalog.test.ts` → FAIL.

- [ ] **Step 3: Implement**

```ts
// packages/shared/utils/membership-offers.ts
import { type MembershipPlan, type MembershipRowLike, toMembershipPlan } from "./membership-plans";
import { offerFor } from "./membership-seasons";

/** Catalog rows starting this season or next, as plans tagged with `offer`. */
export function toOfferCandidates(rows: MembershipRowLike[], now: Date): MembershipPlan[] {
  const candidates: MembershipPlan[] = [];
  for (const row of rows) {
    const plan = toMembershipPlan(row);
    const offer = plan ? offerFor(plan.startDate, now) : null;
    if (plan && offer) {
      candidates.push({ ...plan, offer });
    }
  }
  return candidates;
}
```

`membership-catalog.ts`:

```ts
/**
 * Plans starting this season or next, from the `memberships` catalog that the
 * member-roster-sync function mirrors from 24SevenOffice. What a given
 * student may buy is decided by `resolveMembershipGate` (or `selectOffers`).
 */
export async function getMembershipOfferCandidates(now: Date = new Date()): Promise<MembershipPlan[]> {
  const { db } = await createAdminClient();
  const response = await db.listRows<Memberships>("app", "memberships", [
    Query.isNotNull("category"),
    Query.limit(200),
  ]);
  return toOfferCandidates(response.rows, now);
}

/** What someone with no membership may buy right now. */
export async function getPurchasableMembershipPlans(now: Date = new Date()): Promise<MembershipPlan[]> {
  return selectOffers(await getMembershipOfferCandidates(now), { heldThrough: null, now });
}

export async function getMembershipPlanById(planId: string, now: Date = new Date()): Promise<MembershipPlan | null> {
  const candidates = await getMembershipOfferCandidates(now);
  return candidates.find((plan) => plan.id === planId) ?? null;
}
```

`membership-gate.ts`: add `now?: Date` and `upcomingMemberships?` to the input types; replace the expiry/offer block with:

```ts
  const now = input.now ?? new Date();
  const held = [
    ...(input.status?.isMember ? (input.status.memberships ?? []) : []),
    ...(input.status?.upcomingMemberships ?? []),
  ]
    .map((membership) => membership.expiryDate)
    .filter(Boolean)
    .sort();
  const currentExpiry = held.at(-1) ?? null;
  const offeredPlans = selectOffers(input.plans, { heldThrough: currentExpiry, now });

  if (offeredPlans.length === 0) {
    const state = currentExpiry ? "already_member" : "no_plans_available";
    return { state, offeredPlans: [], currentExpiry };
  }
```

Update the gate's doc comment: `plans` are catalog candidates (`getMembershipOfferCandidates`).

- [ ] **Step 4: GREEN** — `cd packages/shared && bunx vitest run` → PASS.

- [ ] **Step 5: Commit** — `git add packages/shared/utils/membership-{catalog,gate,offers}.ts packages/shared/utils/membership-{catalog,gate}.test.ts && git commit -m "feat(membership): catalog candidates and gate with upcoming memberships"`

---

### Task 5: Roster function — catalog step and start-date rule

**Files:**
- Modify: `functions/member-roster-sync/src/{roster,run,main}.ts`, tests `roster.test.ts`, `run.test.ts`, `README.md`

**Interfaces:**
- Consumes: `syncMembershipCatalog` (Task 1), `membershipRowState` (Task 3).
- Produces: `PlanRow` gains `startDate: string`; `selectActivePlans` keeps only rows whose state is `active`; `SyncDeps.syncCatalog: () => Promise<{ created: number; skipped: number; updated: number }>` runs right after the overlap guard.

- [ ] **Step 1: Failing tests**
  - `roster.test.ts`: add `startDate` to every `planRows` fixture (`"2026-07-01"` for the fall/year/three-year ones; `"2026-01-01"` for the spring one; the `"No category"` row any date). Add:

```ts
test("selectActivePlans skips a plan that has not started", () => {
  const plans = selectActivePlans(
    [{ category: "20", expiryDate: "2027-06-30", membership_id: "55", name: "spring 2027", startDate: "2027-01-01" }],
    TODAY
  );
  expect(plans.size).toBe(0);
});
```

  - `run.test.ts`: add `syncCatalog: mock(async () => ({ created: 0, skipped: 0, updated: 3 }))` to `deps()`, `startDate: "2020-01-01"` to its plan row, and:

```ts
test("syncs the catalog before reading plans, and not at all when skipping", async () => {
  const order: string[] = [];
  const d = deps({
    listPlanRows: async () => {
      order.push("plans");
      return [{ category: "10", expiryDate: "2099-12-31", membership_id: "113", name: "Plan", startDate: "2020-01-01" }];
    },
    syncCatalog: mock(async () => {
      order.push("catalog");
      return { created: 0, skipped: 0, updated: 1 };
    }),
  });
  await runSync(d);
  expect(order).toEqual(["catalog", "plans"]);

  const skipped = deps({ countRunningExecutions: async () => 2 });
  await runSync(skipped);
  expect(skipped.syncCatalog).not.toHaveBeenCalled();
});

test("a catalog failure stops the run before any roster write", async () => {
  const d = deps({ syncCatalog: async () => { throw new Error("24SO down"); } });
  await expect(runSync(d)).rejects.toThrow("24SO down");
  expect(d.upsertRows).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: RED** — `cd functions/member-roster-sync && bun test` → FAIL.

- [ ] **Step 3: Implement**
  - `roster.ts`: `PlanRow` gains `startDate: string`; in `selectActivePlans`, replace the expiry comparison with `membershipRowState(row.startDate, row.expiryDate, now)` — change the signature to `selectActivePlans(rows, now: Date)` and the callers accordingly (`run.ts` passes `deps.now()`; rename `SyncDeps.today` to `now: () => Date`). Keep storing `expiryDate` normalised via `normalizeMembershipDate`. Import `membershipRowState` from `@repo/shared/utils/membership-status` — **check the bundle stays self-contained**: `membership-status.ts` imports `@repo/connectors` and `@repo/api/server`, both already bundled.
  - `run.ts`: after the overlap guard: `const catalog = await deps.syncCatalog(); deps.log(\`Catalog: ${catalog.created} created, ${catalog.updated} updated, ${catalog.skipped} skipped\`);`
  - `main.ts`: `syncCatalog: () => syncMembershipCatalog()`; `listPlanRows` selects and maps `startDate`; `now: () => new Date()`.
  - README "How it works": add step 0 "Mirror every 24SO membership product into `memberships` (name, category, price, dates from the name; fall starts 1 July)" and change step 1 to "Active plans: start ≤ today ≤ expiry".
  - Update `roster.test.ts` / `run.test.ts` call sites for the `now` rename (`TODAY` → `new Date("2026-09-29T12:00:00Z")`).

- [ ] **Step 4: GREEN** — `cd functions/member-roster-sync && bun test && bun run check-types && bun run bundle && rm -rf dist` → PASS, bundle builds.

- [ ] **Step 5: Commit** — `git add functions/member-roster-sync && git commit -m "feat(member-roster): sync the membership catalog before the roster"`

---

### Task 6: API — overview offers and checkout eligibility

**Files:**
- Modify: `apps/api/src/app/api/membership/route.ts` (+ `route.test.ts`)
- Modify: `apps/api/src/app/api/payment/[provider]/membership-checkout/route.ts` (+ `route.test.ts`)

**Interfaces:**
- Consumes: `getMembershipOfferCandidates` (Task 4), gate `now`/`upcomingMemberships`.
- Produces: overview body `offeredPlans[].offer`, top-level `upcomingMemberships`. Checkout refuses (409 "That membership is no longer available") any plan id not in the gate's `offeredPlans` for that student.

- [ ] **Step 1: Failing tests**
  - `membership/route.test.ts`: mock `getMembershipOfferCandidates` (replace the `getPurchasableMembershipPlans` mock) returning a current and next semester plan; assert `offeredPlans[0].offer === "current"` and that `upcomingMemberships` is passed through from the status.
  - `membership-checkout/route.test.ts`: replace the "refuses a plan row with canPurchase false" test with "refuses a plan that is not on offer" — plan row with `startDate: "2030-07-01"`, `expiryDate: "2030-12-31"` → 409 and no order created. Update `VALID_PLAN_ROW` to a current-season plan relative to a fixed `now` (inject via `vi.setSystemTime(new Date("2026-09-29T12:00:00Z"))` in `beforeEach`, `vi.useRealTimers()` in `afterEach`): `startDate: "2026-07-01"`, `expiryDate: "2026-12-31"`, `canPurchase: false`, `status: true`.
- [ ] **Step 2: RED** — `cd apps/api && bun test src/app/api/membership src/app/api/payment` → FAIL.
- [ ] **Step 3: Implement**
  - `membership/route.ts`: swap `getPurchasableMembershipPlans()` for `getMembershipOfferCandidates()`; add `offer: plan.offer ?? "current"` to the mapped `offeredPlans`; add `upcomingMemberships: status.upcomingMemberships ?? []` to `overviewBody`.
  - `membership-checkout/route.ts`: in `resolveMembershipPurchase`, delete the `row?.status && row?.canPurchase` guard (keep "row not found → 409 no longer available"). In the eligibility step, pass `plans: await getMembershipOfferCandidates()` to the gate and, after the existing `gate.state !== "eligible"` handling, add:

```ts
  if (!gate.offeredPlans.some((offered) => offered.id === identity.plan.id)) {
    return { ok: false, message: "That membership is no longer available", status: 409 };
  }
```

- [ ] **Step 4: GREEN** — `cd apps/api && bun test && cd ../.. && bun run check-types --filter=api` → PASS.
- [ ] **Step 5: Commit** — `git add apps/api/src/app/api/membership apps/api/src/app/api/payment && git commit -m "feat(api): offer current/next plans; checkout sells only offered plans"`

---

### Task 7: Web — join choice, portal, upcoming notice

**Files:**
- Modify: `apps/web/src/app/(public)/membership/join/page.tsx`, `join-wizard.tsx`
- Modify: `apps/web/src/app/(public)/member/member-portal-content.tsx`, `apps/web/src/lib/member-portal-membership.ts` (+ `.test.ts`)
- Modify: `packages/i18n/messages/{en,no}/membership.json` (`join.plan`), `.../memberPortal.json`

**Interfaces:**
- Consumes: `getMembershipOfferCandidates`, `selectOffers`, `MembershipPlan.offer`, `status.upcomingMemberships`.
- Produces: `groupOffersByDuration(plans: MembershipPlan[]): Array<{ current?: MembershipPlan; duration: MembershipDuration; next?: MembershipPlan }>` in `apps/web/src/lib/membership-offer-groups.ts`; `upgradePlans(candidates, heldThrough: string | null, now?)`.

- [ ] **Step 1: Failing tests**

`apps/web/src/lib/membership-offer-groups.test.ts`:

```ts
import { expect, test } from "bun:test";
import { groupOffersByDuration } from "./membership-offer-groups";

const p = (id: string, duration: "semester" | "year", offer: "current" | "next") =>
  ({ accrualMonths: 6, categoryId: 1, duration, expiryDate: "2026-12-31", id, name: id, offer, price: 350, productId: 1, startDate: "2026-07-01" }) as const;

test("pairs this season's and next season's plan per duration, in order", () => {
  expect(
    groupOffersByDuration([p("s1", "semester", "current"), p("s2", "semester", "next"), p("y2", "year", "next")])
  ).toEqual([
    { current: p("s1", "semester", "current"), duration: "semester", next: p("s2", "semester", "next") },
    { current: undefined, duration: "year", next: p("y2", "year", "next") },
  ]);
});
```

In `member-portal-membership.test.ts`, update `upgradePlans` tests to the new signature `upgradePlans(candidates, heldThrough, now)` and assert it delegates to `selectOffers` (renewal case: heldThrough `2026-12-31`, now `2026-10-15` → next semester offered).

- [ ] **Step 2: RED** — `cd apps/web && bun test src/lib/membership-offer-groups.test.ts src/lib/member-portal-membership.test.ts` → FAIL.

- [ ] **Step 3: Implement**
  - `membership-offer-groups.ts`: build the list in `["semester", "year", "three_years"]` order from `plans`, skipping durations with neither offer.
  - `member-portal-membership.ts`: `upgradePlans(candidates, heldThrough, now = new Date())` → `selectOffers(candidates, { heldThrough, now }).map(({ duration, expiryDate, id, price }) => ({ duration, expiryDate, id, price }))`.
  - `member-portal-content.tsx`: fetch `getMembershipOfferCandidates()` instead of `getPurchasableMembershipPlans()`; `heldThrough` = latest expiry of `membership.memberships` and `membership.upcomingMemberships`; `upgradePlans(plans, heldThrough)`. When `!isMember` and `membership?.upcomingMemberships?.[0]`, render above `<MemberPortalTabs>`:

```tsx
<Alert className="mb-6">
  <AlertDescription>
    {tPortal("upcomingMembership", { start: formatDate(upcoming.startDate) })}
  </AlertDescription>
</Alert>
```

    using the page's existing date formatting helper (or `getFormatter().dateTime(new Date(upcoming.startDate), { dateStyle: "long" })`), and `tPortal = await getTranslations("memberPortal.membership")`.
  - `join/page.tsx`: pass `plans: await getMembershipOfferCandidates()` (instead of `getPurchasableMembershipPlans()`) and `now: new Date()` to `resolveMembershipGate`.
  - `join-wizard.tsx`: build `groups = groupOffersByDuration(plans)`. The plan radio shows **one card per group** (value = `group.duration`), priced from `group.current ?? group.next`. Keep `planId` state; add `duration` state (default `groups[0]?.duration`) and `useNext` state (default `false`). The selected plan is `useNext || !group.current ? group.next : group.current`. When the selected group has both offers, render under the cards:

```tsx
<RadioGroup className="mt-4 grid gap-2" onValueChange={(v) => setUseNext(v === "next")} value={useNext ? "next" : "current"}>
  <p className="text-sm">{t("endsSoon", { end: group.current.expiryDate })}</p>
  <Label className="flex items-center gap-2" htmlFor="offer-current">
    <RadioGroupItem id="offer-current" value="current" />
    {t("buyThisSeason", { end: group.current.expiryDate })}
  </Label>
  <Label className="flex items-center gap-2" htmlFor="offer-next">
    <RadioGroupItem id="offer-next" value="next" />
    {t("buyNextSeason", { start: group.next.startDate, end: group.next.expiryDate })}
  </Label>
</RadioGroup>
```

    Reset `useNext` to `false` whenever `duration` changes. `handlePay` uses the selected plan's `id`. Format dates with `useFormatter().dateTime(new Date(x), { dateStyle: "long" })`.
  - i18n `membership.json` `join.plan` (en / no):
    - `endsSoon`: "This membership ends {end}." / "Dette medlemskapet utløper {end}."
    - `buyThisSeason`: "Buy for this semester (until {end})" / "Kjøp for dette semesteret (til {end})"
    - `buyNextSeason`: "Start next semester instead ({start} – {end})" / "Start neste semester i stedet ({start} – {end})"
  - `memberPortal.json` `membership.upcomingMembership`: "Your membership starts {start}." / "Medlemskapet ditt starter {start}."

- [ ] **Step 4: GREEN** — `cd apps/web && bun test && cd ../.. && bun run check-types --filter=web && bun run build --filter=web` → PASS, build compiles.

- [ ] **Step 5: Commit** — `git add apps/web/src packages/i18n/messages && git commit -m "feat(web): choose this or next semester in the last month; show upcoming membership"`

---

### Task 8: Verification and production dry run

- [ ] **Step 1:** Full suite: `bun run check-types`; `(cd packages/shared && bunx vitest run)`; `(cd packages/connectors && bun test)`; `(cd functions/member-roster-sync && bun test)`; `(cd apps/api && bun test)`; `(cd apps/web && bun test)`; `(cd apps/admin && bun test)`; `bun x turbo run lint --continue` (only the pre-existing `@repo/ui`, `@repo/editor`, `@repo/payment` failures allowed).
- [ ] **Step 2: Read-only dry run** (writes stubbed): run `syncMembershipsFrom24SO`'s item builder without upserting (use `previewMembershipSync`) and print the planned rows (count, a few names with start/expiry/price, any skipped); run `runSync` with the catalog step stubbed to "use the preview rows as the plan rows" and writes stubbed, and print member counts before (current table) and after; call `computeMembershipStatus` for three real customer ids — one on a 2025 three-year plan (a 113174 holder from the tree), one fall-2026 semester holder, one with nothing — and print isMember/memberships/upcoming. Delete the script afterwards.
- [ ] **Step 3:** Report results to the user. Do not run the real catalog sync (it writes production) without their go-ahead.
