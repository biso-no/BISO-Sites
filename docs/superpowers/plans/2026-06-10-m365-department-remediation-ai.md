# M365 Department Remediation v2 (AI-driven) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the freeform-string department classifier with an AI resolver that judges every licensed M365 user against their role-based email, fenced to the canonical department list, with confidence-gated auto-apply and a persisted snapshot.

**Architecture:** Deterministic code extracts a campus hint and batches users; `gpt-5-nano` (Vercel AI SDK `generateObject`, mirroring `recruitment-screener.ts`) classifies each user as management / department / manual and picks a canonical department; the server post-validates membership (off-list → manual), buckets into safe/review/manual/closed grouped by resolved target, and persists the plan as a snapshot row in Appwrite. The audit page renders the latest snapshot; a "Run analysis" action recomputes on demand. The existing apply/write path, campus-derivation safety, and audit logging are unchanged.

**Tech Stack:** Next.js 16 (App Router, server actions), Vercel AI SDK (`ai`, `@ai-sdk/openai`), zod, Appwrite (`@repo/api`), Microsoft Graph (`@repo/connectors`), `bun:test`, next-intl.

**Spec:** `docs/superpowers/specs/2026-06-10-m365-department-remediation-ai-design.md`

---

## File structure

| File | Responsibility |
|------|----------------|
| `packages/shared/types/user-management.ts` | Resolver zod schema + result type; new remediation group/plan/snapshot types (replaces old tier types) |
| `packages/ai/src/server/department-resolver.ts` | **New.** Thin `generateObject` wrapper that asks the model to resolve a batch |
| `packages/ai/package.json` | Add the resolver export |
| `apps/admin/src/lib/it/email-classify.ts` | **New.** Pure: campus-hint extraction from email/officeLocation |
| `apps/admin/src/lib/it/concurrency.ts` | **New.** Pure: `mapWithConcurrency` |
| `apps/admin/src/lib/it/remediation-bucketing.ts` | **New.** Pure: resolution validation + plan bucketing (the core logic) |
| `apps/admin/src/lib/it/department-matching.ts` | Keep closed/campus helpers; remove the Dice auto-tier classifier |
| `apps/admin/src/lib/it/department-matching.test.ts` | Trim to retained helpers |
| `apps/admin/src/app/(portal)/_actions/it-remediation.ts` | `runDepartmentAnalysis`, `getLatestRemediationSnapshot`; adapt buckets; keep `applyDepartmentFixes` |
| `apps/admin/src/app/(portal)/it/users/audit/page.tsx` | Read snapshot (not live compute); set `maxDuration` |
| `apps/admin/src/app/(portal)/it/users/_components/remediation-client.tsx` | 4 tabs, Run/Re-run, Manual tab |
| `packages/i18n/messages/{en,no}/adminPortal.json` | New keys |
| `packages/api/appwrite.config.json` | Add `m365_remediation_snapshot` table (user pushes) |

---

## Task 1: Shared types + resolver schema

**Files:**
- Modify: `packages/shared/types/user-management.ts` (the "Department Remediation Types" block, lines ~426-478)

- [ ] **Step 1: Replace the remediation types block**

In `packages/shared/types/user-management.ts`, **delete** the existing block from `export type RemediationTier =` (line ~429) through the end of `DepartmentDataHealthEntry` (line ~477) and replace it with:

```ts
// ============================================================================
// Department Remediation Types (AI-driven)
// ============================================================================

export type RemediationClassification = "management" | "department" | "manual";
export type RemediationConfidence = "high" | "medium" | "low";

// One AI judgement for a single user. `ref` echoes the M365 user id.
export const departmentResolutionSchema = z.object({
  ref: z.string(),
  classification: z.enum(["management", "department", "manual"]),
  department: z.string().nullable(),
  campus: z.string().nullable(),
  confidence: z.enum(["high", "medium", "low"]),
  reasoning: z.string().max(200),
});
export type DepartmentResolution = z.infer<typeof departmentResolutionSchema>;

export const departmentResolutionBatchSchema = z.object({
  resolutions: z.array(departmentResolutionSchema),
});

// A bucket of users that share one resolved write target (department + campus).
export interface RemediationGroup {
  affectedUsers: M365UserListItem[];
  classification: RemediationClassification;
  confidence: RemediationConfidence | null;
  reasoning: string | null;
  suggestedCampusName: string | null; // office location to write
  suggestedDepartment: string | null; // canonical name to write
  value: string; // group label (resolved target department, or raw value for closed)
}

// A single user the model could not place; assigned manually in the UI.
export interface ManualRemediationUser {
  reasoning: string | null;
  user: M365UserListItem;
}

export interface DepartmentRemediationPlan {
  closed: RemediationGroup[];
  compliantCount: number;
  manual: ManualRemediationUser[];
  review: RemediationGroup[];
  safe: RemediationGroup[];
  totalScanned: number;
}

// Persisted snapshot wrapper (stored as JSON in m365_remediation_snapshot.result).
export interface RemediationSnapshot {
  generatedAt: string;
  generatedBy: string;
  plan: DepartmentRemediationPlan;
}

// A single accepted fix decision sent to applyDepartmentFixes.
export interface DepartmentFixDecision {
  campusName: string; // office location hint (campus is re-derived server-side)
  department: string; // exact canonical name to write
  userIds: string[];
}

export interface DepartmentFixSummary {
  failed: Array<{ userId: string; error: string }>;
  succeeded: number;
}

// 24SO data-health report (unchanged).
export type DepartmentDataIssue =
  | "trailingWhitespace"
  | "duplicateName"
  | "activeClosed";

export interface DepartmentDataHealthEntry {
  campusName: string;
  id: string;
  issues: DepartmentDataIssue[];
  name: string;
}
```

- [ ] **Step 2: Verify the package type-checks**

Run: `bun --filter=@repo/shared check-types`
Expected: PASS (no errors). `z` is already imported at the top of the file.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/types/user-management.ts
git commit -m "feat(shared): AI-driven remediation types + resolver schema"
```

---

## Task 2: Email campus-hint helper (pure, TDD)

**Files:**
- Create: `apps/admin/src/lib/it/email-classify.ts`
- Test: `apps/admin/src/lib/it/email-classify.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/admin/src/lib/it/email-classify.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { emailLocalPart, extractCampusHint } from "./email-classify";

const TOKEN_TO_CAMPUS = new Map<string, string>([
  ["oslo", "Oslo"],
  ["bergen", "Bergen"],
  ["trondheim", "Trondheim"],
  ["stavanger", "Stavanger"],
]);

describe("emailLocalPart", () => {
  test("returns the part before @, lowercased", () => {
    expect(emailLocalPart("President.Oslo@biso.no")).toBe("president.oslo");
  });
  test("returns empty string for null/blank", () => {
    expect(emailLocalPart(null)).toBe("");
    expect(emailLocalPart("")).toBe("");
  });
});

describe("extractCampusHint", () => {
  test("uses the email's last segment when it is a known campus token", () => {
    expect(
      extractCampusHint("finance.nu.oslo@biso.no", null, TOKEN_TO_CAMPUS)
    ).toBe("Oslo");
    expect(
      extractCampusHint("president.bergen@biso.no", "Oslo", TOKEN_TO_CAMPUS)
    ).toBe("Bergen"); // email token wins over officeLocation
  });

  test("falls back to officeLocation when email has no campus token", () => {
    expect(
      extractCampusHint("markus@biso.no", "Trondheim", TOKEN_TO_CAMPUS)
    ).toBe("Trondheim");
  });

  test("returns null when neither email nor office resolves a campus", () => {
    expect(extractCampusHint("markus@biso.no", null, TOKEN_TO_CAMPUS)).toBeNull();
    expect(
      extractCampusHint("markus@biso.no", "National", TOKEN_TO_CAMPUS)
    ).toBeNull();
  });

  test("a person address whose last segment is a name returns the office fallback only", () => {
    // adrian.heien -> 'heien' is not a campus token; office National -> null
    expect(
      extractCampusHint("adrian.heien@biso.no", "National", TOKEN_TO_CAMPUS)
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test apps/admin/src/lib/it/email-classify.test.ts`
Expected: FAIL ("Cannot find module './email-classify'").

- [ ] **Step 3: Write the implementation**

Create `apps/admin/src/lib/it/email-classify.ts`:

```ts
// Pure helpers for deciding which campus batch a user belongs to. This only
// chooses a batch + candidate list for the AI resolver; it never decides the
// user's department (the model does that).

export function emailLocalPart(email: string | null): string {
  if (!email) {
    return "";
  }
  const at = email.indexOf("@");
  const local = at === -1 ? email : email.slice(0, at);
  return local.toLowerCase().trim();
}

// Returns a campus *name* (e.g. "Oslo") or null. Email's trailing segment wins;
// officeLocation is a fallback; otherwise null (national / unplaceable).
export function extractCampusHint(
  email: string | null,
  officeLocation: string | null,
  tokenToCampus: Map<string, string>
): string | null {
  const local = emailLocalPart(email);
  if (local) {
    const segments = local.split(".");
    const last = segments.at(-1) ?? "";
    const fromEmail = tokenToCampus.get(last);
    if (fromEmail) {
      return fromEmail;
    }
  }
  const office = (officeLocation ?? "").trim().toLowerCase();
  if (office) {
    const fromOffice = tokenToCampus.get(office);
    if (fromOffice) {
      return fromOffice;
    }
  }
  return null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test apps/admin/src/lib/it/email-classify.test.ts`
Expected: PASS (all assertions).

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/lib/it/email-classify.ts apps/admin/src/lib/it/email-classify.test.ts
git commit -m "feat(admin): email campus-hint helper for remediation batching"
```

---

## Task 3: Concurrency helper (pure, TDD)

**Files:**
- Create: `apps/admin/src/lib/it/concurrency.ts`
- Test: `apps/admin/src/lib/it/concurrency.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/admin/src/lib/it/concurrency.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { mapWithConcurrency } from "./concurrency";

describe("mapWithConcurrency", () => {
  test("maps every item and preserves order", async () => {
    const result = await mapWithConcurrency(
      [1, 2, 3, 4, 5],
      2,
      async (n) => n * 10
    );
    expect(result).toEqual([10, 20, 30, 40, 50]);
  });

  test("never exceeds the concurrency limit", async () => {
    let active = 0;
    let peak = 0;
    await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active -= 1;
      return null;
    });
    expect(peak).toBeLessThanOrEqual(2);
  });

  test("returns empty array for empty input", async () => {
    expect(await mapWithConcurrency([], 3, async (n) => n)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test apps/admin/src/lib/it/concurrency.test.ts`
Expected: FAIL ("Cannot find module './concurrency'").

- [ ] **Step 3: Write the implementation**

Create `apps/admin/src/lib/it/concurrency.ts`:

```ts
// Runs `fn` over `items` with at most `limit` in flight; preserves input order.
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await fn(items[index], index);
    }
  }

  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `bun test apps/admin/src/lib/it/concurrency.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/lib/it/concurrency.ts apps/admin/src/lib/it/concurrency.test.ts
git commit -m "feat(admin): bounded-concurrency map helper"
```

---

## Task 4: Resolution validation + bucketing (pure, TDD — core logic)

**Files:**
- Create: `apps/admin/src/lib/it/remediation-bucketing.ts`
- Test: `apps/admin/src/lib/it/remediation-bucketing.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/admin/src/lib/it/remediation-bucketing.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import type {
  DepartmentResolution,
  M365UserListItem,
} from "@repo/shared/types/user-management";
import { buildRemediationPlan, validateResolution } from "./remediation-bucketing";

const CAMPUS_NAMES = new Set(["Oslo", "Bergen"]);
const CANDIDATES = new Map<string, Set<string>>([
  ["Oslo", new Set(["Ledelsen Oslo", "OSL Næringslivsutvalget"])],
  ["Bergen", new Set(["Ledelsen Bergen"])],
]);
const NO_CLOSED = new Set<string>();

function user(id: string, over: Partial<M365UserListItem> = {}): M365UserListItem {
  return {
    accountEnabled: true,
    createdDateTime: null,
    department: null,
    displayName: id,
    id,
    jobTitle: null,
    lastSignInDateTime: null,
    mail: `${id}@biso.no`,
    officeLocation: null,
    userPrincipalName: `${id}@biso.no`,
    ...over,
  };
}

function res(over: Partial<DepartmentResolution>): DepartmentResolution {
  return {
    ref: "u",
    classification: "department",
    department: null,
    campus: null,
    confidence: "high",
    reasoning: "",
    ...over,
  };
}

describe("validateResolution", () => {
  test("management with a known campus resolves to Ledelsen {campus}", () => {
    expect(
      validateResolution(
        res({ classification: "management", campus: "Oslo" }),
        CANDIDATES,
        CAMPUS_NAMES
      )
    ).toEqual({ department: "Ledelsen Oslo", campus: "Oslo" });
  });

  test("department off-list returns null (forced to manual)", () => {
    expect(
      validateResolution(
        res({ classification: "department", department: "Made Up Dept", campus: "Oslo" }),
        CANDIDATES,
        CAMPUS_NAMES
      )
    ).toBeNull();
  });

  test("department on-list resolves", () => {
    expect(
      validateResolution(
        res({ classification: "department", department: "OSL Næringslivsutvalget", campus: "Oslo" }),
        CANDIDATES,
        CAMPUS_NAMES
      )
    ).toEqual({ department: "OSL Næringslivsutvalget", campus: "Oslo" });
  });

  test("unknown campus returns null", () => {
    expect(
      validateResolution(
        res({ classification: "management", campus: "Narnia" }),
        CANDIDATES,
        CAMPUS_NAMES
      )
    ).toBeNull();
  });
});

describe("buildRemediationPlan", () => {
  test("high-confidence management → safe, grouped by Ledelsen Oslo", () => {
    const users = [user("president.oslo"), user("controller.oslo")];
    const resolutions = new Map([
      ["president.oslo", res({ ref: "president.oslo", classification: "management", campus: "Oslo" })],
      ["controller.oslo", res({ ref: "controller.oslo", classification: "management", campus: "Oslo" })],
    ]);
    const plan = buildRemediationPlan({
      users,
      resolutions,
      candidatesByCampus: CANDIDATES,
      closedBaseNames: NO_CLOSED,
      campusNames: CAMPUS_NAMES,
    });
    expect(plan.safe).toHaveLength(1);
    expect(plan.safe[0].suggestedDepartment).toBe("Ledelsen Oslo");
    expect(plan.safe[0].affectedUsers).toHaveLength(2);
    expect(plan.manual).toHaveLength(0);
  });

  test("a non-management user the model marks manual never lands in Ledelsen (the 29-bug)", () => {
    const users = [user("hr.oslo", { department: "Ledelse" })];
    const resolutions = new Map([
      ["hr.oslo", res({ ref: "hr.oslo", classification: "manual", campus: null, department: null, reasoning: "HR function" })],
    ]);
    const plan = buildRemediationPlan({
      users,
      resolutions,
      candidatesByCampus: CANDIDATES,
      closedBaseNames: NO_CLOSED,
      campusNames: CAMPUS_NAMES,
    });
    expect(plan.safe).toHaveLength(0);
    expect(plan.manual).toHaveLength(1);
    expect(plan.manual[0].user.id).toBe("hr.oslo");
  });

  test("medium confidence → review, not safe", () => {
    const users = [user("a")];
    const resolutions = new Map([
      ["a", res({ ref: "a", classification: "department", department: "OSL Næringslivsutvalget", campus: "Oslo", confidence: "medium" })],
    ]);
    const plan = buildRemediationPlan({
      users, resolutions, candidatesByCampus: CANDIDATES, closedBaseNames: NO_CLOSED, campusNames: CAMPUS_NAMES,
    });
    expect(plan.safe).toHaveLength(0);
    expect(plan.review).toHaveLength(1);
    expect(plan.review[0].suggestedDepartment).toBe("OSL Næringslivsutvalget");
  });

  test("off-list department → manual", () => {
    const users = [user("a")];
    const resolutions = new Map([
      ["a", res({ ref: "a", classification: "department", department: "Ghost Unit", campus: "Oslo" })],
    ]);
    const plan = buildRemediationPlan({
      users, resolutions, candidatesByCampus: CANDIDATES, closedBaseNames: NO_CLOSED, campusNames: CAMPUS_NAMES,
    });
    expect(plan.manual).toHaveLength(1);
  });

  test("missing resolution → manual", () => {
    const plan = buildRemediationPlan({
      users: [user("a")],
      resolutions: new Map(),
      candidatesByCampus: CANDIDATES,
      closedBaseNames: NO_CLOSED,
      campusNames: CAMPUS_NAMES,
    });
    expect(plan.manual).toHaveLength(1);
  });

  test("already-compliant user is counted and dropped from safe", () => {
    const users = [user("president.oslo", { department: "Ledelsen Oslo", officeLocation: "Oslo" })];
    const resolutions = new Map([
      ["president.oslo", res({ ref: "president.oslo", classification: "management", campus: "Oslo" })],
    ]);
    const plan = buildRemediationPlan({
      users, resolutions, candidatesByCampus: CANDIDATES, closedBaseNames: NO_CLOSED, campusNames: CAMPUS_NAMES,
    });
    expect(plan.safe).toHaveLength(0);
    expect(plan.compliantCount).toBe(1);
  });

  test("current department matching a closed base name → closed bucket", () => {
    const users = [user("a", { department: "DataAnalytisk Utvalg" })];
    const plan = buildRemediationPlan({
      users,
      resolutions: new Map([["a", res({ ref: "a", classification: "manual" })]]),
      candidatesByCampus: CANDIDATES,
      closedBaseNames: new Set(["dataanalytisk utvalg"]),
      campusNames: CAMPUS_NAMES,
    });
    expect(plan.closed).toHaveLength(1);
    expect(plan.manual).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test apps/admin/src/lib/it/remediation-bucketing.test.ts`
Expected: FAIL ("Cannot find module './remediation-bucketing'").

- [ ] **Step 3: Write the implementation**

Create `apps/admin/src/lib/it/remediation-bucketing.ts`:

```ts
import type {
  DepartmentRemediationPlan,
  DepartmentResolution,
  M365UserListItem,
  ManualRemediationUser,
  RemediationGroup,
} from "@repo/shared/types/user-management";
import { normalizeForCompare } from "./department-matching";

export interface BucketingInput {
  campusNames: Set<string>;
  candidatesByCampus: Map<string, Set<string>>; // campus name -> canonical active dept names
  closedBaseNames: Set<string>; // normalizeForCompare(stripClosedSuffix(name)) of nedlagt depts
  resolutions: Map<string, DepartmentResolution>; // keyed by user id
  users: M365UserListItem[];
}

interface Target {
  campus: string;
  department: string;
}

const GROUP_SEP = "␟";

// Returns the canonical write target when the AI answer is on-list for a valid
// campus, else null (off-list / unknown campus / no department => manual).
export function validateResolution(
  resolution: DepartmentResolution,
  candidatesByCampus: Map<string, Set<string>>,
  campusNames: Set<string>
): Target | null {
  const campus = resolution.campus;
  if (!(campus && campusNames.has(campus))) {
    return null;
  }
  const candidates = candidatesByCampus.get(campus) ?? new Set<string>();
  if (resolution.classification === "management") {
    const department = `Ledelsen ${campus}`;
    return candidates.has(department) ? { department, campus } : null;
  }
  if (resolution.classification === "department" && resolution.department) {
    return candidates.has(resolution.department)
      ? { department: resolution.department, campus }
      : null;
  }
  return null;
}

function pushGroup(
  map: Map<string, RemediationGroup>,
  key: string,
  meta: Omit<RemediationGroup, "affectedUsers">,
  user: M365UserListItem
): void {
  const existing = map.get(key);
  if (existing) {
    existing.affectedUsers.push(user);
    return;
  }
  map.set(key, { ...meta, affectedUsers: [user] });
}

export function buildRemediationPlan(
  input: BucketingInput
): DepartmentRemediationPlan {
  const { users, resolutions, candidatesByCampus, closedBaseNames, campusNames } =
    input;

  const safeByTarget = new Map<string, RemediationGroup>();
  const reviewByTarget = new Map<string, RemediationGroup>();
  const closedByValue = new Map<string, RemediationGroup>();
  const manual: ManualRemediationUser[] = [];
  let compliantCount = 0;

  for (const user of users) {
    const currentDept = (user.department ?? "").trim();

    // 1) Closed: current value corresponds to a "- nedlagt" department.
    if (currentDept && closedBaseNames.has(normalizeForCompare(currentDept))) {
      pushGroup(
        closedByValue,
        currentDept,
        {
          classification: "manual",
          confidence: null,
          reasoning: null,
          suggestedCampusName: null,
          suggestedDepartment: null,
          value: currentDept,
        },
        user
      );
      continue;
    }

    const resolution = resolutions.get(user.id);

    // 2) No resolution or explicit manual → manual bucket.
    if (!resolution || resolution.classification === "manual") {
      manual.push({ reasoning: resolution?.reasoning ?? null, user });
      continue;
    }

    const target = validateResolution(
      resolution,
      candidatesByCampus,
      campusNames
    );

    // 3) Off-list / unresolved → manual (cannot bulk-write a single target).
    if (!target) {
      manual.push({ reasoning: resolution.reasoning, user });
      continue;
    }

    // 4) Already compliant → counted, not shown.
    if (
      user.department === target.department &&
      user.officeLocation === target.campus
    ) {
      compliantCount += 1;
      continue;
    }

    const meta: Omit<RemediationGroup, "affectedUsers"> = {
      classification: resolution.classification,
      confidence: resolution.confidence,
      reasoning: resolution.reasoning,
      suggestedCampusName: target.campus,
      suggestedDepartment: target.department,
      value: target.department,
    };
    const key = `${target.department}${GROUP_SEP}${target.campus}`;

    if (resolution.confidence === "high") {
      pushGroup(safeByTarget, key, meta, user);
    } else {
      pushGroup(reviewByTarget, key, meta, user);
    }
  }

  const byCount = (a: RemediationGroup, b: RemediationGroup) =>
    b.affectedUsers.length - a.affectedUsers.length;

  return {
    closed: [...closedByValue.values()].sort(byCount),
    compliantCount,
    manual,
    review: [...reviewByTarget.values()].sort(byCount),
    safe: [...safeByTarget.values()].sort(byCount),
    totalScanned: users.length,
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `bun test apps/admin/src/lib/it/remediation-bucketing.test.ts`
Expected: PASS (all assertions).

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/lib/it/remediation-bucketing.ts apps/admin/src/lib/it/remediation-bucketing.test.ts
git commit -m "feat(admin): remediation bucketing + AI resolution validation"
```

---

## Task 5: AI resolver module + package export

**Files:**
- Create: `packages/ai/src/server/department-resolver.ts`
- Modify: `packages/ai/package.json` (exports block, after the `recruitment-screener` line ~15)

- [ ] **Step 1: Create the resolver**

Create `packages/ai/src/server/department-resolver.ts`:

```ts
import "server-only";

import {
  type DepartmentResolution,
  departmentResolutionBatchSchema,
} from "@repo/shared/types/user-management";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";

export interface ResolveDepartmentsInput {
  campusLabel: string; // e.g. "Oslo" or "National/unknown" (context only)
  candidates: string[]; // canonical department names the model may choose from
  model?: string; // defaults to gpt-5-nano
  users: Array<{
    department: string; // current freeform M365 department (may be wrong/blank)
    email: string; // local-part of the role mailbox, e.g. "finance.nu.oslo"
    office: string; // current officeLocation (may be wrong/blank)
    ref: string; // opaque key echoed back (the M365 user id)
  }>;
}

const SYSTEM_PROMPT = `You normalise Microsoft 365 user records for BISO, a Norwegian
student organisation. Each licensed mailbox is provisioned per ROLE, not per person,
and the email local-part encodes the role:

- "role.campus" (two segments, e.g. "president.oslo", "controller.oslo") usually means
  a CAMPUS MANAGEMENT role → classification "management", department "Ledelsen {Campus}".
  BUT a two-segment address can also be a function (e.g. "hr.oslo") or a person
  (e.g. "adrian.oslo", a first name). Only classify as management when the first
  segment is clearly a leadership role (president, controller, vice president, etc.).
- "function.deptabbrev.campus" (three+ segments, e.g. "finance.nu.oslo" where "nu" is an
  ad-hoc abbreviation of a department) → classification "department". Choose the ONE
  candidate department that the abbreviation/department best matches. Abbreviations are
  ad-hoc (e.g. "nu" = Næringslivsutvalget). Candidate names may themselves be truncated.
- A bare first name or "firstname.lastname" (e.g. "markus", "adrian.heien"), or anything
  you cannot confidently place, → classification "manual" with department null.

Rules:
- department MUST be exactly one of the provided candidate names, or null. Never invent one.
- Use the current department/office only as weak hints; the email is the source of truth.
- confidence "high" only when the email clearly determines the answer.
- Echo each user's ref unchanged. Keep reasoning to one short sentence.`;

function buildPrompt(input: ResolveDepartmentsInput): string {
  const candidateList =
    input.candidates.length > 0
      ? input.candidates.map((c) => `- ${c}`).join("\n")
      : "(none — classify these as manual unless clearly management)";
  const userList = input.users
    .map(
      (u) =>
        `ref=${u.ref} | email=${u.email} | department=${u.department || "(blank)"} | office=${u.office || "(blank)"}`
    )
    .join("\n");

  return `Campus context: ${input.campusLabel}

Candidate departments for this campus:
${candidateList}

Classify each user below. Return one resolution per user, echoing its ref.

Users:
${userList}`;
}

export async function resolveDepartments(
  input: ResolveDepartmentsInput
): Promise<DepartmentResolution[]> {
  if (input.users.length === 0) {
    return [];
  }
  const model = input.model ?? "gpt-5-nano";
  const result = await generateObject({
    model: openai(model),
    prompt: buildPrompt(input),
    schema: departmentResolutionBatchSchema,
    system: SYSTEM_PROMPT,
  });
  return result.object.resolutions;
}
```

- [ ] **Step 2: Add the package export**

In `packages/ai/package.json`, add this line to the `exports` block immediately after the `"./server/recruitment-emails"` entry:

```json
    "./server/department-resolver": "./src/server/department-resolver.ts",
```

- [ ] **Step 3: Verify the package type-checks**

Run: `bun --filter=@repo/ai check-types`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/ai/src/server/department-resolver.ts packages/ai/package.json
git commit -m "feat(ai): batched department resolver (gpt-5-nano, fenced to candidates)"
```

---

## Task 6: Snapshot table in appwrite.config.json

**Files:**
- Modify: `packages/api/appwrite.config.json` (add a table object to the `tables` array)

> Note: `appwrite.config.json` is normally auto-generated, but the user has
> explicitly asked us to add this table here so they can `appwrite push` it.

- [ ] **Step 1: Add the table**

In `packages/api/appwrite.config.json`, add this object as a new entry in the top-level `tables` array (e.g. right after the `cart_reservations` table object — insert a comma after that table's closing `}` and paste this):

```json
{
  "$id": "m365_remediation_snapshot",
  "$permissions": [
    "create(\"team:admin\")",
    "read(\"team:admin\")",
    "update(\"team:admin\")",
    "delete(\"team:admin\")"
  ],
  "databaseId": "app",
  "name": "M365 Remediation Snapshot",
  "enabled": true,
  "rowSecurity": true,
  "columns": [
    {
      "key": "generated_at",
      "type": "datetime",
      "required": true,
      "array": false,
      "default": null,
      "format": ""
    },
    {
      "key": "generated_by",
      "type": "string",
      "required": false,
      "array": false,
      "size": 120,
      "default": null,
      "encrypt": false
    },
    {
      "key": "total_scanned",
      "type": "integer",
      "required": false,
      "array": false,
      "default": 0,
      "min": 0,
      "max": 1000000
    },
    {
      "key": "safe_count",
      "type": "integer",
      "required": false,
      "array": false,
      "default": 0,
      "min": 0,
      "max": 1000000
    },
    {
      "key": "review_count",
      "type": "integer",
      "required": false,
      "array": false,
      "default": 0,
      "min": 0,
      "max": 1000000
    },
    {
      "key": "manual_count",
      "type": "integer",
      "required": false,
      "array": false,
      "default": 0,
      "min": 0,
      "max": 1000000
    },
    {
      "key": "closed_count",
      "type": "integer",
      "required": false,
      "array": false,
      "default": 0,
      "min": 0,
      "max": 1000000
    },
    {
      "key": "result",
      "type": "string",
      "required": false,
      "array": false,
      "size": 5000000,
      "default": null,
      "encrypt": false
    }
  ],
  "indexes": [
    {
      "key": "idx_generated_at",
      "type": "key",
      "status": "available",
      "columns": ["generated_at"],
      "orders": ["DESC"]
    }
  ]
}
```

- [ ] **Step 2: Validate JSON**

Run: `bun -e "JSON.parse(require('fs').readFileSync('packages/api/appwrite.config.json','utf8')); console.log('valid json')"`
Expected: prints `valid json`.

- [ ] **Step 3: Commit**

```bash
git add packages/api/appwrite.config.json
git commit -m "feat(api): m365_remediation_snapshot table for analysis snapshots"
```

> After this, the user runs `appwrite push` (and optionally regenerates types).
> We do **not** depend on the generated type — the action types the row inline.

---

## Task 7: Server actions — run analysis, read snapshot, adapt apply

**Files:**
- Modify: `apps/admin/src/app/(portal)/_actions/it-remediation.ts` (full rewrite of the plan-building action; keep `applyDepartmentFixes` and `getDepartmentDataHealth`)

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `apps/admin/src/app/(portal)/_actions/it-remediation.ts` with:

```ts
"use server";

import { ID, Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type { Campus, Departments } from "@repo/api/types/appwrite";
import { resolveDepartments } from "@repo/ai/server/department-resolver";
import type {
  DepartmentDataHealthEntry,
  DepartmentDataIssue,
  DepartmentFixDecision,
  DepartmentFixSummary,
  DepartmentResolution,
  M365UserListItem,
  RemediationSnapshot,
} from "@repo/shared/types/user-management";
import { revalidatePath } from "next/cache";
import {
  buildCampusPrefixToId,
  type CanonicalDepartment,
  extractCampusPrefix,
  isClosedName,
  normalizeForCompare,
  stripClosedSuffix,
} from "@/lib/it/department-matching";
import { mapWithConcurrency } from "@/lib/it/concurrency";
import { emailLocalPart, extractCampusHint } from "@/lib/it/email-classify";
import { getGraphService, M365_DOMAIN, toListItem } from "@/lib/it/graph";
import { buildRemediationPlan } from "@/lib/it/remediation-bucketing";
import { requireItPermission } from "@/lib/it-permissions";
import { logAuditEvent } from "./audit-log";

type ActionResult<T> =
  | { data: T; error?: never }
  | { data?: never; error: string };

const TRAILING_WHITESPACE_REGEX = /\s$/;
const SNAPSHOT_TABLE = "m365_remediation_snapshot";
const AI_CHUNK_SIZE = 30;
const AI_CONCURRENCY = 5;
const NATIONAL_KEY = "__national__";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

interface CanonicalData {
  campusIdToName: Map<string, string>;
  canonical: CanonicalDepartment[]; // includes closed (nedlagt) entries
  departments: Departments[];
}

async function loadCanonicalData(): Promise<CanonicalData> {
  const { db } = await createAdminClient();
  const [campuses, departments] = await Promise.all([
    db.listRows<Campus>("app", "campus", [
      Query.orderAsc("name"),
      Query.limit(100),
    ]),
    db.listRows<Departments>("app", "departments", [
      Query.orderAsc("Name"),
      Query.limit(1000),
    ]),
  ]);

  const campusIdToName = new Map(
    campuses.rows.map((campus) => [campus.$id, campus.name])
  );
  const canonical = departments.rows.map((department) => ({
    name: department.Name,
    campusId: department.campus_id,
  }));

  return { canonical, campusIdToName, departments: departments.rows };
}

export async function runDepartmentAnalysis(): Promise<
  ActionResult<RemediationSnapshot>
> {
  try {
    const ctx = await requireItPermission("it.users.editProfile");
    const graph = getGraphService();
    const [users, data] = await Promise.all([
      graph.listLicensedUsers({
        allowedDomain: M365_DOMAIN,
        licensedOnly: true,
      }),
      loadCanonicalData(),
    ]);

    const listItems = users.map(toListItem);

    // Build canonical lookups.
    const campusNames = new Set(data.campusIdToName.values());
    const tokenToCampus = new Map<string, string>();
    for (const name of campusNames) {
      tokenToCampus.set(name.toLowerCase(), name);
    }
    const candidatesByCampus = new Map<string, Set<string>>();
    const allCandidates = new Set<string>();
    for (const dept of data.canonical) {
      if (isClosedName(dept.name)) {
        continue;
      }
      const campusName = data.campusIdToName.get(dept.campusId);
      if (!campusName) {
        continue;
      }
      const set = candidatesByCampus.get(campusName) ?? new Set<string>();
      set.add(dept.name);
      candidatesByCampus.set(campusName, set);
      allCandidates.add(dept.name);
    }
    const closedBaseNames = new Set(
      data.canonical
        .filter((d) => isClosedName(d.name))
        .map((d) => normalizeForCompare(stripClosedSuffix(d.name)))
    );

    // Batch users by campus hint.
    const batches = new Map<string, M365UserListItem[]>();
    for (const item of listItems) {
      const hint =
        extractCampusHint(
          item.mail ?? item.userPrincipalName,
          item.officeLocation,
          tokenToCampus
        ) ?? NATIONAL_KEY;
      const list = batches.get(hint) ?? [];
      list.push(item);
      batches.set(hint, list);
    }

    // Chunk every batch and resolve with bounded concurrency.
    interface Chunk {
      campusLabel: string;
      candidates: string[];
      users: M365UserListItem[];
    }
    const chunks: Chunk[] = [];
    for (const [hint, batchUsers] of batches) {
      const isNational = hint === NATIONAL_KEY;
      const campusLabel = isNational ? "National/unknown" : hint;
      const candidates = isNational
        ? [...allCandidates]
        : [...(candidatesByCampus.get(hint) ?? new Set<string>())];
      for (let i = 0; i < batchUsers.length; i += AI_CHUNK_SIZE) {
        chunks.push({
          campusLabel,
          candidates,
          users: batchUsers.slice(i, i + AI_CHUNK_SIZE),
        });
      }
    }

    const chunkResults = await mapWithConcurrency(
      chunks,
      AI_CONCURRENCY,
      async (chunk): Promise<DepartmentResolution[]> => {
        try {
          return await resolveDepartments({
            campusLabel: chunk.campusLabel,
            candidates: chunk.candidates,
            users: chunk.users.map((u) => ({
              department: u.department ?? "",
              email: emailLocalPart(u.mail ?? u.userPrincipalName),
              office: u.officeLocation ?? "",
              ref: u.id,
            })),
          });
        } catch {
          // Degrade a failed batch to manual rather than aborting the run.
          return chunk.users.map((u) => ({
            ref: u.id,
            classification: "manual" as const,
            department: null,
            campus: null,
            confidence: "low" as const,
            reasoning: "AI resolution failed for this batch",
          }));
        }
      }
    );

    const resolutions = new Map<string, DepartmentResolution>();
    for (const list of chunkResults) {
      for (const r of list) {
        resolutions.set(r.ref, r);
      }
    }

    const plan = buildRemediationPlan({
      users: listItems,
      resolutions,
      candidatesByCampus,
      closedBaseNames,
      campusNames,
    });

    const snapshot: RemediationSnapshot = {
      generatedAt: new Date().toISOString(),
      generatedBy: ctx.email ?? ctx.userId,
      plan,
    };

    const { db } = await createAdminClient();
    await db.createRow("app", SNAPSHOT_TABLE, ID.unique(), {
      generated_at: snapshot.generatedAt,
      generated_by: snapshot.generatedBy,
      total_scanned: plan.totalScanned,
      safe_count: plan.safe.length,
      review_count: plan.review.length,
      manual_count: plan.manual.length,
      closed_count: plan.closed.length,
      result: JSON.stringify(snapshot.plan),
    });

    await logAuditEvent(ctx, "it.m365.department.analysis", {
      resourceType: "m365.user",
      payload: {
        totalScanned: plan.totalScanned,
        safe: plan.safe.length,
        review: plan.review.length,
        manual: plan.manual.length,
        closed: plan.closed.length,
        compliant: plan.compliantCount,
      },
    });

    revalidatePath("/it/users/audit");
    return { data: snapshot };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

export async function getLatestRemediationSnapshot(): Promise<
  ActionResult<RemediationSnapshot | null>
> {
  try {
    await requireItPermission("it.users.view");
    const { db } = await createAdminClient();
    const rows = await db.listRows<{
      $id: string;
      generated_at: string;
      generated_by: string | null;
      result: string | null;
    }>("app", SNAPSHOT_TABLE, [
      Query.orderDesc("generated_at"),
      Query.limit(1),
    ]);
    const latest = rows.rows[0];
    if (!(latest && latest.result)) {
      return { data: null };
    }
    return {
      data: {
        generatedAt: latest.generated_at,
        generatedBy: latest.generated_by ?? "unknown",
        plan: JSON.parse(latest.result),
      },
    };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

export async function applyDepartmentFixes(
  decisions: DepartmentFixDecision[]
): Promise<ActionResult<DepartmentFixSummary>> {
  try {
    const ctx = await requireItPermission("it.users.editProfile");
    const data = await loadCanonicalData();

    // Authoritative department -> campus-name resolution. The campus written to
    // M365 is derived from the department here; the client-supplied campusName
    // is never trusted for the write.
    const prefixToId = buildCampusPrefixToId(data.canonical);
    const activeByName = new Map<string, CanonicalDepartment>();
    for (const dept of data.canonical) {
      if (!isClosedName(dept.name)) {
        activeByName.set(dept.name, dept);
      }
    }
    const resolveCampusName = (departmentName: string): string | null => {
      const dept = activeByName.get(departmentName);
      if (!dept) {
        return null;
      }
      const prefix = extractCampusPrefix(dept.name);
      const mappedId = prefix ? prefixToId.get(prefix) : undefined;
      const campusId = mappedId ?? dept.campusId;
      return data.campusIdToName.get(campusId) ?? null;
    };

    const updates: Array<{
      id: string;
      patch: { department: string; officeLocation: string };
    }> = [];
    const applied: Array<{ department: string; campus: string; users: number }> =
      [];
    for (const decision of decisions) {
      const campusName = resolveCampusName(decision.department);
      if (!campusName) {
        throw new Error(`"${decision.department}" is not a valid department.`);
      }
      applied.push({
        department: decision.department,
        campus: campusName,
        users: decision.userIds.length,
      });
      for (const userId of decision.userIds) {
        updates.push({
          id: userId,
          patch: { department: decision.department, officeLocation: campusName },
        });
      }
    }

    const results = await getGraphService().batchUpdateUsers(updates);
    const failed = results
      .filter((r): r is { id: string; error: string } => r.error !== undefined)
      .map((r) => ({ userId: r.id, error: r.error }));
    const succeeded = results.length - failed.length;

    await logAuditEvent(ctx, "it.m365.user.department.bulkFix", {
      resourceType: "m365.user",
      payload: {
        succeeded,
        failedCount: failed.length,
        decisionCount: decisions.length,
        userCount: updates.length,
        applied,
      },
    });

    revalidatePath("/it/users/audit");
    return { data: { succeeded, failed } };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

export async function getDepartmentDataHealth(): Promise<
  ActionResult<DepartmentDataHealthEntry[]>
> {
  try {
    await requireItPermission("it.users.view");
    const data = await loadCanonicalData();
    const nameCounts = new Map<string, number>();
    for (const department of data.departments) {
      nameCounts.set(department.Name, (nameCounts.get(department.Name) ?? 0) + 1);
    }

    const entries: DepartmentDataHealthEntry[] = [];
    for (const department of data.departments) {
      const issues: DepartmentDataIssue[] = [];
      if (TRAILING_WHITESPACE_REGEX.test(department.Name)) {
        issues.push("trailingWhitespace");
      }
      if ((nameCounts.get(department.Name) ?? 0) > 1) {
        issues.push("duplicateName");
      }
      if (isClosedName(department.Name) && department.active !== false) {
        issues.push("activeClosed");
      }
      if (issues.length > 0) {
        entries.push({
          id: department.$id,
          name: department.Name,
          campusName: data.campusIdToName.get(department.campus_id) ?? "—",
          issues,
        });
      }
    }
    return { data: entries };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}
```

- [ ] **Step 2: Type-check (expect ONE known failure)**

Run: `bun --filter=admin check-types`
Expected: FAIL — only in `it/users/audit/page.tsx`, which still imports the now-removed `getDepartmentRemediationPlan`. That page is rewritten in Task 9. Confirm there are **no** errors inside `it-remediation.ts` itself (all referenced helpers — `normalizeForCompare`, `stripClosedSuffix` — still exist in `department-matching.ts` until Task 8). Do not run the full build yet; it would fail on the same page. The green gate is Task 10 Step 3.

- [ ] **Step 3: Commit**

```bash
git add "apps/admin/src/app/(portal)/_actions/it-remediation.ts"
git commit -m "feat(admin): AI analysis + snapshot persistence server actions"
```

---

## Task 8: Retire the Dice auto-tier; trim matching tests

**Files:**
- Modify: `apps/admin/src/lib/it/department-matching.ts` (remove `classifyDepartmentValue` + similarity machinery; keep helpers)
- Modify: `apps/admin/src/lib/it/department-matching.test.ts` (remove classifier tests)

- [ ] **Step 1: Remove the classifier from the engine**

In `apps/admin/src/lib/it/department-matching.ts`, **delete** everything from
`export type RemediationTier =` (line ~114) to the end of the file
(`classifyDepartmentValue` and the `expectedCampusId` / `sameCampus` helpers it
uses). Also delete the now-unused `diceCoefficient`, `bigrams`,
`normalizeForSimilarity`, `AMPERSAND_REGEX`, and `TRAILING_DOT_SPACE_REGEX` if
they are referenced **only** by the removed code.

**Keep** (these are imported by Tasks 4 & 7): `CAMPUS_PREFIXES`, `CampusPrefix`,
`extractCampusPrefix`, `normalizeForCompare`, `CanonicalDepartment`,
`isClosedName`, `stripClosedSuffix`, `buildCampusPrefixToId`, and the regex
constants those use (`DIACRITIC_MAP`, `DIACRITIC_REGEX`, `WHITESPACE_REGEX`,
`LEADING_PREFIX_REGEX`, `CLOSED_REGEX`).

- [ ] **Step 2: Trim the test file**

In `apps/admin/src/lib/it/department-matching.test.ts`:
- Remove the import of `classifyDepartmentValue` and `diceCoefficient` (and the
  `ClassifierContext` type import) from the top import block.
- Remove `const REVIEW_TIER_REGEX = ...` and **all** `describe(...)` blocks that
  exercise `classifyDepartmentValue` or `diceCoefficient`.
- Keep the `describe` blocks for `normalizeForCompare`, `extractCampusPrefix`,
  `isClosedName`, `stripClosedSuffix`, and `buildCampusPrefixToId`.

- [ ] **Step 3: Run the trimmed tests**

Run: `bun test apps/admin/src/lib/it/department-matching.test.ts`
Expected: PASS (only the retained helper tests run).

- [ ] **Step 4: Type-check (same one known failure as Task 7)**

Run: `bun --filter=admin check-types`
Expected: FAIL **only** in `it/users/audit/page.tsx` (still importing `getDepartmentRemediationPlan`, fixed in Task 9). Confirm there are **no** errors referencing `department-matching.ts` or its removed classifier — that proves nothing else still depends on the Dice tier.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/lib/it/department-matching.ts apps/admin/src/lib/it/department-matching.test.ts
git commit -m "refactor(admin): retire Dice auto-tier; AI now owns classification"
```

---

## Task 9: Audit page reads the snapshot

**Files:**
- Modify: `apps/admin/src/app/(portal)/it/users/audit/page.tsx`

- [ ] **Step 1: Replace the page**

Replace the contents of `apps/admin/src/app/(portal)/it/users/audit/page.tsx` with:

```tsx
import { getTranslations } from "next-intl/server";
import { requireItPagePermission } from "@/lib/it-permissions";
import { listDepartments } from "../../../_actions/departments";
import { getLatestRemediationSnapshot } from "../../../_actions/it-remediation";
import { PageHeader } from "../../../_components/page-header";
import { ItUsersTabs } from "../_components/it-users-tabs";
import { RemediationClient } from "../_components/remediation-client";

// The analysis pass fans out to the AI for ~1800 users; give the run action room.
export const maxDuration = 300;

export default async function ItUsersAuditPage() {
  await requireItPagePermission("it.users.view");
  const t = await getTranslations("adminPortal.it");
  const [snapshotResult, departments] = await Promise.all([
    getLatestRemediationSnapshot(),
    listDepartments(),
  ]);

  const departmentNames = departments.map((d) => d.Name);
  const departmentToCampus: Record<string, string> = {};
  for (const d of departments) {
    if (d.campus?.name) {
      departmentToCampus[d.Name] = d.campus.name;
    }
  }

  return (
    <div className="pb-12">
      <PageHeader
        description={t("audit.description")}
        title={t("audit.title")}
      />
      <ItUsersTabs
        labels={{
          audit: t("users.tabs.audit"),
          dataHealth: t("users.tabs.dataHealth"),
          users: t("users.tabs.users"),
        }}
      />

      {snapshotResult.error ? (
        <div
          className="rounded-2xl p-5 text-sm"
          style={{
            background: "rgba(248,113,113,0.08)",
            border: "1px solid rgba(248,113,113,0.20)",
            color: "#fca5a5",
          }}
        >
          {snapshotResult.error}
        </div>
      ) : (
        <RemediationClient
          departmentNames={departmentNames}
          departmentToCampus={departmentToCampus}
          snapshot={snapshotResult.data ?? null}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `bun --filter=admin check-types`
Expected: FAIL — `RemediationClient` still expects the old `plan` prop. This is fixed in Task 10. (Proceed; do not commit yet.)

> No commit here — Task 10 makes this compile.

---

## Task 10: Remediation client — 4 tabs, Run control, Manual tab

**Files:**
- Modify: `apps/admin/src/app/(portal)/it/users/_components/remediation-client.tsx` (full rewrite)

- [ ] **Step 1: Replace the component**

Replace the contents of `apps/admin/src/app/(portal)/it/users/_components/remediation-client.tsx` with:

```tsx
"use client";

import type {
  DepartmentFixDecision,
  ManualRemediationUser,
  RemediationGroup,
  RemediationSnapshot,
} from "@repo/shared/types/user-management";
import { AlertTriangle, Check, Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import {
  applyDepartmentFixes,
  runDepartmentAnalysis,
} from "../../../_actions/it-remediation";
import { EmptyState } from "../../../_components/empty-state";
import { STUDIO, StudioButton } from "../../../_components/studio";

type Segment = "safe" | "review" | "manual" | "closed";

interface RemediationClientProps {
  departmentNames: string[];
  departmentToCampus: Record<string, string>;
  snapshot: RemediationSnapshot | null;
}

function groupDecision(
  group: RemediationGroup,
  department: string | null,
  campusName: string | null
): DepartmentFixDecision | null {
  if (!(department && campusName)) {
    return null;
  }
  return {
    campusName,
    department,
    userIds: group.affectedUsers.map((u) => u.id),
  };
}

export function RemediationClient({
  departmentNames,
  departmentToCampus,
  snapshot,
}: RemediationClientProps) {
  const t = useTranslations("adminPortal.it.audit");
  const router = useRouter();
  const [segment, setSegment] = useState<Segment>("safe");
  const [pending, startTransition] = useTransition();
  const [analyzing, startAnalysis] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error" | null>(
    null
  );

  function runAnalysis() {
    startAnalysis(async () => {
      const result = await runDepartmentAnalysis();
      if (result.error) {
        setMessage(result.error);
        setMessageType("error");
      } else {
        setMessage(null);
        setMessageType(null);
        router.refresh();
      }
    });
  }

  if (!snapshot) {
    return (
      <div>
        <EmptyState
          description={t("noSnapshotDescription")}
          icon={<RefreshCw size={28} />}
          title={t("noSnapshot")}
        />
        <div className="mt-4 flex justify-center">
          <StudioButton
            disabled={analyzing}
            onClick={runAnalysis}
            variant="primary"
          >
            {analyzing ? (
              <Loader2 className="animate-spin" size={15} />
            ) : (
              <RefreshCw size={15} />
            )}
            {t("runAnalysis")}
          </StudioButton>
        </div>
        {message && messageType === "error" && (
          <p className="mt-3 text-center text-sm" style={{ color: STUDIO.claret }}>
            {message}
          </p>
        )}
      </div>
    );
  }

  const plan = snapshot.plan;

  function apply(decisions: DepartmentFixDecision[]) {
    if (decisions.length === 0) {
      return;
    }
    startTransition(async () => {
      const result = await applyDepartmentFixes(decisions);
      if (result.error) {
        setMessage(result.error);
        setMessageType("error");
      } else if (result.data) {
        setMessage(
          t("applied", {
            failed: result.data.failed.length,
            succeeded: result.data.succeeded,
          })
        );
        setMessageType("success");
        router.refresh();
      }
    });
  }

  function applyAllSafe() {
    const decisions = plan.safe
      .map((group) =>
        groupDecision(
          group,
          group.suggestedDepartment,
          group.suggestedCampusName
        )
      )
      .filter((d): d is DepartmentFixDecision => d !== null);
    apply(decisions);
  }

  const segments: Array<{ count: number; key: Segment; label: string }> = [
    { count: plan.safe.length, key: "safe", label: t("segments.safe") },
    { count: plan.review.length, key: "review", label: t("segments.review") },
    { count: plan.manual.length, key: "manual", label: t("segments.manual") },
    { count: plan.closed.length, key: "closed", label: t("segments.closed") },
  ];

  const segmentDescriptions: Record<Segment, string> = {
    closed: t("closedDescription"),
    manual: t("manualDescription"),
    review: t("reviewDescription"),
    safe: t("safeDescription"),
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="text-sm" style={{ color: STUDIO.ink3 }}>
          {t("summary", {
            compliant: plan.compliantCount,
            flagged:
              plan.safe.length +
              plan.review.length +
              plan.manual.length +
              plan.closed.length,
            total: plan.totalScanned,
          })}
        </p>
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: STUDIO.ink4 }}>
            {t("lastGenerated", {
              when: new Date(snapshot.generatedAt).toLocaleString(),
            })}
          </span>
          <StudioButton
            disabled={analyzing}
            onClick={runAnalysis}
            variant="secondary"
          >
            {analyzing ? (
              <Loader2 className="animate-spin" size={15} />
            ) : (
              <RefreshCw size={15} />
            )}
            {t("reRunAnalysis")}
          </StudioButton>
        </div>
      </div>

      <div
        className="mb-5 flex items-center gap-1 border-b"
        style={{ borderColor: STUDIO.rule }}
      >
        {segments.map((s) => (
          <button
            className="-mb-px border-b-2 px-4 py-2.5 font-medium text-sm"
            key={s.key}
            onClick={() => {
              setSegment(s.key);
              setMessage(null);
              setMessageType(null);
            }}
            style={{
              borderColor: segment === s.key ? STUDIO.claret : "transparent",
              color: segment === s.key ? STUDIO.ink : STUDIO.ink3,
            }}
            type="button"
          >
            {s.label} ({s.count})
          </button>
        ))}
      </div>

      <p className="mb-4 text-xs" style={{ color: STUDIO.ink4 }}>
        {segmentDescriptions[segment]}
      </p>

      {message && (
        <p
          className="mb-4 text-sm"
          style={{
            color: messageType === "error" ? STUDIO.claret : STUDIO.leaf,
          }}
        >
          {message}
        </p>
      )}

      {segment === "safe" && plan.safe.length > 0 && (
        <div className="mb-4">
          <StudioButton disabled={pending} onClick={applyAllSafe} variant="primary">
            {pending ? (
              <Loader2 className="animate-spin" size={15} />
            ) : (
              <Check size={15} />
            )}
            {t("applyAllSafe")}
          </StudioButton>
        </div>
      )}

      {segment === "manual" ? (
        <ManualList
          departmentNames={departmentNames}
          departmentToCampus={departmentToCampus}
          onApply={apply}
          pending={pending}
          users={plan.manual}
        />
      ) : (
        <GroupList
          departmentNames={departmentNames}
          departmentToCampus={departmentToCampus}
          groups={plan[segment]}
          onApply={apply}
          pending={pending}
          segment={segment}
        />
      )}
    </div>
  );
}

function GroupList({
  departmentNames,
  departmentToCampus,
  groups,
  onApply,
  pending,
  segment,
}: {
  departmentNames: string[];
  departmentToCampus: Record<string, string>;
  groups: RemediationGroup[];
  onApply: (decisions: DepartmentFixDecision[]) => void;
  pending: boolean;
  segment: Segment;
}) {
  const t = useTranslations("adminPortal.it.audit");
  if (groups.length === 0) {
    return (
      <EmptyState
        description={t("allClearDescription")}
        icon={<Check size={28} />}
        title={t("allClear")}
      />
    );
  }
  return (
    <div className="space-y-2">
      {groups.map((group) => (
        <GroupRow
          departmentNames={departmentNames}
          departmentToCampus={departmentToCampus}
          group={group}
          key={group.value || "__blank__"}
          onApply={onApply}
          pending={pending}
          segment={segment}
        />
      ))}
    </div>
  );
}

function GroupRow({
  departmentNames,
  departmentToCampus,
  group,
  onApply,
  pending,
  segment,
}: {
  departmentNames: string[];
  departmentToCampus: Record<string, string>;
  group: RemediationGroup;
  onApply: (decisions: DepartmentFixDecision[]) => void;
  pending: boolean;
  segment: Segment;
}) {
  const t = useTranslations("adminPortal.it.audit");
  const [chosen, setChosen] = useState<string | null>(
    group.suggestedDepartment
  );

  useEffect(() => {
    setChosen(group.suggestedDepartment);
  }, [group.suggestedDepartment]);

  const displayValue = group.value || t("blankDepartment");
  const count = group.affectedUsers.length;

  let infoSuffix = "";
  if (segment === "safe" && group.suggestedDepartment) {
    infoSuffix = t("writesWithOffice", {
      department: group.suggestedDepartment,
      office: group.suggestedCampusName ?? "",
    });
  } else if (segment === "review" && group.reasoning) {
    infoSuffix = group.reasoning;
  }

  return (
    <div
      className="rounded-2xl px-5 py-4"
      style={{
        background: "rgba(255,255,255,0.46)",
        border: `0.5px solid ${STUDIO.rule}`,
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate font-medium text-sm" style={{ color: STUDIO.ink }}>
            {displayValue}
          </p>
          <p className="mt-1 text-xs" style={{ color: STUDIO.ink4 }}>
            {t("affectedUsers", { count })}
            {infoSuffix ? ` · ${infoSuffix}` : ""}
          </p>
        </div>

        {segment === "review" && (
          <div className="flex items-center gap-2">
            <select
              aria-label={t("selectDepartment")}
              className="rounded-lg border px-3 py-2 text-sm"
              onChange={(e) => setChosen(e.target.value || null)}
              style={{ borderColor: STUDIO.rule2, color: STUDIO.ink2 }}
              value={chosen ?? ""}
            >
              <option value="">{t("selectDepartment")}</option>
              {departmentNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <StudioButton
              disabled={pending || !chosen}
              onClick={() => {
                const campusName =
                  group.suggestedCampusName ??
                  (chosen ? (departmentToCampus[chosen] ?? null) : null);
                const decision = groupDecision(group, chosen, campusName);
                if (decision) {
                  onApply([decision]);
                }
              }}
              variant="secondary"
            >
              {t("applyGroup")}
            </StudioButton>
          </div>
        )}

        {segment === "closed" && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"
            style={{ background: "rgba(107,30,30,0.08)", color: STUDIO.claret }}
          >
            <AlertTriangle size={12} />
            {t("segments.closed")}
          </span>
        )}
      </div>
    </div>
  );
}

function ManualList({
  departmentNames,
  departmentToCampus,
  onApply,
  pending,
  users,
}: {
  departmentNames: string[];
  departmentToCampus: Record<string, string>;
  onApply: (decisions: DepartmentFixDecision[]) => void;
  pending: boolean;
  users: ManualRemediationUser[];
}) {
  const t = useTranslations("adminPortal.it.audit");
  if (users.length === 0) {
    return (
      <EmptyState
        description={t("allClearDescription")}
        icon={<Check size={28} />}
        title={t("allClear")}
      />
    );
  }
  return (
    <div className="space-y-2">
      {users.map((entry) => (
        <ManualRow
          departmentNames={departmentNames}
          departmentToCampus={departmentToCampus}
          entry={entry}
          key={entry.user.id}
          onApply={onApply}
          pending={pending}
        />
      ))}
    </div>
  );
}

function ManualRow({
  departmentNames,
  departmentToCampus,
  entry,
  onApply,
  pending,
}: {
  departmentNames: string[];
  departmentToCampus: Record<string, string>;
  entry: ManualRemediationUser;
  onApply: (decisions: DepartmentFixDecision[]) => void;
  pending: boolean;
}) {
  const t = useTranslations("adminPortal.it.audit");
  const [chosen, setChosen] = useState<string>("");
  const { user } = entry;

  return (
    <div
      className="rounded-2xl px-5 py-4"
      style={{
        background: "rgba(255,255,255,0.46)",
        border: `0.5px solid ${STUDIO.rule}`,
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate font-medium text-sm" style={{ color: STUDIO.ink }}>
            {user.displayName}
          </p>
          <p className="mt-1 truncate text-xs" style={{ color: STUDIO.ink4 }}>
            {user.userPrincipalName}
            {entry.reasoning ? ` · ${entry.reasoning}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            aria-label={t("selectDepartment")}
            className="rounded-lg border px-3 py-2 text-sm"
            onChange={(e) => setChosen(e.target.value)}
            style={{ borderColor: STUDIO.rule2, color: STUDIO.ink2 }}
            value={chosen}
          >
            <option value="">{t("selectDepartment")}</option>
            {departmentNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <StudioButton
            disabled={pending || !chosen}
            onClick={() => {
              const campusName = departmentToCampus[chosen] ?? null;
              if (chosen && campusName) {
                onApply([
                  { campusName, department: chosen, userIds: [user.id] },
                ]);
              }
            }}
            variant="secondary"
          >
            {t("applyGroup")}
          </StudioButton>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Format**

Run: `bun x ultracite fix`
Expected: may reorder imports; no errors.

- [ ] **Step 3: Type-check**

Run: `bun --filter=admin check-types`
Expected: PASS (page + client now agree on the `snapshot` prop).

- [ ] **Step 4: Commit**

```bash
git add "apps/admin/src/app/(portal)/it/users/audit/page.tsx" "apps/admin/src/app/(portal)/it/users/_components/remediation-client.tsx"
git commit -m "feat(admin): snapshot-driven remediation UI with manual tab + run control"
```

---

## Task 11: i18n keys (en + no)

**Files:**
- Modify: `packages/i18n/messages/en/adminPortal.json`
- Modify: `packages/i18n/messages/no/adminPortal.json`

- [ ] **Step 1: Inspect the current audit block**

Run: `bun -e "const m=require('./packages/i18n/messages/en/adminPortal.json'); console.log(Object.keys(m.it.audit))"`
Expected: prints the existing `it.audit` keys (segments, summary, applied, etc.).

- [ ] **Step 2: Update the English `it.audit` block**

In `packages/i18n/messages/en/adminPortal.json`, set `it.audit` to include these keys (merge — keep any existing identical keys, add/replace the rest):

```json
{
  "title": "Department audit",
  "description": "AI-assisted review of every licensed M365 user's department against the 24SO source of truth.",
  "runAnalysis": "Run analysis",
  "reRunAnalysis": "Re-run analysis",
  "noSnapshot": "No analysis yet",
  "noSnapshotDescription": "Run the analysis to classify every licensed user against their role email.",
  "lastGenerated": "Last generated {when}",
  "summary": "{flagged} groups need attention · {compliant} of {total} users compliant",
  "applied": "{succeeded} updated, {failed} failed",
  "affectedUsers": "{count} users",
  "writesWithOffice": "Sets department → {department}, office → {office}",
  "applyAllSafe": "Apply all safe fixes",
  "applyGroup": "Apply",
  "selectDepartment": "Select department",
  "blankDepartment": "(blank department)",
  "allClear": "All clear",
  "allClearDescription": "Nothing needs attention in this tab.",
  "segments": {
    "safe": "Safe",
    "review": "Review",
    "manual": "Manual",
    "closed": "Closed"
  },
  "safeDescription": "High-confidence matches. Review the members, then apply.",
  "reviewDescription": "The AI suggested a department but wasn't certain — confirm or change each one.",
  "manualDescription": "Personal or national mailboxes the AI couldn't place. Assign each one yourself.",
  "closedDescription": "Users still attached to a closed (nedlagt) department. Reassign them in 24SO."
}
```

- [ ] **Step 3: Update the Norwegian `it.audit` block**

In `packages/i18n/messages/no/adminPortal.json`, set `it.audit` to:

```json
{
  "title": "Avdelingsrevisjon",
  "description": "AI-assistert gjennomgang av avdelingen til hver lisensierte M365-bruker mot fasiten i 24SO.",
  "runAnalysis": "Kjør analyse",
  "reRunAnalysis": "Kjør analyse på nytt",
  "noSnapshot": "Ingen analyse ennå",
  "noSnapshotDescription": "Kjør analysen for å klassifisere hver lisensierte bruker mot rolle-e-posten deres.",
  "lastGenerated": "Sist generert {when}",
  "summary": "{flagged} grupper trenger oppfølging · {compliant} av {total} brukere er korrekte",
  "applied": "{succeeded} oppdatert, {failed} feilet",
  "affectedUsers": "{count} brukere",
  "writesWithOffice": "Setter avdeling → {department}, kontor → {office}",
  "applyAllSafe": "Bruk alle trygge rettelser",
  "applyGroup": "Bruk",
  "selectDepartment": "Velg avdeling",
  "blankDepartment": "(tom avdeling)",
  "allClear": "Alt i orden",
  "allClearDescription": "Ingenting trenger oppfølging i denne fanen.",
  "segments": {
    "safe": "Trygg",
    "review": "Gjennomgang",
    "manual": "Manuell",
    "closed": "Nedlagt"
  },
  "safeDescription": "Treff med høy sikkerhet. Se gjennom medlemmene, og bruk deretter.",
  "reviewDescription": "AI-en foreslo en avdeling, men var usikker — bekreft eller endre hver enkelt.",
  "manualDescription": "Personlige eller nasjonale postbokser AI-en ikke kunne plassere. Tildel hver enkelt selv.",
  "closedDescription": "Brukere som fortsatt er knyttet til en nedlagt avdeling. Flytt dem i 24SO."
}
```

- [ ] **Step 4: Verify JSON validity + key parity**

Run:
```bash
bun -e "const e=require('./packages/i18n/messages/en/adminPortal.json'); const n=require('./packages/i18n/messages/no/adminPortal.json'); const ek=Object.keys(e.it.audit).sort(); const nk=Object.keys(n.it.audit).sort(); console.log('en==no audit keys:', JSON.stringify(ek)===JSON.stringify(nk)); console.log('segments parity:', JSON.stringify(Object.keys(e.it.audit.segments).sort())===JSON.stringify(Object.keys(n.it.audit.segments).sort()))"
```
Expected: both `true`.

- [ ] **Step 5: Commit**

```bash
git add packages/i18n/messages/en/adminPortal.json packages/i18n/messages/no/adminPortal.json
git commit -m "i18n(admin): remediation v2 audit keys (manual tab, run controls)"
```

---

## Task 12: Final verification + docs

**Files:**
- Modify: `apps/admin/CLAUDE.md` (add an AI-resolver + snapshot note under App-specific patterns)

- [ ] **Step 1: Full type-check**

Run: `bun run check-types`
Expected: all tasks successful.

- [ ] **Step 2: Full build (the only signal for the "use server" rule)**

Run: `bun run build --filter=admin`
Expected: `✓ Compiled successfully`.

- [ ] **Step 3: Run the IT unit tests**

Run: `bun test apps/admin/src/lib/it/`
Expected: PASS — `email-classify`, `concurrency`, `remediation-bucketing`, and the trimmed `department-matching` suites all green.

- [ ] **Step 4: Lint/format**

Run: `bun x ultracite fix && bun --filter=admin lint`
Expected: no errors.

- [ ] **Step 5: Document the pattern**

In `apps/admin/CLAUDE.md`, under "App-specific patterns", add:

```markdown
- **AI department remediation**: `/it/users/audit` runs an AI pass
  (`@repo/ai/server/department-resolver`, `gpt-5-nano`) over every licensed M365
  user, fenced to the canonical department list (off-list answers are forced to
  the Manual tab — never written). Results are persisted as a JSON snapshot in
  the `m365_remediation_snapshot` table and rendered by `remediation-client.tsx`;
  the heavy run happens only on the explicit "Run analysis" action (the page sets
  `maxDuration = 300`). Pure logic lives in `src/lib/it/{email-classify,
  remediation-bucketing,concurrency}.ts` and is unit-tested with `bun:test`.
```

- [ ] **Step 6: Commit**

```bash
git add apps/admin/CLAUDE.md
git commit -m "docs(admin): document AI department remediation flow"
```

---

## Manual verification (after `appwrite push`)

These require the pushed table + live Graph/OpenAI creds; run in `bun run dev --filter=admin`:

1. Open `/it/users` → **Department audit** tab → empty state → **Run analysis**.
2. After it completes, confirm the **Safe** tab's `Ledelsen Oslo` group lists ≈6–9 real members (not 29).
3. Confirm a `finance.<abbrev>.oslo` user resolves to the correct `OSL …` department in Safe or Review.
4. Confirm `adrian.oslo` / `markus` (or any `firstname[.lastname]`) appear in **Manual**, each with a department + (derived) campus picker.
5. Apply a safe group → users update in M365 (department + officeLocation), snapshot refreshes, "Last generated" updates on **Re-run**.
6. Switch locale to Norwegian and confirm all labels render with their ICU args.

---

## Self-review notes (addressed)

- **Spec coverage:** resolver (T5), fencing/validation (T4), every-user scan + batching (T7), 4 buckets incl. Manual (T4/T10), snapshot persistence (T6/T7), retire Dice tier (T8), i18n (T11), docs (T12). ✓
- **Type consistency:** `RemediationSnapshot`, `DepartmentResolution`, `ManualRemediationUser`, `RemediationGroup` defined in T1 and used identically in T4/T5/T7/T9/T10. `resolveDepartments` signature matches its call in T7. `buildRemediationPlan`/`validateResolution` signatures match T4 tests and T7 caller. ✓
- **ICU safety:** every `t(...)` that targets a placeholder string passes its args (`summary`, `applied`, `affectedUsers`, `writesWithOffice`, `lastGenerated`); static keys pass none. ✓
- **"use server" rule:** `it-remediation.ts` exports only async fns; all shared values come from plain modules (`graph.ts`, `department-matching.ts`, `email-classify.ts`, `concurrency.ts`, `remediation-bucketing.ts`) or the async `resolveDepartments`. Verified by the T7/T12 build step. ✓
