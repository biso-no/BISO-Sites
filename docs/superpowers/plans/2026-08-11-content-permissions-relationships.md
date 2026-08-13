# Content Permissions and Relationships Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Appwrite relationships the canonical content-ownership and translation links, authorize all admin publishing operations in server code, allow department-scoped publishing, and retain HR/global-only recruitment access.

**Architecture:** The admin portal becomes a scoped service boundary: Server Actions authenticate the session, resolve campus/department relationships, authorize persisted and requested scope, then use the Appwrite admin client. Public/member visibility remains row-level Appwrite permissions. Synchronous saves persist actual translation relations; deferred `after()` callbacks follow the saved source relation and attach only the destination locale.

**Tech Stack:** Next.js 16.3 Server Actions and `after()`, React 19, TypeScript, Bun, Vitest, Zod, Appwrite TablesDB/Teams, Appwrite CLI, Turborepo, Ultracite.

## Global Constraints

- General content covers pages, news, events, product publishing, member benefits, announcements, and documents. It excludes shop operations, partner management, applicants, interviews, and other operational/PII data.
- Department members may publish only content related to their department and campus.
- Campus management may manage all department-owned and campus-wide content in a managed campus.
- Only global administrators may use a null campus, and only for global announcements or national documents.
- Jobs remain available to HR plus National Operations Unit/global break-glass access.
- General `sg-app-*` teams receive no direct table/row create, update, or delete permission after cutover.
- Public/member visibility is row-level; non-public content remains service-only.
- Do not edit generated `packages/api/appwrite.config.json` or `packages/api/types/appwrite.ts` by hand. Change the linked schema with Appwrite CLI, then pull tables and regenerate types.
- Do not reduce live table permissions until the admin-client build is deployed.
- Do not add dependencies.
- Follow RED → verify RED → GREEN → verify GREEN for every behavior change.
- Preserve the existing auto-translation changes. Never stage unrelated `* 2.*` files, `WEB_APP_APPWRITE_INCIDENT_AUDIT 2.md`, or `apps/web/src/components/news/article-card.tsx`.

## File Boundaries

- `apps/admin/src/lib/content-authorization.ts`: relationship ID extraction, relationship scope queries, ownership validation.
- `apps/admin/src/lib/roles.ts`: general publishing navigation and explicit HR role.
- General content action files: feature-specific mapping, admin persistence, audits, and invalidation.
- `packages/api/page-builder.ts`: privileged page persistence and linked page translations.
- `packages/api/content-relationship-repair.ts`: injected-DB repair engine; CLI wrapper remains dry-run by default.
- `packages/api/content-permission-cutover.ts`: injected-DB table-permission cutover; CLI wrapper remains dry-run by default.

---

### Task 0: Preserve the Existing Translation Baseline

**Files:**
- Commit only the current auto-translation implementation, tests, and its spec/plan.
- Exclude every unrelated duplicate and `apps/web/src/components/news/article-card.tsx`.

**Interfaces:**
- Produces: a reviewable baseline commit before relationship changes touch the same action files.

- [ ] **Step 1: Verify the current baseline**

```bash
bun test 'apps/admin/src/app/(portal)/_actions/content-translation-actions.test.ts' 'apps/admin/src/lib/content-translation.test.ts' 'apps/admin/src/lib/page-document-translation.test.ts'
bun x turbo run check-types --filter=admin --filter=@repo/api --filter=@repo/shared --force
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 2: Stage the exact translation paths and inspect the index**

```bash
git add \
  'apps/admin/src/app/(editor)/pages/[id]/_components/page-editor-client.tsx' \
  'apps/admin/src/app/(portal)/_actions/announcements.ts' \
  'apps/admin/src/app/(portal)/_actions/announcements-translation.cases.ts' \
  'apps/admin/src/app/(portal)/_actions/benefits.ts' \
  'apps/admin/src/app/(portal)/_actions/benefits-translation.cases.ts' \
  'apps/admin/src/app/(portal)/_actions/content-translation-actions.test.ts' \
  'apps/admin/src/app/(portal)/_actions/events.ts' \
  'apps/admin/src/app/(portal)/_actions/events-translation.cases.ts' \
  'apps/admin/src/app/(portal)/_actions/jobs.ts' \
  'apps/admin/src/app/(portal)/_actions/jobs-translation-test-harness.ts' \
  'apps/admin/src/app/(portal)/_actions/jobs-translation.cases.ts' \
  'apps/admin/src/app/(portal)/_actions/news.test.ts' \
  'apps/admin/src/app/(portal)/_actions/news.ts' \
  'apps/admin/src/app/(portal)/_actions/news-translation.cases.ts' \
  'apps/admin/src/app/(portal)/_actions/pages.ts' \
  'apps/admin/src/app/(portal)/_actions/pages-translation.cases.ts' \
  'apps/admin/src/app/(portal)/_actions/schemas.ts' \
  'apps/admin/src/app/(portal)/_actions/schemas.test.ts' \
  'apps/admin/src/app/(portal)/_actions/shop.ts' \
  'apps/admin/src/app/(portal)/_actions/shop-translation.cases.ts' \
  'apps/admin/src/app/(portal)/_actions/translate-page-route.cases.ts' \
  'apps/admin/src/app/(portal)/benefits/[id]/_components/benefit-editor-client.tsx' \
  'apps/admin/src/app/(portal)/communications/_components/announcement-studio-editor.tsx' \
  'apps/admin/src/app/(portal)/events/[id]/_components/event-studio-editor.tsx' \
  'apps/admin/src/app/(portal)/jobs/[id]/_components/job-studio-editor.tsx' \
  'apps/admin/src/app/(portal)/news/[id]/_components/news-studio-editor.tsx' \
  'apps/admin/src/app/(portal)/news/[id]/_components/news-studio-state.test.ts' \
  'apps/admin/src/app/(portal)/news/[id]/_components/news-studio-state.ts' \
  'apps/admin/src/app/(portal)/shop/[id]/_components/shop-studio-editor.tsx' \
  'apps/admin/src/app/_components/content-translation-controls.test.tsx' \
  'apps/admin/src/app/_components/content-translation-controls.tsx' \
  'apps/admin/src/app/api/translate-page/route.ts' \
  'apps/admin/src/lib/announcements/send.ts' \
  'apps/admin/src/lib/content-translation.server.ts' \
  'apps/admin/src/lib/content-translation.test.ts' \
  'apps/admin/src/lib/content-translation.ts' \
  'apps/admin/src/lib/page-document-translation.test.ts' \
  'apps/admin/src/lib/page-document-translation.ts' \
  'docs/superpowers/plans/2026-08-11-content-auto-translation.md' \
  'docs/superpowers/specs/2026-08-11-content-auto-translation-design.md' \
  'packages/api/page-builder.test.ts' \
  'packages/api/page-builder.ts' \
  'packages/editor/src/components/editor-shell/index.tsx' \
  'packages/editor/src/components/editor-shell/topbar/index.tsx' \
  'packages/shared/types/events.ts' \
  'packages/shared/types/recruitment.ts'
git diff --cached --name-only
```

Expected: no excluded duplicate or `article-card.tsx` is staged.

- [ ] **Step 3: Commit**

```bash
git commit -m "Keep translation outside the publishing request" \
  -m "Preserve the verified manual and deferred translation baseline before relationship authorization changes." \
  -m "Constraint: Preserve unrelated user-owned working-tree changes" \
  -m "Confidence: high" \
  -m "Scope-risk: broad" \
  -m "Tested: Focused translation tests, type checks, git diff --check"
```

---

### Task 1: Add Missing Ownership Relationships in Appwrite

**Files:**
- Modify after CLI pull: `packages/api/appwrite.config.json`
- Modify after generation: `packages/api/types/appwrite.ts`
- Modify: `packages/api/appwrite-config.test.ts`

**Interfaces:**
- Produces: `pages.department`; `campus_benefits.campus/department`; `announcements.campus/department`; `documents.campus/department`.

- [ ] **Step 1: Write the failing schema contract**

Add this matrix and assert each column is a two-way `relationship` to the related table with `onDelete: "setNull"`:

```ts
const REQUIRED_OWNERSHIP_RELATIONSHIPS = [
  ["pages", "campus", "campus"],
  ["pages", "department", "departments"],
  ["campus_benefits", "campus", "campus"],
  ["campus_benefits", "department", "departments"],
  ["announcements", "campus", "campus"],
  ["announcements", "department", "departments"],
  ["documents", "campus", "campus"],
  ["documents", "department", "departments"],
] as const;
```

Also assert the existing event/news/product/benefit/page translation relations use `onDelete: "cascade"`; the one-way job relation is asserted separately as `jobs.translations`.

- [ ] **Step 2: Verify RED**

```bash
bun run --cwd packages/api test -- appwrite-config.test.ts
```

Expected: FAIL on `pages.department` or another missing relation.

- [ ] **Step 3: Verify the linked target**

From `packages/api`:

```bash
appwrite whoami
appwrite -j projects get --project-id "$(jq -r .projectId appwrite.config.json)"
```

Expected: the returned project matches the config. Stop on mismatch.

- [ ] **Step 4: Create only missing additive relationships**

Use `appwrite tables-db get-column` before each create and skip existing keys:

```bash
appwrite tables-db create-relationship-column --database-id app --table-id pages --related-table-id departments --type manyToOne --two-way true --key department --two-way-key pages --on-delete setNull
appwrite tables-db create-relationship-column --database-id app --table-id campus_benefits --related-table-id campus --type manyToOne --two-way true --key campus --two-way-key benefits --on-delete setNull
appwrite tables-db create-relationship-column --database-id app --table-id campus_benefits --related-table-id departments --type manyToOne --two-way true --key department --two-way-key benefits --on-delete setNull
appwrite tables-db create-relationship-column --database-id app --table-id announcements --related-table-id campus --type manyToOne --two-way true --key campus --two-way-key announcements --on-delete setNull
appwrite tables-db create-relationship-column --database-id app --table-id announcements --related-table-id departments --type manyToOne --two-way true --key department --two-way-key announcements --on-delete setNull
appwrite tables-db create-relationship-column --database-id app --table-id documents --related-table-id campus --type manyToOne --two-way true --key campus --two-way-key documents --on-delete setNull
appwrite tables-db create-relationship-column --database-id app --table-id documents --related-table-id departments --type manyToOne --two-way true --key department --two-way-key documents --on-delete setNull
```

- [ ] **Step 5: Pull schema, regenerate types, and verify GREEN**

```bash
cd packages/api
appwrite pull tables
appwrite types -l ts ./types
cd ../..
bun run --cwd packages/api test -- appwrite-config.test.ts
bun x turbo run check-types --filter=@repo/api --force
```

Expected: schema contract and type check pass.

- [ ] **Step 6: Commit**

```bash
git add packages/api/appwrite.config.json packages/api/types/appwrite.ts packages/api/appwrite-config.test.ts
git commit -m "Make content ownership queryable through relationships" \
  -m "Add missing ownership relations without removing legacy scalar compatibility fields." \
  -m "Constraint: Relationship cardinality cannot be changed after creation" \
  -m "Confidence: high" \
  -m "Scope-risk: broad" \
  -m "Tested: Appwrite schema contract and API type check"
```

---

### Task 2: Centralize Relationship-Scoped Authorization

**Files:**
- Create: `apps/admin/src/lib/content-authorization.ts`
- Create: `apps/admin/src/lib/content-authorization.test.ts`
- Modify: `apps/admin/src/lib/utils/authorization.ts`
- Modify: `apps/admin/src/lib/utils/authorization.test.ts`

**Interfaces:**
- Produces: `relationId`, `getContentOwnership`, `applyContentRelationshipScopeQueries`, and `assertContentOwnership`.
- Changes: `assertPublishAccess(ctx, campusId, departmentId)` uses the same scope as general writes.

- [ ] **Step 1: Write failing authorization tests**

```ts
expect(applyContentRelationshipScopeQueries(departmentUser)).toEqual([
  Query.equal("campus.$id", ["1"]),
  Query.equal("department.$id", ["dept-1"]),
]);

expect(() =>
  assertPublishAccess(departmentUser, "1", "dept-1")
).not.toThrow();

db.getRow.mockResolvedValue({ $id: "dept-1", campus: { $id: "2" } });
await expect(
  assertContentOwnership(db, campusAdmin, {
    allowGlobalCampus: false,
    campusId: "1",
    departmentId: "dept-1",
  })
).rejects.toThrow("Department does not belong to the selected campus");
```

Also test: department cannot omit department; non-global cannot omit campus; global can omit campus only when `allowGlobalCampus` is true; relationship values take precedence over legacy scalars.

- [ ] **Step 2: Verify RED**

```bash
bun test apps/admin/src/lib/content-authorization.test.ts apps/admin/src/lib/utils/authorization.test.ts
```

Expected: missing module and department-publish failures.

- [ ] **Step 3: Implement the minimal boundary**

```ts
export interface ContentOwnershipInput {
  allowGlobalCampus: boolean;
  campusId: string | null;
  departmentId: string | null;
}

export const relationId = (
  value: string | { $id: string } | null | undefined
): string | null => (typeof value === "string" ? value : value?.$id ?? null);

export const applyContentRelationshipScopeQueries = (
  ctx: UserAuthContext
): string[] =>
  applyScopeQueries(ctx, {
    campusField: "campus.$id",
    departmentField: "department.$id",
  });
```

`assertContentOwnership` must load `departments/{id}` with `Query.select(["$id", "campus.$id"])`, reject cross-campus references, enforce null-campus policy, then call `assertWriteAccess`. `getContentOwnership(row, { legacyFallback })` prefers relationship IDs and exposes scalar fallback only during repair rollout.

- [ ] **Step 4: Verify GREEN and commit**

```bash
bun test apps/admin/src/lib/content-authorization.test.ts apps/admin/src/lib/utils/authorization.test.ts
git add apps/admin/src/lib/content-authorization.ts apps/admin/src/lib/content-authorization.test.ts apps/admin/src/lib/utils/authorization.ts apps/admin/src/lib/utils/authorization.test.ts
git commit -m "Authorize content through ownership relationships" \
  -m "Centralize relation extraction, campus-department consistency, scope queries, and direct department publishing." \
  -m "Constraint: Submitted relationship IDs are untrusted" \
  -m "Confidence: high" \
  -m "Scope-risk: broad" \
  -m "Tested: Content authorization unit tests"
```

---

### Task 3: Align Navigation and Operational Surfaces

**Files:**
- Modify: `apps/admin/src/lib/roles.ts`
- Modify: `apps/admin/src/lib/authorization.ts`
- Create: `apps/admin/src/lib/roles.test.ts`
- Modify: `apps/admin/src/lib/authorization.test.ts`
- Modify: `apps/admin/src/lib/nav-tree.test.ts`
- Modify: `apps/admin/src/app/(portal)/shop/page.tsx`
- Modify: `apps/admin/src/app/(portal)/shop/_components/shop-studio-dashboard.tsx`
- Create: `apps/admin/src/app/(portal)/shop/_components/shop-access.test.ts`

**Interfaces:**
- Produces: `ROLES.HR = "hr"` derived from the normalized HR department name.
- General publishing nav accepts department membership; job nav accepts HR/global only.
- Department product authors receive `showOrders: false`.

- [ ] **Step 1: Write failing tests**

```ts
for (const key of [
  "portal.pages",
  "portal.news",
  "portal.events",
  "portal.shop",
  "portal.benefits",
  "portal.communications",
  "portal.documents",
] as const) {
  expect(hasNavAccess(key, [], true)).toBe(true);
}

expect(hasNavAccess("portal.jobs", ["hr"], true)).toBe(true);
expect(hasNavAccess("portal.jobs", [], true)).toBe(false);
expect(hasNavAccess("portal.jobs", ["campusadmin"], true)).toBe(false);
```

Test that only HR names derive `hr`, and `canViewShopOperations` returns true for campus/global only.

- [ ] **Step 2: Verify RED**

```bash
bun test apps/admin/src/lib/roles.test.ts apps/admin/src/lib/authorization.test.ts apps/admin/src/lib/nav-tree.test.ts 'apps/admin/src/app/(portal)/shop/_components/shop-access.test.ts'
```

- [ ] **Step 3: Implement and verify GREEN**

Add `HR: "hr"`; normalize department names with `replace(/\s+/g, "").toLowerCase()`. Open only general publishing keys to `DEPARTMENT_ROLE`. Keep orders/customers/settings and partner management narrow. Load `listOrders()` only when `showOrders` is true and hide order UI otherwise.

```bash
bun test apps/admin/src/lib/roles.test.ts apps/admin/src/lib/authorization.test.ts apps/admin/src/lib/nav-tree.test.ts 'apps/admin/src/app/(portal)/shop/_components/shop-access.test.ts'
```

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/lib/roles.ts apps/admin/src/lib/roles.test.ts apps/admin/src/lib/authorization.ts apps/admin/src/lib/authorization.test.ts apps/admin/src/lib/nav-tree.test.ts 'apps/admin/src/app/(portal)/shop/page.tsx' 'apps/admin/src/app/(portal)/shop/_components/shop-studio-dashboard.tsx' 'apps/admin/src/app/(portal)/shop/_components/shop-access.test.ts'
git commit -m "Expose scoped publishing without exposing operations" \
  -m "Open general content navigation to department authors, gate jobs by HR/global, and hide order operations." \
  -m "Confidence: high" \
  -m "Scope-risk: moderate" \
  -m "Tested: Roles, navigation, authorization context, and shop access tests"
```

---

### Task 4: Make News Relationship-Aware

**Files:**
- Modify: `apps/admin/src/app/(portal)/_actions/news.ts`
- Modify: `apps/admin/src/app/(portal)/_actions/news.test.ts`
- Modify: `apps/admin/src/app/(portal)/_actions/news-translation.cases.ts`
- Create: `apps/admin/src/app/(portal)/_actions/news-relationships.test.ts`

**Interfaces:**
- Parent payloads set `campus`, `department`, and `translation_refs`.
- Deferred destination creates set `news_ref`.
- Private admin reads/writes use admin DB and relationship scope queries.

- [ ] **Step 1: Write failing relationship tests**

Require the parent upsert to contain relationship ownership and a nested source child:

```ts
expect(adminDb.upsertRow).toHaveBeenCalledWith(
  "app",
  "news",
  expect.any(String),
  expect.objectContaining({
    campus: "campus-oslo",
    department: "dept-1",
    translation_refs: expect.arrayContaining([
      expect.objectContaining({
        $permissions: expect.any(Array),
        content_type: "news",
        locale: "no",
      }),
    ]),
  }),
  expect.any(Array)
);
```

Require a deferred destination create to contain `news_ref`, and require read/update/delete to authorize against the related campus and department.

- [ ] **Step 2: Verify RED**

```bash
bun test 'apps/admin/src/app/(portal)/_actions/news-relationships.test.ts' 'apps/admin/src/app/(portal)/_actions/news.test.ts' 'apps/admin/src/app/(portal)/_actions/news-translation.cases.ts'
```

Expected: standalone child writes and session/scalar scope fail expectations.

- [ ] **Step 3: Implement minimal relationship persistence**

For an existing nested child include `$id`; for a new child omit it. Include `$permissions`, `content_id`, `content_type`, locale, and translated fields. Keep scalar IDs only as compatibility metadata. Re-read source relationships before deferred persistence with `Query.select(["*", "campus.$id", "department.$id", "translation_refs.*"])`. Preserve stale-source checks, audit entries, notifications, and cache invalidation.

- [ ] **Step 4: Verify GREEN and commit**

```bash
bun test 'apps/admin/src/app/(portal)/_actions/news-relationships.test.ts' 'apps/admin/src/app/(portal)/_actions/news.test.ts' 'apps/admin/src/app/(portal)/_actions/news-translation.cases.ts'
git add 'apps/admin/src/app/(portal)/_actions/news.ts' 'apps/admin/src/app/(portal)/_actions/news.test.ts' 'apps/admin/src/app/(portal)/_actions/news-translation.cases.ts' 'apps/admin/src/app/(portal)/_actions/news-relationships.test.ts'
git commit -m "Keep news ownership and locales connected" \
  -m "Persist news as a relationship graph and attach deferred translations through the news back-reference." \
  -m "Confidence: high" \
  -m "Scope-risk: moderate" \
  -m "Tested: News action, ownership, and translation tests"
```

---

### Task 5: Make Events and Segments Relationship-Aware

**Files:**
- Modify: `apps/admin/src/app/(portal)/_actions/events.ts`
- Modify: `apps/admin/src/app/(portal)/_actions/events-translation.cases.ts`
- Modify: `apps/admin/src/app/(portal)/_actions/event-segments.ts`
- Create: `apps/admin/src/app/(portal)/_actions/events-relationships.test.ts`

**Interfaces:**
- Event parent payloads set `campus`, `department`, and `translation_refs`.
- Deferred destination creates set `event_ref`.
- Segment mutations authorize against the parent event relationship scope.

- [ ] **Step 1: Write failing event and segment tests**

Require an event parent upsert with ownership and a nested source translation, a deferred child create with `event_ref`, and segment create/update/delete to reject authors outside the parent event campus/department.

```ts
expect(adminDb.createRow).toHaveBeenCalledWith(
  "app",
  "content_translations",
  expect.any(String),
  expect.objectContaining({ event_ref: "event-1", locale: "en" }),
  expect.any(Array)
);
```

- [ ] **Step 2: Verify RED**

```bash
bun test 'apps/admin/src/app/(portal)/_actions/events-relationships.test.ts' 'apps/admin/src/app/(portal)/_actions/events-translation.cases.ts'
```

- [ ] **Step 3: Implement event graph persistence and segment authorization**

Use a parent upsert with nested translations for synchronous saves. Include `event_ref` on deferred children and re-read `campus.$id`, `department.$id`, and `translation_refs.*` immediately before persistence. Load the parent event through admin DB before every segment mutation, call `assertContentOwnership`, and keep segment permissions consumer-facing rather than author-team-facing.

- [ ] **Step 4: Verify GREEN and commit**

```bash
bun test 'apps/admin/src/app/(portal)/_actions/events-relationships.test.ts' 'apps/admin/src/app/(portal)/_actions/events-translation.cases.ts'
git add 'apps/admin/src/app/(portal)/_actions/events.ts' 'apps/admin/src/app/(portal)/_actions/events-translation.cases.ts' 'apps/admin/src/app/(portal)/_actions/event-segments.ts' 'apps/admin/src/app/(portal)/_actions/events-relationships.test.ts'
git commit -m "Keep event locales and segments inside event ownership" \
  -m "Attach event translations through Appwrite relationships and authorize segment mutations against their parent event." \
  -m "Confidence: high" \
  -m "Scope-risk: moderate" \
  -m "Tested: Event relationship, translation, and segment authorization tests"
```

---

### Task 6: Make Products Relationship-Aware

**Files:**
- Modify: `apps/admin/src/app/(portal)/_actions/shop.ts`
- Modify: `apps/admin/src/app/(portal)/_actions/shop-translation.cases.ts`
- Create: `apps/admin/src/app/(portal)/_actions/shop-relationships.test.ts`

**Interfaces:**
- Product parent payloads set `campus`, `department`, and `translation_refs`.
- Deferred destination creates set `product_ref`.
- Department authors can manage products in scope but cannot access order operations.

- [ ] **Step 1: Write failing product relationship tests**

Require the product parent upsert to contain ownership and a nested source child. Require deferred destination creates to contain `product_ref`. Require create/read/update/delete to use `assertContentOwnership`, while order actions retain their existing narrow authorization.

- [ ] **Step 2: Verify RED**

```bash
bun test 'apps/admin/src/app/(portal)/_actions/shop-relationships.test.ts' 'apps/admin/src/app/(portal)/_actions/shop-translation.cases.ts'
```

- [ ] **Step 3: Implement product graph persistence**

Use the admin DB after action authorization. Persist synchronous translations through the product parent; include `$id` only for existing child rows. Keep `departmentId` as compatibility metadata, but use `campus` and `department` relationships as the authorization source. Attach deferred destinations with `product_ref` after a relationship-aware stale-source re-read.

- [ ] **Step 4: Verify GREEN and commit**

```bash
bun test 'apps/admin/src/app/(portal)/_actions/shop-relationships.test.ts' 'apps/admin/src/app/(portal)/_actions/shop-translation.cases.ts'
git add 'apps/admin/src/app/(portal)/_actions/shop.ts' 'apps/admin/src/app/(portal)/_actions/shop-translation.cases.ts' 'apps/admin/src/app/(portal)/_actions/shop-relationships.test.ts'
git commit -m "Connect product ownership and translated locales" \
  -m "Persist product translations through relationships while keeping operational commerce actions separately authorized." \
  -m "Confidence: high" \
  -m "Scope-risk: moderate" \
  -m "Tested: Product relationship and translation tests"
```

---

### Task 7: Make Pages Relationship-Complete

**Files:**
- Modify: `packages/api/page-builder.ts`
- Modify: `packages/api/page-builder.test.ts`
- Modify: `apps/admin/src/app/(portal)/_actions/pages.ts`
- Modify: `apps/admin/src/app/(portal)/_actions/pages-translation.cases.ts`

**Interfaces:**
- Page parents set `campus` and `department`.
- Page translations retain both canonical `page` and compatibility `page_id`.

- [ ] **Step 1: Write failing page relationship tests**

```ts
expect(db.upsertRow).toHaveBeenNthCalledWith(
  1,
  "app",
  "pages",
  expect.any(String),
  expect.objectContaining({ campus: "os", department: "dept-1" }),
  expect.any(Array)
);
expect(db.upsertRow).toHaveBeenNthCalledWith(
  2,
  "app",
  "page_translations",
  expect.any(String),
  expect.objectContaining({ page: "page-1", page_id: "page-1" }),
  expect.any(Array)
);
```

Require page action reads and mutations to authorize against relationship ownership through admin DB.

- [ ] **Step 2: Verify RED**

```bash
bun run --cwd packages/api test -- page-builder.test.ts
bun test 'apps/admin/src/app/(portal)/_actions/pages-translation.cases.ts'
```

- [ ] **Step 3: Implement page ownership persistence**

Set page relationships in every parent upsert and use admin DB for editor reads/writes after action authorization. Keep the existing child `page` relationship intact. Permit a null department only for campus/global authors and a null campus only for global authors.

- [ ] **Step 4: Verify GREEN and commit**

```bash
bun run --cwd packages/api test -- page-builder.test.ts
bun test 'apps/admin/src/app/(portal)/_actions/pages-translation.cases.ts'
git add packages/api/page-builder.ts packages/api/page-builder.test.ts 'apps/admin/src/app/(portal)/_actions/pages.ts' 'apps/admin/src/app/(portal)/_actions/pages-translation.cases.ts'
git commit -m "Persist page ownership with its locale relation" \
  -m "Make page campus and department relationships canonical while retaining the existing page translation back-reference." \
  -m "Confidence: high" \
  -m "Scope-risk: moderate" \
  -m "Tested: Page builder and page translation tests"
```

---

### Task 8: Keep Deferred Job Locales in the Parent Relation

**Files:**
- Modify: `apps/admin/src/app/(portal)/_actions/jobs.ts`
- Modify: `apps/admin/src/app/(portal)/_actions/jobs-translation.cases.ts`
- Modify: `apps/admin/src/app/(portal)/_actions/jobs-translation-test-harness.ts`

**Interfaces:**
- Deferred translation updates the complete one-way `jobs.translations` array.
- Job authorization remains HR/global only.

- [ ] **Step 1: Write a failing parent-relation regression test**

Require the deferred parent upsert to keep every existing translation ID plus one destination object, and require no standalone child create.

```ts
expect(adminDb.upsertRow).toHaveBeenCalledWith(
  "app",
  "jobs",
  "job-1",
  expect.objectContaining({
    translations: ["translation-no", expect.objectContaining({ locale: "en" })],
  }),
  expect.any(Array)
);
expect(adminDb.createRow).not.toHaveBeenCalled();
```

- [ ] **Step 2: Verify RED**

```bash
bun test 'apps/admin/src/app/(portal)/_actions/jobs-translation.cases.ts'
```

- [ ] **Step 3: Implement complete parent-relation replacement**

Reload `translations.*` immediately before persistence. Keep non-target children as IDs; represent the destination as an object with `$id` when updating or without `$id` when creating. Preserve the HR guard and all stale-source checks.

- [ ] **Step 4: Verify GREEN and commit**

```bash
bun test 'apps/admin/src/app/(portal)/_actions/jobs-translation.cases.ts'
git add 'apps/admin/src/app/(portal)/_actions/jobs.ts' 'apps/admin/src/app/(portal)/_actions/jobs-translation.cases.ts' 'apps/admin/src/app/(portal)/_actions/jobs-translation-test-harness.ts'
git commit -m "Keep deferred vacancy locales inside the vacancy relation" \
  -m "Replace the complete one-way relation after translating so the destination cannot become an orphan." \
  -m "Constraint: Jobs have no child back-reference" \
  -m "Confidence: high" \
  -m "Scope-risk: narrow" \
  -m "Tested: Job translation action tests"
```

---

### Task 9: Add Relationship Ownership to Benefits

**Files:**
- Modify: `apps/admin/src/app/(portal)/_actions/schemas.ts`
- Modify: `apps/admin/src/app/(portal)/_actions/schemas.test.ts`
- Modify: `apps/admin/src/app/(portal)/_actions/benefits.ts`
- Modify: `apps/admin/src/app/(portal)/_actions/benefits-translation.cases.ts`
- Modify: `apps/admin/src/app/(portal)/benefits/page.tsx`
- Modify: `apps/admin/src/app/(portal)/benefits/[id]/page.tsx`
- Modify: `apps/admin/src/app/(portal)/benefits/[id]/_components/benefit-editor-client.tsx`
- Create: `apps/admin/src/app/(portal)/_actions/benefits-relationships.test.ts`

**Interfaces:**
- Benefit form values gain `department_id: string | null`.
- Benefits set `campus`, `department`, and `contentTranslations` while retaining inline bilingual columns.

- [ ] **Step 1: Write failing schema and action tests**

```ts
expect(benefitSchema.parse(input).department_id).toBe("dept-1");
expect(adminDb.upsertRow).toHaveBeenCalledWith(
  "app",
  "campus_benefits",
  expect.any(String),
  expect.objectContaining({
    campus: "campus-oslo",
    department: "dept-1",
    contentTranslations: expect.arrayContaining([
      expect.objectContaining({ content_type: "memberBenefit", locale: "no" }),
    ]),
  }),
  expect.any(Array)
);
```

Require deferred children to set `memberBenefit`. Test that department users cannot clear ownership, campus authors may leave department null, and only global users may leave campus null.

- [ ] **Step 2: Verify RED**

```bash
bun test 'apps/admin/src/app/(portal)/_actions/schemas.test.ts' 'apps/admin/src/app/(portal)/_actions/benefits-relationships.test.ts' 'apps/admin/src/app/(portal)/_actions/benefits-translation.cases.ts'
```

- [ ] **Step 3: Implement benefit ownership and locale relations**

Add `department_id` and reuse `DepartmentCombobox` after campus selection. Default a single-department author to that department and prevent clearing. Use admin DB and `assertContentOwnership`. Dual-write inline locale fields and linked children, including `short_description` and `additional_fields`. Deferred translation updates the destination inline fields and related child. Hide partner links from department-only authors; the partner route keeps its narrow gate.

- [ ] **Step 4: Verify GREEN and commit**

```bash
bun test 'apps/admin/src/app/(portal)/_actions/schemas.test.ts' 'apps/admin/src/app/(portal)/_actions/benefits-relationships.test.ts' 'apps/admin/src/app/(portal)/_actions/benefits-translation.cases.ts'
git add 'apps/admin/src/app/(portal)/_actions/schemas.ts' 'apps/admin/src/app/(portal)/_actions/schemas.test.ts' 'apps/admin/src/app/(portal)/_actions/benefits.ts' 'apps/admin/src/app/(portal)/_actions/benefits-translation.cases.ts' 'apps/admin/src/app/(portal)/_actions/benefits-relationships.test.ts' 'apps/admin/src/app/(portal)/benefits/page.tsx' 'apps/admin/src/app/(portal)/benefits/[id]/page.tsx' 'apps/admin/src/app/(portal)/benefits/[id]/_components/benefit-editor-client.tsx'
git commit -m "Give benefits explicit ownership and locale relations" \
  -m "Persist benefit campus and department ownership while retaining inline bilingual compatibility." \
  -m "Confidence: high" \
  -m "Scope-risk: moderate" \
  -m "Tested: Benefit schema, relationship, and translation tests"
```

---

### Task 10: Add Relationship Ownership to Announcements

**Files:**
- Modify: `apps/admin/src/app/(portal)/_actions/schemas.ts`
- Modify: `apps/admin/src/app/(portal)/_actions/schemas.test.ts`
- Modify: `apps/admin/src/app/(portal)/_actions/announcements.ts`
- Modify: `apps/admin/src/app/(portal)/_actions/announcements-translation.cases.ts`
- Modify: `apps/admin/src/app/(portal)/communications/[id]/page.tsx`
- Modify: `apps/admin/src/app/(portal)/communications/_components/announcement-studio-editor.tsx`
- Create: `apps/admin/src/app/(portal)/_actions/announcements-relationships.test.ts`

**Interfaces:**
- Announcement form values gain `department_id: string | null`.
- Announcements persist `campus` and `department` but retain inline bilingual snapshots.
- Null-campus announcements remain global-admin only for compatibility.

- [ ] **Step 1: Write failing schema, ownership, and dispatch tests**

Require announcement creates/updates to persist both ownership relationships. Require department authors to keep their own department, campus authors to be able to create campus-wide announcements, and only global authors to use a null campus. Require the deferred send callback to reload ownership and reject dispatch if the actor is no longer in scope.

- [ ] **Step 2: Verify RED**

```bash
bun test 'apps/admin/src/app/(portal)/_actions/schemas.test.ts' 'apps/admin/src/app/(portal)/_actions/announcements-relationships.test.ts' 'apps/admin/src/app/(portal)/_actions/announcements-translation.cases.ts'
```

- [ ] **Step 3: Implement announcement ownership**

Add `department_id` to schema and editor state. Reuse `DepartmentCombobox`, pin single-department authors to their department, and allow campus/global authors to select campus-wide scope. Use admin DB with `assertContentOwnership`; keep the inline Norwegian/English snapshot format. Revalidate ownership before translation, dispatch, and audit persistence in the queued callback.

- [ ] **Step 4: Verify GREEN and commit**

```bash
bun test 'apps/admin/src/app/(portal)/_actions/schemas.test.ts' 'apps/admin/src/app/(portal)/_actions/announcements-relationships.test.ts' 'apps/admin/src/app/(portal)/_actions/announcements-translation.cases.ts'
git add 'apps/admin/src/app/(portal)/_actions/schemas.ts' 'apps/admin/src/app/(portal)/_actions/schemas.test.ts' 'apps/admin/src/app/(portal)/_actions/announcements.ts' 'apps/admin/src/app/(portal)/_actions/announcements-translation.cases.ts' 'apps/admin/src/app/(portal)/_actions/announcements-relationships.test.ts' 'apps/admin/src/app/(portal)/communications/[id]/page.tsx' 'apps/admin/src/app/(portal)/communications/_components/announcement-studio-editor.tsx'
git commit -m "Scope announcements through ownership relationships" \
  -m "Persist campus and department ownership and revalidate it before queued translation and dispatch." \
  -m "Confidence: high" \
  -m "Scope-risk: moderate" \
  -m "Tested: Announcement schema, ownership, translation, and dispatch tests"
```

---

### Task 11: Add Relationship Ownership to Documents

**Files:**
- Modify: `apps/admin/src/app/(portal)/_actions/schemas.ts`
- Modify: `apps/admin/src/app/(portal)/_actions/schemas.test.ts`
- Modify: `apps/admin/src/app/(portal)/_actions/documents.ts`
- Modify: `apps/admin/src/app/(portal)/documents/[id]/page.tsx`
- Modify: `apps/admin/src/app/(portal)/documents/[id]/_components/document-editor-client.tsx`
- Create: `apps/admin/src/app/(portal)/_actions/documents-relationships.test.ts`

**Interfaces:**
- Document form values gain `department_id: string | null`.
- Documents persist `campus` and `department` while retaining monolingual SharePoint metadata.
- National/null-campus documents remain global-admin only.

- [ ] **Step 1: Write failing schema and ownership tests**

Require create/update/delete to use admin DB after `assertContentOwnership`, and require stored rows to contain both relationship refs. Test department-only, campus-wide, and global-national scopes separately. Verify the existing SharePoint fields are unchanged.

- [ ] **Step 2: Verify RED**

```bash
bun test 'apps/admin/src/app/(portal)/_actions/schemas.test.ts' 'apps/admin/src/app/(portal)/_actions/documents-relationships.test.ts'
```

- [ ] **Step 3: Implement document ownership**

Add `department_id` to schema and editor state, reuse `DepartmentCombobox`, and enforce the same department/campus ownership rules as other general content. Keep SharePoint upload/link behavior and monolingual metadata unchanged. Use admin DB for all private document reads and mutations after application authorization.

- [ ] **Step 4: Verify GREEN and commit**

```bash
bun test 'apps/admin/src/app/(portal)/_actions/schemas.test.ts' 'apps/admin/src/app/(portal)/_actions/documents-relationships.test.ts'
git add 'apps/admin/src/app/(portal)/_actions/schemas.ts' 'apps/admin/src/app/(portal)/_actions/schemas.test.ts' 'apps/admin/src/app/(portal)/_actions/documents.ts' 'apps/admin/src/app/(portal)/_actions/documents-relationships.test.ts' 'apps/admin/src/app/(portal)/documents/[id]/page.tsx' 'apps/admin/src/app/(portal)/documents/[id]/_components/document-editor-client.tsx'
git commit -m "Scope documents through campus and department relations" \
  -m "Make relationship ownership authoritative without changing SharePoint document metadata behavior." \
  -m "Confidence: high" \
  -m "Scope-risk: moderate" \
  -m "Tested: Document schema and ownership tests"
```

---

### Task 12: Repair Existing Ownership and Translation Links

**Files:**
- Create: `packages/api/content-relationship-repair.ts`
- Create: `packages/api/content-relationship-repair.test.ts`
- Create: `packages/api/scripts/repair-content-relationships.ts`
- Modify: `packages/api/package.json`
- Modify after CLI pull: `packages/api/appwrite.config.json`
- Modify: `packages/api/appwrite-config.test.ts`

**Interfaces:**
- Produces: `repairContentRelationships(db, { apply }): Promise<RepairReport>`.
- Report includes linked, already linked, ownership backfills, duplicates, orphans, wrong parents, and errors.
- CLI defaults to dry run; `--apply` performs only unambiguous updates.

- [ ] **Step 1: Write failing repair tests**

```ts
const report = await repairContentRelationships(db, { apply: true });
expect(db.updateRow).toHaveBeenCalledWith(
  "app",
  "content_translations",
  "tr-1",
  { news_ref: "news-1" }
);
expect(report.linked).toContainEqual({
  parentId: "news-1",
  translationId: "tr-1",
});
```

Test: dry run never writes; duplicate locale rows are reported and untouched; missing parents and wrong refs are untouched; scalar ownership backfills set relationships; jobs rebuild the parent relation.

- [ ] **Step 2: Verify RED**

```bash
bun run --cwd packages/api test -- content-relationship-repair.test.ts
```

- [ ] **Step 3: Implement repair engine and dry-run CLI**

```ts
const TRANSLATION_RULES = {
  department: { backReference: "department_ref", parentTable: "departments" },
  event: { backReference: "event_ref", parentTable: "events" },
  memberBenefit: { backReference: "memberBenefit", parentTable: "campus_benefits" },
  news: { backReference: "news_ref", parentTable: "news" },
  product: { backReference: "product_ref", parentTable: "webshop_products" },
} as const;
```

Paginate at 100 rows using `Query.cursorAfter`. Never delete. Print IDs/counts only. Exit nonzero for duplicates, orphans, wrong refs, or write errors. Handle jobs by updating the complete parent `translations` relation; verify page translations rather than rewriting their already-canonical relation.

Add package script:

```json
"repair:content-relationships": "bun --env-file=../../apps/admin/.env.local scripts/repair-content-relationships.ts"
```

- [ ] **Step 4: Verify GREEN and run dry/apply convergence**

```bash
bun run --cwd packages/api test -- content-relationship-repair.test.ts
bun run --cwd packages/api repair:content-relationships
```

If and only if unsafe groups are empty:

```bash
bun run --cwd packages/api repair:content-relationships -- --apply
bun run --cwd packages/api repair:content-relationships
```

Expected: second dry run has no pending safe repair. Stop without deleting if unsafe groups exist.

- [ ] **Step 5: Add uniqueness after duplicates are resolved**

```bash
cd packages/api
appwrite tables-db create-index --database-id app --table-id content_translations --key uniq_content_locale --type unique --columns content_type content_id locale
appwrite pull tables
cd ../..
```

Add this exact config assertion and rerun API tests:

```ts
expect(contentTranslations.indexes).toContainEqual(
  expect.objectContaining({
    columns: ["content_type", "content_id", "locale"],
    key: "uniq_content_locale",
    type: "unique",
  })
);
```

- [ ] **Step 6: Commit**

```bash
git add packages/api/content-relationship-repair.ts packages/api/content-relationship-repair.test.ts packages/api/scripts/repair-content-relationships.ts packages/api/package.json packages/api/appwrite.config.json packages/api/appwrite-config.test.ts
git commit -m "Repair orphaned relations without deleting content" \
  -m "Add an idempotent repair command and enforce one locale per content item after duplicate resolution." \
  -m "Constraint: Ambiguous data is reported for explicit resolution" \
  -m "Confidence: high" \
  -m "Scope-risk: broad" \
  -m "Tested: Repair tests, dry-run/apply convergence, schema contract"
```

---

### Task 13: Remove Remaining Session Dependencies for Private Admin Content

**Files:**
- Modify: `apps/admin/src/app/(portal)/_actions/drafts.ts`
- Modify: `apps/admin/src/app/(portal)/_actions/palette-search.ts`
- Modify: `apps/admin/src/app/(portal)/_actions/lookups.ts`
- Modify: `apps/admin/src/app/(portal)/_actions/content-scoping.test.ts`
- Create: `apps/admin/src/app/(portal)/_actions/admin-content-boundary.test.ts`

**Interfaces:**
- Produces: no session-client read/write dependency for private general content in the admin portal.

- [ ] **Step 1: Write failing boundary tests**

Require draft and palette lists to call the admin client, select ownership relationships, and include `Query.equal("department.$id", allowedIds)` for department users. Require department lookup results to remain within the caller's scope.

- [ ] **Step 2: Verify RED**

```bash
bun test 'apps/admin/src/app/(portal)/_actions/admin-content-boundary.test.ts' 'apps/admin/src/app/(portal)/_actions/content-scoping.test.ts'
```

- [ ] **Step 3: Implement and audit**

Switch private general-content reads to the admin client and canonical relationship filters. Keep public/member web readers and non-content operational actions unchanged.

```bash
rg -n 'createSessionClient|department_id|departmentId|campus_id' 'apps/admin/src/app/(portal)/_actions' packages/api/page-builder.ts
```

Every remaining hit must be relationship compatibility metadata, a reference lookup, recruitment, or an explicitly excluded operational surface. No unexplained general-content session mutation remains.

- [ ] **Step 4: Verify GREEN and commit**

```bash
bun test 'apps/admin/src/app/(portal)/_actions/admin-content-boundary.test.ts' 'apps/admin/src/app/(portal)/_actions/content-scoping.test.ts' 'apps/admin/src/app/(portal)/_actions/content-translation-actions.test.ts'
git add 'apps/admin/src/app/(portal)/_actions/drafts.ts' 'apps/admin/src/app/(portal)/_actions/palette-search.ts' 'apps/admin/src/app/(portal)/_actions/lookups.ts' 'apps/admin/src/app/(portal)/_actions/content-scoping.test.ts' 'apps/admin/src/app/(portal)/_actions/admin-content-boundary.test.ts'
git commit -m "Keep private admin content behind scoped service reads" \
  -m "Remove remaining session dependencies for draft and relationship-scoped admin discovery." \
  -m "Confidence: high" \
  -m "Scope-risk: broad" \
  -m "Tested: Admin boundary, scoping, and translation action tests"
```

---

### Task 14: Prepare the Service-Only Permission Cutover

**Files:**
- Modify: `apps/admin/src/lib/utils.ts`
- Create or modify: `apps/admin/src/lib/utils.test.ts`
- Modify: `packages/api/page-builder.ts`
- Modify: `packages/api/page-builder.test.ts`
- Modify: `apps/admin/src/lib/recruitment.ts`
- Modify: `apps/admin/src/lib/recruitment.test.ts`
- Modify: `apps/admin/src/lib/team-provisioning.ts`
- Modify: `apps/admin/src/lib/team-provisioning.test.ts`
- Modify: `apps/admin/src/lib/m365-sync.ts`
- Modify: `apps/admin/src/lib/m365-sync.test.ts`
- Create: `packages/api/content-permission-cutover.ts`
- Create: `packages/api/content-permission-cutover.test.ts`
- Create: `packages/api/scripts/cutover-content-permissions.ts`
- Modify: `packages/api/package.json`

**Interfaces:**
- General permission builders return consumer read permissions only.
- Jobs use a recruitment-specific translation permission builder with Operations Unit/HR staff permissions.
- M365 sync provisions recruitment only.
- `cutoverContentPermissions(db, { apply })` targets exactly nine general tables.

- [ ] **Step 1: Write failing permission/provisioning tests**

```ts
expect(buildContentRowPermissions({ status: "draft" })).toEqual([]);
expect(buildContentRowPermissions({ status: "published" })).toEqual([
  Permission.read(Role.any()),
]);
expect(buildContentRowPermissions({
  audience: "members",
  status: "published",
})).toEqual([Permission.read(Role.team("biso-members"))]);
```

Assert no result contains create/update/delete. Assert M365 sync never updates general content table permissions. Test cutover dry-run and apply against exactly:

```ts
const GENERAL_CONTENT_TABLES = [
  "events",
  "news",
  "webshop_products",
  "pages",
  "campus_benefits",
  "announcements",
  "documents",
  "content_translations",
  "page_translations",
] as const;
```

- [ ] **Step 2: Verify RED**

```bash
bun test apps/admin/src/lib/utils.test.ts apps/admin/src/lib/team-provisioning.test.ts apps/admin/src/lib/m365-sync.test.ts apps/admin/src/lib/recruitment.test.ts
bun run --cwd packages/api test -- content-permission-cutover.test.ts
```

- [ ] **Step 3: Implement**

General builders return no permission for non-public status, `read(any)` for published public, or member read for published member content. Apply the same rule to page rows/translations. Benefit actions pass `audience: is_member_only ? "members" : "public"`; document actions pass `audience: "public"`; announcement actions pass an explicit empty permission array because delivery snapshots are never directly consumed.

Create `buildJobTranslationPermissions` from visibility plus `buildRecruitmentStaffRowPermissions`. Remove `grantTeamContentAccess` and its M365 calls; keep HR recruitment provisioning.

Implement a sanitized, idempotent dry-run cutover CLI with an explicit `--apply` switch. Add:

```json
"cutover:content-permissions": "bun --env-file=../../apps/admin/.env.local scripts/cutover-content-permissions.ts"
```

- [ ] **Step 4: Verify GREEN without changing live permissions**

```bash
bun test apps/admin/src/lib/utils.test.ts apps/admin/src/lib/team-provisioning.test.ts apps/admin/src/lib/m365-sync.test.ts apps/admin/src/lib/recruitment.test.ts
bun run --cwd packages/api test -- content-permission-cutover.test.ts
bun x turbo run check-types --filter=admin --filter=@repo/api --filter=@repo/shared --force
bun run --cwd packages/api cutover:content-permissions
```

Expected: tests pass and the last command is dry-run only.

- [ ] **Step 5: Commit deploy-safe code**

```bash
git add apps/admin/src/lib/utils.ts apps/admin/src/lib/utils.test.ts packages/api/page-builder.ts packages/api/page-builder.test.ts apps/admin/src/lib/recruitment.ts apps/admin/src/lib/recruitment.test.ts apps/admin/src/lib/team-provisioning.ts apps/admin/src/lib/team-provisioning.test.ts apps/admin/src/lib/m365-sync.ts apps/admin/src/lib/m365-sync.test.ts packages/api/content-permission-cutover.ts packages/api/content-permission-cutover.test.ts packages/api/scripts/cutover-content-permissions.ts packages/api/package.json
git commit -m "Move content authoring behind the admin service" \
  -m "Remove dynamic content grants, keep row permissions consumer-only, and provide a guarded post-deployment table cutover." \
  -m "Constraint: Live table permissions cannot change before compatible code is active" \
  -m "Confidence: high" \
  -m "Scope-risk: broad" \
  -m "Directive: Apply the cutover only after production deployment" \
  -m "Tested: Permission, M365, recruitment, cutover, and type tests" \
  -m "Not-tested: Live cutover intentionally deferred"
```

---

### Task 15: Verify, Deploy, and Complete the Permission Cutover

**Files:**
- Modify after live pull: `packages/api/appwrite.config.json`
- Modify: `packages/api/appwrite-config-permissions.test.ts`
- Modify: `apps/admin/PERMISSIONS_REVIEW.md`

**Interfaces:**
- Consumes: all tasks above.
- Produces: release evidence and a live config snapshot with empty permissions on general content tables.

- [ ] **Step 1: Run focused and complete tests**

```bash
bun test apps/admin/src/lib/content-authorization.test.ts apps/admin/src/lib/utils/authorization.test.ts apps/admin/src/lib/roles.test.ts apps/admin/src/lib/nav-tree.test.ts 'apps/admin/src/app/(portal)/_actions/content-scoping.test.ts' 'apps/admin/src/app/(portal)/_actions/content-translation-actions.test.ts' 'apps/admin/src/app/(portal)/_actions/news-relationships.test.ts' 'apps/admin/src/app/(portal)/_actions/events-relationships.test.ts' 'apps/admin/src/app/(portal)/_actions/shop-relationships.test.ts' 'apps/admin/src/app/(portal)/_actions/benefits-relationships.test.ts' 'apps/admin/src/app/(portal)/_actions/announcements-relationships.test.ts' 'apps/admin/src/app/(portal)/_actions/documents-relationships.test.ts'
bun run --cwd packages/api test -- appwrite-config.test.ts content-relationship-repair.test.ts content-permission-cutover.test.ts page-builder.test.ts
bun x turbo run test --filter=admin --filter=@repo/api --filter=@repo/shared --force
```

Expected: all pass without warnings or unhandled rejections.

- [ ] **Step 2: Run static and build verification**

```bash
bun x turbo run check-types --filter=admin --filter=@repo/api --filter=@repo/shared --force
bun x ultracite check apps/admin packages/api packages/shared
git diff --check
bun run build:admin
bun run build:admin:appwrite
```

Expected: exit 0.

- [ ] **Step 3: Run safe operational diagnostics**

```bash
bun run --cwd packages/api repair:content-relationships
bun run --cwd packages/api cutover:content-permissions
```

Expected: no unsafe relationship groups; permission command is still dry-run.

- [ ] **Step 4: Deploy before permission reduction**

The repository deploys affected apps from `main` via `.github/workflows/deploy-production.yml`. Confirm the active admin deployment contains Tasks 2–14. Do not apply production permission changes from an undeployed feature branch.

- [ ] **Step 5: Apply and pull the live permission cutover**

After deployment:

```bash
bun run --cwd packages/api cutover:content-permissions
bun run --cwd packages/api cutover:content-permissions -- --apply
cd packages/api
appwrite pull tables
cd ../..
```

Expected: only the nine target tables change, each to an empty table-permission array.

- [ ] **Step 6: Lock the pulled config contract**

Add this test using the nine-table constant and run it:

```ts
test("general content tables have no table-level permissions", () => {
  const config = loadAppwriteConfig();
  for (const tableId of GENERAL_CONTENT_TABLES) {
    const table = config.tables.find((candidate) => candidate.$id === tableId);
    expect(table?.$permissions, tableId).toEqual([]);
  }
});
```

```bash
bun run --cwd packages/api test -- appwrite-config-permissions.test.ts
```

Expected: PASS against the CLI-pulled live snapshot.

- [ ] **Step 7: Update review documentation and commit**

Record the final authorization model, relationship repair counts, deployed commit, cutover status, and any manual duplicate/orphan resolution.

```bash
git add packages/api/appwrite.config.json packages/api/appwrite-config-permissions.test.ts apps/admin/PERMISSIONS_REVIEW.md
git commit -m "Record the relationship-scoped publishing cutover" \
  -m "Lock the live service-only table contract and replace obsolete dynamic-team authoring guidance." \
  -m "Confidence: high" \
  -m "Scope-risk: narrow" \
  -m "Tested: Full tests, type checks, Ultracite, builds, repair diagnostics, live config contract" \
  -m "Not-tested: Record any unavailable live-account checks"
```

- [ ] **Step 8: Final completion audit**

Confirm:

- general admin reads/mutations use relationship scope and admin DB;
- ownership transfers validate old and new scope;
- department publishing is limited to related content;
- HR/global alone manage recruitment;
- synchronous and deferred translations remain attached;
- repair tooling never deletes ambiguous data;
- no live permission reduction preceded compatible deployment;
- unrelated dirty/untracked user files remain untouched.
