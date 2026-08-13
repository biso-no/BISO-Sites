# Content Permissions and Appwrite Relationships Design

## Goal

Make content authorization predictable when Azure security groups are mirrored
into Appwrite teams, and make every translated row an actual Appwrite relation
of its parent content row.

The admin portal becomes the only authoring boundary. It authenticates the
caller, derives their campus and department scope from `sg-app-*` team
memberships, validates every requested content scope, and then performs the
database operation with the Appwrite admin client. Appwrite row permissions
remain responsible for consumer visibility, not authoring authorization.

## Scope

This change covers the admin publishing surfaces for:

- pages;
- news articles;
- events;
- shop products;
- member benefits;
- announcements;
- documents;
- job vacancies, only where translation relationships and recruitment access
  gates are involved.

Jobs remain recruitment content. They are not opened to general campus or
department authors.

Partner management, shop orders, customers, applications, interviews, and
other operational or personally identifiable data are outside the general
content-authoring policy.

## Confirmed Authorization Policy

### General content

- A National Operations Unit member is a global administrator and can manage
  all content.
- A campus-management member can create, read, edit, publish, unpublish,
  archive, and delete all general content in a managed campus.
- A department member can perform the same operations only when the content's
  department relationship belongs to one of their resolved departments and
  the department belongs to one of their campuses.
- A department member cannot create campus-wide content without a department
  relationship.
- A campus manager or global administrator can create campus-wide content by
  leaving the department relationship empty.
- A global administrator can create content without a campus relationship only
  for feature types that already support a national/global scope: national
  documents and global announcements. Campus and department authors always
  require a campus relationship.
- Changing ownership is authorized against both the old and new scope.
- A department relationship must belong to the selected campus. A campus
  manager cannot accidentally attach content to a department in another
  campus.

Department members may publish directly in their own scope. Publication is no
longer restricted to campus managers for general content.

### Recruitment

- Members of `sg-app-dept-hr` may manage jobs for their campus.
- National HR may manage jobs across campuses.
- National Operations Unit/global administrators retain break-glass access.
- Campus management and non-HR departments receive no job or applicant access.

Navigation visibility and every recruitment server action must apply the same
rule. Navigation alone is never an authorization boundary.

## Current Problems

### Mixed trust boundaries

General-content actions currently mix Appwrite session and admin clients.
Session writes depend on dynamically provisioned table-level create grants and
row-level update/delete permissions. The provisioning list omits some content
tables, campus teams intentionally receive no create grants, and newly mirrored
teams can therefore observe behavior that differs from existing teams.

Several publishing actions already contain correct-looking scope assertions,
but the following database request can still fail because its session lacks an
Appwrite permission. Other actions use an admin client, so the behavior is not
consistent across features.

### Duplicate ownership values

Some content tables have a scalar campus or department ID, an Appwrite
relationship, or both. Most actions query scalar fields and do not reliably set
the corresponding relationship. Pages have a scalar department field without
a department relationship. Benefits, announcements, and documents have no
department ownership relationship at all.

This prevents one consistent rule such as
`Query.equal("department.$id", allowedDepartmentIds)` from being applied to
every publishing surface.

### Orphaned translations

News, event, and product translations are usually created with `content_id`
and `content_type`, but without `news_ref`, `event_ref`, or `product_ref`.
Those scalar values are metadata, not Appwrite relationships, so selecting
`translation_refs.*` from the parent does not return them and relationship
cascade behavior does not apply.

The synchronous job save already uses a nested `jobs.translations` payload,
but its deferred translation path creates a standalone child row. Pages
already write `page_translations.page`; that implementation is the closest
existing reference pattern.

### Over-broad table permissions

Content tables with row security must not use table-level authoring grants for
dynamic `sg-app-*` teams. A table-level permission applies across the table and
cannot express campus-plus-department ownership. Public visibility also belongs
on individual published rows, so drafts cannot become public through a broad
table permission.

## Chosen Architecture

### 1. Relationship-first ownership

The canonical ownership tuple is:

```ts
interface ContentOwnership {
  campus: string | null; // related campus row ID; null only for global scope
  department: string | null; // related department row ID
}
```

The strings above are identifiers passed to Appwrite relationship fields; they
are not duplicate database columns.

Use existing relationships where present and add the missing relationships:

| Table | Campus relationship | Department relationship |
| --- | --- | --- |
| `events` | existing `campus` | existing `department` |
| `news` | existing `campus` | existing `department` |
| `webshop_products` | existing `campus` | existing `department` |
| `pages` | existing `campus` | add `department` |
| `campus_benefits` | add `campus` | add `department` |
| `announcements` | add `campus` | add `department` |
| `documents` | add `campus` | add `department` |

Existing scalar scope fields remain only during the compatibility migration.
They are backfilled into relationships and are not used to make authorization
decisions after the application switches to relationship queries. They may be
removed in a later schema cleanup after every consumer is verified.

Existing rows in the last three tables have no historical department owner.
They remain campus-wide rather than having an owner inferred from unreliable
metadata. A campus manager can assign a department later.

### 2. Central scoped admin data boundary

All admin publishing actions use a small shared authorization/data boundary:

1. `requireAuth()` obtains the session identity and mirrored team context.
2. The requested campus and department relationship IDs are loaded with the
   admin client.
3. The department-to-campus relationship is validated.
4. A centralized scope assertion validates the caller against the canonical
   relationships.
5. The action performs the read or mutation with the admin client.

List queries use relationship paths:

```ts
Query.equal("campus.$id", allowedCampusIds)
Query.equal("department.$id", allowedDepartmentIds)
```

A global administrator may optionally apply the active-campus filter. A campus
manager is filtered by managed campuses. A department member is filtered by
both campus and department. Missing or unresolved scope fails closed.
Feature types that support national/global rows may use a null campus only when
the caller is a global administrator; every other authoring path requires a
resolved campus relationship.

Single-row reads load the row with the admin client and immediately validate
its relationships before returning any content. Create actions validate the
new scope. Update and ownership-transfer actions validate both the persisted
scope and requested scope. Delete, publish, archive, and unpublish actions
validate the persisted scope.

Server Actions are treated as public endpoints: client-provided campus,
department, status, relationship IDs, and row IDs are untrusted.

### 3. Service-only authoring permissions

General-content table and row permissions do not grant `sg-app-*` teams direct
create, update, or delete access. The admin client performs those operations
only after the application-level authorization checks above.

Row permissions describe consumer visibility:

- published public content: `read("any")`;
- published member-only content: read for the member team;
- drafts, scheduled content, archived content, and other non-public states: no
  public read permission;
- translation rows receive visibility equivalent to their parent.

The M365 sync continues to mirror team membership, but it stops mutating
general-content table permissions. Recruitment provisioning remains separate
and HR-specific.

The public/member applications keep using non-admin access. Their access is
therefore still constrained by row visibility. The admin portal uses the admin
client and explicit scope checks.

### 4. Relationship-aware translation persistence

The supported relationship mapping is:

| Content type | Parent field | Translation back-reference |
| --- | --- | --- |
| Events | `events.translation_refs` | `content_translations.event_ref` |
| News | `news.translation_refs` | `content_translations.news_ref` |
| Products | `webshop_products.translation_refs` | `content_translations.product_ref` |
| Benefits | `campus_benefits.contentTranslations` | `content_translations.memberBenefit` |
| Pages | `pages.translation_refs` | `page_translations.page` |
| Jobs | `jobs.translations` | none; the relationship is one-way |
| Departments | `departments.translations` | `content_translations.department_ref` |

`content_id`, `content_type`, and `page_id` remain stable lookup and migration
metadata. They do not establish a relationship by themselves.

#### Manual translation and normal saves

The final-step manual translator continues to return an editable browser
draft. When the user saves or publishes, the parent write includes its related
translation children.

For an existing translation, the nested object contains its `$id`; Appwrite
updates and retains that child. For a new locale, the nested object omits an
existing `$id`; Appwrite creates and links the child. Each nested child includes
explicit `$permissions` matching the parent's visibility instead of relying on
permission inheritance.

This produces one relationship-aware parent operation for the content and the
translations already present in the form. If a feature must use multiple calls,
the child payload always includes its two-way parent reference.

Benefits keep their current bilingual columns during migration and dual-write
the same values into related `content_translations` rows. Existing web and app
consumers therefore continue to work while the relationship becomes complete.
Announcements remain inline bilingual delivery snapshots and do not gain an
unnecessary translation table. Documents remain monolingual uploaded content.

#### Deferred automatic translation

After the source save or publish and its source relationship succeed, the
Server Action schedules `after()` and returns immediately.

The callback receives only the parent ID, source locale, source snapshot, and
initiating status. It then:

1. creates an admin client independent of the completed request session;
2. reloads the parent and its related source translation;
3. verifies that the ownership, status, locale, and source content still match
   the submitted snapshot;
4. translates all fields in one structured model call;
5. rechecks the source immediately before persistence;
6. upserts only the destination locale;
7. supplies `event_ref`, `news_ref`, `product_ref`, `memberBenefit`, or `page`
   when creating a two-way related child;
8. updates the parent's complete `translations` relation for jobs, whose
   relationship has no child back-reference;
9. applies destination permissions equivalent to the current parent;
10. logs a sanitized failure without rolling back the successful source
    save/publish.

The source locale is always linked before the callback is scheduled, giving
the deferred task a reliable relationship to follow. A stale callback never
overwrites a destination generated for a newer source revision.

### 5. Translation uniqueness and repair

Before adding uniqueness enforcement, an idempotent repair command inventories
translations grouped by `content_type`, `content_id`, and `locale`.

- A single unlinked row is attached to the matching parent.
- Missing parents are reported as orphans and left untouched.
- Duplicate locale rows are reported with their IDs. No content is deleted
  automatically.
- Already linked rows are left unchanged.
- A row linked to the wrong parent is reported and requires an explicit repair.

After duplicate resolution, add a unique index across
`content_type`, `content_id`, and `locale`. Auto-translation upserts then become
idempotent even if two deferred callbacks overlap.

Page translations retain their existing unique `(page_id, locale)` index.

## Feature Access Matrix

| Actor | General content | Campus-wide content | National/global content | Jobs and applicants |
| --- | --- | --- | --- | --- |
| National Operations Unit/global admin | All campuses and departments | Yes | Yes, where supported | Yes, break-glass |
| Campus management | Managed campus, all departments | Yes | No | No, unless also HR |
| Department member | Own campus and department | No | No | No, unless HR |
| HR member | Own department general content | No | No | All recruitment in HR member's campus |
| National HR | Own department general content | No | No | All recruitment |
| Authenticated user without resolved scope | None | No | No | No |

General publishing navigation includes pages, news, events, product publishing,
benefits, announcements, and documents for department members. Operational
shop pages and benefit partner administration retain their existing narrower
roles unless separately authorized.

The jobs navigation entry uses an HR/global predicate rather than the broad
`department` pseudo-role.

## Migration and Rollout

Schema and application changes must be deployed in a compatibility-safe order:

1. Add missing campus/department relationships and the indexes required for
   relationship queries. Do not remove scalar columns.
2. Deploy dual-read code that prefers relationships but can temporarily fall
   back to existing scalar scope metadata during repair.
3. Run the idempotent ownership and translation relationship backfill. Produce
   a report for unresolved rows and duplicates.
4. Verify every content type has the expected parent/child links and that
   relationship-selected reads work for public translations.
5. Switch all admin content actions to scoped admin reads and writes and make
   relationships mandatory for newly department-owned content.
6. Remove general-content table create/update/delete grants and disable their
   dynamic provisioning in M365 sync.
7. Add translation uniqueness after duplicates are resolved.
8. Remove scalar-query fallback. Scalar columns may be removed in a later,
   separately verified schema cleanup.

The permission reduction must not deploy before the admin-client action paths,
or old session-client mutations would stop working. Relationship-dependent code
must not deploy before the schema columns exist.

## Failure Handling

- Invalid or unresolved relationships fail closed before content is returned
  or changed.
- Cross-campus departments are rejected even for a campus manager.
- A department user cannot clear ownership to create campus-wide content.
- A non-global user cannot clear the campus relationship; a global user may do
  so only for national documents and global announcements.
- Authorization errors do not reveal whether an out-of-scope row exists.
- A synchronous parent/relationship failure returns an action error and does
  not schedule automatic translation.
- Deferred translation failure leaves the source save or publish intact and
  records a sanitized diagnostic with content type and row ID, never content
  bodies.
- Repair tooling is idempotent, supports dry-run output, and never deletes a
  duplicate or orphan automatically.
- Existing scalar scope values remain available for rollback until the
  relationship rollout is verified.

## Testing Strategy

### Authorization unit tests

- global administrator can manage all general content;
- campus manager can manage every department and campus-wide content in a
  managed campus;
- campus manager is denied another campus;
- department member can list, read, create, update, publish, unpublish, and
  delete only related department content;
- department member cannot use a null department, another department, or a
  department in another campus;
- only a global administrator can use a null campus for a feature that supports
  national/global content;
- unresolved memberships fail closed;
- HR and global break-glass access jobs, while campus management and other
  departments cannot;
- navigation matches the server authorization matrix.

### Permission tests

- content tables do not grant dynamic `sg-app-*` authoring permissions;
- non-public rows do not have `read("any")`;
- public and member visibility is applied at row level;
- translation visibility matches the parent;
- M365 sync mirrors memberships without mutating general-content table
  permissions;
- recruitment permissions remain Operations Unit and HR only.

### Relationship persistence tests

For news, events, products, benefits, pages, departments, and jobs:

- a manual/direct save creates a linked source child;
- saving both locales links both children;
- an existing child ID is updated rather than duplicated;
- parent reads using relationship selection return the translations;
- parent deletion follows the configured cascade behavior where applicable;
- the repair command links a valid orphan and reports duplicates or missing
  parents without deleting them.

### Deferred translation tests

- `after()` is scheduled only after the source relationship is persisted;
- the callback uses an admin client and not request-session state;
- it reads the source through the parent relationship;
- it creates or updates only the destination locale;
- the destination is linked to the parent;
- the one-way job relation remains complete after a destination insert;
- a changed source, ownership, or status makes the callback skip persistence;
- callback failure does not change the successful source action response.

### Verification

Run focused action and authorization tests first, followed by:

- admin and API package type checks;
- the admin, API, and shared test suites;
- Ultracite on every changed file;
- Appwrite configuration contract tests;
- `git diff --check`;
- the admin production build;
- a dry-run migration report;
- manual checks with one global, campus-management, department, and HR test
  account where an Appwrite environment is available.

## Non-goals

- Granting general department teams direct Appwrite table CRUD permissions.
- Opening jobs, applicants, interviews, shop orders, or customer data to all
  departments.
- Inferring a historical department owner when no trustworthy relationship or
  scalar value exists.
- Automatically deleting orphaned or duplicate translations.
- Translating uploaded document files.
- Replacing `after()` with a durable queue or retry service in this change.
- Removing every legacy scalar column before the relationship rollout is
  proven in production.
