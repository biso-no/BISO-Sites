# M365 Department Remediation + 24SO Data Health — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a bulk remediation tool in the admin IT section that classifies the ~1109 M365 users with non-canonical departments into auto-applicable "safe" fixes, "needs review" suggestions, and "closed-department" users — then applies the fixes to M365 via Graph `$batch` — plus a read-only 24SO data-health report.

**Architecture:** A pure, unit-tested matching engine (deterministic rules gate auto-apply; Dice-coefficient similarity powers review suggestions and a campus-prefix/near-tie guard). Three server actions assemble inputs, classify, and apply. A reworked "Department audit" hub renders three segments; a new "24SO data health" tab lists canonical name defects. M365 only — the Appwrite `user` table is not touched.

**Tech Stack:** Next.js 16 App Router (RSC + server actions), `@repo/connectors` Microsoft Graph client, `bun:test` for unit tests, `@repo/api` Appwrite, `next-intl`, STUDIO design tokens.

**Spec:** `docs/superpowers/specs/2026-06-09-m365-department-remediation-design.md`

**Branch note:** Repo is on `main`. Before Task 1, create a feature branch:
`git checkout -b feat/m365-department-remediation`.

---

## File Structure

**Create:**
- `apps/admin/src/lib/it/department-matching.ts` — pure engine (normalize, similarity, classify).
- `apps/admin/src/lib/it/department-matching.test.ts` — `bun:test` unit tests.
- `apps/admin/src/app/(portal)/_actions/it-remediation.ts` — `getDepartmentRemediationPlan`, `applyDepartmentFixes`, `getDepartmentDataHealth`.
- `apps/admin/src/app/(portal)/it/users/_components/remediation-client.tsx` — the three-segment hub UI.
- `apps/admin/src/app/(portal)/it/data-health/page.tsx` — data-health page.
- `apps/admin/src/app/(portal)/it/data-health/_components/data-health-client.tsx` — data-health table.

**Modify:**
- `packages/connectors/src/azure/users.ts` — add `batchUpdateUsers`.
- `packages/shared/types/user-management.ts` — add remediation result types.
- `apps/admin/src/app/(portal)/it/users/_components/it-users-tabs.tsx` — add the data-health tab.
- `apps/admin/src/app/(portal)/it/users/audit/page.tsx` — rework into the remediation hub.
- `packages/i18n/messages/en/adminPortal.json`, `packages/i18n/messages/no/adminPortal.json` — new keys.

**Remove (superseded by the engine):**
- `auditM365UserDepartments` + the `evaluateDepartmentCompliance` / `buildDepartmentAuditLookups` helpers in `it-users.ts`.
- `apps/admin/src/app/(portal)/it/users/_components/audit-list-client.tsx`.
- The `DepartmentAuditIssue` / `M365DepartmentAuditEntry` / `M365DepartmentAuditResult` types (replaced by new ones).

---

## Task 1: Similarity + normalization helpers (pure)

**Files:**
- Create: `apps/admin/src/lib/it/department-matching.ts`
- Test: `apps/admin/src/lib/it/department-matching.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/admin/src/lib/it/department-matching.test.ts
import { describe, expect, test } from "bun:test";
import {
  diceCoefficient,
  extractCampusPrefix,
  normalizeForCompare,
} from "./department-matching";

describe("normalizeForCompare", () => {
  test("lowercases, folds Norwegian diacritics, collapses whitespace", () => {
    expect(normalizeForCompare("OSL  Markedsføring")).toBe("markedsforing");
    expect(normalizeForCompare("BRG Næringsliv")).toBe("naeringsliv");
    expect(normalizeForCompare("Drift og Påvirkning ")).toBe("drift og pavirkning");
  });

  test("strips a leading campus prefix token", () => {
    expect(normalizeForCompare("TRD Økonomi")).toBe("okonomi");
    expect(normalizeForCompare("Økonomi")).toBe("okonomi");
  });
});

describe("extractCampusPrefix", () => {
  test("returns the known campus prefix or null", () => {
    expect(extractCampusPrefix("OSL DIGI-KOMM - Digital")).toBe("OSL");
    expect(extractCampusPrefix("BRG Marked")).toBe("BRG");
    expect(extractCampusPrefix("National Board")).toBeNull();
    expect(extractCampusPrefix("oslo lowercase prefix")).toBeNull();
  });
});

describe("diceCoefficient", () => {
  test("identical strings score 1", () => {
    expect(diceCoefficient("markedsforing", "markedsforing")).toBe(1);
  });

  test("no shared bigrams scores 0", () => {
    expect(diceCoefficient("abc", "xyz")).toBe(0);
  });

  test("near matches score high, unrelated score low", () => {
    expect(diceCoefficient("markedsforing", "markedsanalyse")).toBeLessThan(0.5);
    expect(
      diceCoefficient("naeringsliv og konsulent", "naeringsliv & konsulent")
    ).toBeGreaterThan(0.8);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test "apps/admin/src/lib/it/department-matching.test.ts"`
Expected: FAIL — `Cannot find module './department-matching'` / exports undefined.

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/admin/src/lib/it/department-matching.ts
const CAMPUS_PREFIXES = ["OSL", "BRG", "TRD", "STV"] as const;
export type CampusPrefix = (typeof CAMPUS_PREFIXES)[number];

const DIACRITIC_MAP: Record<string, string> = {
  ø: "o",
  æ: "ae",
  å: "a",
};
const DIACRITIC_REGEX = /[øæå]/g;
const WHITESPACE_REGEX = /\s+/g;
const LEADING_PREFIX_REGEX = /^(OSL|BRG|TRD|STV)\s+/;

export function extractCampusPrefix(name: string): CampusPrefix | null {
  const match = name.trim().match(LEADING_PREFIX_REGEX);
  return match ? (match[1] as CampusPrefix) : null;
}

export function normalizeForCompare(name: string): string {
  return name
    .trim()
    .replace(LEADING_PREFIX_REGEX, "")
    .toLowerCase()
    .replace(DIACRITIC_REGEX, (char) => DIACRITIC_MAP[char] ?? char)
    .replace(WHITESPACE_REGEX, " ")
    .trim();
}

function bigrams(value: string): Map<string, number> {
  const counts = new Map<string, number>();
  const compact = value.replace(WHITESPACE_REGEX, "");
  for (let i = 0; i < compact.length - 1; i++) {
    const gram = compact.slice(i, i + 2);
    counts.set(gram, (counts.get(gram) ?? 0) + 1);
  }
  return counts;
}

export function diceCoefficient(a: string, b: string): number {
  if (a === b) {
    return 1;
  }
  const aGrams = bigrams(a);
  const bGrams = bigrams(b);
  if (aGrams.size === 0 || bGrams.size === 0) {
    return 0;
  }
  let intersection = 0;
  for (const [gram, countA] of aGrams) {
    const countB = bGrams.get(gram) ?? 0;
    intersection += Math.min(countA, countB);
  }
  const total =
    [...aGrams.values()].reduce((sum, n) => sum + n, 0) +
    [...bGrams.values()].reduce((sum, n) => sum + n, 0);
  return (2 * intersection) / total;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test "apps/admin/src/lib/it/department-matching.test.ts"`
Expected: PASS (all `normalizeForCompare`, `extractCampusPrefix`, `diceCoefficient` cases).

- [ ] **Step 5: Commit**

```bash
git add "apps/admin/src/lib/it/department-matching.ts" "apps/admin/src/lib/it/department-matching.test.ts"
git commit -m "feat(admin): department-matching similarity and normalization helpers

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Closed-suffix + campus-prefix-to-id derivation (pure)

**Files:**
- Modify: `apps/admin/src/lib/it/department-matching.ts`
- Test: `apps/admin/src/lib/it/department-matching.test.ts`

- [ ] **Step 1: Write the failing test (append to the test file)**

```ts
import {
  buildCampusPrefixToId,
  isClosedName,
  stripClosedSuffix,
} from "./department-matching";

describe("isClosedName / stripClosedSuffix", () => {
  test("detects the nedlagt suffix case-insensitively", () => {
    expect(isClosedName("OSL DataAnalytisk Utvalg - nedlagt")).toBe(true);
    expect(isClosedName("OSL DataAnalytisk Utvalg - NEDLAGT")).toBe(true);
    expect(isClosedName("OSL DataAnalytisk Utvalg")).toBe(false);
  });

  test("strips the nedlagt suffix to recover the base name", () => {
    expect(stripClosedSuffix("OSL DataAnalytisk Utvalg - nedlagt")).toBe(
      "OSL DataAnalytisk Utvalg"
    );
    expect(stripClosedSuffix("OSL Marked")).toBe("OSL Marked");
  });
});

describe("buildCampusPrefixToId", () => {
  test("maps each prefix to the campus id most common among its departments", () => {
    const map = buildCampusPrefixToId([
      { name: "OSL Marked", campusId: "1" },
      { name: "OSL Drift", campusId: "1" },
      { name: "BRG Marked", campusId: "2" },
      { name: "Sentralt utvalg", campusId: "5" }, // no prefix, ignored
    ]);
    expect(map.get("OSL")).toBe("1");
    expect(map.get("BRG")).toBe("2");
    expect(map.has("TRD")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test "apps/admin/src/lib/it/department-matching.test.ts"`
Expected: FAIL — `isClosedName` / `stripClosedSuffix` / `buildCampusPrefixToId` not exported.

- [ ] **Step 3: Write minimal implementation (append to the module)**

```ts
const CLOSED_REGEX = /\s*-\s*nedlagt\s*$/i;

export interface CanonicalDepartment {
  name: string; // exact stored canonical name (the write target)
  campusId: string;
}

export function isClosedName(name: string): boolean {
  return CLOSED_REGEX.test(name);
}

export function stripClosedSuffix(name: string): string {
  return name.replace(CLOSED_REGEX, "").trim();
}

export function buildCampusPrefixToId(
  departments: CanonicalDepartment[]
): Map<CampusPrefix, string> {
  // For each prefix, count campusId occurrences and pick the most common.
  const tally = new Map<CampusPrefix, Map<string, number>>();
  for (const department of departments) {
    const prefix = extractCampusPrefix(department.name);
    if (!prefix) {
      continue;
    }
    const counts = tally.get(prefix) ?? new Map<string, number>();
    counts.set(
      department.campusId,
      (counts.get(department.campusId) ?? 0) + 1
    );
    tally.set(prefix, counts);
  }

  const result = new Map<CampusPrefix, string>();
  for (const [prefix, counts] of tally) {
    let bestId: string | null = null;
    let bestCount = -1;
    for (const [campusId, count] of counts) {
      if (count > bestCount) {
        bestId = campusId;
        bestCount = count;
      }
    }
    if (bestId) {
      result.set(prefix, bestId);
    }
  }
  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test "apps/admin/src/lib/it/department-matching.test.ts"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "apps/admin/src/lib/it/department-matching.ts" "apps/admin/src/lib/it/department-matching.test.ts"
git commit -m "feat(admin): closed-suffix detection and campus-prefix-to-id mapping

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Core classifier (pure)

**Files:**
- Modify: `apps/admin/src/lib/it/department-matching.ts`
- Test: `apps/admin/src/lib/it/department-matching.test.ts`

This is the heart of the engine. `classifyDepartmentValue` takes one distinct M365
department string plus the canonical set and returns its tier + the canonical write
target + campus id + score.

- [ ] **Step 1: Write the failing test (append)**

```ts
import {
  classifyDepartmentValue,
  type ClassifierContext,
} from "./department-matching";

function makeContext(): ClassifierContext {
  const canonical = [
    { name: "OSL DIGI-KOMM - Digital kommunikasjon og markedsf.", campusId: "1" },
    { name: "OSL Markedsforing", campusId: "1" },
    { name: "OSL Markedsanalyse", campusId: "1" },
    { name: "OSL Naringsliv og Konsulent", campusId: "1" },
    { name: "BRG Marked", campusId: "2" },
    { name: "OSL DataAnalytisk Utvalg - nedlagt", campusId: "1" },
    { name: "Sentralstyret", campusId: "5" },
  ];
  return {
    canonical,
    campusPrefixToId: buildCampusPrefixToId(canonical),
    reviewThreshold: 0.8,
    minPrefixLength: 20,
    tieMargin: 0.1,
  };
}

describe("classifyDepartmentValue", () => {
  test("blank value -> review-no-match", () => {
    const r = classifyDepartmentValue("", makeContext());
    expect(r.tier).toBe("review-no-match");
    expect(r.suggestedDepartment).toBeNull();
  });

  test("exact (case/whitespace) -> safe-exact with canonical casing", () => {
    const r = classifyDepartmentValue("  brg marked ", makeContext());
    expect(r.tier).toBe("safe-exact");
    expect(r.suggestedDepartment).toBe("BRG Marked");
    expect(r.suggestedCampusId).toBe("2");
  });

  test("truncated full name -> safe-truncation to the canonical truncated value", () => {
    const r = classifyDepartmentValue(
      "OSL DIGI-KOMM - Digital kommunikasjon og markedsføring",
      makeContext()
    );
    expect(r.tier).toBe("safe-truncation");
    expect(r.suggestedDepartment).toBe(
      "OSL DIGI-KOMM - Digital kommunikasjon og markedsf."
    );
    expect(r.suggestedCampusId).toBe("1");
  });

  test("user on a closed department -> closed", () => {
    const r = classifyDepartmentValue("OSL DataAnalytisk Utvalg", makeContext());
    expect(r.tier).toBe("closed");
  });

  test("diacritic/& typo within a campus -> review-suggested", () => {
    const r = classifyDepartmentValue(
      "OSL Næringsliv & Konsulent",
      makeContext()
    );
    expect(r.tier).toBe("review-suggested");
    expect(r.suggestedDepartment).toBe("OSL Naringsliv og Konsulent");
    expect(r.score).toBeGreaterThan(0.8);
  });

  test("cross-campus high similarity is never auto -> review at best", () => {
    // "BRG Markedsforing" is similar to OSL Markedsforing but different campus.
    const r = classifyDepartmentValue("BRG Markedsforing", makeContext());
    expect(r.tier).not.toBe("safe-exact");
    expect(r.tier).not.toBe("safe-truncation");
  });

  test("ambiguous near-tie prefix -> demoted to review", () => {
    // "OSL Markeds" is a prefix of both Markedsforing and Markedsanalyse.
    const r = classifyDepartmentValue("OSL Markeds", makeContext());
    expect(r.tier).toMatch(/^review-/);
  });

  test("nothing close -> review-no-match", () => {
    const r = classifyDepartmentValue("OSL Completely Unrelated Xyz", makeContext());
    expect(r.tier).toBe("review-no-match");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test "apps/admin/src/lib/it/department-matching.test.ts"`
Expected: FAIL — `classifyDepartmentValue` / `ClassifierContext` not exported.

- [ ] **Step 3: Write minimal implementation (append)**

```ts
export type RemediationTier =
  | "safe-exact"
  | "safe-truncation"
  | "review-suggested"
  | "review-no-match"
  | "closed";

export interface ClassifierContext {
  canonical: CanonicalDepartment[];
  campusPrefixToId: Map<CampusPrefix, string>;
  reviewThreshold: number; // e.g. 0.8
  minPrefixLength: number; // e.g. 20
  tieMargin: number; // e.g. 0.1
}

export interface DepartmentClassification {
  tier: RemediationTier;
  suggestedDepartment: string | null;
  suggestedCampusId: string | null;
  score: number | null;
}

function expectedCampusId(
  department: CanonicalDepartment,
  context: ClassifierContext
): string {
  const prefix = extractCampusPrefix(department.name);
  return (prefix && context.campusPrefixToId.get(prefix)) || department.campusId;
}

function sameCampus(
  value: string,
  department: CanonicalDepartment,
  context: ClassifierContext
): boolean {
  const valuePrefix = extractCampusPrefix(value);
  if (!valuePrefix) {
    return true; // value has no prefix signal; don't block on campus here
  }
  return context.campusPrefixToId.get(valuePrefix) === expectedCampusId(
    department,
    context
  );
}

export function classifyDepartmentValue(
  rawValue: string,
  context: ClassifierContext
): DepartmentClassification {
  const value = rawValue.trim();
  if (!value) {
    return {
      tier: "review-no-match",
      suggestedDepartment: null,
      suggestedCampusId: null,
      score: null,
    };
  }

  const normalizedValue = normalizeForCompare(value);

  // 1. Closed: value corresponds to a "- nedlagt" department's base name.
  for (const department of context.canonical) {
    if (
      isClosedName(department.name) &&
      normalizeForCompare(stripClosedSuffix(department.name)) === normalizedValue
    ) {
      return {
        tier: "closed",
        suggestedDepartment: null,
        suggestedCampusId: null,
        score: null,
      };
    }
  }

  const active = context.canonical.filter((d) => !isClosedName(d.name));

  // 2. Safe-exact: case/whitespace-insensitive equality to exactly one canonical.
  const exactMatches = active.filter(
    (d) => normalizeForCompare(d.name) === normalizedValue
  );
  if (exactMatches.length === 1) {
    const department = exactMatches[0];
    return {
      tier: "safe-exact",
      suggestedDepartment: department.name,
      suggestedCampusId: expectedCampusId(department, context),
      score: 1,
    };
  }

  // 3. Safe-truncation: a canonical (trailing "."/space stripped) is a prefix of
  // the value, campus agrees, canonical long enough, and exactly one qualifies.
  const truncationMatches = active.filter((d) => {
    const stripped = d.name.replace(/[.\s]+$/, "").trim();
    return (
      stripped.length >= context.minPrefixLength &&
      value.toLowerCase().startsWith(stripped.toLowerCase()) &&
      sameCampus(value, d, context)
    );
  });
  if (truncationMatches.length === 1) {
    const department = truncationMatches[0];
    return {
      tier: "safe-truncation",
      suggestedDepartment: department.name,
      suggestedCampusId: expectedCampusId(department, context),
      score: 0.97,
    };
  }

  // 4 & 5. Similarity ranking (campus-scoped when the value has a prefix).
  const valuePrefix = extractCampusPrefix(value);
  const candidates = active.filter((d) =>
    valuePrefix ? sameCampus(value, d, context) : true
  );
  const scored = candidates
    .map((d) => ({
      department: d,
      score: diceCoefficient(normalizedValue, normalizeForCompare(d.name)),
    }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  const second = scored[1];

  // If a truncation/exact attempt was ambiguous (>1 match), force review.
  const wasAmbiguous =
    exactMatches.length > 1 || truncationMatches.length > 1;

  if (
    best &&
    best.score >= context.reviewThreshold &&
    (!second || best.score - second.score >= context.tieMargin) &&
    !wasAmbiguous
  ) {
    return {
      tier: "review-suggested",
      suggestedDepartment: best.department.name,
      suggestedCampusId: expectedCampusId(best.department, context),
      score: best.score,
    };
  }

  if (best && best.score >= context.reviewThreshold && wasAmbiguous) {
    // Ambiguous: still offer the top suggestion for the admin to confirm.
    return {
      tier: "review-suggested",
      suggestedDepartment: best.department.name,
      suggestedCampusId: expectedCampusId(best.department, context),
      score: best.score,
    };
  }

  return {
    tier: "review-no-match",
    suggestedDepartment: best?.department.name ?? null,
    suggestedCampusId: best ? expectedCampusId(best.department, context) : null,
    score: best?.score ?? null,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test "apps/admin/src/lib/it/department-matching.test.ts"`
Expected: PASS — all classifier cases (exact, truncation, closed, fuzzy, cross-campus, near-tie, no-match).

- [ ] **Step 5: Commit**

```bash
git add "apps/admin/src/lib/it/department-matching.ts" "apps/admin/src/lib/it/department-matching.test.ts"
git commit -m "feat(admin): hybrid department classifier (rules + similarity)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Graph `$batch` bulk update

**Files:**
- Modify: `packages/connectors/src/azure/users.ts`

No unit test (network-bound); verified via `check-types` and manual run in Task 9.

- [ ] **Step 1: Add the method after `updateUser` in `GraphUserService`**

```ts
  /**
   * Patch many users in one round-trip group using Microsoft Graph $batch
   * (max 20 requests per batch). Returns a per-user result; failures do not
   * abort the run.
   */
  async batchUpdateUsers(
    updates: Array<{ id: string; patch: GraphUserProfileUpdate }>
  ): Promise<Array<{ error?: string; id: string }>> {
    const BATCH_SIZE = 20;
    const results: Array<{ error?: string; id: string }> = [];

    for (let start = 0; start < updates.length; start += BATCH_SIZE) {
      const chunk = updates.slice(start, start + BATCH_SIZE);
      const requests = chunk.map((update, index) => ({
        id: String(index),
        method: "PATCH",
        url: `/users/${encodeGraphPathSegment(update.id)}`,
        headers: { "Content-Type": "application/json" },
        body: update.patch,
      }));

      let response: { responses?: Array<{ id: string; status: number; body?: unknown }> };
      try {
        response = await this.client.api("/$batch").post({ requests });
      } catch (error) {
        const message = normalizeGraphError(error).message;
        for (const update of chunk) {
          results.push({ id: update.id, error: message });
        }
        continue;
      }

      const byId = new Map(
        (response.responses ?? []).map((item) => [item.id, item])
      );
      chunk.forEach((update, index) => {
        const item = byId.get(String(index));
        if (item && item.status >= 200 && item.status < 300) {
          results.push({ id: update.id });
        } else {
          const body = item?.body as
            | { error?: { message?: string } }
            | undefined;
          results.push({
            id: update.id,
            error: body?.error?.message ?? `Graph batch failed (status ${item?.status ?? "unknown"})`,
          });
        }
      });
    }

    return results;
  }
```

- [ ] **Step 2: Verify it type-checks**

Run: `bun run check-types --filter=@repo/connectors`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add packages/connectors/src/azure/users.ts
git commit -m "feat(connectors): GraphUserService.batchUpdateUsers via /\$batch

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Remediation result types

**Files:**
- Modify: `packages/shared/types/user-management.ts`

Remove the now-superseded audit types and add the remediation result types.

- [ ] **Step 1: Delete the old audit types**

Remove this block (added in the earlier audit work) from the file:

```ts
export type DepartmentAuditIssue =
  | "missingDepartment"
  | "unknownDepartment"
  | "missingOffice"
  | "unknownOffice"
  | "campusMismatch";

export interface M365DepartmentAuditEntry {
  user: M365UserListItem;
  issues: DepartmentAuditIssue[];
  // Campus names the matched canonical department belongs to (for UI hints).
  expectedCampuses: string[];
}

export interface M365DepartmentAuditResult {
  entries: M365DepartmentAuditEntry[];
  totalScanned: number;
  compliantCount: number;
}
```

- [ ] **Step 2: Add the new types in the same place**

```ts
export type RemediationTier =
  | "safe-exact"
  | "safe-truncation"
  | "review-suggested"
  | "review-no-match"
  | "closed";

// One distinct M365 department value and the fix proposed for everyone on it.
export interface RemediationGroup {
  value: string; // the raw M365 department string ("" = blank department)
  tier: RemediationTier;
  suggestedDepartment: string | null; // canonical name to write
  suggestedCampusName: string | null; // campus the suggestion belongs to
  score: number | null; // similarity 0-1 when applicable
  affectedUsers: M365UserListItem[];
}

export interface DepartmentRemediationPlan {
  safe: RemediationGroup[];
  review: RemediationGroup[];
  closed: RemediationGroup[];
  totalScanned: number;
  compliantCount: number;
}

// A single accepted fix decision sent to applyDepartmentFixes.
export interface DepartmentFixDecision {
  userIds: string[];
  department: string; // exact canonical name to write
  campusName: string; // office location to write
}

export interface DepartmentFixSummary {
  succeeded: number;
  failed: Array<{ userId: string; error: string }>;
}

// 24SO data-health report.
export type DepartmentDataIssue =
  | "trailingWhitespace"
  | "duplicateName"
  | "activeClosed";

export interface DepartmentDataHealthEntry {
  id: string;
  name: string;
  campusName: string;
  issues: DepartmentDataIssue[];
}
```

- [ ] **Step 3: Verify type-check (will fail in it-users.ts — fixed in Task 8)**

Run: `bun run check-types --filter=@repo/shared`
Expected: exit 0 (the shared package itself compiles; admin breakage is handled in Task 8).

- [ ] **Step 4: Commit**

```bash
git add packages/shared/types/user-management.ts
git commit -m "feat(shared): replace audit types with remediation result types

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Remediation server actions

**Files:**
- Create: `apps/admin/src/app/(portal)/_actions/it-remediation.ts`

Reuses `getGraphService`, `M365_DOMAIN`, `toListItem` — but those are module-private
in `it-users.ts`. **Step 0:** export them from `it-users.ts` so this file can import
them (add `export` to `function toListItem`, `function getGraphService`, and
`const M365_DOMAIN`). Confirm with: `grep -n "export" apps/admin/src/app/(portal)/_actions/it-users.ts | grep -E "toListItem|getGraphService|M365_DOMAIN"`.

- [ ] **Step 1: Create the actions file**

```ts
// apps/admin/src/app/(portal)/_actions/it-remediation.ts
"use server";

import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type { Campus, Departments } from "@repo/api/types/appwrite";
import type {
  DepartmentDataHealthEntry,
  DepartmentDataIssue,
  DepartmentFixDecision,
  DepartmentFixSummary,
  DepartmentRemediationPlan,
  M365UserListItem,
  RemediationGroup,
} from "@repo/shared/types/user-management";
import { revalidatePath } from "next/cache";
import {
  buildCampusPrefixToId,
  type CanonicalDepartment,
  classifyDepartmentValue,
  type ClassifierContext,
  isClosedName,
} from "@/lib/it/department-matching";
import { requireItPermission } from "@/lib/it-permissions";
import { logAuditEvent } from "./audit-log";
import { getGraphService, M365_DOMAIN, toListItem } from "./it-users";

type ActionResult<T> =
  | { data: T; error?: never }
  | { data?: never; error: string };

const TRAILING_WHITESPACE_REGEX = /\s$/;
const REVIEW_THRESHOLD = 0.8;
const MIN_PREFIX_LENGTH = 20;
const TIE_MARGIN = 0.1;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

interface CanonicalData {
  canonical: CanonicalDepartment[]; // includes closed (nedlagt) entries
  campusIdToName: Map<string, string>;
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

function isCompliant(
  user: M365UserListItem,
  group: { suggestedDepartment: string | null; suggestedCampusName: string | null }
): boolean {
  return (
    group.suggestedDepartment !== null &&
    user.department === group.suggestedDepartment &&
    user.officeLocation === group.suggestedCampusName
  );
}

export async function getDepartmentRemediationPlan(): Promise<
  ActionResult<DepartmentRemediationPlan>
> {
  try {
    await requireItPermission("it.users.view");
    const graph = getGraphService();
    const [users, data] = await Promise.all([
      graph.listLicensedUsers({ allowedDomain: M365_DOMAIN, licensedOnly: true }),
      loadCanonicalData(),
    ]);

    const context: ClassifierContext = {
      canonical: data.canonical,
      campusPrefixToId: buildCampusPrefixToId(data.canonical),
      reviewThreshold: REVIEW_THRESHOLD,
      minPrefixLength: MIN_PREFIX_LENGTH,
      tieMargin: TIE_MARGIN,
    };

    // Group users by their distinct (trimmed) department string.
    const byValue = new Map<string, M365UserListItem[]>();
    for (const user of users) {
      const value = (user.department ?? "").trim();
      const list = byValue.get(value) ?? [];
      list.push(toListItem(user));
      byValue.set(value, list);
    }

    const safe: RemediationGroup[] = [];
    const review: RemediationGroup[] = [];
    const closed: RemediationGroup[] = [];
    let compliantCount = 0;

    for (const [value, groupUsers] of byValue) {
      const classification = classifyDepartmentValue(value, context);
      const suggestedCampusName = classification.suggestedCampusId
        ? data.campusIdToName.get(classification.suggestedCampusId) ?? null
        : null;
      const group: RemediationGroup = {
        value,
        tier: classification.tier,
        suggestedDepartment: classification.suggestedDepartment,
        suggestedCampusName,
        score: classification.score,
        affectedUsers: groupUsers,
      };

      if (classification.tier === "closed") {
        closed.push(group);
        continue;
      }
      if (
        classification.tier === "safe-exact" ||
        classification.tier === "safe-truncation"
      ) {
        // Drop users who are already fully compliant; keep those needing a write.
        const needsFix = groupUsers.filter((user) => !isCompliant(user, group));
        compliantCount += groupUsers.length - needsFix.length;
        if (needsFix.length > 0) {
          safe.push({ ...group, affectedUsers: needsFix });
        }
        continue;
      }
      review.push(group);
    }

    const sortByCount = (a: RemediationGroup, b: RemediationGroup) =>
      b.affectedUsers.length - a.affectedUsers.length;
    safe.sort(sortByCount);
    review.sort(sortByCount);
    closed.sort(sortByCount);

    return {
      data: {
        safe,
        review,
        closed,
        totalScanned: users.length,
        compliantCount,
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
    const validNames = new Set(
      data.canonical.filter((d) => !isClosedName(d.name)).map((d) => d.name)
    );
    const validCampusNames = new Set(data.campusIdToName.values());

    const updates: Array<{
      id: string;
      patch: { department: string; officeLocation: string };
    }> = [];
    for (const decision of decisions) {
      if (!validNames.has(decision.department)) {
        throw new Error(`"${decision.department}" is not a valid department.`);
      }
      if (!validCampusNames.has(decision.campusName)) {
        throw new Error(`"${decision.campusName}" is not a valid campus.`);
      }
      for (const userId of decision.userIds) {
        updates.push({
          id: userId,
          patch: {
            department: decision.department,
            officeLocation: decision.campusName,
          },
        });
      }
    }

    const results = await getGraphService().batchUpdateUsers(updates);
    const failed = results
      .filter((r) => r.error)
      .map((r) => ({ userId: r.id, error: r.error as string }));
    const succeeded = results.length - failed.length;

    await logAuditEvent(ctx, "it.m365.user.department.bulkFix", {
      resourceType: "m365.user",
      payload: {
        succeeded,
        failedCount: failed.length,
        decisionCount: decisions.length,
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
      nameCounts.set(
        department.Name,
        (nameCounts.get(department.Name) ?? 0) + 1
      );
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

- [ ] **Step 2: Type-check (expected to still fail until Task 8 cleans `it-users.ts`)**

Run: `grep -n "export function getGraphService\|export function toListItem\|export const M365_DOMAIN" "apps/admin/src/app/(portal)/_actions/it-users.ts"`
Expected: three matches (after the Step 0 exports). Full admin `check-types` runs in Task 8.

- [ ] **Step 3: Commit**

```bash
git add "apps/admin/src/app/(portal)/_actions/it-remediation.ts" "apps/admin/src/app/(portal)/_actions/it-users.ts"
git commit -m "feat(admin): remediation plan, bulk-fix, and data-health server actions

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: i18n keys (en + no)

**Files:**
- Modify: `packages/i18n/messages/en/adminPortal.json`
- Modify: `packages/i18n/messages/no/adminPortal.json`

- [ ] **Step 1: Move the `audit` block to `it` (sibling of `users`) in `en/adminPortal.json`**

**Delete** the existing `"audit": { … }` object that currently sits under `it.users`
(added in the earlier work), and **add** this block directly under `it` (as a sibling
of `users` and the new `dataHealth`), so the page's `adminPortal.it` namespace reaches
`audit.*`, `users.tabs.*`, and `dataHealth.*`:

```json
      "audit": {
        "title": "Department audit",
        "description": "Match M365 departments to the canonical 24SevenOffice list and fix drift in bulk.",
        "summary": "{flagged} groups need attention · {compliant} of {total} users compliant",
        "segments": {
          "safe": "Safe fixes",
          "review": "Needs review",
          "closed": "Closed departments"
        },
        "safeDescription": "Deterministic matches (exact, case, or truncation). Apply without per-user review.",
        "reviewDescription": "Best-guess matches that need a human decision.",
        "closedDescription": "Users on departments that have been closed (nedlagt). Reassign manually.",
        "applyAllSafe": "Apply all safe fixes",
        "applyGroup": "Apply",
        "affectedUsers": "{count} users",
        "writes": "Sets department → {department}",
        "writesWithOffice": "Sets department → {department}, office → {office}",
        "suggestion": "Suggested: {department} ({score}%)",
        "selectDepartment": "Choose department",
        "noSuggestion": "No confident match — choose a department",
        "applied": "{succeeded} updated, {failed} failed",
        "allClear": "Nothing to remediate",
        "allClearDescription": "Every licensed user matches a canonical department and campus.",
        "blankDepartment": "(no department)"
      }
```

- [ ] **Step 2: Add a `dataHealth` block under `it` (sibling of `users`) in `en/adminPortal.json`**

```json
      "dataHealth": {
        "title": "24SO data health",
        "description": "Canonical department records with defects to fix in 24SevenOffice.",
        "empty": "No data issues found",
        "emptyDescription": "All canonical department names are clean.",
        "column": { "name": "Department", "campus": "Campus", "issues": "Issues" },
        "issues": {
          "trailingWhitespace": "Trailing space",
          "duplicateName": "Duplicate name",
          "activeClosed": "Active but marked nedlagt"
        }
      }
```

- [ ] **Step 3: Add the `tabs.dataHealth` key under `it.users.tabs` in `en/adminPortal.json`**

Change the existing `tabs` object to:

```json
      "tabs": {
        "users": "Users",
        "audit": "Department audit",
        "dataHealth": "24SO data health"
      }
```

- [ ] **Step 4: Apply the Norwegian equivalents in `no/adminPortal.json`**

Move the `audit` block from `it.users` to `it` (sibling of `users`), with these values:

```json
      "audit": {
        "title": "Avdelingskontroll",
        "description": "Match M365-avdelinger mot den offisielle 24SevenOffice-listen og rett opp avvik i bulk.",
        "summary": "{flagged} grupper trenger oppfølging · {compliant} av {total} brukere i orden",
        "segments": {
          "safe": "Trygge rettelser",
          "review": "Trenger gjennomgang",
          "closed": "Nedlagte avdelinger"
        },
        "safeDescription": "Deterministiske treff (eksakt, store/små bokstaver, eller forkortelse). Kan brukes uten gjennomgang per bruker.",
        "reviewDescription": "Antatte treff som krever en menneskelig beslutning.",
        "closedDescription": "Brukere på avdelinger som er nedlagt. Må flyttes manuelt.",
        "applyAllSafe": "Bruk alle trygge rettelser",
        "applyGroup": "Bruk",
        "affectedUsers": "{count} brukere",
        "writes": "Setter avdeling → {department}",
        "writesWithOffice": "Setter avdeling → {department}, kontor → {office}",
        "suggestion": "Forslag: {department} ({score}%)",
        "selectDepartment": "Velg avdeling",
        "noSuggestion": "Ingen sikker match — velg en avdeling",
        "applied": "{succeeded} oppdatert, {failed} feilet",
        "allClear": "Ingenting å rette",
        "allClearDescription": "Alle lisensierte brukere matcher en gyldig avdeling og campus.",
        "blankDepartment": "(ingen avdeling)"
      }
```

Add the `dataHealth` block under `it`:

```json
      "dataHealth": {
        "title": "24SO datakvalitet",
        "description": "Avdelingsoppføringer med feil som må rettes i 24SevenOffice.",
        "empty": "Ingen datafeil funnet",
        "emptyDescription": "Alle avdelingsnavn er rene.",
        "column": { "name": "Avdeling", "campus": "Campus", "issues": "Feil" },
        "issues": {
          "trailingWhitespace": "Mellomrom på slutten",
          "duplicateName": "Duplikatnavn",
          "activeClosed": "Aktiv men merket nedlagt"
        }
      }
```

Update the `tabs` object:

```json
      "tabs": {
        "users": "Brukere",
        "audit": "Avdelingskontroll",
        "dataHealth": "24SO datakvalitet"
      }
```

- [ ] **Step 5: Validate JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('packages/i18n/messages/en/adminPortal.json','utf8'));JSON.parse(require('fs').readFileSync('packages/i18n/messages/no/adminPortal.json','utf8'));console.log('JSON OK')"`
Expected: `JSON OK`

- [ ] **Step 6: Commit**

```bash
git add packages/i18n/messages/en/adminPortal.json packages/i18n/messages/no/adminPortal.json
git commit -m "i18n(admin): remediation hub and data-health strings

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Remove superseded audit code + fix tabs

> **ATOMIC PAIR:** Tasks 8 and 9 are one UI cutover — the repo does **not** compile
> between them (deleting the old component/action breaks the old audit page; the tabs
> change breaks the consumers). Do **not** run `check-types` or commit at the end of
> Task 8. Complete Task 9, then type-check and make a single combined commit at the
> end of Task 9.

**Files:**
- Modify: `apps/admin/src/app/(portal)/_actions/it-users.ts`
- Delete: `apps/admin/src/app/(portal)/it/users/_components/audit-list-client.tsx`
- Modify: `apps/admin/src/app/(portal)/it/users/_components/it-users-tabs.tsx`
- Modify: `apps/admin/src/app/(portal)/it/users/page.tsx`

- [ ] **Step 1: Remove the audit logic from `it-users.ts`**

Delete `auditM365UserDepartments`, `evaluateDepartmentCompliance`,
`buildDepartmentAuditLookups`, and the `DepartmentAuditLookups` interface. Remove the
now-unused type imports `DepartmentAuditIssue`, `M365DepartmentAuditEntry`,
`M365DepartmentAuditResult` from the `@repo/shared/types/user-management` import
block. Keep `M365UserListItem` and the rest.

- [ ] **Step 2: Delete the old audit list component**

Run: `git rm "apps/admin/src/app/(portal)/it/users/_components/audit-list-client.tsx"`

- [ ] **Step 3: Add the data-health tab to `it-users-tabs.tsx`**

Replace the `ItUsersTabsProps` labels type and `TABS` array:

```tsx
interface ItUsersTabsProps {
  labels: {
    users: string;
    audit: string;
    dataHealth: string;
  };
}

const TABS = [
  { href: "/it/users", key: "users" as const },
  { href: "/it/users/audit", key: "audit" as const },
  { href: "/it/data-health", key: "dataHealth" as const },
];
```

And update the active-tab check so `/it/users` does not match `/it/data-health`
(it already uses an exact check for `/it/users` and `startsWith` for others — verify
`/it/data-health` uses `startsWith`, which is correct since it is its own segment).

- [ ] **Step 4: Update `users/page.tsx` to pass the new `dataHealth` tab label**

The existing list page renders `<ItUsersTabs labels={{ audit, users }} />`. Since
`ItUsersTabsProps` now requires `dataHealth`, update that call:

```tsx
      <ItUsersTabs
        labels={{
          audit: t("tabs.audit"),
          dataHealth: t("tabs.dataHealth"),
          users: t("tabs.users"),
        }}
      />
```

(The page's `t` is `getTranslations("adminPortal.it.users")`, so `tabs.*` resolves to
`it.users.tabs.*`.)

- [ ] **Step 5: Do not type-check or commit yet — continue to Task 9**

The repo intentionally does not compile at this point (the old `audit/page.tsx` still
imports the just-deleted component and removed action). Proceed directly to Task 9,
which rewrites that page; type-check and commit there.

---

## Task 9: Remediation hub UI (completes the Task 8 cutover)

**Files:**
- Create: `apps/admin/src/app/(portal)/it/users/_components/remediation-client.tsx`
- Modify: `apps/admin/src/app/(portal)/it/users/audit/page.tsx`

- [ ] **Step 1: Create the remediation client component**

```tsx
// apps/admin/src/app/(portal)/it/users/_components/remediation-client.tsx
"use client";

import type {
  DepartmentFixDecision,
  DepartmentRemediationPlan,
  RemediationGroup,
} from "@repo/shared/types/user-management";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { applyDepartmentFixes } from "../../../_actions/it-remediation";
import { EmptyState } from "../../../_components/empty-state";
import { STUDIO, StudioButton } from "../../../_components/studio";

type Segment = "safe" | "review" | "closed";

interface RemediationClientProps {
  plan: DepartmentRemediationPlan;
  departmentNames: string[];
  departmentToCampus: Record<string, string>; // canonical name -> campus name
  labels: Record<string, string>;
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
    userIds: group.affectedUsers.map((u) => u.id),
    department,
    campusName,
  };
}

export function RemediationClient({
  plan,
  departmentNames,
  departmentToCampus,
  labels,
}: RemediationClientProps) {
  const [segment, setSegment] = useState<Segment>("safe");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const segments: Array<{ key: Segment; count: number; label: string }> = [
    { key: "safe", count: plan.safe.length, label: labels.safe },
    { key: "review", count: plan.review.length, label: labels.review },
    { key: "closed", count: plan.closed.length, label: labels.closed },
  ];

  function apply(decisions: DepartmentFixDecision[]) {
    if (decisions.length === 0) {
      return;
    }
    startTransition(async () => {
      const result = await applyDepartmentFixes(decisions);
      if (result.error) {
        setMessage(result.error);
      } else {
        setMessage(
          labels.applied
            .replace("{succeeded}", String(result.data.succeeded))
            .replace("{failed}", String(result.data.failed.length))
        );
      }
    });
  }

  function applyAllSafe() {
    const decisions = plan.safe
      .map((group) =>
        groupDecision(group, group.suggestedDepartment, group.suggestedCampusName)
      )
      .filter((d): d is DepartmentFixDecision => d !== null);
    apply(decisions);
  }

  const active =
    segment === "safe" ? plan.safe : segment === "review" ? plan.review : plan.closed;

  return (
    <div>
      <p className="mb-4 text-sm" style={{ color: STUDIO.ink3 }}>
        {labels.summary}
      </p>

      <div className="mb-5 flex items-center gap-1 border-b" style={{ borderColor: STUDIO.rule }}>
        {segments.map((s) => (
          <button
            className="-mb-px border-b-2 px-4 py-2.5 font-medium text-sm"
            key={s.key}
            onClick={() => {
              setSegment(s.key);
              setMessage(null);
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

      {message && (
        <p className="mb-4 text-sm" style={{ color: STUDIO.leaf }}>
          {message}
        </p>
      )}

      {segment === "safe" && plan.safe.length > 0 && (
        <div className="mb-4">
          <StudioButton disabled={pending} onClick={applyAllSafe} variant="primary">
            {pending ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />}
            {labels.applyAllSafe}
          </StudioButton>
        </div>
      )}

      {active.length === 0 ? (
        <EmptyState
          description={labels.allClearDescription}
          icon={<Check size={28} />}
          title={labels.allClear}
        />
      ) : (
        <div className="space-y-2">
          {active.map((group) => (
            <GroupRow
              departmentNames={departmentNames}
              departmentToCampus={departmentToCampus}
              group={group}
              key={group.value || "__blank__"}
              labels={labels}
              onApply={apply}
              pending={pending}
              segment={segment}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function GroupRow({
  group,
  segment,
  departmentNames,
  departmentToCampus,
  labels,
  onApply,
  pending,
}: {
  group: RemediationGroup;
  segment: Segment;
  departmentNames: string[];
  departmentToCampus: Record<string, string>;
  labels: Record<string, string>;
  onApply: (decisions: DepartmentFixDecision[]) => void;
  pending: boolean;
}) {
  const [chosen, setChosen] = useState<string | null>(group.suggestedDepartment);

  const displayValue = group.value || labels.blankDepartment;
  const count = group.affectedUsers.length;

  return (
    <div
      className="rounded-2xl px-5 py-4"
      style={{ background: "rgba(255,255,255,0.46)", border: `0.5px solid ${STUDIO.rule}` }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate font-medium text-sm" style={{ color: STUDIO.ink }}>
            {displayValue}
          </p>
          <p className="mt-1 text-xs" style={{ color: STUDIO.ink4 }}>
            {labels.affectedUsers.replace("{count}", String(count))}
            {group.suggestedDepartment &&
              ` · ${labels.suggestion
                .replace("{department}", group.suggestedDepartment)
                .replace("{score}", String(Math.round((group.score ?? 0) * 100)))}`}
          </p>
        </div>

        {segment === "review" && (
          <div className="flex items-center gap-2">
            <select
              className="rounded-lg border px-3 py-2 text-sm"
              onChange={(e) => setChosen(e.target.value || null)}
              style={{ borderColor: STUDIO.rule2, color: STUDIO.ink2 }}
              value={chosen ?? ""}
            >
              <option value="">{labels.selectDepartment}</option>
              {departmentNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <StudioButton
              disabled={pending || !chosen}
              onClick={() => {
                // Use the suggestion's campus; for no-match groups derive the campus
                // from the admin's chosen department.
                const campusName =
                  group.suggestedCampusName ??
                  (chosen ? departmentToCampus[chosen] ?? null : null);
                const decision = groupDecision(group, chosen, campusName);
                if (decision) {
                  onApply([decision]);
                }
              }}
              variant="secondary"
            >
              {labels.applyGroup}
            </StudioButton>
          </div>
        )}

        {segment === "closed" && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"
            style={{ background: "rgba(107,30,30,0.08)", color: STUDIO.claret }}
          >
            <AlertTriangle size={12} />
            {labels.closed}
          </span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Rework `audit/page.tsx` into the hub**

```tsx
// apps/admin/src/app/(portal)/it/users/audit/page.tsx
import { getTranslations } from "next-intl/server";
import { requireItPagePermission } from "@/lib/it-permissions";
import { getDepartmentRemediationPlan } from "../../../_actions/it-remediation";
import { listDepartments } from "../../../_actions/departments";
import { PageHeader } from "../../../_components/page-header";
import { ItUsersTabs } from "../_components/it-users-tabs";
import { RemediationClient } from "../_components/remediation-client";

export default async function ItUsersAuditPage() {
  await requireItPagePermission("it.users.view");
  const t = await getTranslations("adminPortal.it");
  const [result, departments] = await Promise.all([
    getDepartmentRemediationPlan(),
    listDepartments(),
  ]);

  const departmentNames = departments.map((d) => d.Name);
  const departmentToCampus: Record<string, string> = {};
  // campus name is needed; departments carry campus_id, not name — map via the
  // plan's groups is insufficient. Build from the campus list instead:
  // (listDepartments returns Departments with campus relation; use d.campus?.name)
  for (const d of departments) {
    if (d.campus?.name) {
      departmentToCampus[d.Name] = d.campus.name;
    }
  }

  return (
    <div className="pb-12">
      <PageHeader description={t("audit.description")} title={t("audit.title")} />
      <ItUsersTabs
        labels={{
          audit: t("users.tabs.audit"),
          dataHealth: t("users.tabs.dataHealth"),
          users: t("users.tabs.users"),
        }}
      />

      {result.data ? (
        <RemediationClient
          departmentNames={departmentNames}
          departmentToCampus={departmentToCampus}
          labels={{
            affectedUsers: t("audit.affectedUsers"),
            allClear: t("audit.allClear"),
            allClearDescription: t("audit.allClearDescription"),
            applied: t("audit.applied"),
            applyAllSafe: t("audit.applyAllSafe"),
            applyGroup: t("audit.applyGroup"),
            blankDepartment: t("audit.blankDepartment"),
            closed: t("audit.segments.closed"),
            review: t("audit.segments.review"),
            safe: t("audit.segments.safe"),
            selectDepartment: t("audit.selectDepartment"),
            suggestion: t("audit.suggestion"),
            summary: t("audit.summary", {
              compliant: result.data.compliantCount,
              flagged:
                result.data.safe.length +
                result.data.review.length +
                result.data.closed.length,
              total: result.data.totalScanned,
            }),
          }}
          plan={result.data}
        />
      ) : (
        <div
          className="rounded-2xl p-5 text-sm"
          style={{
            background: "rgba(248,113,113,0.08)",
            border: "1px solid rgba(248,113,113,0.20)",
            color: "#fca5a5",
          }}
        >
          {result.error}
        </div>
      )}
    </div>
  );
}
```

> `listDepartments` and the `Departments.campus` relation already exist
> (`_actions/departments.ts`, `@repo/api/types/appwrite`), so `departmentToCampus`
> is built directly from `d.campus?.name` as shown.

- [ ] **Step 3: Format, lint, and type-check the whole cutover (Tasks 8 + 9)**

Run:
```bash
bun x ultracite fix \
  "apps/admin/src/app/(portal)/it/users/_components/remediation-client.tsx" \
  "apps/admin/src/app/(portal)/it/users/audit/page.tsx" \
  "apps/admin/src/app/(portal)/it/users/page.tsx" \
  "apps/admin/src/app/(portal)/it/users/_components/it-users-tabs.tsx" \
  "apps/admin/src/app/(portal)/_actions/it-users.ts"
bun run check-types
```
Expected: ultracite clean; check-types 13/13 exit 0 (the repo compiles again now that
the page is rewritten).

- [ ] **Step 4: Commit the full cutover (both tasks)**

```bash
git add -A
git commit -m "feat(admin): department remediation hub, tabs, remove exact-match audit

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 10: 24SO data-health page

**Files:**
- Create: `apps/admin/src/app/(portal)/it/data-health/page.tsx`
- Create: `apps/admin/src/app/(portal)/it/data-health/_components/data-health-client.tsx`

- [ ] **Step 1: Create the data-health client**

```tsx
// apps/admin/src/app/(portal)/it/data-health/_components/data-health-client.tsx
"use client";

import type {
  DepartmentDataHealthEntry,
  DepartmentDataIssue,
} from "@repo/shared/types/user-management";
import { ShieldCheck } from "lucide-react";
import { EmptyState } from "../../../_components/empty-state";
import { STUDIO } from "../../../_components/studio";

interface DataHealthClientProps {
  entries: DepartmentDataHealthEntry[];
  labels: {
    empty: string;
    emptyDescription: string;
    columnName: string;
    columnCampus: string;
    columnIssues: string;
    issues: Record<DepartmentDataIssue, string>;
  };
}

export function DataHealthClient({ entries, labels }: DataHealthClientProps) {
  if (entries.length === 0) {
    return (
      <EmptyState
        description={labels.emptyDescription}
        icon={<ShieldCheck size={28} />}
        title={labels.empty}
      />
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => (
        <div
          className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.5fr)] items-center gap-4 rounded-2xl px-5 py-4"
          key={entry.id}
          style={{ background: "rgba(255,255,255,0.46)", border: `0.5px solid ${STUDIO.rule}` }}
        >
          <p className="truncate font-medium text-sm" style={{ color: STUDIO.ink }}>
            <code>{`"${entry.name}"`}</code>
          </p>
          <p className="truncate text-xs" style={{ color: STUDIO.ink3 }}>
            {entry.campusName}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {entry.issues.map((issue) => (
              <span
                className="inline-flex items-center rounded-full px-2.5 py-1 text-xs"
                key={issue}
                style={{ background: "rgba(176,138,62,0.09)", color: "#6a5118" }}
              >
                {labels.issues[issue]}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create the data-health page**

```tsx
// apps/admin/src/app/(portal)/it/data-health/page.tsx
import { getTranslations } from "next-intl/server";
import { requireItPagePermission } from "@/lib/it-permissions";
import { getDepartmentDataHealth } from "../../_actions/it-remediation";
import { PageHeader } from "../../_components/page-header";
import { ItUsersTabs } from "../users/_components/it-users-tabs";
import { DataHealthClient } from "./_components/data-health-client";

export default async function DataHealthPage() {
  await requireItPagePermission("it.users.view");
  const t = await getTranslations("adminPortal.it");
  const result = await getDepartmentDataHealth();

  return (
    <div className="pb-12">
      <PageHeader
        description={t("dataHealth.description")}
        title={t("dataHealth.title")}
      />
      <ItUsersTabs
        labels={{
          audit: t("users.tabs.audit"),
          dataHealth: t("users.tabs.dataHealth"),
          users: t("users.tabs.users"),
        }}
      />

      {result.data ? (
        <DataHealthClient
          entries={result.data}
          labels={{
            columnCampus: t("dataHealth.column.campus"),
            columnIssues: t("dataHealth.column.issues"),
            columnName: t("dataHealth.column.name"),
            empty: t("dataHealth.empty"),
            emptyDescription: t("dataHealth.emptyDescription"),
            issues: {
              activeClosed: t("dataHealth.issues.activeClosed"),
              duplicateName: t("dataHealth.issues.duplicateName"),
              trailingWhitespace: t("dataHealth.issues.trailingWhitespace"),
            },
          }}
        />
      ) : (
        <div
          className="rounded-2xl p-5 text-sm"
          style={{
            background: "rgba(248,113,113,0.08)",
            border: "1px solid rgba(248,113,113,0.20)",
            color: "#fca5a5",
          }}
        >
          {result.error}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Format, lint, type-check**

Run:
```bash
bun x ultracite fix "apps/admin/src/app/(portal)/it/data-health/page.tsx" "apps/admin/src/app/(portal)/it/data-health/_components/data-health-client.tsx"
bun run check-types
```
Expected: clean; 13/13 exit 0.

- [ ] **Step 4: Commit**

```bash
git add "apps/admin/src/app/(portal)/it/data-health/"
git commit -m "feat(admin): 24SO department data-health report

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 11: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the engine unit tests**

Run: `bun test "apps/admin/src/lib/it/department-matching.test.ts"`
Expected: all tests PASS.

- [ ] **Step 2: Repo type-check**

Run: `bun run check-types`
Expected: 13/13 successful, exit 0.

- [ ] **Step 3: Lint all touched files**

Run:
```bash
bun x ultracite check \
  "apps/admin/src/lib/it/department-matching.ts" \
  "apps/admin/src/app/(portal)/_actions/it-remediation.ts" \
  "apps/admin/src/app/(portal)/_actions/it-users.ts" \
  "apps/admin/src/app/(portal)/it/users/audit/page.tsx" \
  "apps/admin/src/app/(portal)/it/users/_components/it-users-tabs.tsx" \
  "apps/admin/src/app/(portal)/it/users/_components/remediation-client.tsx" \
  "apps/admin/src/app/(portal)/it/data-health/page.tsx" \
  "apps/admin/src/app/(portal)/it/data-health/_components/data-health-client.tsx" \
  "packages/connectors/src/azure/users.ts" \
  "packages/shared/types/user-management.ts"
```
Expected: "No fixes applied", no errors.

- [ ] **Step 4: Manual smoke test**

Run: `bun run dev --filter=admin`, sign in as a global admin, open `/it/users` →
**Department audit**. Verify:
- Previously false-flagged truncation users (e.g. `OSL DIGI-KOMM … markedsføring`) now appear under **Safe fixes** with target `… markedsf.`, not as errors.
- **Apply all safe fixes** updates a small test subset (try one group first) and shows the `{succeeded}/{failed}` message; confirm in M365 the `department`/`officeLocation` changed and an `it.m365.user.department.bulkFix` audit-log row exists.
- **Needs review** lets you pick/override a department and apply a group.
- **Closed departments** lists users on `- nedlagt` departments with no apply action.
- **24SO data health** lists departments with trailing spaces / duplicates.

- [ ] **Step 5: Final commit (if formatting changed anything)**

```bash
git add -A
git commit -m "chore(admin): formatting after department remediation

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Notes for the implementer

- **Thresholds** (`REVIEW_THRESHOLD=0.8`, `MIN_PREFIX_LENGTH=20`, `TIE_MARGIN=0.1`) are in `it-remediation.ts`. Tune against real data during Step 4 of Task 11.
- **Graph throughput:** ~56 batches for 1100 users. If Graph returns 429s on the
  `$batch` call, add a short delay between chunks in `batchUpdateUsers` (not expected
  for an admin-triggered one-off).
- **Compliant users never appear** in safe groups — `getDepartmentRemediationPlan`
  filters them out and counts them in `compliantCount`.
- The `review-no-match` group's campus is resolved from the admin's selected
  department via the `departmentToCampus` map threaded through the UI.
