# Admin Nav Restructure + Unified Command Palette Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut the admin sidebar from ~20 to 8 top-level entries (accordion tree), merge Approvals+Submissions into a tabbed `/inbox`, move settings-ish routes under `/settings/*` with redirects, upgrade ⌘K into a fuzzy/recents/entity-search/AI palette, and add read-only assistant tools (shop, ops, analytics).

**Architecture:** Navigation becomes a role-filtered tree in a plain testable lib module consumed by both the sidebar and breadcrumbs. Route moves are `git mv` + import-depth fixes + `next.config.ts` permanent redirects. The palette stays hand-rolled; entity search is a `"use server"` action whose scoping logic lives in a plain lib module (bun:test-able). Assistant additions follow the existing deps-injection pattern: tool factories in `@repo/ai`, dep implementations in the admin assistant route.

**Tech Stack:** Next.js 16 App Router, Bun 1.3.1, Appwrite via `@repo/api`, AI SDK v5 (`ai` + `@ai-sdk/react`), `next-intl`, lucide-react, bun:test.

**Spec:** `docs/superpowers/specs/2026-07-09-admin-nav-and-command-palette-design.md`

## Global Constraints

- **Bun only** — never npm/pnpm. Run root commands from `/Users/heien/Documents/Dev/BISO-Sites`.
- **`"use server"` files may export ONLY `async function`s** (plus `export type`/`export interface`). Shared consts/sync helpers go in plain lib modules. `check-types` does NOT catch violations — only `bun run build --filter=admin` does.
- **Verification gates per task:** `bun run check-types` (root), and `bun run build --filter=admin` for any task touching a `"use server"` file. Run `bun x ultracite fix` before every commit.
- **All Appwrite access via `@repo/api`** (`createSessionClient` from `@repo/api/server`, `Query` from `@repo/api`). Never import `node-appwrite`/`appwrite` directly.
- **Tests:** colocated `*.test.ts`, `import { describe, expect, test } from "bun:test"` (use `test`, not `it`). Only plain (non-`"use server"`) modules get unit tests.
- **i18n:** admin strings live in `packages/i18n/messages/{en,no}/adminPortal.json` — always edit BOTH locales with identical key structure.
- **Styling:** portal UI uses the STUDIO tokens from `apps/admin/src/app/(portal)/_components/studio.tsx` (`STUDIO`, `SERIF_STACK`, `MONO_STACK`), inline-style based like the existing sidebar/palette.
- **Commits:** plain sentence-case messages (match `git log` style). Author is the repo owner; no co-author trailers.
- **Stale-artifact gotcha:** if `check-types` fails on files you didn't touch, run `find apps -path '*/.next/*' -name '* [0-9].*' -delete` and retry.
- Working branch: create `feat/admin-nav-command-palette` off `main` before Task 1.

---

### Task 1: Move settings-ish routes under /settings with sub-nav + redirects

**Files:**
- Move: `apps/admin/src/app/(portal)/operations/` → `apps/admin/src/app/(portal)/settings/operations/`
- Move: `apps/admin/src/app/(portal)/feature-flags/` → `apps/admin/src/app/(portal)/settings/feature-flags/`
- Move: `apps/admin/src/app/(portal)/payment-settings/` → `apps/admin/src/app/(portal)/settings/payments/`
- Create: `apps/admin/src/app/(portal)/settings/layout.tsx`
- Create: `apps/admin/src/app/(portal)/settings/_components/settings-subnav.tsx`
- Modify: `apps/admin/src/app/(portal)/settings/feature-flags/actions.ts` (revalidatePath)
- Modify: `apps/admin/src/app/(portal)/settings/payments/actions.ts` (3× revalidatePath)
- Modify: `apps/admin/src/app/(portal)/settings/_components/settings-client.tsx` (remove Platform section)
- Modify: `apps/admin/src/app/(portal)/settings/page.tsx` (remove platform labels)
- Modify: `apps/admin/next.config.ts` (add redirects)
- Modify: `packages/i18n/messages/en/adminPortal.json`, `packages/i18n/messages/no/adminPortal.json` (add `nav.general`)

**Interfaces:**
- Consumes: existing `requireNavAccess("portal.settings")` gates (unchanged inside moved pages).
- Produces: routes `/settings/operations`, `/settings/feature-flags`, `/settings/payments`; permanent redirects from the three old paths. Later tasks link to these new paths.

- [ ] **Step 1: Move the three route directories**

```bash
cd /Users/heien/Documents/Dev/BISO-Sites
git mv "apps/admin/src/app/(portal)/operations" "apps/admin/src/app/(portal)/settings/operations"
git mv "apps/admin/src/app/(portal)/feature-flags" "apps/admin/src/app/(portal)/settings/feature-flags"
git mv "apps/admin/src/app/(portal)/payment-settings" "apps/admin/src/app/(portal)/settings/payments"
```

- [ ] **Step 2: Fix relative-import depth in moved files**

Each moved file sits one directory deeper. In each of these files, add one `../` to every **relative** import that starts with `../` (alias `@/…` imports are untouched):

- `settings/operations/page.tsx` — e.g. `from "../_components/page-header"` → `from "../../_components/page-header"`
- `settings/operations/_components/operations-health.tsx` — e.g. `from "../../_components/studio"` → `from "../../../_components/studio"`
- `settings/feature-flags/page.tsx` — same PageHeader fix; `./actions` and `./_components/...` stay unchanged
- `settings/feature-flags/_components/feature-flags-client.tsx` — `../actions` unchanged; `../../_components/studio` → `../../../_components/studio`
- `settings/payments/page.tsx` — same PageHeader fix
- `settings/payments/_components/payment-settings-client.tsx` — `../actions` unchanged; `../../_components/studio` → `../../../_components/studio`

Then verify nothing was missed:

```bash
bun run check-types --filter=admin
```

Expected: PASS (fix any remaining module-not-found errors by adjusting the reported import path depth).

- [ ] **Step 3: Update revalidatePath calls in moved actions**

In `apps/admin/src/app/(portal)/settings/feature-flags/actions.ts` (~line 123):

```ts
revalidatePath("/settings/feature-flags");
```

In `apps/admin/src/app/(portal)/settings/payments/actions.ts` (lines ~177, ~254, ~290), all three become:

```ts
revalidatePath("/settings/payments");
```

- [ ] **Step 4: Add the settings layout with sub-nav**

Create `apps/admin/src/app/(portal)/settings/layout.tsx`:

```tsx
import { requireNavAccess } from "@/lib/authorization";
import { SettingsSubnav } from "./_components/settings-subnav";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireNavAccess("portal.settings");
  return (
    <div>
      <SettingsSubnav />
      {children}
    </div>
  );
}
```

Create `apps/admin/src/app/(portal)/settings/_components/settings-subnav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { STUDIO } from "../../_components/studio";

const TABS = [
  { exact: true, href: "/settings", labelKey: "general" },
  { exact: false, href: "/settings/operations", labelKey: "operations" },
  { exact: false, href: "/settings/feature-flags", labelKey: "featureFlags" },
  { exact: false, href: "/settings/payments", labelKey: "payments" },
] as const;

export function SettingsSubnav() {
  const pathname = usePathname();
  const t = useTranslations("adminPortal.nav");

  return (
    <div
      className="mb-6 flex items-center gap-1 border-b"
      style={{ borderColor: STUDIO.rule }}
    >
      {TABS.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname.startsWith(tab.href);
        return (
          <Link
            className="-mb-px border-b-2 px-3 py-2 text-[13px] transition"
            href={tab.href}
            key={tab.href}
            style={
              active
                ? { borderColor: STUDIO.ink, color: STUDIO.ink, fontWeight: 600 }
                : { borderColor: "transparent", color: STUDIO.ink3 }
            }
          >
            {t(tab.labelKey)}
          </Link>
        );
      })}
    </div>
  );
}
```

Add the `general` key to `adminPortal.nav` in BOTH message files:
- `packages/i18n/messages/en/adminPortal.json`: `"general": "General",`
- `packages/i18n/messages/no/adminPortal.json`: `"general": "Generelt",`

- [ ] **Step 5: Remove the redundant Platform section from settings-client**

In `apps/admin/src/app/(portal)/settings/_components/settings-client.tsx`:
1. Remove `"platform"` from the `Section` union type (~lines 61–66) and delete its entry from the section-nav array (the one with the `Boxes` icon); remove the now-unused `Boxes` lucide import.
2. Delete the entire Platform section render block (~lines 468–489, the three `LinkRow`s pointing at `/operations`, `/feature-flags`, `/payment-settings`).
3. If `LinkRow` is now unused, delete the `LinkRow` component too.
4. In `settings/page.tsx`, delete the `platform` object from the `labels` prop (~lines 105–114) and remove `platform` from the client's `labels` prop type.

The `adminPortal.settings.platform.*` i18n keys become unused — delete them from BOTH `adminPortal.json` files (`settings.platform` object).

- [ ] **Step 6: Add redirects to next.config.ts**

In `apps/admin/next.config.ts`, alongside the existing `headers()` (~lines 50–72), add:

```ts
// biome-ignore lint/suspicious/useAwait: Next.js requires redirects to be async
async redirects() {
  return [
    { destination: "/settings/operations", permanent: true, source: "/operations" },
    { destination: "/settings/feature-flags", permanent: true, source: "/feature-flags" },
    { destination: "/settings/payments", permanent: true, source: "/payment-settings" },
  ];
},
```

- [ ] **Step 7: Update stale hrefs in sidebar and palette to the new paths**

These keep the current (pre-restructure) UI working until Tasks 4/9 rewrite it:

- `apps/admin/src/app/(portal)/sidebar.tsx`: `href="/operations"` → `/settings/operations` (~line 343), `href="/feature-flags"` → `/settings/feature-flags` (~line 351), `href="/payment-settings"` → `/settings/payments` (~line 359). Update the matching `isActive(...)` args too.
- `apps/admin/src/app/(portal)/_components/command-palette.tsx`: same three `href` updates in `ALL_COMMANDS` (`nav-operations` ~line 147, `nav-feature-flags` ~line 155, `nav-payment-settings` ~line 163).

- [ ] **Step 8: Verify and commit**

```bash
bun run check-types
bun run build --filter=admin
bun x ultracite fix
```

Expected: both PASS (`✓ Compiled` in the build). Then:

```bash
git add -A
git commit -m "Move operations, feature flags and payment settings under /settings with sub-nav and redirects"
```

---

### Task 2: Tabbed /inbox merging Approvals + Submissions

**Files:**
- Modify: `apps/admin/src/lib/roles.ts` (add `portal.inbox`)
- Create: `apps/admin/src/app/(portal)/_actions/inbox.ts`
- Create: `apps/admin/src/app/(portal)/inbox/layout.tsx`
- Create: `apps/admin/src/app/(portal)/inbox/page.tsx`
- Create: `apps/admin/src/app/(portal)/inbox/_components/inbox-tabs.tsx`
- Move: `apps/admin/src/app/(portal)/approvals/` → `apps/admin/src/app/(portal)/inbox/approvals/`
- Move: `apps/admin/src/app/(portal)/submissions/` → `apps/admin/src/app/(portal)/inbox/submissions/`
- Modify: `apps/admin/src/app/(portal)/_actions/approvals.ts` (3× revalidatePath)
- Modify: `apps/admin/src/app/(portal)/_actions/submissions.ts` (2× revalidatePath)
- Modify: `apps/admin/next.config.ts` (3 more redirects)

**Interfaces:**
- Consumes: `requireAuth()`/`requireNavAccess()` from `@/lib/authorization`; `applyScopeQueries` from `@/lib/utils/authorization`.
- Produces: `getInboxCounts(): Promise<InboxCounts>` where `InboxCounts = { approvals: number; submissions: number; total: number }` — reused by Task 4 (sidebar badge) and Task 12 (assistant dep). Routes `/inbox`, `/inbox/approvals`, `/inbox/submissions`, `/inbox/submissions/[topic]`. New NavKey `"portal.inbox"`.

- [ ] **Step 1: Add the portal.inbox nav key**

In `apps/admin/src/lib/roles.ts`, inside `NAV_ACCESS` next to the approvals/submissions keys:

```ts
"portal.inbox": [ROLES.GLOBAL_ADMIN, ROLES.CAMPUS_ADMIN],
```

(Leave `portal.approvals` / `portal.submissions` in place for now — the current sidebar/palette still reference them; Task 9 removes them.)

- [ ] **Step 2: Create the inbox counts action**

Create `apps/admin/src/app/(portal)/_actions/inbox.ts`. Copy the exact import specifiers for `createSessionClient`/`Query` from the top of `_actions/submissions.ts`:

```ts
"use server";

import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import { requireAuth } from "@/lib/authorization";
import { applyScopeQueries } from "@/lib/utils/authorization";

export interface InboxCounts {
  approvals: number;
  submissions: number;
  total: number;
}

export async function getInboxCounts(): Promise<InboxCounts> {
  const ctx = await requireAuth();
  const isApprover =
    ctx.roles.includes("globaladmin") || ctx.roles.includes("campusadmin");
  if (!isApprover) {
    return { approvals: 0, submissions: 0, total: 0 };
  }

  const { db } = await createSessionClient();

  const approvalQueries = [Query.equal("status", "pending"), Query.limit(1)];
  if (ctx.activeCampusId) {
    approvalQueries.push(Query.equal("campus_id", [ctx.activeCampusId]));
  }

  const submissionQueries = [
    Query.equal("status", "new"),
    Query.limit(1),
    // form_submissions is campus-scoped only (no department column)
    ...applyScopeQueries(ctx, { departmentField: null }),
  ];

  const [approvals, submissions] = await Promise.allSettled([
    db.listRows("app", "approval_requests", approvalQueries),
    db.listRows("app", "form_submissions", submissionQueries),
  ]);

  const approvalCount =
    approvals.status === "fulfilled" ? approvals.value.total : 0;
  const submissionCount =
    submissions.status === "fulfilled" ? submissions.value.total : 0;
  return {
    approvals: approvalCount,
    submissions: submissionCount,
    total: approvalCount + submissionCount,
  };
}
```

Scoping note: this action's campus scoping is `applyScopeQueries(ctx, { departmentField: null })`, which already has direct unit coverage in `src/lib/utils/authorization.test.ts` — no separate count-scoping test is needed (`"use server"` files aren't unit-tested per convention).

- [ ] **Step 3: Move the two route directories**

```bash
mkdir -p "apps/admin/src/app/(portal)/inbox"
git mv "apps/admin/src/app/(portal)/approvals" "apps/admin/src/app/(portal)/inbox/approvals"
git mv "apps/admin/src/app/(portal)/submissions" "apps/admin/src/app/(portal)/inbox/submissions"
```

- [ ] **Step 4: Fix imports, gates, and hardcoded hrefs in moved files**

- `inbox/approvals/page.tsx`:
  - `requireNavAccess("portal.approvals")` → `requireNavAccess("portal.inbox")`
  - `from "../_actions/approvals"` → `from "../../_actions/approvals"`
  - `from "../_components/empty-state"` → `from "../../_components/empty-state"`
  - `from "../_components/page-header"` → `from "../../_components/page-header"`
- `inbox/approvals/_components/approvals-review-client.tsx`:
  - `from "../../_actions/approvals"` → `from "../../../_actions/approvals"`
  - `from "../../_components/status-badge"` and `"../../_components/studio"` → add one `../` each
- `inbox/submissions/page.tsx`:
  - `requireNavAccess("portal.submissions")` → `requireNavAccess("portal.inbox")`
  - `from "../_actions/submissions"` → `from "../../_actions/submissions"`
  - `from "../_components/page-header"` → `from "../../_components/page-header"`
- `inbox/submissions/_components/submission-topic-list.tsx` (~line 24):
  - `` href={`/submissions/${encodeURIComponent(t.topic)}`} `` → `` href={`/inbox/submissions/${encodeURIComponent(t.topic)}`} ``
- `inbox/submissions/[topic]/page.tsx`:
  - `requireNavAccess("portal.submissions")` → `requireNavAccess("portal.inbox")`
  - `from "../../_actions/submissions"` → `from "../../../_actions/submissions"`
  - `from "../../_components/page-header"` → `from "../../../_components/page-header"`
  - back link (~line 37): `href="/submissions"` → `href="/inbox/submissions"`
- `inbox/submissions/[topic]/_components/submissions-list.tsx`:
  - `from "../../../_actions/submissions"` → `from "../../../../_actions/submissions"`

- [ ] **Step 5: Create inbox layout, tabs, and index redirect page**

Create `apps/admin/src/app/(portal)/inbox/_components/inbox-tabs.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { STUDIO } from "../../_components/studio";

interface InboxTabsProps {
  approvals: number;
  submissions: number;
}

export function InboxTabs({ approvals, submissions }: InboxTabsProps) {
  const pathname = usePathname();
  const t = useTranslations("adminPortal.nav");
  const tabs = [
    { count: approvals, href: "/inbox/approvals", label: t("approvals") },
    { count: submissions, href: "/inbox/submissions", label: t("submissions") },
  ];

  return (
    <div
      className="mb-6 flex items-center gap-1 border-b"
      style={{ borderColor: STUDIO.rule }}
    >
      {tabs.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            className="-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-[13px] transition"
            href={tab.href}
            key={tab.href}
            style={
              active
                ? { borderColor: STUDIO.ink, color: STUDIO.ink, fontWeight: 600 }
                : { borderColor: "transparent", color: STUDIO.ink3 }
            }
          >
            {tab.label}
            {tab.count > 0 && (
              <span
                className="rounded-full px-1.5 py-0.5 font-mono text-[10px] leading-none"
                style={{ background: STUDIO.claret, color: STUDIO.paper }}
              >
                {tab.count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
```

Create `apps/admin/src/app/(portal)/inbox/layout.tsx`:

```tsx
import { requireNavAccess } from "@/lib/authorization";
import { getInboxCounts } from "../_actions/inbox";
import { InboxTabs } from "./_components/inbox-tabs";

export default async function InboxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireNavAccess("portal.inbox");
  const counts = await getInboxCounts();
  return (
    <div>
      <InboxTabs approvals={counts.approvals} submissions={counts.submissions} />
      {children}
    </div>
  );
}
```

Create `apps/admin/src/app/(portal)/inbox/page.tsx` (approvals preferred on tie):

```tsx
import { redirect } from "next/navigation";
import { getInboxCounts } from "../_actions/inbox";

export default async function InboxPage() {
  const counts = await getInboxCounts();
  if (counts.submissions > 0 && counts.approvals === 0) {
    redirect("/inbox/submissions");
  }
  redirect("/inbox/approvals");
}
```

- [ ] **Step 6: Update revalidatePath calls**

- `apps/admin/src/app/(portal)/_actions/approvals.ts` (~lines 135, 236, 331): `revalidatePath("/approvals")` → `revalidatePath("/inbox/approvals")` (all three).
- `apps/admin/src/app/(portal)/_actions/submissions.ts` (~lines 150, 172): `` revalidatePath(`/submissions/${topic}`) `` → `` revalidatePath(`/inbox/submissions/${topic}`) `` (both).

- [ ] **Step 7: Add inbox redirects**

In `apps/admin/next.config.ts`, extend the `redirects()` array from Task 1:

```ts
{ destination: "/inbox/approvals", permanent: true, source: "/approvals" },
{ destination: "/inbox/submissions", permanent: true, source: "/submissions" },
{ destination: "/inbox/submissions/:topic", permanent: true, source: "/submissions/:topic" },
```

- [ ] **Step 8: Point current sidebar/palette at /inbox tabs (temporary until Tasks 4/9)**

- `sidebar.tsx`: approvals link `href="/approvals"` → `/inbox/approvals` (~line 327), submissions NAV_ITEMS entry `path: "/submissions"` → `path: "/inbox/submissions"` (~line 150).
- `command-palette.tsx`: `nav-activity` untouched; update any command with `href: "/approvals"` or `/submissions` if present (check `ALL_COMMANDS`; currently submissions/approvals may not exist there — skip if absent).

- [ ] **Step 9: Verify and commit**

```bash
bun run check-types
bun run build --filter=admin
bun x ultracite fix
git add -A
git commit -m "Merge approvals and form submissions into tabbed /inbox with pending counts"
```

Manual check (optional but recommended): `bun run dev --filter=admin`, visit `http://localhost:3001/approvals` → lands on `/inbox/approvals`; `/submissions/some-topic` → `/inbox/submissions/some-topic`.

---

### Task 3: Navigation tree module (pure logic + tests)

**Files:**
- Create: `apps/admin/src/lib/nav-tree.ts`
- Test: `apps/admin/src/lib/nav-tree.test.ts`

**Interfaces:**
- Consumes: `hasNavAccess`, `NavKey` from `@/lib/roles`.
- Produces (used by Tasks 4, 6, 9):
  - `interface NavLeaf { icon: LucideIcon; kind: "leaf"; labelKey: string; navKey: NavKey; path: string }`
  - `interface NavGroup { children: NavLeaf[]; icon: LucideIcon; id: string; kind: "group"; labelKey: string }`
  - `type NavNode = NavGroup | NavLeaf`
  - `const NAV_TREE: NavNode[]`
  - `filterNavTree(input: { hasDepartmentMembership: boolean; roles: string[] }, tree?: NavNode[]): NavNode[]`
  - `flattenNavTree(tree?: NavNode[]): NavLeaf[]`
  - `findActivePath(pathname: string, tree?: NavNode[]): string | null`

- [ ] **Step 1: Write the failing tests**

Create `apps/admin/src/lib/nav-tree.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { filterNavTree, findActivePath, flattenNavTree } from "./nav-tree";

const globalAdmin = { hasDepartmentMembership: true, roles: ["globaladmin"] };
const campusAdmin = { hasDepartmentMembership: true, roles: ["campusadmin"] };
const departmentUser = { hasDepartmentMembership: true, roles: [] };
const noAccess = { hasDepartmentMembership: false, roles: [] };

function labels(nodes: ReturnType<typeof filterNavTree>) {
  return nodes.map((n) => n.labelKey);
}

describe("filterNavTree", () => {
  test("global admin sees all 8 top-level entries", () => {
    expect(labels(filterNavTree(globalAdmin))).toEqual([
      "overview",
      "inbox",
      "content",
      "shop",
      "organization",
      "analytics",
      "system",
    ]);
  });

  test("campus admin: system group flattens to its single visible child (activity)", () => {
    const nodes = filterNavTree(campusAdmin);
    const last = nodes.at(-1);
    expect(last?.kind).toBe("leaf");
    expect(last?.labelKey).toBe("activity");
    // analytics is globaladmin-only and must be gone
    expect(labels(nodes)).not.toContain("analytics");
  });

  test("department user sees only the content group with pages/news/jobs", () => {
    const nodes = filterNavTree(departmentUser);
    expect(nodes).toHaveLength(1);
    const content = nodes[0];
    if (content?.kind !== "group") {
      throw new Error("expected content group");
    }
    expect(content.children.map((c) => c.labelKey)).toEqual([
      "pages",
      "news",
      "jobs",
    ]);
  });

  test("SECURITY: user with no roles and no membership sees nothing", () => {
    expect(filterNavTree(noAccess)).toEqual([]);
  });
});

describe("flattenNavTree", () => {
  test("returns every leaf exactly once", () => {
    const paths = flattenNavTree().map((l) => l.path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toContain("/settings/feature-flags");
    expect(paths).toContain("/inbox");
  });
});

describe("findActivePath", () => {
  test("root only matches exactly", () => {
    expect(findActivePath("/")).toBe("/");
    expect(findActivePath("/jobs")).toBe("/jobs");
  });

  test("longest prefix wins for settings children", () => {
    expect(findActivePath("/settings/feature-flags")).toBe(
      "/settings/feature-flags"
    );
    expect(findActivePath("/settings")).toBe("/settings");
    expect(findActivePath("/settings/payments/foo")).toBe("/settings/payments");
  });

  test("detail routes match their section", () => {
    expect(findActivePath("/jobs/abc123")).toBe("/jobs");
    expect(findActivePath("/inbox/submissions/contact")).toBe("/inbox");
  });

  test("unknown path returns null", () => {
    expect(findActivePath("/nope")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/admin && bun test src/lib/nav-tree.test.ts
```

Expected: FAIL — `Cannot find module './nav-tree'`.

- [ ] **Step 3: Implement the module**

Create `apps/admin/src/lib/nav-tree.ts`:

```ts
import {
  Activity,
  Briefcase,
  Building2,
  Calendar,
  CreditCard,
  FileStack,
  FileText,
  Flag,
  Gauge,
  Gift,
  HardDrive,
  Inbox,
  Layers,
  LayoutDashboard,
  LineChart,
  type LucideIcon,
  Megaphone,
  Newspaper,
  Settings,
  ShoppingCart,
} from "lucide-react";
import { hasNavAccess, type NavKey } from "@/lib/roles";

export interface NavLeaf {
  icon: LucideIcon;
  kind: "leaf";
  labelKey: string;
  navKey: NavKey;
  path: string;
}

export interface NavGroup {
  children: NavLeaf[];
  icon: LucideIcon;
  id: string;
  kind: "group";
  labelKey: string;
}

export type NavNode = NavGroup | NavLeaf;

export interface NavRoleInput {
  hasDepartmentMembership: boolean;
  roles: string[];
}

const leaf = (
  labelKey: string,
  navKey: NavKey,
  path: string,
  icon: LucideIcon
): NavLeaf => ({ icon, kind: "leaf", labelKey, navKey, path });

export const NAV_TREE: NavNode[] = [
  leaf("overview", "portal.dashboard", "/", LayoutDashboard),
  leaf("inbox", "portal.inbox", "/inbox", Inbox),
  {
    children: [
      leaf("pages", "portal.pages", "/pages", Layers),
      leaf("news", "portal.news", "/news", Newspaper),
      leaf("events", "portal.events", "/events", Calendar),
      leaf("jobs", "portal.jobs", "/jobs", Briefcase),
      leaf("communications", "portal.communications", "/communications", Megaphone),
      leaf("benefits", "portal.benefits", "/benefits", Gift),
      leaf("drafts", "portal.drafts", "/drafts", FileStack),
    ],
    icon: Layers,
    id: "content",
    kind: "group",
    labelKey: "content",
  },
  leaf("shop", "portal.shop", "/shop", ShoppingCart),
  {
    children: [
      leaf("departments", "portal.departments", "/departments", Building2),
      leaf("documents", "portal.documents", "/documents", FileText),
    ],
    icon: Building2,
    id: "organization",
    kind: "group",
    labelKey: "organization",
  },
  leaf("analytics", "portal.analytics", "/analytics", LineChart),
  {
    children: [
      leaf("it", "portal.it", "/it", HardDrive),
      leaf("activity", "portal.activity", "/activity", Activity),
      leaf("operations", "portal.settings", "/settings/operations", Gauge),
      leaf("featureFlags", "portal.settings", "/settings/feature-flags", Flag),
      leaf("payments", "portal.settings", "/settings/payments", CreditCard),
      leaf("settings", "portal.settings", "/settings", Settings),
    ],
    icon: Gauge,
    id: "system",
    kind: "group",
    labelKey: "system",
  },
];

export function filterNavTree(
  input: NavRoleInput,
  tree: NavNode[] = NAV_TREE
): NavNode[] {
  const visible: NavNode[] = [];
  for (const node of tree) {
    if (node.kind === "leaf") {
      if (hasNavAccess(node.navKey, input.roles, input.hasDepartmentMembership)) {
        visible.push(node);
      }
      continue;
    }
    const children = node.children.filter((child) =>
      hasNavAccess(child.navKey, input.roles, input.hasDepartmentMembership)
    );
    if (children.length === 0) {
      continue;
    }
    if (children.length === 1) {
      visible.push(children[0] as NavLeaf);
      continue;
    }
    visible.push({ ...node, children });
  }
  return visible;
}

export function flattenNavTree(tree: NavNode[] = NAV_TREE): NavLeaf[] {
  return tree.flatMap((node) => (node.kind === "leaf" ? [node] : node.children));
}

export function findActivePath(
  pathname: string,
  tree: NavNode[] = NAV_TREE
): string | null {
  let best: string | null = null;
  for (const item of flattenNavTree(tree)) {
    const matches =
      item.path === "/"
        ? pathname === "/"
        : pathname === item.path || pathname.startsWith(`${item.path}/`);
    if (matches && (best === null || item.path.length > best.length)) {
      best = item.path;
    }
  }
  return best;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/admin && bun test src/lib/nav-tree.test.ts
```

Expected: PASS (all tests green). Note the department-user test depends on current `NAV_ACCESS` values — if it fails, check which keys include `DEPARTMENT_ROLE` and fix the test expectation only if the access matrix genuinely differs from `pages/news/jobs`.

- [ ] **Step 5: Commit**

```bash
bun x ultracite fix
git add apps/admin/src/lib/nav-tree.ts apps/admin/src/lib/nav-tree.test.ts
git commit -m "Add role-filtered navigation tree module for the admin sidebar"
```

---

### Task 4: Accordion sidebar + breadcrumbs + inbox badge

**Files:**
- Modify: `apps/admin/src/app/(portal)/sidebar.tsx` (major rewrite of nav section)
- Modify: `apps/admin/src/app/(portal)/_components/admin-shell.tsx` (breadcrumbs, inboxCount pass-through)
- Modify: `apps/admin/src/app/(portal)/layout.tsx` (fetch counts)
- Modify: `packages/i18n/messages/en/adminPortal.json`, `packages/i18n/messages/no/adminPortal.json` (new nav keys)

**Interfaces:**
- Consumes: `NAV_TREE`, `filterNavTree`, `flattenNavTree`, `findActivePath`, types from `@/lib/nav-tree` (Task 3); `getInboxCounts` from `(portal)/_actions/inbox` (Task 2).
- Produces: `Sidebar` props gain `inboxCount: number`; `AdminShell` props gain `inboxCount: number`. `NAV_ITEMS` export is REMOVED from sidebar.tsx (admin-shell switches to `flattenNavTree`).

- [ ] **Step 1: Add i18n keys**

In `packages/i18n/messages/en/adminPortal.json`, add to the `nav` object:

```json
"inbox": "Inbox",
"content": "Content",
"organization": "Organization",
"system": "System"
```

In `packages/i18n/messages/no/adminPortal.json`:

```json
"inbox": "Innboks",
"content": "Innhold",
"organization": "Organisasjon",
"system": "System"
```

Remove `"publishGroup"` and `"operateGroup"` from BOTH files (their only consumers are removed in Step 2).

- [ ] **Step 2: Rewrite the sidebar nav section**

In `apps/admin/src/app/(portal)/sidebar.tsx`:

1. **Delete** the `NavItem` interface, the entire `NAV_ITEMS` array, and the `NavGroup` component (lines ~52–172).
2. **Replace imports**: drop now-unused lucide icons (keep `Command`, `LogOut`, `Sparkles`, `ChevronDown` — add `ChevronDown`), drop `NavKey` if unused, and add:

```tsx
import { ChevronDown } from "lucide-react";
import {
  filterNavTree,
  findActivePath,
  type NavLeaf,
  type NavNode,
} from "@/lib/nav-tree";
```

(Keep `hasNavAccess` import — the hints carousel still uses it.)

3. **Props**: add `inboxCount: number` to `SidebarProps`.

4. **Inside `Sidebar`**, replace the `visibleItems`/`canViewX`/`publishItems`/`operateItems` logic (lines ~180–236 except the campus block) with:

```tsx
const tree = useMemo(
  () =>
    filterNavTree({
      hasDepartmentMembership: roles.hasDepartmentMembership,
      roles: roles.roles,
    }),
  [roles]
);

const activePath = findActivePath(pathname);
const activeGroupId = useMemo(() => {
  for (const node of tree) {
    if (node.kind === "group" && node.children.some((c) => c.path === activePath)) {
      return node.id;
    }
  }
  return null;
}, [tree, activePath]);

const [openGroup, setOpenGroup] = useState<string | null>(null);
const expandedGroup = openGroup ?? activeGroupId;
```

5. **Replace the `<nav>` block** (the two `NavGroup` sections, lines ~294–374) with:

```tsx
<nav className="min-h-0 flex-1 space-y-1 overflow-y-auto pt-2">
  {tree.map((node) =>
    node.kind === "leaf" ? (
      <SidebarLink
        active={activePath === node.path}
        badge={node.path === "/inbox" ? inboxCount : undefined}
        href={node.path}
        icon={node.icon}
        key={node.path}
        label={t(node.labelKey)}
      />
    ) : (
      <SidebarGroup
        activePath={activePath}
        expanded={expandedGroup === node.id}
        key={node.id}
        label={t(node.labelKey)}
        node={node}
        onToggle={() =>
          setOpenGroup((prev) => (prev === node.id ? null : node.id))
        }
        t={t}
      />
    )
  )}
</nav>
```

6. **Add the `SidebarGroup` component** (place after `SidebarLink`):

```tsx
function SidebarGroup({
  activePath,
  expanded,
  label,
  node,
  onToggle,
  t,
}: {
  activePath: string | null;
  expanded: boolean;
  label: string;
  node: Extract<NavNode, { kind: "group" }>;
  onToggle: () => void;
  t: (key: string) => string;
}) {
  const Icon = node.icon;
  return (
    <div>
      <button
        aria-expanded={expanded}
        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition hover:bg-white/60"
        onClick={onToggle}
        style={{ color: STUDIO.ink2 }}
        type="button"
      >
        <Icon size={15} />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <ChevronDown
          size={13}
          style={{
            color: STUDIO.ink4,
            transform: expanded ? "rotate(180deg)" : "none",
            transition: "transform 150ms ease",
          }}
        />
      </button>
      {expanded && (
        <div
          className="ml-4 space-y-0.5 border-l pl-2"
          style={{ borderColor: STUDIO.rule2 }}
        >
          {node.children.map((child) => (
            <SidebarLink
              active={activePath === child.path}
              href={child.path}
              icon={child.icon}
              key={child.path}
              label={t(child.labelKey)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

7. **Extend `SidebarLink`** with an optional badge:

```tsx
function SidebarLink({
  active,
  badge,
  href,
  icon: Icon,
  label,
}: {
  active: boolean;
  badge?: number;
  href: string;
  icon: React.ComponentType<{ size?: number }>;
  label: string;
}) {
  return (
    <Link
      className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition"
      href={href}
      style={active ? { background: STUDIO.ink, color: STUDIO.paper } : { color: STUDIO.ink2 }}
    >
      <Icon size={15} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span
          className="rounded-full px-1.5 py-0.5 font-mono text-[10px] leading-none"
          style={
            active
              ? { background: STUDIO.paper, color: STUDIO.ink }
              : { background: STUDIO.claret, color: STUDIO.paper }
          }
        >
          {badge}
        </span>
      )}
    </Link>
  );
}
```

8. Destructure the new prop: `export function Sidebar({ user, roles, inboxCount }: SidebarProps)`. Remove the old `isActive` function if now unused.

- [ ] **Step 3: Update admin-shell breadcrumbs and plumb inboxCount**

In `apps/admin/src/app/(portal)/_components/admin-shell.tsx`:

1. Change `import { NAV_ITEMS, Sidebar } from "../sidebar";` → `import { Sidebar } from "../sidebar";` and add `import { flattenNavTree } from "@/lib/nav-tree";`.
2. Replace every `NAV_ITEMS` usage in the breadcrumb logic with a memoized flat list:

```tsx
const flatNav = useMemo(() => flattenNavTree(), []);
```

The breadcrumb lookup that previously searched `NAV_ITEMS` by `path` now searches `flatNav` the same way (the leaf shape still has `path` and `labelKey`).
3. Add `inboxCount: number` to `AdminShellProps` and pass it through: `<Sidebar inboxCount={inboxCount} roles={roles} user={user} />`.

- [ ] **Step 4: Fetch counts in the portal layout**

In `apps/admin/src/app/(portal)/layout.tsx`:

```tsx
import { getInboxCounts } from "./_actions/inbox";
```

Inside the component, after `roles`:

```tsx
const inboxCounts = await getInboxCounts().catch(() => ({
  approvals: 0,
  submissions: 0,
  total: 0,
}));
```

Pass `inboxCount={inboxCounts.total}` to `<AdminShell>`.

- [ ] **Step 5: Verify and commit**

```bash
cd apps/admin && bun test src/lib/nav-tree.test.ts && cd ../..
bun run check-types
bun run build --filter=admin
bun x ultracite fix
git add -A
git commit -m "Restructure admin sidebar into accordion tree with inbox badge"
```

Manual check: as global admin the sidebar shows exactly Overview, Inbox, Content, Shop, Organization, Analytics, System; navigating to `/settings/payments` auto-expands System and highlights Payments.

---

### Task 5: Fuzzy matching lib

**Files:**
- Create: `apps/admin/src/lib/fuzzy.ts`
- Test: `apps/admin/src/lib/fuzzy.test.ts`

**Interfaces:**
- Produces: `fuzzyScore(query: string, target: string): number | null` — `null` = no match; higher score = better match; empty query = `0`. Used by Task 9.

- [ ] **Step 1: Write the failing tests**

Create `apps/admin/src/lib/fuzzy.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { fuzzyScore } from "./fuzzy";

describe("fuzzyScore", () => {
  test("returns null when characters are missing", () => {
    expect(fuzzyScore("xyz", "Feature flags")).toBeNull();
  });

  test("empty query matches everything with score 0", () => {
    expect(fuzzyScore("", "Anything")).toBe(0);
  });

  test("is case-insensitive", () => {
    expect(fuzzyScore("FLAG", "feature flags")).not.toBeNull();
  });

  test("prefix match scores higher than scattered match", () => {
    const prefix = fuzzyScore("feat", "Feature flags");
    const scattered = fuzzyScore("felg", "Feature flags");
    if (prefix === null || scattered === null) {
      throw new Error("both should match");
    }
    expect(prefix).toBeGreaterThan(scattered);
  });

  test("word-boundary match beats mid-word match", () => {
    const boundary = fuzzyScore("fl", "Feature flags");
    const midword = fuzzyScore("ea", "Feature flags");
    if (boundary === null || midword === null) {
      throw new Error("both should match");
    }
    expect(boundary).toBeGreaterThan(midword);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/admin && bun test src/lib/fuzzy.test.ts
```

Expected: FAIL — `Cannot find module './fuzzy'`.

- [ ] **Step 3: Implement**

Create `apps/admin/src/lib/fuzzy.ts`:

```ts
const START_BONUS = 10;
const WORD_BOUNDARY_BONUS = 8;
const CONSECUTIVE_BONUS = 4;
const GAP_PENALTY = 1;
const ALNUM = /[a-z0-9]/;

/**
 * Subsequence fuzzy match. Returns null when `query` is not a subsequence of
 * `target` (case-insensitive); otherwise a score where higher is better.
 */
export function fuzzyScore(query: string, target: string): number | null {
  const q = query.trim().toLowerCase();
  if (q.length === 0) {
    return 0;
  }
  const t = target.toLowerCase();
  let score = 0;
  let searchFrom = 0;
  let prevIndex = -1;
  for (const char of q) {
    const index = t.indexOf(char, searchFrom);
    if (index === -1) {
      return null;
    }
    if (index === 0) {
      score += START_BONUS;
    } else if (!ALNUM.test(t[index - 1] ?? "")) {
      score += WORD_BOUNDARY_BONUS;
    }
    if (prevIndex !== -1 && index === prevIndex + 1) {
      score += CONSECUTIVE_BONUS;
    }
    score -= (index - searchFrom) * GAP_PENALTY;
    prevIndex = index;
    searchFrom = index + 1;
  }
  return score;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/admin && bun test src/lib/fuzzy.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
bun x ultracite fix
git add apps/admin/src/lib/fuzzy.ts apps/admin/src/lib/fuzzy.test.ts
git commit -m "Add fuzzy subsequence scorer for the command palette"
```

---

### Task 6: Recents lib + visit tracking

**Files:**
- Create: `apps/admin/src/lib/recents.ts`
- Test: `apps/admin/src/lib/recents.test.ts`
- Modify: `apps/admin/src/app/(portal)/_components/admin-shell.tsx` (track visits)

**Interfaces:**
- Consumes: `flattenNavTree`, `findActivePath` from `@/lib/nav-tree`.
- Produces (used by Task 9): `interface RecentEntry { href: string; label: string; visitedAt: number }`, `pushRecent(list: RecentEntry[], entry: RecentEntry): RecentEntry[]` (pure), `readRecents(): RecentEntry[]`, `recordRecent(entry: { href: string; label: string }): void`.

- [ ] **Step 1: Write the failing tests (pure part only)**

Create `apps/admin/src/lib/recents.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { pushRecent, type RecentEntry } from "./recents";

const entry = (href: string, visitedAt = 0): RecentEntry => ({
  href,
  label: href,
  visitedAt,
});

describe("pushRecent", () => {
  test("newest entry goes first", () => {
    const next = pushRecent([entry("/a")], entry("/b", 1));
    expect(next.map((e) => e.href)).toEqual(["/b", "/a"]);
  });

  test("revisiting moves the entry to the front without duplicating", () => {
    const next = pushRecent([entry("/a"), entry("/b")], entry("/b", 2));
    expect(next.map((e) => e.href)).toEqual(["/b", "/a"]);
  });

  test("caps the list at 5 entries", () => {
    const list = ["/1", "/2", "/3", "/4", "/5"].map((h) => entry(h));
    const next = pushRecent(list, entry("/6", 9));
    expect(next).toHaveLength(5);
    expect(next[0]?.href).toBe("/6");
    expect(next.map((e) => e.href)).not.toContain("/5");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/admin && bun test src/lib/recents.test.ts
```

Expected: FAIL — `Cannot find module './recents'`.

- [ ] **Step 3: Implement**

Create `apps/admin/src/lib/recents.ts`:

```ts
export interface RecentEntry {
  href: string;
  label: string;
  visitedAt: number;
}

const STORAGE_KEY = "biso-admin:recents";
const MAX_RECENTS = 5;

export function pushRecent(
  list: RecentEntry[],
  entry: RecentEntry
): RecentEntry[] {
  const next = [entry, ...list.filter((item) => item.href !== entry.href)];
  return next.slice(0, MAX_RECENTS);
}

function isRecentEntry(value: unknown): value is RecentEntry {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.href === "string" &&
    typeof candidate.label === "string" &&
    typeof candidate.visitedAt === "number"
  );
}

export function readRecents(): RecentEntry[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isRecentEntry).slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

export function recordRecent(entry: { href: string; label: string }): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const next = pushRecent(readRecents(), { ...entry, visitedAt: Date.now() });
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // storage unavailable (private mode/quota) — recents are best-effort
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/admin && bun test src/lib/recents.test.ts
```

Expected: PASS.

- [ ] **Step 5: Track visited sections in AdminShell**

In `apps/admin/src/app/(portal)/_components/admin-shell.tsx` (it is already `"use client"` and already calls `usePathname` for breadcrumbs — reuse that variable). Add imports:

```tsx
import { findActivePath } from "@/lib/nav-tree";
import { recordRecent } from "@/lib/recents";
```

Add an effect inside the component (t is the existing `useTranslations("adminPortal.nav")` hook):

```tsx
useEffect(() => {
  const activePath = findActivePath(pathname);
  if (!activePath) {
    return;
  }
  const item = flatNav.find((navItem) => navItem.path === activePath);
  if (item) {
    recordRecent({ href: item.path, label: t(item.labelKey) });
  }
}, [pathname, flatNav, t]);
```

- [ ] **Step 6: Verify and commit**

```bash
bun run check-types
bun x ultracite fix
git add -A
git commit -m "Add localStorage recents tracking for admin navigation"
```

---

### Task 7: Palette search scoping model (pure logic + tests)

**Files:**
- Create: `apps/admin/src/lib/palette-search-model.ts`
- Test: `apps/admin/src/lib/palette-search-model.test.ts`

**Interfaces:**
- Consumes: `Query` from `@repo/api`; `UserAuthContext` type from `@/lib/authorization`.
- Produces (used by Task 8/9):
  - `type PaletteEntityGroup = "departments" | "events" | "jobs" | "news" | "orders" | "pages" | "products"`
  - `interface PaletteSearchHit { group: PaletteEntityGroup; href: string; id: string; subtitle: string | null; title: string }`
  - `jobScopeQueries(ctx: UserAuthContext): string[]` (relationship-based, mirrors `listJobs`)
  - `departmentScopeQueries(ctx: UserAuthContext): string[]` (mirrors `listDepartments`)
  - `pickTitle(translations: unknown, fallback: string): string` (prefers `no`, then `en`)
  - `buildHitHref(group: PaletteEntityGroup, id: string): string`

- [ ] **Step 1: Verify detail-route shapes before hard-coding hrefs**

```bash
ls "apps/admin/src/app/(portal)/jobs" "apps/admin/src/app/(portal)/events" "apps/admin/src/app/(portal)/news" "apps/admin/src/app/(portal)/departments" "apps/admin/src/app/(portal)/shop" 2>/dev/null
ls "apps/admin/src/app/(editor)/pages" 2>/dev/null
```

For each entity: if an `[id]` (or similar dynamic) segment exists, the href is `/<section>/<id>`; otherwise fall back to the section list page. The `buildHitHref` code in Step 4 encodes the expected defaults — **adjust it to match what you actually find**, and note any fallback in the commit message.

- [ ] **Step 2: Write the failing tests**

Create `apps/admin/src/lib/palette-search-model.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { Query } from "@repo/api";
import type { UserAuthContext } from "@/lib/authorization";
import {
  departmentScopeQueries,
  jobScopeQueries,
  pickTitle,
} from "./palette-search-model";

function makeCtx(overrides: Partial<UserAuthContext> = {}): UserAuthContext {
  return {
    campusNames: [],
    campusTeamIds: [],
    departmentNames: [],
    departmentTeamIds: [],
    email: null,
    managedCampuses: [],
    managedCampusIds: [],
    name: null,
    resolvedCampusIds: [],
    resolvedDepartmentIds: [],
    roles: [],
    userId: "u1",
    ...overrides,
  };
}

describe("jobScopeQueries", () => {
  test("global admin without campus filter sees everything", () => {
    expect(jobScopeQueries(makeCtx({ roles: ["globaladmin"] }))).toEqual([]);
  });

  test("global admin with active campus filters by campus relationship", () => {
    expect(
      jobScopeQueries(makeCtx({ activeCampusId: "1", roles: ["globaladmin"] }))
    ).toEqual([Query.equal("campus.$id", ["1"])]);
  });

  test("campus admin filters by managed campuses", () => {
    expect(
      jobScopeQueries(
        makeCtx({ managedCampusIds: ["1", "2"], roles: ["campusadmin"] })
      )
    ).toEqual([Query.equal("campus.$id", ["1", "2"])]);
  });

  test("department user filters by department relationship", () => {
    expect(
      jobScopeQueries(makeCtx({ resolvedDepartmentIds: ["d1"] }))
    ).toEqual([Query.equal("department.$id", ["d1"])]);
  });

  test("SECURITY: unresolved scope fails closed", () => {
    const queries = jobScopeQueries(makeCtx());
    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain("__no_scope_resolved__");
  });
});

describe("departmentScopeQueries", () => {
  test("campus admin filters by campus_id", () => {
    expect(
      departmentScopeQueries(
        makeCtx({ managedCampusIds: ["3"], roles: ["campusadmin"] })
      )
    ).toEqual([Query.equal("campus_id", ["3"])]);
  });

  test("SECURITY: unresolved scope fails closed", () => {
    expect(departmentScopeQueries(makeCtx())[0]).toContain(
      "__no_scope_resolved__"
    );
  });
});

describe("pickTitle", () => {
  test("prefers Norwegian, then English, then any, then fallback", () => {
    const rows = [
      { locale: "en", title: "English" },
      { locale: "no", title: "Norsk" },
    ];
    expect(pickTitle(rows, "fb")).toBe("Norsk");
    expect(pickTitle([{ locale: "en", title: "English" }], "fb")).toBe(
      "English"
    );
    expect(pickTitle([{ locale: "de", title: "Deutsch" }], "fb")).toBe(
      "Deutsch"
    );
    expect(pickTitle([], "fb")).toBe("fb");
    expect(pickTitle(null, "fb")).toBe("fb");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd apps/admin && bun test src/lib/palette-search-model.test.ts
```

Expected: FAIL — `Cannot find module './palette-search-model'`.

- [ ] **Step 4: Implement**

Create `apps/admin/src/lib/palette-search-model.ts`:

```ts
import { Query } from "@repo/api";
import type { UserAuthContext } from "@/lib/authorization";

export type PaletteEntityGroup =
  | "departments"
  | "events"
  | "jobs"
  | "news"
  | "orders"
  | "pages"
  | "products";

export interface PaletteSearchHit {
  group: PaletteEntityGroup;
  href: string;
  id: string;
  subtitle: string | null;
  title: string;
}

/** Matches the fail-closed sentinel used by applyScopeQueries. */
const NO_SCOPE_FILTER = Query.equal("$id", "__no_scope_resolved__");

/**
 * Jobs scope by relationship (campus.$id / department.$id) — the jobs list
 * action scopes the same way; the flat campus_id column is not authoritative.
 */
export function jobScopeQueries(ctx: UserAuthContext): string[] {
  if (ctx.roles.includes("globaladmin")) {
    return ctx.activeCampusId
      ? [Query.equal("campus.$id", [ctx.activeCampusId])]
      : [];
  }
  if (ctx.roles.includes("campusadmin") && ctx.managedCampusIds.length > 0) {
    return [Query.equal("campus.$id", ctx.managedCampusIds)];
  }
  if (ctx.resolvedDepartmentIds.length > 0) {
    return [Query.equal("department.$id", ctx.resolvedDepartmentIds)];
  }
  return [NO_SCOPE_FILTER];
}

/** Departments scope by their flat campus_id column (mirrors listDepartments). */
export function departmentScopeQueries(ctx: UserAuthContext): string[] {
  if (ctx.roles.includes("globaladmin")) {
    return ctx.activeCampusId
      ? [Query.equal("campus_id", [ctx.activeCampusId])]
      : [];
  }
  if (ctx.managedCampusIds.length > 0) {
    return [Query.equal("campus_id", ctx.managedCampusIds)];
  }
  if (ctx.resolvedCampusIds.length > 0) {
    return [Query.equal("campus_id", ctx.resolvedCampusIds)];
  }
  return [NO_SCOPE_FILTER];
}

interface TranslationLike {
  locale?: string | null;
  title?: string | null;
}

export function pickTitle(translations: unknown, fallback: string): string {
  if (!Array.isArray(translations)) {
    return fallback;
  }
  const rows = translations.filter(
    (row): row is TranslationLike => typeof row === "object" && row !== null
  );
  const norwegian = rows.find((row) => row.locale === "no" && row.title);
  const english = rows.find((row) => row.locale === "en" && row.title);
  const any = rows.find((row) => row.title);
  return norwegian?.title ?? english?.title ?? any?.title ?? fallback;
}

/**
 * Adjust per Task 7 Step 1 findings: entities without an [id] detail route
 * fall back to their list page.
 */
export function buildHitHref(group: PaletteEntityGroup, id: string): string {
  switch (group) {
    case "departments":
      return `/departments/${id}`;
    case "events":
      return `/events/${id}`;
    case "jobs":
      return `/jobs/${id}`;
    case "news":
      return `/news/${id}`;
    case "orders":
      return "/shop";
    case "pages":
      return `/pages/${id}`;
    case "products":
      return `/shop/products/${id}`;
    default:
      return "/";
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd apps/admin && bun test src/lib/palette-search-model.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
bun x ultracite fix
git add apps/admin/src/lib/palette-search-model.ts apps/admin/src/lib/palette-search-model.test.ts
git commit -m "Add palette search scoping model with fail-closed role filters"
```

---

### Task 8: searchEverything server action

**Files:**
- Create: `apps/admin/src/app/(portal)/_actions/palette-search.ts`

**Interfaces:**
- Consumes: model from Task 7; `requireAuth` from `@/lib/authorization`; `applyScopeQueries` from `@/lib/utils/authorization`; `hasNavAccess` from `@/lib/roles`.
- Produces (used by Task 9): `searchEverything(rawQuery: string): Promise<PaletteSearchHit[]>`.

- [ ] **Step 1: Implement the action**

Create `apps/admin/src/app/(portal)/_actions/palette-search.ts`. Copy the exact generated-type import specifier from the top of `_actions/pages.ts` (it imports the `Pages` type — use the same module path for all row types here):

```ts
"use server";

import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
// Copy the exact specifier used by _actions/pages.ts for the Pages type:
import type {
  Departments,
  Events,
  Jobs,
  News,
  Orders,
  Pages,
  WebshopProducts,
} from "@repo/api/types/appwrite";
import { requireAuth, type UserAuthContext } from "@/lib/authorization";
import {
  buildHitHref,
  departmentScopeQueries,
  jobScopeQueries,
  type PaletteSearchHit,
  pickTitle,
} from "@/lib/palette-search-model";
import { hasNavAccess } from "@/lib/roles";
import { applyScopeQueries } from "@/lib/utils/authorization";

const LIMIT = 5;
const MIN_QUERY_LENGTH = 2;

type Db = Awaited<ReturnType<typeof createSessionClient>>["db"];

async function searchJobs(
  db: Db,
  ctx: UserAuthContext,
  q: string
): Promise<PaletteSearchHit[]> {
  // jobs' translation relationship key is `translations` (not translation_refs)
  const rows = await db.listRows<Jobs>("app", "jobs", [
    Query.select(["*", "translations.*"]),
    Query.search("translations.title", q),
    Query.limit(LIMIT),
    ...jobScopeQueries(ctx),
  ]);
  return rows.rows.map((row) => ({
    group: "jobs" as const,
    href: buildHitHref("jobs", row.$id),
    id: row.$id,
    subtitle: row.status ?? null,
    title: pickTitle(row.translations, row.$id),
  }));
}

async function searchEvents(
  db: Db,
  ctx: UserAuthContext,
  q: string
): Promise<PaletteSearchHit[]> {
  const rows = await db.listRows<Events>("app", "events", [
    Query.select(["*", "translation_refs.*"]),
    Query.search("translation_refs.title", q),
    Query.limit(LIMIT),
    ...applyScopeQueries(ctx, { departmentField: null }),
  ]);
  return rows.rows.map((row) => ({
    group: "events" as const,
    href: buildHitHref("events", row.$id),
    id: row.$id,
    subtitle: row.status ?? null,
    title: pickTitle(row.translation_refs, row.$id),
  }));
}

async function searchNews(
  db: Db,
  ctx: UserAuthContext,
  q: string
): Promise<PaletteSearchHit[]> {
  const rows = await db.listRows<News>("app", "news", [
    Query.select(["*", "translation_refs.*"]),
    Query.search("translation_refs.title", q),
    Query.limit(LIMIT),
    ...applyScopeQueries(ctx),
  ]);
  return rows.rows.map((row) => ({
    group: "news" as const,
    href: buildHitHref("news", row.$id),
    id: row.$id,
    subtitle: row.status ?? null,
    title: pickTitle(row.translation_refs, row.$id),
  }));
}

async function searchPages(
  db: Db,
  ctx: UserAuthContext,
  q: string
): Promise<PaletteSearchHit[]> {
  // page_translations has no fulltext index — contains() does substring match
  const rows = await db.listRows<Pages>("app", "pages", [
    Query.select(["*", "translation_refs.*"]),
    Query.contains("translation_refs.title", q),
    Query.limit(LIMIT),
    ...applyScopeQueries(ctx),
  ]);
  return rows.rows.map((row) => ({
    group: "pages" as const,
    href: buildHitHref("pages", row.$id),
    id: row.$id,
    subtitle: row.status ?? null,
    title: pickTitle(row.translation_refs, row.$id),
  }));
}

async function searchDepartments(
  db: Db,
  ctx: UserAuthContext,
  q: string
): Promise<PaletteSearchHit[]> {
  const rows = await db.listRows<Departments>("app", "departments", [
    Query.search("Name", q),
    Query.limit(LIMIT),
    ...departmentScopeQueries(ctx),
  ]);
  return rows.rows.map((row) => ({
    group: "departments" as const,
    href: buildHitHref("departments", row.$id),
    id: row.$id,
    subtitle: row.campus_id ?? null,
    title: row.Name,
  }));
}

async function searchProducts(
  db: Db,
  ctx: UserAuthContext,
  q: string
): Promise<PaletteSearchHit[]> {
  const rows = await db.listRows<WebshopProducts>("app", "webshop_products", [
    Query.select(["*", "translation_refs.*"]),
    Query.search("translation_refs.title", q),
    Query.limit(LIMIT),
    // webshop_products uses camelCase departmentId
    ...applyScopeQueries(ctx, { departmentField: "departmentId" }),
  ]);
  return rows.rows.map((row) => ({
    group: "products" as const,
    href: buildHitHref("products", row.$id),
    id: row.$id,
    subtitle: row.status ?? null,
    title: pickTitle(row.translation_refs, row.slug),
  }));
}

async function searchOrders(
  db: Db,
  ctx: UserAuthContext,
  q: string
): Promise<PaletteSearchHit[]> {
  const rows = await db.listRows<Orders>("app", "orders", [
    Query.or([
      Query.contains("buyer_name", q),
      Query.contains("buyer_email", q),
    ]),
    Query.limit(LIMIT),
    // orders is campus-scoped only (no department column)
    ...applyScopeQueries(ctx, { departmentField: null }),
  ]);
  return rows.rows.map((row) => ({
    group: "orders" as const,
    href: buildHitHref("orders", row.$id),
    id: row.$id,
    subtitle: row.status ?? null,
    title: row.buyer_name ?? row.buyer_email ?? row.$id,
  }));
}

export async function searchEverything(
  rawQuery: string
): Promise<PaletteSearchHit[]> {
  const ctx = await requireAuth();
  const q = rawQuery.trim();
  if (q.length < MIN_QUERY_LENGTH) {
    return [];
  }
  const { db } = await createSessionClient();
  const canShop = hasNavAccess(
    "portal.shop",
    ctx.roles,
    ctx.departmentTeamIds.length > 0
  );

  const tasks = [
    searchJobs(db, ctx, q),
    searchEvents(db, ctx, q),
    searchNews(db, ctx, q),
    searchPages(db, ctx, q),
    searchDepartments(db, ctx, q),
    ...(canShop ? [searchProducts(db, ctx, q), searchOrders(db, ctx, q)] : []),
  ];
  const settled = await Promise.allSettled(tasks);
  // Failures degrade silently — search is additive, never blocking.
  return settled.flatMap((result) =>
    result.status === "fulfilled" ? result.value : []
  );
}
```

- [ ] **Step 2: Verify types and build**

```bash
bun run check-types
bun run build --filter=admin
```

Expected: both PASS. If a generated row type lacks a field used above (e.g. `translations` on `Jobs`), check `packages/api/types/appwrite.ts` for the actual property name and fix the accessor — do NOT edit the generated file.

- [ ] **Step 3: Manual smoke test**

Run `bun run dev --filter=admin`, log in as a global admin, and in a browser console on `http://localhost:3001` you can't call the action directly — instead defer full verification to Task 9's palette UI. For now confirm the build/dev server has no runtime import errors.

- [ ] **Step 4: Commit**

```bash
bun x ultracite fix
git add "apps/admin/src/app/(portal)/_actions/palette-search.ts"
git commit -m "Add cross-entity palette search action with role-scoped queries"
```

---

### Task 9: Command palette rewrite

**Files:**
- Modify: `apps/admin/src/app/(portal)/_components/command-palette.tsx`
- Modify: `apps/admin/src/app/(portal)/_components/admin-shell.tsx` (pass `aiCopilotEnabled`)
- Modify: `apps/admin/src/lib/roles.ts` (remove `portal.approvals` / `portal.submissions`)

**Interfaces:**
- Consumes: `fuzzyScore` (Task 5), `readRecents`/`recordRecent` (Task 6), `searchEverything` + `PaletteSearchHit` (Task 8), `setCampusFilter` from `@/lib/actions/campus`, `useDebounce` from `@repo/ui/hooks/use-debounce` (copy exact specifier from `(portal)/it/users/_components/user-detail-client.tsx`), `OPEN_ASSISTANT_EVENT` from `./assistant/assistant-widget`.
- Produces: `CommandPalette` props become `{ aiCopilotEnabled: boolean; roles: UserRolesForClient }`. Dispatches `CustomEvent(OPEN_ASSISTANT_EVENT, { detail: { prompt } })` (listener added in Task 10).

- [ ] **Step 1: Update ALL_COMMANDS**

In `command-palette.tsx`, replace the `ALL_COMMANDS` array so navigation matches the new IA (all `navKey`s must exist in `NAV_ACCESS`):

```ts
const ALL_COMMANDS: PaletteCommand[] = [
  // Navigate
  { group: "navigate", href: "/", icon: LayoutDashboard, id: "nav-overview", label: "Overview", navKey: "portal.dashboard" },
  { group: "navigate", href: "/inbox", icon: Inbox, id: "nav-inbox", label: "Inbox", navKey: "portal.inbox" },
  { group: "navigate", href: "/inbox/approvals", icon: ClipboardList, id: "nav-approvals", label: "Approvals", navKey: "portal.inbox" },
  { group: "navigate", href: "/inbox/submissions", icon: Inbox, id: "nav-submissions", label: "Form Submissions", navKey: "portal.inbox" },
  { group: "navigate", href: "/jobs", icon: Briefcase, id: "nav-jobs", label: "Jobs", navKey: "portal.jobs" },
  { group: "navigate", href: "/events", icon: Calendar, id: "nav-events", label: "Events", navKey: "portal.events" },
  { group: "navigate", href: "/news", icon: Newspaper, id: "nav-news", label: "News", navKey: "portal.news" },
  { group: "navigate", href: "/communications", icon: Megaphone, id: "nav-communications", label: "Communications", navKey: "portal.communications" },
  { group: "navigate", href: "/benefits", icon: Gift, id: "nav-benefits", label: "Benefits", navKey: "portal.benefits" },
  { group: "navigate", href: "/shop", icon: ShoppingCart, id: "nav-shop", label: "Shop", navKey: "portal.shop" },
  { group: "navigate", href: "/pages", icon: Layers, id: "nav-pages", label: "Pages", navKey: "portal.pages" },
  { group: "navigate", href: "/drafts", icon: FileStack, id: "nav-drafts", label: "Drafts", navKey: "portal.drafts" },
  { group: "navigate", href: "/departments", icon: Building2, id: "nav-departments", label: "Departments", navKey: "portal.departments" },
  { group: "navigate", href: "/documents", icon: FileText, id: "nav-documents", label: "Documents", navKey: "portal.documents" },
  { group: "navigate", href: "/activity", icon: Activity, id: "nav-activity", label: "Activity", navKey: "portal.activity" },
  { group: "navigate", href: "/analytics", icon: LineChart, id: "nav-analytics", label: "Analytics", navKey: "portal.analytics" },
  { group: "navigate", href: "/it", icon: HardDrive, id: "nav-it", label: "IT Console", navKey: "portal.it" },
  { group: "navigate", href: "/settings/operations", icon: Gauge, id: "nav-operations", label: "Operations health", navKey: "portal.settings" },
  { group: "navigate", href: "/settings/feature-flags", icon: Flag, id: "nav-feature-flags", label: "Feature flags", navKey: "portal.settings" },
  { group: "navigate", href: "/settings/payments", icon: CreditCard, id: "nav-payment-settings", label: "Payment settings", navKey: "portal.settings" },
  { group: "navigate", href: "/settings", icon: Settings, id: "nav-settings", label: "Settings", navKey: "portal.settings" },
  // Create
  { group: "create", href: "/jobs/new", icon: Plus, id: "new-job", label: "New Job Posting", navKey: "portal.jobs" },
  { group: "create", href: "/events/new", icon: Plus, id: "new-event", label: "New Event", navKey: "portal.events" },
  { group: "create", href: "/news/new", icon: Plus, id: "new-news", label: "New News Article", navKey: "portal.news" },
  // Account
  { group: "account", icon: LogOut, id: "sign-out", label: "Sign Out" },
];
```

Add lucide imports used above that aren't yet imported: `Inbox`, `ClipboardList`, `Megaphone`, `LineChart`, `Building2` (drop any that become unused). Remove the old static `open-assistant` command from the array (the AI row becomes dynamic — Step 4).

- [ ] **Step 2: Add campus-switch commands and new props**

Update the component signature:

```tsx
export function CommandPalette({
  aiCopilotEnabled,
  roles,
}: {
  aiCopilotEnabled: boolean;
  roles: UserRolesForClient;
}) {
```

Add imports:

```tsx
import { MapPin } from "lucide-react";
import { setCampusFilter } from "@/lib/actions/campus";
import { fuzzyScore } from "@/lib/fuzzy";
import { readRecents, recordRecent, type RecentEntry } from "@/lib/recents";
import { searchEverything } from "../_actions/palette-search";
import type { PaletteSearchHit } from "@/lib/palette-search-model";
import { OPEN_ASSISTANT_EVENT } from "./assistant/assistant-widget";
```

Plus `useDebounce` (exact specifier copied from `it/users/_components/user-detail-client.tsx`).

Inside the component, build campus commands for global admins (list matches the sidebar's hard-coded campuses):

```tsx
const campusCommands: PaletteCommand[] = roles.isGlobalAdmin
  ? [...["Oslo", "Bergen", "Trondheim", "Stavanger"], null].map((campus) => ({
      action: async () => {
        await setCampusFilter(campus);
        router.refresh();
      },
      group: "navigate" as const,
      icon: MapPin,
      id: `campus-${campus ?? "all"}`,
      label: campus ? `Switch campus: ${campus}` : "Switch campus: All campuses",
    }))
  : [];
```

Include them in the visible list: `const visible = [...ALL_COMMANDS.filter(...), ...campusCommands];` (keep the existing `hasNavAccess` filter for commands with a `navKey`).

- [ ] **Step 3: Fuzzy filtering + async entity search + recents state**

Replace the exact-substring `filtered` computation with fuzzy scoring, and add search state:

```tsx
const [results, setResults] = useState<PaletteSearchHit[]>([]);
const [searchState, setSearchState] = useState<"error" | "idle" | "loading">("idle");
const [recents, setRecents] = useState<RecentEntry[]>([]);
const debouncedQuery = useDebounce(query, 200);

useEffect(() => {
  if (open) {
    setRecents(readRecents());
  }
}, [open]);

useEffect(() => {
  const q = debouncedQuery.trim();
  if (!open || q.length < 2) {
    setResults([]);
    setSearchState("idle");
    return;
  }
  let cancelled = false;
  setSearchState("loading");
  searchEverything(q)
    .then((hits) => {
      if (!cancelled) {
        setResults(hits);
        setSearchState("idle");
      }
    })
    .catch(() => {
      if (!cancelled) {
        setResults([]);
        setSearchState("error");
      }
    });
  return () => {
    cancelled = true;
  };
}, [debouncedQuery, open]);

const filtered = useMemo(() => {
  const q = query.trim();
  if (!q) {
    return visible;
  }
  return visible
    .map((cmd) => ({ cmd, score: fuzzyScore(q, cmd.label) }))
    .filter((entry): entry is { cmd: PaletteCommand; score: number } => entry.score !== null)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.cmd);
}, [query, visible]);
```

Reset `results`/`searchState` inside the existing `close()` callback.

- [ ] **Step 4: Unified row model (recents + commands + entity hits + AI row)**

Replace the `groups`/`flatItems` computation with a single row list that keyboard navigation walks over:

```tsx
type PaletteRow =
  | { kind: "ai"; prompt: string }
  | { kind: "command"; command: PaletteCommand }
  | { kind: "hit"; hit: PaletteSearchHit }
  | { kind: "recent"; recent: RecentEntry };

const rows = useMemo(() => {
  const list: PaletteRow[] = [];
  if (!query.trim()) {
    for (const recent of recents) {
      list.push({ kind: "recent", recent });
    }
  }
  for (const command of filtered) {
    list.push({ kind: "command", command });
  }
  for (const hit of results) {
    list.push({ kind: "hit", hit });
  }
  if (aiCopilotEnabled) {
    list.push({ kind: "ai", prompt: query.trim() });
  }
  return list;
}, [query, recents, filtered, results, aiCopilotEnabled]);
```

`handleSelect` becomes:

```tsx
async function handleSelect(row: PaletteRow) {
  close();
  if (row.kind === "ai") {
    window.dispatchEvent(
      new CustomEvent(OPEN_ASSISTANT_EVENT, {
        detail: row.prompt ? { prompt: row.prompt } : undefined,
      })
    );
    return;
  }
  if (row.kind === "recent") {
    recordRecent({ href: row.recent.href, label: row.recent.label });
    router.push(row.recent.href);
    return;
  }
  if (row.kind === "hit") {
    recordRecent({ href: row.hit.href, label: row.hit.title });
    router.push(row.hit.href);
    return;
  }
  const { command } = row;
  if (command.id === "sign-out") {
    await signOut();
    router.push("/auth/login");
    return;
  }
  if (command.action) {
    await command.action();
    return;
  }
  if (command.href) {
    recordRecent({ href: command.href, label: command.label });
    router.push(command.href);
  }
}
```

Update keyboard navigation (`cursor` math and Enter handling) to use `rows.length` / `rows[cursor]`, and update `PaletteCommand.action` type to `(() => void | Promise<void>)`.

- [ ] **Step 5: Render the new sections**

Render order inside the scroll area, reusing the existing group-header + row-button styles (`MONO_STACK` headers, `data-palette-idx` buttons):

1. **Recent** (only when query empty and `recents.length > 0`) — header "Recent", rows with a `Clock` icon (add to lucide imports), label = `recent.label`.
2. **Commands** grouped by their `group` field exactly as today (Navigate / Create / Account labels from `GROUP_LABELS`; remove the `ai` group from `GROUP_LABELS`).
3. **Results** (when `results.length > 0`) — one header per entity group present, labels: `{ departments: "Departments", events: "Events", jobs: "Jobs", news: "News", orders: "Orders", pages: "Pages", products: "Products" }`. Each row: icon per group (Briefcase/Calendar/Newspaper/Layers/Building2/ShoppingCart/CreditCard), `hit.title` as label, `hit.subtitle` rendered dimmed to the right. Anchor for one group's rows (reuses the exact command-row button styling already in the file — same `data-palette-idx`, `onMouseEnter`, active-background pattern):

```tsx
{hitsInGroup.map((hit) => {
  const flatIdx = rowIndexOf({ kind: "hit", hit }); // sequential index within `rows`
  const isActive = flatIdx === cursor;
  const Icon = HIT_ICONS[hit.group];
  return (
    <button
      data-palette-idx={flatIdx}
      key={`${hit.group}-${hit.id}`}
      onClick={() => handleSelect({ kind: "hit", hit })}
      onMouseEnter={() => setCursor(flatIdx)}
      style={/* same style object as existing command rows */}
      type="button"
    >
      <Icon size={15} />
      <span style={{ flex: 1, minWidth: 0 }}>{hit.title}</span>
      {hit.subtitle && (
        <span style={{ color: isActive ? STUDIO.paper : STUDIO.ink4, fontSize: "11px" }}>
          {hit.subtitle}
        </span>
      )}
    </button>
  );
})}
```

(Implementation freedom: computing `flatIdx` can also be done by rendering from a pre-grouped `rows` walk instead of `rowIndexOf` — whatever keeps indices sequential with the keyboard `cursor`.)
4. **Loading/error line**: when `searchState === "loading"` show a dim "Searching…" row; when `"error"` show "Search unavailable" (both non-interactive, MONO_STACK, `color: STUDIO.ink4`, excluded from `rows`).
5. **Ask BISO Assistant** (when `aiCopilotEnabled`) — always the last interactive row, `Sparkles` icon, label: `` query.trim() ? `Ask BISO Assistant: “${query.trim()}”` : "Open BISO Assistant" ``.

Keep the `data-palette-idx` scroll-into-view mechanism — every interactive row gets its sequential index from `rows`.

- [ ] **Step 6: Pass aiCopilotEnabled from AdminShell**

In `admin-shell.tsx`: `<CommandPalette aiCopilotEnabled={aiCopilotEnabled} roles={roles} />` (the prop already exists on `AdminShellProps`).

- [ ] **Step 7: Remove the now-unused nav keys**

In `apps/admin/src/lib/roles.ts`, delete the `"portal.approvals"` and `"portal.submissions"` entries from `NAV_ACCESS`. Then:

```bash
bun run check-types
```

Expected: PASS. If any file still references the deleted keys, migrate it to `"portal.inbox"`.

- [ ] **Step 8: Verify and commit**

```bash
cd apps/admin && bun test && cd ../..
bun run check-types
bun run build --filter=admin
bun x ultracite fix
git add -A
git commit -m "Upgrade command palette with fuzzy matching, recents, entity search and AI handoff"
```

Manual check: ⌘K → type a known job title fragment → grouped results appear and Enter jumps to it; empty query shows Recent section after some navigation; "Switch campus: Bergen" appears for global admins and refreshes data; last row reads Ask BISO Assistant.

---

### Task 10: Assistant prompt handoff

**Files:**
- Modify: `apps/admin/src/app/(portal)/_components/assistant/assistant-widget.tsx`
- Modify: `apps/admin/src/app/(portal)/sidebar.tsx` (use the exported constant)

**Interfaces:**
- Consumes: `OPEN_ASSISTANT_EVENT` constant (already exported at assistant-widget.tsx:21); `CustomEvent<{ prompt?: string }>` dispatched by Task 9.
- Produces: opening the assistant with `detail.prompt` auto-submits that prompt once the chat is idle.

- [ ] **Step 1: Extend the open-event listener**

In `assistant-widget.tsx`, add state near the other `useState` calls (~line 391):

```tsx
const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
```

Replace the existing open-event effect (~lines 401–408) with:

```tsx
// Open via DOM event (from sidebar, command palette, shortcut).
// A CustomEvent detail.prompt is auto-submitted once the chat is idle.
useEffect(() => {
  function onOpen(event: Event) {
    setOpen(true);
    const prompt = (event as CustomEvent<{ prompt?: string } | undefined>)
      .detail?.prompt;
    if (typeof prompt === "string" && prompt.trim()) {
      setPendingPrompt(prompt.trim());
    }
  }
  window.addEventListener(OPEN_ASSISTANT_EVENT, onOpen);
  return () => window.removeEventListener(OPEN_ASSISTANT_EVENT, onOpen);
}, []);
```

- [ ] **Step 2: Auto-submit the pending prompt**

Add a second effect after the one above (mirrors `sendSuggestion`, ~lines 500–513 — reuse its exact body shape):

```tsx
useEffect(() => {
  if (!(open && pendingPrompt) || isLoading) {
    return;
  }
  setPendingPrompt(null);
  sendMessage(
    { text: pendingPrompt },
    {
      body: {
        activeFormSchemaId: getActiveFormSchemaId(),
        currentPath: pathname,
      },
    }
  );
}, [open, pendingPrompt, isLoading, sendMessage, pathname]);
```

(If the linter demands `getActiveFormSchemaId` in deps and it's a stable import, add it.)

- [ ] **Step 3: Use the constant at the other dispatch sites**

In `sidebar.tsx`, the "Ask BISO Assistant" button (~line 380): replace `window.dispatchEvent(new Event("admin:open-assistant"))` with:

```tsx
import { OPEN_ASSISTANT_EVENT } from "./_components/assistant/assistant-widget";
// ...
onClick={() => window.dispatchEvent(new Event(OPEN_ASSISTANT_EVENT))}
```

- [ ] **Step 4: Verify and commit**

```bash
bun run check-types
bun run build --filter=admin
bun x ultracite fix
git add -A
git commit -m "Auto-submit palette queries handed off to the BISO assistant"
```

Manual check: ⌘K → type "how many pending approvals do I have" → Enter on the AI row → assistant panel opens and the question is submitted automatically.

---

### Task 11: New assistant tool groups in @repo/ai

**Files:**
- Create: `packages/ai/src/assistant/tools/shop.ts`
- Create: `packages/ai/src/assistant/tools/ops.ts`
- Create: `packages/ai/src/assistant/tools/analytics.ts`
- Modify: `packages/ai/src/assistant/tools/index.ts`

**Interfaces:**
- Consumes: `AssistantActionDeps` from `../types`; `tool` from `ai`; `z` from `zod`.
- Produces: `buildShopTools(deps)`, `buildOpsTools(deps)`, `buildAnalyticsTools(deps)` — registered in `buildAssistantTools`. Dep keys the route must provide (Task 12): `searchOrders`, `getOrderSummary`, `lookupCustomer`, `getOpsHealth`, `getInboxCounts`, `getAnalyticsSummary`.

- [ ] **Step 1: Create shop tools**

Create `packages/ai/src/assistant/tools/shop.ts`:

```ts
import { tool } from "ai";
import { z } from "zod";
import type { AssistantActionDeps } from "../types";

export function buildShopTools(deps: AssistantActionDeps) {
  return {
    searchOrders: tool({
      description:
        "Search webshop orders by buyer name, email or order id, optionally filtered by status. Results are scoped to the user's campus automatically.",
      inputSchema: z.object({
        query: z
          .string()
          .optional()
          .describe("Buyer name, email or order id fragment"),
        status: z
          .enum(["pending", "authorized", "paid", "cancelled", "failed", "refunded"])
          .optional()
          .describe("Filter by order status"),
      }),
      execute: async ({ query, status }) => {
        try {
          const result = await (
            deps.searchOrders as (input: unknown) => Promise<unknown>
          )({ query, status });
          return { success: true, data: result };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Order search failed",
          };
        }
      },
    }),
    getOrderSummary: tool({
      description:
        "Get a full summary of one order: status, totals, payment provider, buyer and line items.",
      inputSchema: z.object({
        orderId: z.string().describe("The order row $id"),
      }),
      execute: async ({ orderId }) => {
        try {
          const result = await (
            deps.getOrderSummary as (input: unknown) => Promise<unknown>
          )({ orderId });
          return { success: true, data: result };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error ? error.message : "Order lookup failed",
          };
        }
      },
    }),
    lookupCustomer: tool({
      description:
        "Look up a customer/member profile by name or email: campus, student id, membership ids. Only available to global admins.",
      inputSchema: z.object({
        query: z.string().min(2).describe("Name or email fragment"),
      }),
      execute: async ({ query }) => {
        try {
          const result = await (
            deps.lookupCustomer as (input: unknown) => Promise<unknown>
          )({ query });
          return { success: true, data: result };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error ? error.message : "Customer lookup failed",
          };
        }
      },
    }),
  };
}
```

- [ ] **Step 2: Create ops tools**

Create `packages/ai/src/assistant/tools/ops.ts`:

```ts
import { tool } from "ai";
import { z } from "zod";
import type { AssistantActionDeps } from "../types";

export function buildOpsTools(deps: AssistantActionDeps) {
  return {
    getInboxCounts: tool({
      description:
        "Get the current user's pending inbox counts: approval requests awaiting review and new form submissions. Use for questions like 'what needs my attention?'.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const result = await (
            deps.getInboxCounts as () => Promise<unknown>
          )();
          return { success: true, data: result };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error ? error.message : "Inbox counts failed",
          };
        }
      },
    }),
    getOpsHealth: tool({
      description:
        "Get platform operations health: required Appwrite teams status and external integration health (Microsoft 365, SharePoint, Vipps, etc.). Only available to global admins.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const result = await (deps.getOpsHealth as () => Promise<unknown>)();
          return { success: true, data: result };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error ? error.message : "Ops health failed",
          };
        }
      },
    }),
  };
}
```

- [ ] **Step 3: Create analytics tools**

Create `packages/ai/src/assistant/tools/analytics.ts`:

```ts
import { tool } from "ai";
import { z } from "zod";
import type { AssistantActionDeps } from "../types";

export function buildAnalyticsTools(deps: AssistantActionDeps) {
  return {
    getAnalyticsSummary: tool({
      description:
        "Get web.biso.no traffic analytics for a period: pageviews, visitors, top pages and total events. Answers 'how is the site doing?'. Only available to global admins.",
      inputSchema: z.object({
        range: z
          .enum(["7d", "30d", "90d"])
          .default("30d")
          .describe("Reporting period"),
      }),
      execute: async ({ range }) => {
        try {
          const result = await (
            deps.getAnalyticsSummary as (input: unknown) => Promise<unknown>
          )({ range });
          return { success: true, data: result };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error ? error.message : "Analytics fetch failed",
          };
        }
      },
    }),
  };
}
```

- [ ] **Step 4: Register the groups**

In `packages/ai/src/assistant/tools/index.ts`, add imports:

```ts
import { buildAnalyticsTools } from "./analytics";
import { buildOpsTools } from "./ops";
import { buildShopTools } from "./shop";
```

After the existing capability gates in `buildAssistantTools`, add:

```ts
if (capabilities.domains.shop === "publish") {
  Object.assign(tools, buildShopTools(deps));
}
if (capabilities.canApprove) {
  Object.assign(tools, buildOpsTools(deps));
}
if (capabilities.settings) {
  Object.assign(tools, buildAnalyticsTools(deps));
}
```

(No `AssistantCapabilities` type changes needed — existing flags cover all three gates. Real enforcement lives in the deps, Task 12.)

- [ ] **Step 5: Verify and commit**

```bash
bun run check-types
bun x ultracite fix
git add packages/ai/src/assistant/tools/
git commit -m "Add shop, ops and analytics read tools to the assistant toolset"
```

---

### Task 12: Wire assistant deps + prompt route map

**Files:**
- Modify: `apps/admin/src/app/api/assistant/route.ts` (buildDeps additions)
- Modify: `packages/ai/src/assistant/prompt.ts` (route map)
- Modify: `apps/admin/README.md` (line ~19 mentions `/approvals`)

**Interfaces:**
- Consumes: `listOrders` from `(portal)/_actions/shop`; `getInboxCounts` from `(portal)/_actions/inbox` (Task 2); `fetchRequiredTeamHealth` from `@/lib/team-health-check`; `checkIntegrationHealth` from `@/lib/integration-health`; `fetchStats`, `fetchTopMetrics`, `fetchEventsTotal` and range types from `@/lib/umami/client`; `createSessionClient`/`Query` from `@repo/api`.
- Produces: dep keys `searchOrders`, `getOrderSummary`, `lookupCustomer`, `getOpsHealth`, `getInboxCounts`, `getAnalyticsSummary` inside `buildDeps()`.

- [ ] **Step 1: Add module-level helpers to the route file**

In `apps/admin/src/app/api/assistant/route.ts` (a route handler — non-async module-level helpers are fine here), add near the other imports:

```ts
import type { Orders } from "@repo/api/types/appwrite"; // copy exact specifier from _actions/pages.ts
import { getInboxCounts } from "@/app/(portal)/_actions/inbox";
import { listOrders } from "@/app/(portal)/_actions/shop";
import { checkIntegrationHealth } from "@/lib/integration-health";
import { fetchRequiredTeamHealth } from "@/lib/team-health-check";
import {
  fetchEventsTotal,
  fetchStats,
  fetchTopMetrics,
} from "@/lib/umami/client";
```

(Adjust the `_actions` import paths to the app's conventions — the route file already imports other `(portal)/_actions` modules; copy that path style, e.g. relative `../../(portal)/_actions/shop`.)

Add helpers above `buildDeps`:

```ts
const MAX_ORDER_RESULTS = 10;
const DAY_MS = 86_400_000;
const RANGE_DAYS: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };

function toOrderSummary(order: Orders) {
  return {
    buyerEmail: order.buyer_email ?? null,
    buyerName: order.buyer_name ?? null,
    campusId: order.campus_id ?? null,
    createdAt: order.$createdAt,
    currency: order.currency ?? "NOK",
    id: order.$id,
    paymentProvider: order.payment_provider ?? null,
    status: order.status ?? null,
    total: order.total,
  };
}

function parseOrderItems(itemsJson: string | null | undefined): unknown {
  if (!itemsJson) {
    return [];
  }
  try {
    return JSON.parse(itemsJson);
  } catch {
    return [];
  }
}
```

- [ ] **Step 2: Add the six deps inside buildDeps()**

Inside the object returned by `buildDeps(...)` in the same file (follow the existing entry style; `ctx` is in scope):

```ts
searchOrders: async (input: unknown) => {
  const { query, status } = (input ?? {}) as { query?: string; status?: string };
  const rows = await listOrders({ status });
  const q = query?.trim().toLowerCase();
  const filtered = q
    ? rows.filter((order) =>
        [order.buyer_name, order.buyer_email, order.$id].some((value) =>
          value?.toLowerCase().includes(q)
        )
      )
    : rows;
  return filtered.slice(0, MAX_ORDER_RESULTS).map(toOrderSummary);
},
getOrderSummary: async (input: unknown) => {
  const { orderId } = (input ?? {}) as { orderId?: string };
  if (!orderId) {
    throw new Error("orderId is required");
  }
  // Session client — row security limits access to permitted orders.
  const { db } = await createSessionClient();
  const order = await db.getRow<Orders>("app", "orders", orderId);
  return { ...toOrderSummary(order), items: parseOrderItems(order.items_json) };
},
lookupCustomer: async (input: unknown) => {
  if (!ctx.roles.includes("globaladmin")) {
    throw new Error("Forbidden: customer lookup is global-admin only");
  }
  const { query } = (input ?? {}) as { query?: string };
  const q = query?.trim();
  if (!q || q.length < 2) {
    throw new Error("query must be at least 2 characters");
  }
  const { db } = await createSessionClient();
  const result = await db.listRows("app", "user", [
    Query.or([Query.contains("name", q), Query.contains("email", q)]),
    Query.limit(5),
  ]);
  return result.rows.map((row) => ({
    campusId: (row as { campus_id?: string }).campus_id ?? null,
    email: (row as { email?: string }).email ?? null,
    id: row.$id,
    membershipIds: (row as { membership_ids?: string[] }).membership_ids ?? [],
    name: (row as { name?: string }).name ?? null,
    studentId: (row as { student_id?: unknown }).student_id ?? null,
  }));
},
getOpsHealth: async () => {
  if (!ctx.roles.includes("globaladmin")) {
    throw new Error("Forbidden: ops health is global-admin only");
  }
  const [teams, integrations] = await Promise.all([
    fetchRequiredTeamHealth(),
    checkIntegrationHealth(),
  ]);
  return { integrations, teams };
},
getInboxCounts: async () => await getInboxCounts(),
getAnalyticsSummary: async (input: unknown) => {
  if (!ctx.roles.includes("globaladmin")) {
    throw new Error("Forbidden: analytics is global-admin only");
  }
  const { range } = (input ?? {}) as { range?: string };
  const days = RANGE_DAYS[range ?? "30d"] ?? 30;
  const endAt = Date.now();
  const umamiRange = { endAt, startAt: endAt - days * DAY_MS };
  const [stats, topPages, eventsTotal] = await Promise.all([
    fetchStats(umamiRange),
    fetchTopMetrics(umamiRange, "path", 5),
    fetchEventsTotal(umamiRange),
  ]);
  if (!stats) {
    return { configured: false, message: "Analytics (Umami) is not configured or unreachable." };
  }
  return { configured: true, days, eventsTotal, stats, topPages };
},
```

Type-check notes: if `checkIntegrationHealth` is sync, drop it from the `Promise.all` and call it directly (verify its signature in `@/lib/integration-health`). There is a naming collision between the imported `getInboxCounts` action and the dep key — if TypeScript complains, alias the import: `import { getInboxCounts as getInboxCountsAction } from ...` and use `getInboxCounts: async () => await getInboxCountsAction(),`.

- [ ] **Step 3: Update the prompt route map**

In `packages/ai/src/assistant/prompt.ts` (~lines 67–74), update the "Content routes (for navigation)" block: replace the `/approvals — Approval inbox` entry with `/inbox — Inbox (approvals + form submissions)`, and append:

```
- /analytics — Analytics (globaladmin)
- /settings/operations — Operations health  |  /settings/feature-flags — Feature flags  |  /settings/payments — Payment settings (all globaladmin)
```

Keep the existing format of that block (one `- route — label` list, pipe-separated pairs are fine).

- [ ] **Step 4: Update README mention**

In `apps/admin/README.md` (~line 19), change the `/approvals` mention to `/inbox/approvals`.

- [ ] **Step 5: Verify and commit**

```bash
bun run check-types
bun run build --filter=admin
bun x ultracite fix
git add -A
git commit -m "Wire shop, ops and analytics deps into the admin assistant route"
```

Manual check (dev server, global admin): ask the assistant "what needs my attention?" → it calls getInboxCounts and answers with pending counts; "how is the site doing this month?" → analytics summary or a clean not-configured answer.

---

### Task 13: Full verification sweep

**Files:** none (verification only; fix-forward anything found)

- [ ] **Step 1: Automated gates**

```bash
find apps -path '*/.next/*' -name '* [0-9].*' -delete
bun run check-types
bun run build --filter=admin
cd apps/admin && bun test && cd ../..
bun x ultracite check
```

Expected: all PASS (ultracite may list pre-existing issues in untouched files — only fix ones introduced by this work).

- [ ] **Step 2: Manual smoke checklist (dev server, global admin)**

- Sidebar shows exactly: Overview, Inbox (badge if pending), Content ▸, Shop, Organization ▸, Analytics, System ▸.
- Old URLs redirect: `/approvals`, `/submissions`, `/submissions/<topic>`, `/operations`, `/feature-flags`, `/payment-settings`.
- `/inbox` lands on the busier tab; tabs show counts; approve/reject and submission status changes still work (revalidate correctly).
- `/settings` shows the sub-nav; all four tabs render.
- ⌘K: fuzzy command match, entity search with grouped results, Recent section on empty query, campus switch works, AI row hands off and auto-submits.
- Assistant answers inbox counts / ops health / analytics / order search questions (role-gated correctly — test a campus-admin account cannot use analytics or lookupCustomer).

- [ ] **Step 3: Final commit if the sweep produced fixes**

```bash
git add -A
git commit -m "Fix issues found in nav and palette verification sweep"
```

(Skip if the working tree is clean.)
