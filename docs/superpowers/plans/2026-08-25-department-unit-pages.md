# Department Unit Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a department board member build and publish their own public page in the admin CMS, served to students at a campus-aware `/units/<slug>` and a canonical `/units/<campus>/<slug>`.

**Architecture:** Departments gain a campus-agnostic `slug` column, unique on `(slug, campus_id)`, backfilled by the existing 24SO sync. A department's page is bound by slug convention — `pages.slug === "units/<campus>/<dept-slug>"` — so the web routes reuse the existing `cachedPublishedPage` reader unchanged. A published page overrides the current tabbed department view; departments without one keep exactly what they have today.

**Tech Stack:** Next.js 16 (App Router, RSC, `"use cache"`), React 19, Appwrite via `@repo/api`, `@repo/editor` block editor, Bun 1.3.1, Biome/Ultracite, `bun:test` (apps) and `vitest` (packages).

**Spec:** `docs/superpowers/specs/2026-08-25-department-unit-pages-design.md`

## Global Constraints

- **Package manager is Bun.** Never `npm`/`pnpm`. Filter with `--filter=<app>`.
- **Never import `appwrite` / `node-appwrite` directly.** Go through `@repo/api`.
- **`"use server"` files may export ONLY `async function`s.** A `const`, non-async function, or class export fails the build. `check-types` does NOT catch this — only `bun run build --filter=admin` does. Pure/sync helpers go in plain modules.
- **Test frameworks differ by workspace.** `packages/*` → `vitest` (`import { describe, expect, it } from "vitest"`). `apps/*` → `bun:test` (`import { describe, expect, test } from "bun:test"`).
- **Campus ids:** Oslo=`"1"`, Bergen=`"2"`, Trondheim=`"3"`, Stavanger=`"4"`, National=`"5"`.
- **Campus prefixes:** `OSL`, `BRG`, `TRD`, `STV` (exact, from `CAMPUS_PREFIXES`).
- **Diacritic folding is `ø→o`, `æ→ae`, `å→a`** — the existing `normalizeForCompare` convention. Do not introduce a second normalizer.
- **Page slug prefix is `units/`.** The web routes only ever look up the unsuffixed slug.
- **Run `bun x ultracite fix` before every commit.** `lefthook` + `lint-staged` enforce it.
- **`apps/web/next.config.ts` sets `ignoreBuildErrors: true`** — `bun run check-types` is the only type signal for web.

---

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `packages/shared/utils/unit-urls.ts` | Campus id ↔ URL segment table; `unitPageSlug`; `unitCanonicalPath`; `isUnitPageSlug`. The single definition of the page↔department binding, used by both apps. |
| `packages/shared/utils/unit-urls.test.ts` | vitest coverage for the above. |
| `apps/admin/src/lib/departments.ts` | Admin-only pure logic: `unitSlug`, `uniqueUnitSlug`, `assignUnitSlugs`, `resolveDepartmentsLanding`, `canManageDepartment`. Plain module — imported by `"use server"` files. |
| `apps/admin/src/lib/departments.test.ts` | bun:test coverage for the above, plus the campus-table drift guard. |
| `apps/admin/src/app/(portal)/departments/[id]/page.tsx` | Department detail route. |
| `apps/admin/src/app/(portal)/departments/[id]/_components/unit-page-card.tsx` | Page status + create/edit/view-live card. |
| `apps/web/src/app/(public)/units/[...segments]/page.tsx` | Both public shapes, dispatching on segment count. |
| `apps/web/src/app/(public)/units/[...segments]/_components/campus-chooser.tsx` | Ambiguous / no-match campus picker. |
| `apps/web/src/app/(public)/units/[...segments]/resolve.ts` | Request-memoized resolution shared by the page and `generateMetadata`. |

**Modified:**

| File | Change |
|---|---|
| `packages/api/appwrite.config.json` | `slug` column, then `department_slug_campus_unique` index. |
| `apps/admin/src/app/api/units/sync/route.ts` | Assign slugs via `assignUnitSlugs`. |
| `apps/admin/src/lib/roles.ts` | `portal.departments` gains `DEPARTMENT_ROLE`. |
| `apps/admin/src/app/(portal)/departments/page.tsx` | Landing rule + scoped listing + card links. |
| `apps/admin/src/app/(portal)/_actions/departments.ts` | `ids` option; `getDepartmentWithPage`; `createUnitPage`. |
| `apps/admin/src/app/(portal)/_actions/pages.ts` | Server-side binding guard in `savePageEditorDoc`. |
| `packages/editor/src/editor/callbacks.tsx` | `lockedMeta` on the callbacks context. |
| `packages/editor/src/components/editor-shell/index.tsx` | `lockedMeta` prop, threaded into the provider. |
| `packages/editor/src/components/editor-shell/inspector/index.tsx` | Read-only slug/department when locked. |
| `apps/admin/src/app/(editor)/pages/[id]/_components/page-editor-client.tsx` | Accept and forward `lockedMeta`. |
| `apps/admin/src/app/(editor)/pages/[id]/page.tsx` | Set `lockedMeta` for unit pages. |
| `apps/web/src/lib/data/public-content.ts` | `cachedDepartmentsBySlug`, `cachedDepartmentBySlugAndCampus`, sitemap units. |
| `apps/web/src/lib/actions/departments.ts` | Select `department_ref.slug`. |
| `apps/web/src/app/(public)/units/components/department-card.tsx` | Canonical href. |
| `apps/web/src/app/(public)/campus/components/overview/departments-grid.tsx` | Canonical href. |
| `apps/web/src/app/sitemap.ts` | Emit canonical unit URLs. |
| `packages/i18n/messages/{no,en}/adminPortal.json` | Detail-page copy. |

**Deleted:** `apps/web/src/app/(public)/units/[id]/` — its `components/` and `loading.tsx` move to `[...segments]/`.

---

## Task 1: Shared unit URL helpers

**Files:**
- Create: `packages/shared/utils/unit-urls.ts`
- Test: `packages/shared/utils/unit-urls.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `CAMPUS_SEGMENTS: Record<string, { segment: string; label: string }>`; `campusIdToSegment(campusId: string | null | undefined): string | null`; `campusSegmentToId(segment: string | null | undefined): string | null`; `campusIdToLabel(campusId: string | null | undefined): string | null`; `unitPageSlug(target: { campusId?: string | null; slug?: string | null }): string | null`; `unitCanonicalPath(target): string | null`; `isUnitPageSlug(slug: string | null | undefined): boolean`; `UNIT_PAGE_SLUG_PREFIX: "units/"`.

- [ ] **Step 1: Write the failing test**

Create `packages/shared/utils/unit-urls.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  campusIdToLabel,
  campusIdToSegment,
  campusSegmentToId,
  isUnitPageSlug,
  unitCanonicalPath,
  unitPageSlug,
} from "./unit-urls";

describe("campus segment mapping", () => {
  it("maps every campus id to its url segment", () => {
    expect(campusIdToSegment("1")).toBe("oslo");
    expect(campusIdToSegment("2")).toBe("bergen");
    expect(campusIdToSegment("3")).toBe("trondheim");
    expect(campusIdToSegment("4")).toBe("stavanger");
    expect(campusIdToSegment("5")).toBe("national");
  });

  it("round-trips every segment back to its id", () => {
    for (const id of ["1", "2", "3", "4", "5"]) {
      const segment = campusIdToSegment(id);
      expect(segment).not.toBeNull();
      expect(campusSegmentToId(segment as string)).toBe(id);
    }
  });

  it("is case-insensitive on the way in and rejects unknowns", () => {
    expect(campusSegmentToId("OSLO")).toBe("1");
    expect(campusSegmentToId("paris")).toBeNull();
    expect(campusSegmentToId(null)).toBeNull();
    expect(campusIdToSegment("99")).toBeNull();
    expect(campusIdToSegment(null)).toBeNull();
  });

  it("exposes a display label for the chooser", () => {
    expect(campusIdToLabel("1")).toBe("Oslo");
    expect(campusIdToLabel("5")).toBe("National");
    expect(campusIdToLabel("99")).toBeNull();
    expect(campusIdToLabel(null)).toBeNull();
  });
});

describe("unitPageSlug", () => {
  it("builds the storage slug from campus and department slug", () => {
    expect(unitPageSlug({ campusId: "1", slug: "fadderullan" })).toBe(
      "units/oslo/fadderullan"
    );
    expect(unitPageSlug({ campusId: "5", slug: "sentralt-utvalg" })).toBe(
      "units/national/sentralt-utvalg"
    );
  });

  it("returns null when either half is missing or unknown", () => {
    expect(unitPageSlug({ campusId: "1", slug: null })).toBeNull();
    expect(unitPageSlug({ campusId: null, slug: "fadderullan" })).toBeNull();
    expect(unitPageSlug({ campusId: "99", slug: "fadderullan" })).toBeNull();
  });
});

describe("unitCanonicalPath", () => {
  it("is the storage slug as an absolute path", () => {
    expect(unitCanonicalPath({ campusId: "2", slug: "fadderullan" })).toBe(
      "/units/bergen/fadderullan"
    );
    expect(unitCanonicalPath({ campusId: "2", slug: "" })).toBeNull();
  });
});

describe("isUnitPageSlug", () => {
  it("recognises bound unit pages only", () => {
    expect(isUnitPageSlug("units/oslo/fadderullan")).toBe(true);
    expect(isUnitPageSlug("about/history")).toBe(false);
    expect(isUnitPageSlug(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test --filter=@repo/shared`
Expected: FAIL — `Failed to resolve import "./unit-urls"`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/shared/utils/unit-urls.ts`:

```ts
/**
 * URL construction for department ("unit") pages.
 *
 * A department's public page is bound to the department by slug convention:
 * `pages.slug === "units/<campus-segment>/<department-slug>"`. This module is
 * the single definition of that convention — every producer (the admin action
 * that creates the page, the "View live" link) and every consumer (both public
 * routes) goes through it, so the write side and the read side cannot drift.
 *
 * NOTE: `apps/admin/src/lib/campus-constants.ts` holds a parallel campus map
 * keyed by Azure team name. That one exists to translate SG-App-Campus-* group
 * names; this one exists to build URLs. `apps/admin/src/lib/departments.test.ts`
 * asserts the two agree on ids and labels.
 */

export const CAMPUS_SEGMENTS: Record<
  string,
  { segment: string; label: string }
> = {
  "1": { segment: "oslo", label: "Oslo" },
  "2": { segment: "bergen", label: "Bergen" },
  "3": { segment: "trondheim", label: "Trondheim" },
  "4": { segment: "stavanger", label: "Stavanger" },
  "5": { segment: "national", label: "National" },
};

const SEGMENT_TO_CAMPUS_ID: Record<string, string> = Object.fromEntries(
  Object.entries(CAMPUS_SEGMENTS).map(([id, entry]) => [entry.segment, id])
);

export const UNIT_PAGE_SLUG_PREFIX = "units/";

export interface UnitTarget {
  campusId?: string | null;
  slug?: string | null;
}

export function campusIdToSegment(
  campusId: string | null | undefined
): string | null {
  if (!campusId) {
    return null;
  }
  return CAMPUS_SEGMENTS[campusId]?.segment ?? null;
}

export function campusSegmentToId(
  segment: string | null | undefined
): string | null {
  if (!segment) {
    return null;
  }
  return SEGMENT_TO_CAMPUS_ID[segment.toLowerCase()] ?? null;
}

export function campusIdToLabel(
  campusId: string | null | undefined
): string | null {
  if (!campusId) {
    return null;
  }
  return CAMPUS_SEGMENTS[campusId]?.label ?? null;
}

/** Storage slug of the `pages` row bound to a department. */
export function unitPageSlug(target: UnitTarget): string | null {
  const segment = campusIdToSegment(target.campusId);
  if (!(segment && target.slug)) {
    return null;
  }
  return `${UNIT_PAGE_SLUG_PREFIX}${segment}/${target.slug}`;
}

/** Public canonical path for a department. */
export function unitCanonicalPath(target: UnitTarget): string | null {
  const slug = unitPageSlug(target);
  return slug ? `/${slug}` : null;
}

export function isUnitPageSlug(slug: string | null | undefined): boolean {
  return typeof slug === "string" && slug.startsWith(UNIT_PAGE_SLUG_PREFIX);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test --filter=@repo/shared`
Expected: PASS — all 8 assertions green.

- [ ] **Step 5: Commit**

```bash
bun x ultracite fix
git add packages/shared/utils/unit-urls.ts packages/shared/utils/unit-urls.test.ts
git commit -m "feat(shared): unit page URL construction helpers"
```

---

## Task 2: Admin slug generator

**Files:**
- Create: `apps/admin/src/lib/departments.ts`
- Create: `apps/admin/src/lib/departments.test.ts`

**Interfaces:**
- Consumes: `normalizeForCompare`, `stripClosedSuffix` from `./it/department-matching`; `CAMPUS_SEGMENTS` from `@repo/shared/utils/unit-urls`; `CAMPUS_NAME_TO_ID`, `CAMPUS_ID_TO_NAME` from `./campus-constants`.
- Produces: `unitSlug(name: string): string`; `uniqueUnitSlug(base: string, taken: Set<string>): string`.

- [ ] **Step 1: Write the failing test**

Create `apps/admin/src/lib/departments.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { CAMPUS_SEGMENTS } from "@repo/shared/utils/unit-urls";
import { CAMPUS_ID_TO_NAME, CAMPUS_NAME_TO_ID } from "./campus-constants";
import { uniqueUnitSlug, unitSlug } from "./departments";

describe("unitSlug", () => {
  test("strips the campus prefix so all campuses share one slug", () => {
    expect(unitSlug("OSL Fadderullan")).toBe("fadderullan");
    expect(unitSlug("BRG Fadderullan")).toBe("fadderullan");
    expect(unitSlug("TRD Fadderullan")).toBe("fadderullan");
    expect(unitSlug("STV Fadderullan")).toBe("fadderullan");
  });

  test("folds Norwegian characters using the existing convention", () => {
    expect(unitSlug("BRG Næringsliv")).toBe("naeringsliv");
    expect(unitSlug("TRD Økonomi")).toBe("okonomi");
    expect(unitSlug("OSL Påvirkning")).toBe("pavirkning");
  });

  test("hyphenates multi-word names and collapses punctuation runs", () => {
    expect(unitSlug("TRD Sosialt Utvalg")).toBe("sosialt-utvalg");
    expect(unitSlug("OSL DIGI-KOMM - Digital")).toBe("digi-komm-digital");
  });

  test("drops the nedlagt suffix carried by closed units", () => {
    expect(unitSlug("OSL DataAnalytisk Utvalg - nedlagt")).toBe(
      "dataanalytisk-utvalg"
    );
  });

  test("leaves unprefixed national names alone", () => {
    expect(unitSlug("Sentralt utvalg")).toBe("sentralt-utvalg");
  });

  test("never returns an empty slug", () => {
    expect(unitSlug("!!!")).toBe("unit");
    expect(unitSlug("")).toBe("unit");
  });
});

describe("uniqueUnitSlug", () => {
  test("returns the base when free", () => {
    expect(uniqueUnitSlug("fadderullan", new Set())).toBe("fadderullan");
  });

  test("suffixes from 2 upward on collision", () => {
    expect(uniqueUnitSlug("fadderullan", new Set(["fadderullan"]))).toBe(
      "fadderullan-2"
    );
    expect(
      uniqueUnitSlug("fadderullan", new Set(["fadderullan", "fadderullan-2"]))
    ).toBe("fadderullan-3");
  });
});

describe("campus table drift guard", () => {
  test("unit-urls campus ids match campus-constants", () => {
    expect(Object.keys(CAMPUS_SEGMENTS).sort()).toEqual(
      Object.values(CAMPUS_NAME_TO_ID).sort()
    );
  });

  test("unit-urls campus labels match campus-constants names", () => {
    for (const [id, entry] of Object.entries(CAMPUS_SEGMENTS)) {
      expect(entry.label).toBe(CAMPUS_ID_TO_NAME[id] as string);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/admin && bun test ./src/lib/departments.test.ts`
Expected: FAIL — cannot resolve `./departments`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/admin/src/lib/departments.ts`:

```ts
/**
 * Department (unit) domain logic.
 *
 * Plain module, NOT "use server": these are synchronous helpers imported by
 * server-action files, which may only export async functions themselves.
 */

import { normalizeForCompare, stripClosedSuffix } from "./it/department-matching";

const WHITESPACE_TO_DASH = /\s+/g;
const NON_SLUG_CHARS = /[^a-z0-9-]/g;
const REPEATED_DASH = /-{2,}/g;
const EDGE_DASH = /^-+|-+$/g;
const MAX_SLUG_ATTEMPTS = 1000;

/**
 * Campus-agnostic URL slug for a department.
 *
 * "OSL Fadderullan" and "BRG Fadderullan" both yield "fadderullan" — the four
 * campus rows share one student-facing name, and `(slug, campus_id)` keeps them
 * distinct in the database.
 *
 * Built on `normalizeForCompare`, which already strips the OSL|BRG|TRD|STV
 * prefix and folds ø→o, æ→ae, å→a. Do not add a second normalizer.
 */
export function unitSlug(name: string): string {
  const slug = normalizeForCompare(stripClosedSuffix(name))
    .replace(WHITESPACE_TO_DASH, "-")
    .replace(NON_SLUG_CHARS, "")
    .replace(REPEATED_DASH, "-")
    .replace(EDGE_DASH, "");
  return slug || "unit";
}

/** Resolve a slug collision WITHIN one campus by suffixing -2, -3, … */
export function uniqueUnitSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) {
    return base;
  }
  for (let suffix = 2; suffix < MAX_SLUG_ATTEMPTS; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
  }
  throw new Error(`Could not find an available unit slug for "${base}"`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/admin && bun test ./src/lib/departments.test.ts`
Expected: PASS — 10 tests green, including both drift-guard tests.

- [ ] **Step 5: Commit**

```bash
bun x ultracite fix
git add apps/admin/src/lib/departments.ts apps/admin/src/lib/departments.test.ts
git commit -m "feat(admin): campus-agnostic department slug generator"
```

---

## Task 3: Schema — `slug` column

**Files:**
- Modify: `packages/api/appwrite.config.json` (table `departments`, `databaseId: "app"`)

The index is deliberately NOT added here — see Task 5. Pushing a unique index before the backfill risks failing on unslugged rows.

- [ ] **Step 1: Add the column**

In `packages/api/appwrite.config.json`, find the `departments` table whose `databaseId` is `"app"` (there are TWO `departments` tables; the other is `databaseId: "24so"` — do not touch it). Append to its `columns` array:

```json
{
  "key": "slug",
  "type": "string",
  "required": false,
  "array": false,
  "size": 128,
  "default": null,
  "encrypt": false
}
```

- [ ] **Step 2: Verify the file still parses and targets the right table**

Run:
```bash
bun -e "
const c=require('./packages/api/appwrite.config.json');
const d=c.tables.find(t=>t.\$id==='departments'&&t.databaseId==='app');
const s=d.columns.find(c=>c.key==='slug');
if(!s) throw new Error('slug column missing');
console.log('ok', JSON.stringify(s));
const other=c.tables.find(t=>t.\$id==='departments'&&t.databaseId==='24so');
if(other.columns.some(c=>c.key==='slug')) throw new Error('24so table was modified');
console.log('24so table untouched');
"
```
Expected: prints `ok {...}` then `24so table untouched`.

- [ ] **Step 3: Commit**

```bash
git add packages/api/appwrite.config.json
git commit -m "feat(api): add slug column to departments"
```

- [ ] **Step 4: Hand off to the repo owner**

Tell the owner: push this column to Appwrite and regenerate types with `appwrite types -l ts ./types` from `packages/api`. Do **not** create the index yet. Task 4 can be written against the regenerated `Departments` type; if types are not yet regenerated, `slug` will be missing from the type and Task 4's route change will not type-check.

---

## Task 4: Sync assigns slugs

**Files:**
- Modify: `apps/admin/src/lib/departments.ts`
- Modify: `apps/admin/src/lib/departments.test.ts`
- Modify: `apps/admin/src/app/api/units/sync/route.ts`

**Interfaces:**
- Consumes: `unitSlug`, `uniqueUnitSlug` (Task 2).
- Produces: `assignUnitSlugs(existing: ExistingDepartmentSlug[], incoming: IncomingDepartment[]): Map<string, string>`, where `ExistingDepartmentSlug = { $id: string; campus_id: string; slug?: string | null }` and `IncomingDepartment = { $id: string; campusId: string; name: string; active: boolean }`.

- [ ] **Step 1: Write the failing test**

Append to `apps/admin/src/lib/departments.test.ts`:

```ts
import { assignUnitSlugs } from "./departments";

describe("assignUnitSlugs", () => {
  test("assigns one slug per active department", () => {
    const assigned = assignUnitSlugs(
      [],
      [
        { $id: "308", campusId: "1", name: "OSL Fadderullan", active: true },
        { $id: "612", campusId: "3", name: "TRD Sosialt Utvalg", active: true },
      ]
    );
    expect(assigned.get("308")).toBe("fadderullan");
    expect(assigned.get("612")).toBe("sosialt-utvalg");
  });

  test("the same name in different campuses does NOT collide", () => {
    const assigned = assignUnitSlugs(
      [],
      [
        { $id: "308", campusId: "1", name: "OSL Fadderullan", active: true },
        { $id: "410", campusId: "2", name: "BRG Fadderullan", active: true },
        { $id: "705", campusId: "3", name: "TRD Fadderullan", active: true },
      ]
    );
    expect(assigned.get("308")).toBe("fadderullan");
    expect(assigned.get("410")).toBe("fadderullan");
    expect(assigned.get("705")).toBe("fadderullan");
  });

  test("the same name WITHIN one campus is suffixed", () => {
    const assigned = assignUnitSlugs(
      [],
      [
        { $id: "308", campusId: "1", name: "OSL Fadderullan", active: true },
        { $id: "309", campusId: "1", name: "OSL Fadderullan", active: true },
      ]
    );
    expect(assigned.get("308")).toBe("fadderullan");
    expect(assigned.get("309")).toBe("fadderullan-2");
  });

  test("never rewrites a slug that is already assigned", () => {
    const assigned = assignUnitSlugs(
      [{ $id: "308", campus_id: "1", slug: "fadderullan" }],
      [{ $id: "308", campusId: "1", name: "OSL Fadderullan 2026", active: true }]
    );
    expect(assigned.has("308")).toBe(false);
  });

  test("respects slugs already taken in the same campus", () => {
    const assigned = assignUnitSlugs(
      [{ $id: "308", campus_id: "1", slug: "fadderullan" }],
      [{ $id: "309", campusId: "1", name: "OSL Fadderullan", active: true }]
    );
    expect(assigned.get("309")).toBe("fadderullan-2");
  });

  test("skips inactive departments so a closed unit cannot hold the slug", () => {
    const assigned = assignUnitSlugs(
      [],
      [
        {
          $id: "300",
          campusId: "1",
          name: "OSL Fadderullan - nedlagt",
          active: false,
        },
        { $id: "308", campusId: "1", name: "OSL Fadderullan", active: true },
      ]
    );
    expect(assigned.has("300")).toBe(false);
    expect(assigned.get("308")).toBe("fadderullan");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/admin && bun test ./src/lib/departments.test.ts`
Expected: FAIL — `assignUnitSlugs` is not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `apps/admin/src/lib/departments.ts`:

```ts
export interface ExistingDepartmentSlug {
  $id: string;
  campus_id: string;
  slug?: string | null;
}

export interface IncomingDepartment {
  $id: string;
  active: boolean;
  campusId: string;
  name: string;
}

/**
 * Decide which departments receive a slug on this sync run.
 *
 * Returns row `$id` → newly assigned slug. Rows already carrying a slug are
 * absent (a slug, once set, is never rewritten — a 24SO rename must not change
 * a live URL). Inactive rows are absent too: a closed "OSL Foo - nedlagt" would
 * otherwise take `foo` at campus 1 and push its live replacement to `foo-2`.
 */
export function assignUnitSlugs(
  existing: ExistingDepartmentSlug[],
  incoming: IncomingDepartment[]
): Map<string, string> {
  const slugged = new Set<string>();
  const takenByCampus = new Map<string, Set<string>>();

  for (const row of existing) {
    if (!row.slug) {
      continue;
    }
    slugged.add(row.$id);
    const taken = takenByCampus.get(row.campus_id) ?? new Set<string>();
    taken.add(row.slug);
    takenByCampus.set(row.campus_id, taken);
  }

  const assigned = new Map<string, string>();
  for (const department of incoming) {
    if (slugged.has(department.$id) || !department.active) {
      continue;
    }
    const taken = takenByCampus.get(department.campusId) ?? new Set<string>();
    const slug = uniqueUnitSlug(unitSlug(department.name), taken);
    taken.add(slug);
    takenByCampus.set(department.campusId, taken);
    assigned.set(department.$id, slug);
  }

  return assigned;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/admin && bun test ./src/lib/departments.test.ts`
Expected: PASS — 16 tests green.

- [ ] **Step 5: Wire it into the sync route**

In `apps/admin/src/app/api/units/sync/route.ts`, add the imports:

```ts
import { Query } from "@repo/api";
import type { Departments } from "@repo/api/types/appwrite";
import { assignUnitSlugs } from "@/lib/departments";
```

Then inside `POST`, after the `activeIds` set is built and before `Promise.allSettled`, insert:

```ts
    // Slugs are assigned once and never rewritten, so a 24SO rename cannot
    // change a live /units URL. Read the current state first: which rows are
    // already slugged, and which slugs are taken per campus.
    const existing = await db.listRows<Departments>("app", "departments", [
      Query.select(["$id", "campus_id", "slug"]),
      Query.limit(5000),
    ]);
    const newSlugs = assignUnitSlugs(
      existing.rows.map((row) => ({
        $id: row.$id,
        campus_id: row.campus_id,
        slug: row.slug,
      })),
      soapDepartments.map((department) => ({
        $id: department.id,
        active: activeIds.has(department.id),
        campusId: getCampusId(Number(department.id)),
        name: department.name,
      }))
    );
```

Then change the upsert row construction inside `soapDepartments.map(...)` from:

```ts
        const row = {
          $id: department.id,
          Id: department.id,
          Name: department.name,
          active: activeIds.has(department.id),
          campus_id: getCampusId(deptNum),
          campus: getCampusId(deptNum),
        };
```

to:

```ts
        const assignedSlug = newSlugs.get(department.id);
        const row = {
          $id: department.id,
          Id: department.id,
          Name: department.name,
          active: activeIds.has(department.id),
          campus_id: getCampusId(deptNum),
          campus: getCampusId(deptNum),
          // Only present for rows without one: upsertRow patches named columns,
          // so omitting `slug` leaves an assigned slug untouched.
          ...(assignedSlug ? { slug: assignedSlug } : {}),
        };
```

Finally add `slugsAssigned: newSlugs.size` to the `NextResponse.json({...})` payload so a run reports how many it backfilled.

- [ ] **Step 6: Verify it compiles**

Run: `bun --filter=admin check-types`
Expected: no errors. If `slug` is reported as missing on `Departments`, the owner has not regenerated types yet (Task 3 Step 4) — stop and ask.

- [ ] **Step 7: Commit**

```bash
bun x ultracite fix
git add apps/admin/src/lib/departments.ts apps/admin/src/lib/departments.test.ts apps/admin/src/app/api/units/sync/route.ts
git commit -m "feat(admin): assign unit slugs during department sync"
```

---

## Task 5: Schema — unique index (owner checkpoint)

**Files:**
- Modify: `packages/api/appwrite.config.json`

This task has a **manual gate in the middle**. Do not add the index until the backfill has run.

- [ ] **Step 1: Ask the owner to run the backfill**

The owner must, in order: push the Task 3 column, deploy or run admin, and `POST /api/units/sync` (the "Sync units" button on `/departments`, which requires a global admin). The response's `slugsAssigned` should be non-zero on the first run and `0` on an immediate second run.

- [ ] **Step 2: Verify the backfill covered every active department**

Ask the owner to confirm from the Appwrite console that no **active** department row has an empty `slug`. Any that remain indicate a `getCampusId` or name edge case — fix before proceeding, because the unique index will reject duplicates among them.

- [ ] **Step 3: Add the index**

Append to the `indexes` array of the `departments` table (`databaseId: "app"`):

```json
{
  "key": "department_slug_campus_unique",
  "type": "unique",
  "status": "available",
  "columns": ["slug", "campus_id"],
  "orders": ["ASC", "ASC"]
}
```

Column order is `(slug, campus_id)`, **not** the reverse. Tuple uniqueness is order-independent, but only this order's leftmost prefix serves `Query.equal("slug", …)` across all campuses — the chooser's query in Task 12.

- [ ] **Step 4: Verify the file parses**

Run:
```bash
bun -e "
const c=require('./packages/api/appwrite.config.json');
const d=c.tables.find(t=>t.\$id==='departments'&&t.databaseId==='app');
const i=d.indexes.find(i=>i.key==='department_slug_campus_unique');
if(!i) throw new Error('index missing');
if(i.columns[0]!=='slug') throw new Error('column order wrong: slug must be first');
console.log('ok', JSON.stringify(i));
"
```
Expected: prints `ok {...}`.

- [ ] **Step 5: Commit and hand off**

```bash
git add packages/api/appwrite.config.json
git commit -m "feat(api): unique index on department (slug, campus_id)"
```

Tell the owner to push the index and regenerate types.

---

## Task 6: Admin authorization helpers

**Files:**
- Modify: `apps/admin/src/lib/departments.ts`
- Modify: `apps/admin/src/lib/departments.test.ts`

**Interfaces:**
- Consumes: `ROLES` from `./roles`.
- Produces: `resolveDepartmentsLanding(ctx: LandingCtx): DepartmentsLanding` where `LandingCtx = { roles: string[]; resolvedDepartmentIds: string[] }` and `DepartmentsLanding = { kind: "listing"; scopeIds?: string[] } | { kind: "redirect"; departmentId: string } | { kind: "forbidden" }`; `canManageDepartment(ctx: ManageCtx, department: { $id: string; campus_id: string }): boolean` where `ManageCtx = { roles: string[]; managedCampusIds: string[]; resolvedDepartmentIds: string[] }`.

- [ ] **Step 1: Write the failing test**

Append to `apps/admin/src/lib/departments.test.ts`:

```ts
import { canManageDepartment, resolveDepartmentsLanding } from "./departments";

describe("resolveDepartmentsLanding", () => {
  test("admins get the full listing", () => {
    expect(
      resolveDepartmentsLanding({
        roles: ["globaladmin"],
        resolvedDepartmentIds: [],
      })
    ).toEqual({ kind: "listing" });
    expect(
      resolveDepartmentsLanding({
        roles: ["campusadmin"],
        resolvedDepartmentIds: ["308"],
      })
    ).toEqual({ kind: "listing" });
  });

  test("a single-department user is redirected to it", () => {
    expect(
      resolveDepartmentsLanding({ roles: [], resolvedDepartmentIds: ["308"] })
    ).toEqual({ kind: "redirect", departmentId: "308" });
  });

  test("a multi-department user gets a listing scoped to their own", () => {
    expect(
      resolveDepartmentsLanding({
        roles: [],
        resolvedDepartmentIds: ["308", "417"],
      })
    ).toEqual({ kind: "listing", scopeIds: ["308", "417"] });
  });

  test("team membership with zero resolved ids is forbidden, not a listing", () => {
    expect(
      resolveDepartmentsLanding({ roles: [], resolvedDepartmentIds: [] })
    ).toEqual({ kind: "forbidden" });
  });
});

describe("canManageDepartment", () => {
  const oslo = { $id: "308", campus_id: "1" };

  test("a global admin manages any department", () => {
    expect(
      canManageDepartment(
        { roles: ["globaladmin"], managedCampusIds: [], resolvedDepartmentIds: [] },
        oslo
      )
    ).toBe(true);
  });

  test("a campus admin manages departments in their campus only", () => {
    const ctx = {
      roles: ["campusadmin"],
      managedCampusIds: ["1"],
      resolvedDepartmentIds: [],
    };
    expect(canManageDepartment(ctx, oslo)).toBe(true);
    expect(canManageDepartment(ctx, { $id: "410", campus_id: "2" })).toBe(false);
  });

  test("a department member manages their own department only", () => {
    const ctx = {
      roles: [],
      managedCampusIds: [],
      resolvedDepartmentIds: ["308"],
    };
    expect(canManageDepartment(ctx, oslo)).toBe(true);
    expect(canManageDepartment(ctx, { $id: "417", campus_id: "1" })).toBe(false);
  });

  test("grants are a union: a campus admin also on a cross-campus board keeps both", () => {
    const ctx = {
      roles: ["campusadmin"],
      managedCampusIds: ["1"],
      resolvedDepartmentIds: ["410"],
    };
    expect(canManageDepartment(ctx, oslo)).toBe(true);
    expect(canManageDepartment(ctx, { $id: "410", campus_id: "2" })).toBe(true);
    expect(canManageDepartment(ctx, { $id: "999", campus_id: "3" })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/admin && bun test ./src/lib/departments.test.ts`
Expected: FAIL — `resolveDepartmentsLanding` is not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `apps/admin/src/lib/departments.ts`:

```ts
import { ROLES } from "./roles";

export interface LandingCtx {
  resolvedDepartmentIds: string[];
  roles: string[];
}

export type DepartmentsLanding =
  | { kind: "listing"; scopeIds?: string[] }
  | { kind: "redirect"; departmentId: string }
  | { kind: "forbidden" };

/**
 * What /departments should do for this caller.
 *
 * The `forbidden` case is not hypothetical: `resolveDepartmentIds` returns []
 * on lookup failure, and an Azure group with no matching Appwrite row resolves
 * to nothing. Passing the nav gate while owning no department must not fall
 * through to the full listing.
 */
export function resolveDepartmentsLanding(ctx: LandingCtx): DepartmentsLanding {
  if (
    ctx.roles.includes(ROLES.GLOBAL_ADMIN) ||
    ctx.roles.includes(ROLES.CAMPUS_ADMIN)
  ) {
    return { kind: "listing" };
  }
  const ids = ctx.resolvedDepartmentIds;
  if (ids.length === 0) {
    return { kind: "forbidden" };
  }
  if (ids.length === 1) {
    return { kind: "redirect", departmentId: ids[0] as string };
  }
  return { kind: "listing", scopeIds: ids };
}

export interface ManageCtx {
  managedCampusIds: string[];
  resolvedDepartmentIds: string[];
  roles: string[];
}

/** Grants are a union — a campus admin may also sit on a board elsewhere. */
export function canManageDepartment(
  ctx: ManageCtx,
  department: { $id: string; campus_id: string }
): boolean {
  if (ctx.roles.includes(ROLES.GLOBAL_ADMIN)) {
    return true;
  }
  if (ctx.managedCampusIds.includes(department.campus_id)) {
    return true;
  }
  return ctx.resolvedDepartmentIds.includes(department.$id);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/admin && bun test ./src/lib/departments.test.ts`
Expected: PASS — 24 tests green.

- [ ] **Step 5: Commit**

```bash
bun x ultracite fix
git add apps/admin/src/lib/departments.ts apps/admin/src/lib/departments.test.ts
git commit -m "feat(admin): department landing and management authorization"
```

---

## Task 7: Open the nav and apply the landing rule

**Files:**
- Modify: `apps/admin/src/lib/roles.ts:68`
- Modify: `apps/admin/src/app/(portal)/_actions/departments.ts`
- Modify: `apps/admin/src/app/(portal)/departments/page.tsx`

**Interfaces:**
- Consumes: `resolveDepartmentsLanding` (Task 6).
- Produces: `listDepartments` accepts `ids?: string[]`.

- [ ] **Step 1: Open the nav gate**

In `apps/admin/src/lib/roles.ts`, change:

```ts
  "portal.departments": [ROLES.GLOBAL_ADMIN, ROLES.CAMPUS_ADMIN],
```

to:

```ts
  "portal.departments": [
    ROLES.GLOBAL_ADMIN,
    ROLES.CAMPUS_ADMIN,
    DEPARTMENT_ROLE,
  ],
```

`requireNavAccess` already passes `ctx.departmentTeamIds.length > 0` for the pseudo-role, and the nav leaf plus command-palette entry read from `NAV_ACCESS`, so nothing else needs touching.

- [ ] **Step 2: Add id scoping to `listDepartments`**

In `apps/admin/src/app/(portal)/_actions/departments.ts`, change the signature to:

```ts
export async function listDepartments(opts?: {
  campusId?: string;
  ids?: string[];
  includeInactive?: boolean;
  search?: string;
}) {
```

and immediately after the `queries` array is declared, insert:

```ts
  // Explicit id scoping for department users. The departments table is
  // read("any"), so this filter IS the authorization boundary — it cannot be
  // left to row security.
  if (opts?.ids) {
    if (opts.ids.length === 0) {
      return [];
    }
    queries.push(Query.equal("$id", opts.ids));
  }
```

- [ ] **Step 3: Apply the landing rule**

Rewrite the top of `apps/admin/src/app/(portal)/departments/page.tsx`'s component body. Replace:

```tsx
export default async function DepartmentsPage() {
  await requireNavAccess("portal.departments");
  const t = await getTranslations("adminPortal.departments");

  const [departments, campuses] = await Promise.all([
    listDepartments({ includeInactive: true }),
    listCampuses(),
  ]);
```

with:

```tsx
export default async function DepartmentsPage() {
  const ctx = await requireNavAccess("portal.departments");
  const landing = resolveDepartmentsLanding(ctx);

  if (landing.kind === "forbidden") {
    notFound();
  }
  if (landing.kind === "redirect") {
    redirect(`/departments/${landing.departmentId}`);
  }

  const t = await getTranslations("adminPortal.departments");

  const [departments, campuses] = await Promise.all([
    listDepartments({ includeInactive: true, ids: landing.scopeIds }),
    listCampuses(),
  ]);
```

Add the imports:

```tsx
import { notFound, redirect } from "next/navigation";
import { resolveDepartmentsLanding } from "@/lib/departments";
```

- [ ] **Step 4: Make each card link to its detail page**

In the same file, wrap the card. Change the opening of the mapped element from:

```tsx
            <div
              className="group overflow-hidden rounded-2xl border transition hover:bg-white/70"
              key={dept.$id}
```

to:

```tsx
            <Link
              className="group block overflow-hidden rounded-2xl border transition hover:bg-white/70"
              href={`/departments/${dept.$id}`}
              key={dept.$id}
```

and change its closing `</div>` (the one matching this element, immediately before the closing of the `.map` callback) to `</Link>`. Add `import Link from "next/link";`.

- [ ] **Step 5: Verify it compiles and the build accepts the server action**

Run: `bun --filter=admin check-types && bun run build --filter=admin`
Expected: both succeed. The build is required because `_actions/departments.ts` is a `"use server"` file.

- [ ] **Step 6: Commit**

```bash
bun x ultracite fix
git add apps/admin/src/lib/roles.ts "apps/admin/src/app/(portal)/_actions/departments.ts" "apps/admin/src/app/(portal)/departments/page.tsx"
git commit -m "feat(admin): open departments to department users with landing rule"
```

---

## Task 8: Department detail route and actions

**Files:**
- Modify: `apps/admin/src/app/(portal)/_actions/departments.ts`
- Create: `apps/admin/src/app/(portal)/departments/[id]/page.tsx`
- Create: `apps/admin/src/app/(portal)/departments/[id]/_components/unit-page-card.tsx`
- Modify: `packages/i18n/messages/no/adminPortal.json`, `packages/i18n/messages/en/adminPortal.json`

**Interfaces:**
- Consumes: `canManageDepartment` (Task 6); `unitPageSlug`, `unitCanonicalPath` (Task 1); `savePageDraft`, `resolvePageCampusId` from `@repo/api/page-builder`.
- Produces: `getDepartmentWithPage(id: string): Promise<{ department: Departments; page: Pages | null } | null>`; `createUnitPage(id: string): Promise<{ pageId: string } | { error: string }>`.

- [ ] **Step 1: Add the two actions**

Append to `apps/admin/src/app/(portal)/_actions/departments.ts`. Add these imports at the top:

```ts
import {
  type PageDoc,
  resolvePageCampusId,
  savePageDraft,
} from "@repo/api/page-builder";
import { createAdminClient } from "@repo/api/server";
import type { Pages } from "@repo/api/types/appwrite";
import { unitPageSlug } from "@repo/shared/utils/unit-urls";
import { revalidatePath } from "next/cache";
import { canManageDepartment } from "@/lib/departments";
import { logAuditEvent } from "./audit-log";
```

Then append:

```ts
const DEFAULT_ACCENT = "#3DA9E0";

export async function getDepartmentWithPage(
  id: string
): Promise<{ department: Departments; page: Pages | null } | null> {
  const ctx = await requireAuth();
  const { db } = await createSessionClient();

  const found = await db.listRows<Departments>("app", "departments", [
    Query.equal("$id", id),
    Query.limit(1),
  ]);
  const department = found.rows[0];
  if (!(department && canManageDepartment(ctx, department))) {
    return null;
  }

  const slug = unitPageSlug({
    campusId: department.campus_id,
    slug: department.slug,
  });
  if (!slug) {
    return { department, page: null };
  }

  // Admin client: the page row carries no permissions until published, so a
  // session-scoped read would not see a department's own draft.
  const { db: adminDb } = await createAdminClient();
  const pages = await adminDb.listRows<Pages>("app", "pages", [
    Query.equal("slug", slug),
    Query.select(["*", "translation_refs.*"]),
    Query.limit(1),
  ]);

  return { department, page: pages.rows[0] ?? null };
}

export async function createUnitPage(
  id: string
): Promise<{ pageId: string } | { error: string }> {
  const ctx = await requireAuth();
  try {
    const { db } = await createAdminClient();
    const found = await db.listRows<Departments>("app", "departments", [
      Query.equal("$id", id),
      Query.limit(1),
    ]);
    const department = found.rows[0];
    if (!(department && canManageDepartment(ctx, department))) {
      return { error: "You do not have access to this department" };
    }

    const slug = unitPageSlug({
      campusId: department.campus_id,
      slug: department.slug,
    });
    if (!slug) {
      return {
        error:
          "This department has no slug yet. Run the department sync, then try again.",
      };
    }

    // Idempotent by design. resolveUniquePageSlug silently appends -2 when a
    // NEW page's slug collides, and a unit page at ".../fadderullan-2" is
    // permanently unreachable — the web routes only look up the unsuffixed
    // slug. Reusing an existing row closes that hole.
    const existing = await db.listRows<Pages>("app", "pages", [
      Query.equal("slug", slug),
      Query.select(["$id"]),
      Query.limit(1),
    ]);
    const already = existing.rows[0];
    if (already) {
      return { pageId: already.$id };
    }

    const doc: PageDoc = {
      blocks: [],
      meta: {
        accentColor: DEFAULT_ACCENT,
        department: department.$id,
        description: "",
        slug,
        status: "draft",
        title: department.Name,
      },
    };

    const { pageId } = await savePageDraft({ id: null, doc, locale: "no", ctx });
    await logAuditEvent(ctx, "unit_page_created", {
      resourceId: pageId,
      resourceType: "page",
    });
    revalidatePath("/departments");
    revalidatePath(`/departments/${id}`);
    return { pageId };
  } catch (e) {
    console.error("[createUnitPage]", e);
    return { error: e instanceof Error ? e.message : "Could not create page" };
  }
}
```

`resolvePageCampusId` is imported because `savePageDraft` calls it internally through `ctx`; the page's `campus_id` follows the author while the **slug** follows the department, which is what makes a global admin's page for an Oslo department land at `units/oslo/…` regardless of their own active campus.

- [ ] **Step 2: Add the copy**

In `packages/i18n/messages/en/adminPortal.json`, replace the `departments.actions` object with:

```json
  "actions": {
    "editPage": "Edit Page",
    "admins": "Admins",
    "initialize": "Initialize Page",
    "viewLive": "View live",
    "createPage": "Create page",
    "noSlug": "This department has no slug yet. Run the department sync to assign one.",
    "pageHeading": "Public page",
    "noPage": "No page yet. Create one to give this department its own page on biso.no.",
    "draft": "Draft",
    "published": "Published"
  }
```

In `packages/i18n/messages/no/adminPortal.json`, the same keys:

```json
  "actions": {
    "editPage": "Rediger side",
    "admins": "Administratorer",
    "initialize": "Initialiser side",
    "viewLive": "Se publisert side",
    "createPage": "Opprett side",
    "noSlug": "Denne avdelingen har ingen slug ennå. Kjør avdelingssynkroniseringen for å tildele en.",
    "pageHeading": "Offentlig side",
    "noPage": "Ingen side ennå. Opprett én for å gi avdelingen sin egen side på biso.no.",
    "draft": "Utkast",
    "published": "Publisert"
  }
```

- [ ] **Step 3: Build the card component**

Create `apps/admin/src/app/(portal)/departments/[id]/_components/unit-page-card.tsx`:

```tsx
"use client";

import type { Pages } from "@repo/api/types/appwrite";
import { ExternalLink, Plus, SquarePen } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { createUnitPage } from "@/app/(portal)/_actions/departments";
import {
  SERIF_STACK,
  STUDIO,
  StudioButton,
  StudioPanel,
} from "@/app/(portal)/_components/studio";

interface Labels {
  createPage: string;
  draft: string;
  editPage: string;
  noPage: string;
  noSlug: string;
  pageHeading: string;
  published: string;
  viewLive: string;
}

export function UnitPageCard({
  canonicalUrl,
  departmentId,
  labels,
  page,
}: {
  canonicalUrl: string | null;
  departmentId: string;
  labels: Labels;
  page: Pages | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const isPublished = page?.status === "published";

  const handleCreate = () => {
    startTransition(async () => {
      const result = await createUnitPage(departmentId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      router.push(`/pages/${result.pageId}`);
    });
  };

  // StudioPanel is a bare surface — { children, className?, style? }, no title
  // prop and no padding of its own. The heading and padding belong here.
  return (
    <StudioPanel className="p-5">
      <h2
        className="mb-4 text-xl leading-6"
        style={{ color: STUDIO.ink, fontFamily: SERIF_STACK }}
      >
        {labels.pageHeading}
      </h2>
      {canonicalUrl === null ? (
        <p className="text-sm" style={{ color: STUDIO.ink3 }}>
          {labels.noSlug}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-sm">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{
                background: isPublished ? STUDIO.claret : STUDIO.ink4,
              }}
            />
            <span style={{ color: STUDIO.ink3 }}>
              {page ? (isPublished ? labels.published : labels.draft) : null}
            </span>
            {page ? (
              <code className="text-xs" style={{ color: STUDIO.ink4 }}>
                {canonicalUrl}
              </code>
            ) : (
              <span style={{ color: STUDIO.ink3 }}>{labels.noPage}</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {page ? (
              <StudioButton
                onClick={() => router.push(`/pages/${page.$id}`)}
                variant="primary"
              >
                <SquarePen size={15} />
                {labels.editPage}
              </StudioButton>
            ) : (
              <StudioButton
                disabled={pending}
                onClick={handleCreate}
                variant="primary"
              >
                <Plus size={15} />
                {labels.createPage}
              </StudioButton>
            )}

            {isPublished && (
              <a
                className="inline-flex items-center gap-1 text-sm underline"
                href={`${process.env.NEXT_PUBLIC_BASE_URL ?? "https://biso.no"}${canonicalUrl}`}
                rel="noopener"
                style={{ color: STUDIO.ink3 }}
                target="_blank"
              >
                <ExternalLink size={14} />
                {labels.viewLive}
              </a>
            )}
          </div>
        </div>
      )}
    </StudioPanel>
  );
}
```

Signatures verified against `apps/admin/src/app/(portal)/_components/studio.tsx`: `StudioPanel({ children, className?, style? })` — a bare rounded surface with no title and no padding — and `StudioButton(ButtonHTMLAttributes & { children, variant? })`, so `onClick` and `disabled` pass through the spread.

- [ ] **Step 4: Build the detail route**

Create `apps/admin/src/app/(portal)/departments/[id]/page.tsx`:

```tsx
import { unitCanonicalPath } from "@repo/shared/utils/unit-urls";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
import { getDepartmentWithPage } from "../../_actions/departments";
import { listCampuses } from "../../_actions/lookups";
import { PageHeader } from "../../_components/page-header";
import { UnitPageCard } from "./_components/unit-page-card";

export default async function DepartmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireNavAccess("portal.departments");
  const { id } = await params;

  const [result, campuses, t] = await Promise.all([
    getDepartmentWithPage(id),
    listCampuses(),
    getTranslations("adminPortal.departments"),
  ]);

  // Null covers both "no such department" and "not yours" — the action does the
  // canManageDepartment check, and notFound() is what requireNavAccess uses for
  // an authenticated user without access.
  if (!result) {
    notFound();
  }

  const { department, page } = result;
  const campusName =
    campuses.find((c) => c.$id === department.campus_id)?.name ??
    department.campus_id;

  return (
    <div className="pb-12">
      <PageHeader
        description={[campusName, department.type].filter(Boolean).join(" · ")}
        title={department.Name}
      />

      <UnitPageCard
        canonicalUrl={unitCanonicalPath({
          campusId: department.campus_id,
          slug: department.slug,
        })}
        departmentId={department.$id}
        labels={{
          createPage: t("actions.createPage"),
          draft: t("actions.draft"),
          editPage: t("actions.editPage"),
          noPage: t("actions.noPage"),
          noSlug: t("actions.noSlug"),
          pageHeading: t("actions.pageHeading"),
          published: t("actions.published"),
          viewLive: t("actions.viewLive"),
        }}
        page={page}
      />
    </div>
  );
}
```

- [ ] **Step 5: Verify**

Run: `bun --filter=admin check-types && bun run build --filter=admin`
Expected: both succeed.

- [ ] **Step 6: Manual smoke test**

Run `bun run dev --filter=admin`, sign in as a global admin, open `/departments`, click a department. Confirm: the detail page renders, "Create page" navigates into the editor at `/pages/<id>`, and clicking "Create page" a second time on a department that already has one returns the SAME page id rather than creating a duplicate.

- [ ] **Step 7: Commit**

```bash
bun x ultracite fix
git add "apps/admin/src/app/(portal)/_actions/departments.ts" "apps/admin/src/app/(portal)/departments/[id]" packages/i18n/messages/no/adminPortal.json packages/i18n/messages/en/adminPortal.json
git commit -m "feat(admin): department detail page with unit page management"
```

---

## Task 9: Lock slug and department in the editor

**Files:**
- Modify: `packages/editor/src/editor/callbacks.tsx`
- Modify: `packages/editor/src/components/editor-shell/index.tsx`
- Modify: `packages/editor/src/components/editor-shell/inspector/index.tsx:130-165`
- Modify: `apps/admin/src/app/(editor)/pages/[id]/_components/page-editor-client.tsx`
- Modify: `apps/admin/src/app/(editor)/pages/[id]/page.tsx`

**Interfaces:**
- Consumes: `isUnitPageSlug` (Task 1).
- Produces: `EditorCallbacks.lockedMeta?: { department?: boolean; slug?: boolean }`; `EditorShell` prop `lockedMeta`; `PageEditorClient` prop `lockedMeta`.

- [ ] **Step 1: Add `lockedMeta` to the callbacks context**

In `packages/editor/src/editor/callbacks.tsx`, add to the `EditorCallbacks` interface (keeping alphabetical order):

```ts
  /**
   * Meta fields the host has bound to something outside the editor and that
   * must not be edited here. Unit pages set slug + department: both encode the
   * page's binding to a department, and changing either orphans the page.
   */
  lockedMeta?: { department?: boolean; slug?: boolean };
```

No change to `NOOP_CALLBACKS` — the field is optional, and the web renderer never edits.

- [ ] **Step 2: Thread it through the shell**

In `packages/editor/src/components/editor-shell/index.tsx`: add `lockedMeta?: { department?: boolean; slug?: boolean };` to `interface Props`, add `lockedMeta` to the destructured parameter list, and add `lockedMeta,` to the object passed to `EditorCallbacksContext.Provider`.

- [ ] **Step 3: Render the locked fields read-only**

In `packages/editor/src/components/editor-shell/inspector/index.tsx`, change the destructure on line 111:

```tsx
  const { departments, lockedMeta } = useEditorCallbacks();
```

Replace the slug row with:

```tsx
      <div className="pe-row">
        <label htmlFor="pe-page-slug">Shared slug</label>
        <input
          disabled={lockedMeta?.slug}
          id="pe-page-slug"
          onChange={(e) => setMeta("slug", e.target.value)}
          readOnly={lockedMeta?.slug}
          value={doc.meta.slug}
        />
      </div>
```

Replace the department `<select>`/`<input>` pair with a locked branch first:

```tsx
      <div className="pe-row">
        <label htmlFor="pe-page-department">Dept</label>
        {lockedMeta?.department ? (
          <input
            disabled
            id="pe-page-department"
            readOnly
            value={
              departments.find((d) => d.id === doc.meta.department)?.name ??
              doc.meta.department
            }
          />
        ) : departments.length > 0 ? (
          <select
            id="pe-page-department"
            onChange={(e) => setMeta("department", e.target.value)}
            value={doc.meta.department}
          >
            <option value="">— none —</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} · {d.id.slice(0, 8)}
              </option>
            ))}
          </select>
        ) : (
          <input
            id="pe-page-department"
            onChange={(e) => setMeta("department", e.target.value)}
            placeholder="loading…"
            value={doc.meta.department}
          />
        )}
      </div>
```

Then, directly after that row, add the hint:

```tsx
      {(lockedMeta?.slug || lockedMeta?.department) && (
        <p
          style={{
            fontSize: 10,
            color: "var(--ink-3)",
            margin: "2px 0 0",
          }}
        >
          Managed by the department — this page is published at its unit URL.
        </p>
      )}
```

- [ ] **Step 4: Forward the prop from admin**

In `page-editor-client.tsx`: add `lockedMeta?: { department?: boolean; slug?: boolean };` to `PageEditorClientProps`, add `lockedMeta` to the destructured props, and add `lockedMeta={lockedMeta}` to the `<EditorShell …>` JSX (alphabetically, between `locales` and `onDocChange`).

In `apps/admin/src/app/(editor)/pages/[id]/page.tsx`, add the import and compute the flag:

```tsx
import { isUnitPageSlug } from "@repo/shared/utils/unit-urls";
```

then, after the `notFound()` guard:

```tsx
  // A unit page's slug IS its binding to a department (see the unit pages
  // spec). Editing either field here would orphan the page, so both are shown
  // read-only; savePageEditorDoc enforces it server-side.
  const locked = isUnitPageSlug(pageResult?.page.slug)
    ? { department: true, slug: true }
    : undefined;
```

and pass `lockedMeta={locked}` to `<PageEditorClient …>`.

- [ ] **Step 5: Verify**

Run: `bun --filter=admin check-types && bun --filter=@repo/editor check-types`
Expected: both clean.

- [ ] **Step 6: Manual smoke test**

In `bun run dev --filter=admin`: open a unit page's editor and confirm Shared slug and Dept are read-only with the hint; open any ordinary page and confirm both are still editable and the hint is absent.

- [ ] **Step 7: Commit**

```bash
bun x ultracite fix
git add packages/editor/src "apps/admin/src/app/(editor)/pages/[id]"
git commit -m "feat(editor): lock slug and department on unit pages"
```

---

## Task 10: Server-side binding guard

**Files:**
- Modify: `apps/admin/src/app/(portal)/_actions/pages.ts:221-266` (`savePageEditorDoc`)
- Create: `apps/admin/src/lib/unit-page-guard.ts`
- Create: `apps/admin/src/lib/unit-page-guard.test.ts`

The comparison is extracted into a plain module so it is unit-testable without Appwrite, and because `_actions/pages.ts` is `"use server"` and cannot export it.

**Interfaces:**
- Consumes: `isUnitPageSlug` (Task 1).
- Produces: `assertUnitPageBindingUnchanged(persisted: { slug?: string | null; department_id?: string | null }, next: { slug: string; department: string }): string | null` — returns an error message, or `null` when the save is allowed.

- [ ] **Step 1: Write the failing test**

Create `apps/admin/src/lib/unit-page-guard.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { assertUnitPageBindingUnchanged } from "./unit-page-guard";

const persisted = {
  department_id: "308",
  slug: "units/oslo/fadderullan",
};

describe("assertUnitPageBindingUnchanged", () => {
  test("allows a save that leaves the binding alone", () => {
    expect(
      assertUnitPageBindingUnchanged(persisted, {
        department: "308",
        slug: "units/oslo/fadderullan",
      })
    ).toBeNull();
  });

  test("rejects a slug change on a unit page", () => {
    expect(
      assertUnitPageBindingUnchanged(persisted, {
        department: "308",
        slug: "units/oslo/noe-annet",
      })
    ).toBe("A unit page's slug is managed by its department and cannot change");
  });

  test("rejects a department change on a unit page", () => {
    expect(
      assertUnitPageBindingUnchanged(persisted, {
        department: "410",
        slug: "units/oslo/fadderullan",
      })
    ).toBe(
      "A unit page's department is managed by its department and cannot change"
    );
  });

  test("leaves ordinary pages completely unconstrained", () => {
    expect(
      assertUnitPageBindingUnchanged(
        { department_id: "308", slug: "about/history" },
        { department: "410", slug: "about/something-else" }
      )
    ).toBeNull();
  });

  test("treats a page with no persisted slug as ordinary", () => {
    expect(
      assertUnitPageBindingUnchanged(
        { department_id: null, slug: null },
        { department: "308", slug: "units/oslo/fadderullan" }
      )
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/admin && bun test ./src/lib/unit-page-guard.test.ts`
Expected: FAIL — cannot resolve `./unit-page-guard`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/admin/src/lib/unit-page-guard.ts`:

```ts
import { isUnitPageSlug } from "@repo/shared/utils/unit-urls";

/**
 * A unit page's slug IS its binding to a department: the public routes resolve
 * a department, build `units/<campus>/<slug>`, and look that page up. Changing
 * either field would orphan the page — reachable from nowhere, and invisible
 * in the department's admin view.
 *
 * The editor renders both fields read-only, but THIS is the enforcement; the
 * UI lock is convenience. Returns an error message, or null when allowed.
 */
export function assertUnitPageBindingUnchanged(
  persisted: { department_id?: string | null; slug?: string | null },
  next: { department: string; slug: string }
): string | null {
  if (!isUnitPageSlug(persisted.slug)) {
    return null;
  }
  if (next.slug !== persisted.slug) {
    return "A unit page's slug is managed by its department and cannot change";
  }
  if ((persisted.department_id ?? "") !== next.department) {
    return "A unit page's department is managed by its department and cannot change";
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/admin && bun test ./src/lib/unit-page-guard.test.ts`
Expected: PASS — 5 tests green.

- [ ] **Step 5: Wire it into `savePageEditorDoc`**

In `apps/admin/src/app/(portal)/_actions/pages.ts`, add the import:

```ts
import { assertUnitPageBindingUnchanged } from "@/lib/unit-page-guard";
```

Inside `savePageEditorDoc`, in the `if (id) { … }` block, insert immediately after `const existing = await db.getRow<Pages>("app", "pages", id);`:

```ts
      const bindingError = assertUnitPageBindingUnchanged(existing, {
        department: scopedDoc.meta.department || "",
        slug: scopedDoc.meta.slug,
      });
      if (bindingError) {
        return { error: bindingError };
      }
```

- [ ] **Step 6: Verify**

Run: `cd apps/admin && bun test ./src/lib && cd ../.. && bun run build --filter=admin`
Expected: tests pass; build succeeds.

- [ ] **Step 7: Commit**

```bash
bun x ultracite fix
git add apps/admin/src/lib/unit-page-guard.ts apps/admin/src/lib/unit-page-guard.test.ts "apps/admin/src/app/(portal)/_actions/pages.ts"
git commit -m "feat(admin): enforce unit page slug and department immutability"
```

---

## Task 11: Web cached readers

**Files:**
- Modify: `apps/web/src/lib/data/public-content.ts`
- Modify: `apps/web/src/lib/actions/departments.ts`

**Interfaces:**
- Produces: `cachedDepartmentsBySlug(slug: string): Promise<Departments[]>`; `cachedDepartmentBySlugAndCampus(slug: string, campusId: string): Promise<Departments | null>`; `cachedDepartmentById(id: string): Promise<Departments | null>`.

- [ ] **Step 1: Add the readers**

In `apps/web/src/lib/data/public-content.ts`, add `Departments` to the existing type import from `@repo/api/types/appwrite`, then append near `cachedPublishedPage`:

```ts
const DEPARTMENT_SELECT = [
  "$id",
  "Name",
  "campus_id",
  "slug",
  "active",
  "type",
] as const;

/**
 * Every active department sharing one slug — one row per campus.
 *
 * Served by the leftmost prefix of the (slug, campus_id) unique index, which is
 * why that index is ordered slug-first. Drives the campus chooser and the
 * one-segment /units/<slug> route.
 */
export async function cachedDepartmentsBySlug(
  slug: string
): Promise<Departments[]> {
  "use cache";
  cacheLife("minutes");
  const { db } = await createPublicClient();
  const res = await db.listRows<Departments>("app", "departments", [
    Query.equal("slug", slug),
    Query.equal("active", true),
    Query.select([...DEPARTMENT_SELECT]),
    Query.limit(10),
  ]);
  return res.rows;
}

/** The single active department at one campus. Full (slug, campus_id) hit. */
export async function cachedDepartmentBySlugAndCampus(
  slug: string,
  campusId: string
): Promise<Departments | null> {
  "use cache";
  cacheLife("minutes");
  const { db } = await createPublicClient();
  const res = await db.listRows<Departments>("app", "departments", [
    Query.equal("slug", slug),
    Query.equal("campus_id", campusId),
    Query.equal("active", true),
    Query.select([...DEPARTMENT_SELECT]),
    Query.limit(1),
  ]);
  return res.rows[0] ?? null;
}

/** Legacy 24SO-id lookup, used only to redirect old /units/<number> links. */
export async function cachedDepartmentById(
  id: string
): Promise<Departments | null> {
  "use cache";
  cacheLife("minutes");
  const { db } = await createPublicClient();
  const res = await db.listRows<Departments>("app", "departments", [
    Query.equal("$id", id),
    Query.select([...DEPARTMENT_SELECT]),
    Query.limit(1),
  ]);
  return res.rows[0] ?? null;
}
```

- [ ] **Step 2: Expose the slug on department cards**

In `apps/web/src/lib/actions/departments.ts`, inside `getDepartments`'s `Query.select([...])`, add `"department_ref.slug"` immediately after `"department_ref.Name"`.

- [ ] **Step 3: Verify**

Run: `bun --filter=web check-types`
Expected: clean. If `slug` is missing on `Departments`, the owner has not regenerated types (Task 3 Step 4).

- [ ] **Step 4: Commit**

```bash
bun x ultracite fix
git add apps/web/src/lib/data/public-content.ts apps/web/src/lib/actions/departments.ts
git commit -m "feat(web): cached department-by-slug readers"
```

---

## Task 12: Public unit routes

**Files:**
- Create: `apps/web/src/app/(public)/units/[...segments]/resolve.ts`
- Create: `apps/web/src/app/(public)/units/[...segments]/page.tsx`
- Create: `apps/web/src/app/(public)/units/[...segments]/_components/campus-chooser.tsx`
- Move: `apps/web/src/app/(public)/units/[id]/components/` → `apps/web/src/app/(public)/units/[...segments]/components/`
- Move: `apps/web/src/app/(public)/units/[id]/loading.tsx` → `apps/web/src/app/(public)/units/[...segments]/loading.tsx`
- Delete: `apps/web/src/app/(public)/units/[id]/`

A catch-all rather than `units/[slug]` plus `units/[campus]/[slug]` because **Next.js rejects two different dynamic segment names at the same path level**.

**Interfaces:**
- Consumes: Task 11's readers; `campusSegmentToId`, `campusIdToLabel`, `unitPageSlug`, `unitCanonicalPath` (Task 1); `getPage` path via `cachedPublishedPage`.
- Produces: `resolveUnit(segments: string[]): Promise<UnitResolution>`.

- [ ] **Step 1: Move the existing view**

```bash
cd apps/web/src/app/\(public\)/units
mkdir -p '[...segments]'
git mv '[id]/components' '[...segments]/components'
git mv '[id]/loading.tsx' '[...segments]/loading.tsx'
git rm '[id]/page.tsx'
rmdir '[id]' 2>/dev/null || true
```

- [ ] **Step 2: Write the resolver**

Create `apps/web/src/app/(public)/units/[...segments]/resolve.ts`:

```ts
import type { Departments } from "@repo/api/types/appwrite";
import {
  campusIdToLabel,
  campusSegmentToId,
  unitCanonicalPath,
} from "@repo/shared/utils/unit-urls";
import { cache } from "react";
import { getActiveCampus } from "@/app/actions/campus";
import {
  cachedDepartmentById,
  cachedDepartmentBySlugAndCampus,
  cachedDepartmentsBySlug,
} from "@/lib/data/public-content";

export type UnitResolution =
  | { kind: "department"; department: Departments; canonical: string }
  | {
      kind: "chooser";
      slug: string;
      matches: Departments[];
      unavailableAt: string | null;
    }
  | { kind: "redirect"; to: string }
  | { kind: "notFound" };

/**
 * Resolve either URL shape to a department.
 *
 *   /units/oslo/fadderullan  → explicit campus, cookie-independent, canonical
 *   /units/fadderullan       → follows the nav campus filter; chooser when the
 *                              filter is unset or the campus has no match
 *
 * Request-memoized: the page body and generateMetadata both call this and it
 * must run once. Reads cookies via getActiveCampus, so it is React `cache`, not
 * `"use cache"`.
 */
export const resolveUnit = cache(
  async (segments: string[]): Promise<UnitResolution> => {
    if (segments.length === 2) {
      return await resolveCanonical(segments[0] as string, segments[1] as string);
    }
    if (segments.length === 1) {
      return await resolveFiltered(segments[0] as string);
    }
    return { kind: "notFound" };
  }
);

async function resolveCanonical(
  campusSegment: string,
  slug: string
): Promise<UnitResolution> {
  const campusId = campusSegmentToId(campusSegment);
  if (!campusId) {
    return { kind: "notFound" };
  }
  const department = await cachedDepartmentBySlugAndCampus(slug, campusId);
  if (!department) {
    return { kind: "notFound" };
  }
  return {
    kind: "department",
    department,
    canonical: `/units/${campusSegment}/${slug}`,
  };
}

async function resolveFiltered(slug: string): Promise<UnitResolution> {
  const matches = await cachedDepartmentsBySlug(slug);

  if (matches.length === 0) {
    // Nothing matches the slug. It may be a legacy /units/<24SO id> link —
    // those ids are internal accounting identity students never saw, so this
    // is a courtesy redirect, not a supported contract.
    const legacy = await cachedDepartmentById(slug);
    const to = legacy ? `/units/${legacy.slug ?? ""}` : null;
    if (legacy?.slug && to) {
      return { kind: "redirect", to };
    }
    return { kind: "notFound" };
  }

  const activeCampusId = await getActiveCampus();
  const match = activeCampusId
    ? matches.find((d) => d.campus_id === activeCampusId)
    : undefined;

  if (match) {
    const canonical = unitCanonicalPath({
      campusId: match.campus_id,
      slug: match.slug,
    });
    if (!canonical) {
      return { kind: "notFound" };
    }
    return { kind: "department", department: match, canonical };
  }

  return {
    kind: "chooser",
    slug,
    matches,
    unavailableAt: activeCampusId ? campusIdToLabel(activeCampusId) : null,
  };
}
```

- [ ] **Step 3: Write the chooser**

Create `apps/web/src/app/(public)/units/[...segments]/_components/campus-chooser.tsx`:

```tsx
import type { Departments } from "@repo/api/types/appwrite";
import { campusIdToLabel } from "@repo/shared/utils/unit-urls";
import { Button } from "@repo/ui/components/ui/button";
import { revalidatePath } from "next/cache";
import { setActiveCampus } from "@/app/actions/campus";

/**
 * Shown when /units/<slug> cannot resolve to one department: either no campus
 * filter is set (every fresh visitor and every crawler) or the visitor's campus
 * has no department with this slug.
 *
 * Choosing sets the site-wide campus filter and stays on this URL, so the
 * choice follows the visitor everywhere afterwards.
 */
export function CampusChooser({
  matches,
  slug,
  unavailableAt,
}: {
  matches: Departments[];
  slug: string;
  unavailableAt: string | null;
}) {
  const title = matches[0]?.Name ?? slug;

  async function choose(formData: FormData) {
    "use server";
    const campusId = formData.get("campusId");
    if (typeof campusId === "string" && campusId) {
      await setActiveCampus(campusId);
      revalidatePath(`/units/${slug}`);
    }
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col justify-center px-4 py-16">
      <h1 className="font-semibold text-3xl tracking-tight">{title}</h1>
      <p className="mt-3 text-muted-foreground">
        {unavailableAt
          ? `Not at ${unavailableAt}. Available at:`
          : `This unit exists at ${matches.length} campuses. Which is yours?`}
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        {matches.map((department) => (
          <form action={choose} key={department.$id}>
            <input name="campusId" type="hidden" value={department.campus_id} />
            <Button size="lg" type="submit" variant="outline">
              {campusIdToLabel(department.campus_id) ?? department.campus_id}
            </Button>
          </form>
        ))}
      </div>
    </div>
  );
}
```

The `Button` import path is verified — `(public)/contact/page.tsx` and `(public)/error.tsx` both import from `@repo/ui/components/ui/button`.

- [ ] **Step 4: Write the route**

Create `apps/web/src/app/(public)/units/[...segments]/page.tsx`:

```tsx
import type { PageDoc } from "@repo/editor";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { getLocale } from "@/app/actions/locale";
import { getDepartmentById } from "@/lib/actions/departments";
import { getLoggedInUser } from "@/lib/actions/user";
import { cachedPublishedPage } from "@/lib/data/public-content";
import { resolvePageFeeds } from "@/lib/data/page-feeds";
import { RenderedPage } from "../../[...slug]/_components/rendered-page";
import { CampusChooser } from "./_components/campus-chooser";
import { DepartmentHero } from "./components/department-hero";
import { DepartmentTabsClient } from "./components/department-tabs-client";
import DepartmentLoading from "./loading";
import { resolveUnit } from "./resolve";

interface Props {
  params: Promise<{ segments: string[] }>;
}

/**
 * Opt out of the instant shell, for the reason documented on the (public)
 * catch-all: once the shell flushes the response is committed as 200, so
 * notFound() can no longer answer a crawler with a real 404.
 */
export const instant = false;

async function UnitContent({ segments }: { segments: string[] }) {
  const resolution = await resolveUnit(segments);

  if (resolution.kind === "notFound") {
    notFound();
  }
  if (resolution.kind === "redirect") {
    permanentRedirect(resolution.to);
  }
  if (resolution.kind === "chooser") {
    return (
      <CampusChooser
        matches={resolution.matches}
        slug={resolution.slug}
        unavailableAt={resolution.unavailableAt}
      />
    );
  }

  const locale = await getLocale();
  const { department, canonical } = resolution;

  // A published custom page overrides the default view. canonical is
  // "/units/<campus>/<slug>"; the page's storage slug is the same without the
  // leading slash.
  const pageResult = await cachedPublishedPage(
    canonical.slice(1),
    locale
  ).catch(() => null);

  if (pageResult?.translation?.is_published && pageResult.doc) {
    const doc = pageResult.doc as PageDoc;
    const feeds = await resolvePageFeeds(doc, locale);
    return <RenderedPage doc={doc} feeds={feeds} locale={locale} />;
  }

  const translated = await getDepartmentById(department.$id, locale);
  if (!translated?.department_ref?.active) {
    notFound();
  }
  const user = await getLoggedInUser();
  const isMember = user?.profile?.studentId?.isMember ?? false;

  return (
    <>
      <DepartmentHero department={translated} />
      <DepartmentTabsClient department={translated} isMember={isMember} />
    </>
  );
}

export default async function UnitPage({ params }: Props) {
  const { segments } = await params;
  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={<DepartmentLoading />}>
        <UnitContent segments={segments} />
      </Suspense>
    </div>
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { segments } = await params;
  const resolution = await resolveUnit(segments);
  if (resolution.kind !== "department") {
    return {};
  }

  const locale = await getLocale();
  const { department, canonical } = resolution;
  const pageResult = await cachedPublishedPage(
    canonical.slice(1),
    locale
  ).catch(() => null);

  const translated = await getDepartmentById(department.$id, locale);
  const title = pageResult?.translation?.title ?? translated?.title ?? department.Name;
  const description =
    pageResult?.translation?.description ??
    translated?.short_description ??
    translated?.description ??
    undefined;

  return {
    title: `${title} | BISO`,
    description: description?.slice(0, 160),
    // The one-segment URL points at the campus-explicit one so the two routes
    // never compete as duplicate content.
    alternates: { canonical },
  };
}
```

- [ ] **Step 5: Verify**

Run: `bun --filter=web check-types && bun run build --filter=web`
Expected: both succeed. A "You cannot use different slug names for the same dynamic path" error means the old `[id]` directory still exists — remove it.

- [ ] **Step 6: Manual smoke test**

With `bun run dev --filter=web`:

| URL / action | Expected |
|---|---|
| `/units/oslo/<slug>` | Oslo's department, regardless of filter |
| `/units/<slug>`, filter unset | Chooser listing every campus with that slug |
| Click a campus in the chooser | Same URL, that campus's department, filter now set |
| `/units/<slug>`, filter on a campus without it | Chooser with "Not at X. Available at:" |
| `/units/<old 24SO id>` | 301 to `/units/<slug>` |
| `/units/nonsense` | 404 |
| A department with a published page | Blocks render instead of the tabs |
| View source on `/units/<slug>` | `<link rel="canonical" href=".../units/<campus>/<slug>">` |

- [ ] **Step 7: Commit**

```bash
bun x ultracite fix
git add "apps/web/src/app/(public)/units"
git commit -m "feat(web): campus-aware and canonical unit page routes"
```

---

## Task 13: Links and sitemap

**Files:**
- Modify: `apps/web/src/app/(public)/units/components/department-card.tsx:134`
- Modify: `apps/web/src/app/(public)/campus/components/overview/departments-grid.tsx:58`
- Modify: `apps/web/src/lib/data/public-content.ts` (`cachedSitemapEntries`)
- Modify: `apps/web/src/app/sitemap.ts`

- [ ] **Step 1: Point both card links at the canonical URL**

In both files, import:

```tsx
import { unitCanonicalPath } from "@repo/shared/utils/unit-urls";
```

In `department-card.tsx`, replace:

```tsx
            href={`/units/${dept?.$id || department.content_id}`}
```

with:

```tsx
            href={
              unitCanonicalPath({
                campusId: dept?.campus_id,
                slug: dept?.slug,
              }) ?? `/units/${dept?.$id || department.content_id}`
            }
```

In `departments-grid.tsx`, replace:

```tsx
              href={`/units/${dept.department_ref?.$id || dept.content_id}`}
```

with:

```tsx
              href={
                unitCanonicalPath({
                  campusId: dept.department_ref?.campus_id,
                  slug: dept.department_ref?.slug,
                }) ?? `/units/${dept.department_ref?.$id || dept.content_id}`
              }
```

The `$id` fallback keeps a not-yet-slugged department linking somewhere valid; the route's legacy redirect then handles it.

- [ ] **Step 2: Add units to the sitemap source**

In `apps/web/src/lib/data/public-content.ts`, add `units: UnitSitemapRow[]` to the `SitemapEntries` interface with:

```ts
export interface UnitSitemapRow {
  $updatedAt: string;
  campus_id: string;
  slug: string | null;
}
```

Inside `cachedSitemapEntries`, add this promise to the `Promise.all` array and destructure it:

```ts
    db
      .listRows<Departments>("app", "departments", [
        Query.select(["$id", "$updatedAt", "campus_id", "slug"]),
        Query.equal("active", true),
        Query.limit(SITEMAP_LIMIT),
      ])
      .then((res) =>
        res.rows.map((row) => ({
          $updatedAt: row.$updatedAt,
          campus_id: row.campus_id,
          slug: row.slug ?? null,
        }))
      )
      .catch(() => [] as UnitSitemapRow[]),
```

and add `units` to the returned object.

- [ ] **Step 3: Emit canonical unit URLs**

In `apps/web/src/app/sitemap.ts`, add the import:

```ts
import { unitCanonicalPath } from "@repo/shared/utils/unit-urls";
```

add `units: []` to the `.catch(() => ({ … }))` fallback object, and append to the returned array:

```ts
    ...entries.units
      .map((row) => ({
        path: unitCanonicalPath({ campusId: row.campus_id, slug: row.slug }),
        lastModified: new Date(row.$updatedAt),
      }))
      .filter((row): row is { path: string; lastModified: Date } =>
        Boolean(row.path)
      )
      .map((row) => ({
        url: `${BASE}${row.path}`,
        lastModified: row.lastModified,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      })),
```

Only the campus-explicit URLs are listed — the one-segment URL is cookie-dependent and points its canonical here.

- [ ] **Step 4: Verify**

Run: `bun --filter=web check-types && bun run build --filter=web`
Expected: both succeed.

- [ ] **Step 5: Manual smoke test**

Load `/sitemap.xml` and confirm `/units/<campus>/<slug>` entries appear. Load `/units` and a campus overview page and confirm the cards link to canonical URLs.

- [ ] **Step 6: Commit**

```bash
bun x ultracite fix
git add apps/web/src
git commit -m "feat(web): canonical unit links and sitemap entries"
```

---

## Task 14: Full verification

**Files:** none — verification only.

- [ ] **Step 1: Type-check the whole monorepo**

Run: `bun run check-types`
Expected: all workspaces clean.

- [ ] **Step 2: Run every test suite**

Run: `bun run test --filter=@repo/shared && cd apps/admin && bun test ./src && cd ../..`
Expected: all green. Report exact counts; do not summarise as "passing" without the output.

- [ ] **Step 3: Build both apps**

Run: `bun run build --filter=admin && bun run build --filter=web`
Expected: both succeed. The admin build is the ONLY check that catches a non-async export from a `"use server"` file.

- [ ] **Step 4: Lint**

Run: `bun x ultracite check`
Expected: clean.

- [ ] **Step 5: End-to-end walkthrough**

As a **department user** (not an admin): sign into admin, land on `/departments` → confirm the automatic redirect to your own department. Create a page, add a block, publish it. Open `/units/<campus>/<your-slug>` in web and confirm the blocks render. Switch the campus filter and confirm `/units/<your-slug>` follows it.

As a **campus admin**: confirm `/departments` lists only your managed campuses and that opening a department outside them 404s.

- [ ] **Step 6: Commit any fixes and open the PR**

```bash
git push -u origin feat/department-unit-pages
gh pr create --title "feat: department unit pages" --body "$(cat <<'EOF'
Implements docs/superpowers/specs/2026-08-25-department-unit-pages-design.md.

Departments get a campus-agnostic slug and can publish their own block-editor
page, served at /units/<slug> (follows the nav campus filter) and
/units/<campus>/<slug> (canonical, indexable). Departments without a page keep
today's tabbed view.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Notes for the executor

- **Tasks 3 and 5 block on the repo owner.** Task 4 needs regenerated types; Task 5 needs the backfill to have run. Stop and ask rather than guessing.
- **Two `departments` tables exist** in `appwrite.config.json`. Only touch `databaseId: "app"`.
- **Never** add a second name normalizer. `normalizeForCompare` is the one.
- The `(public)/units` subtree does **not** use `next-intl` — it is hardcoded English, like its neighbours. The chooser follows suit. Do not introduce translations for it in this plan.
