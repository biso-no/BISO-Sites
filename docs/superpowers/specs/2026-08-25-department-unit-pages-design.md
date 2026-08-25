# Department unit pages

**Date:** 2026-08-25
**Status:** Approved design, not yet implemented
**Scope:** `packages/api` (schema), `packages/shared`, `packages/editor`, `apps/admin`, `apps/web`

## 1. Problem

A department — say **OSL Fadderullan** at campus Oslo — has no way to shape its
own public presence. `apps/web` renders every department through one fixed
template at `/units/{$id}`: a hero plus Overview / News / Products / Team tabs,
identical for all ~200 departments, keyed by an opaque 24SO number.

Meanwhile the block editor shipped and works. Department users can already
author and publish pages in `apps/admin`, and those pages already carry a
`department_id`. What is missing is the binding: nothing connects a department
to *its* page, and nothing serves that page at a URL a student would recognise.

This document specifies that binding, the admin surface a board member uses to
manage it, and the public route that serves it.

### 1.1 Verified current state

| Finding | Evidence |
|---|---|
| `departments` (db `app`) has `Id`, `Name`, `campus_id`, `active`, `type`, `logo`, `hero`, `abbreviation` and a `pages` relationship. There is **no `slug` column**. | `packages/api/appwrite.config.json` |
| Department row `$id` **is the 24SO department number** (e.g. `308`), assigned by the sync. Public URLs are therefore `/units/308` today. | `apps/admin/src/app/api/units/sync/route.ts:52` |
| `pages` already has `slug` (unique index `page_slug_unique`), `department_id` **and** a `department` relationship, plus `campus_id`/`campus`, `status`, `visibility`. No schema change needed on `pages`. | `packages/api/appwrite.config.json` |
| A department user's saved page is already auto-stamped with their department when they belong to exactly one. | `apps/admin/src/app/(portal)/_actions/pages.ts:203` `ensureDepartmentForScoping` |
| Department users can already **publish** their own department's pages — `assertPublishAccess` delegates verbatim to `assertWriteAccess`. No approval step exists or is being added. | `apps/admin/src/lib/utils/authorization.ts:202` |
| `portal.departments` is gated to `globaladmin` + `campusadmin`. Department users cannot reach `/departments` at all. | `apps/admin/src/lib/roles.ts:68` |
| `ctx.resolvedDepartmentIds` resolves Azure group names to Appwrite department row `$id`s, and returns `[]` on lookup failure. It can be empty while `departmentTeamIds` is non-empty. | `apps/admin/src/lib/authorization.ts:79` |
| The web catch-all resolves published pages via `cachedPublishedPage(slug, locale)` — `"use cache"` over a guest client — then `resolvePageFeeds` before render. | `apps/web/src/app/(public)/[...slug]/page.tsx` |
| `savePageDraft` hardcodes `visibility: PagesVisibility.PUBLIC` for every page. There are no members-only pages. | `packages/api/page-builder.ts:401` |
| `resolveUniquePageSlug` appends `-2`, `-3`… on collision, but **only for new pages**. | `packages/api/page-builder.ts:239` |
| Only two call sites link to a department detail page, both by `$id`. | `apps/web/.../units/components/department-card.tsx:134`, `apps/web/.../campus/components/overview/departments-grid.tsx:58` |
| `sitemap.ts` emits `/units` (the index) and nothing else. **No department detail page is in the sitemap.** | `apps/web/src/app/sitemap.ts:53` |
| `sanitizeSlug` strips everything outside `[a-z0-9\s-]`, so `BGO Bærekraft` → `bgo-brekraft`. Unusable for Norwegian department names. | `apps/admin/src/lib/utils.ts:71` |
| The editor inspector renders `slug` and `department` as freely editable fields. | `packages/editor/src/components/editor-shell/inspector/index.tsx:133` |
| `EditorCallbacks` is the context seam through which the shell already passes `departments` to the inspector. | `packages/editor/src/editor/callbacks.tsx` |

## 2. Goals

1. A department board member signs into `apps/admin`, lands directly on their
   own department, and can create, edit and publish a page for it.
2. A published department page is served at `/units/<slug>` — human-readable,
   derived from the department name (`OSL Fadderullan` → `osl-fadderullan`).
3. A department that has **not** built a page keeps exactly the presence it has
   today. Nobody's public page gets worse as a result of this change.
4. Existing `/units/<24SO-number>` links keep working.
5. Campus and global admins retain the listing view and gain the same page
   management for any department in their scope.

## 3. Non-goals

- Editing department profile data (logo, hero, socials, board members,
  translated title/description) from admin. None of it is editable today; making
  it so is a separate feature. See §10.
- An approval/review step before a department publishes. Department users can
  already publish their own content; this changes nothing there.
- Renaming department slugs from admin. Slugs are assigned once, by the sync,
  and are immutable in this cut. See D6.
- Changing the draft/publish flow in `@repo/api/page-builder`.
- Changing how `/units` (the index) works, beyond linking to slugs.

## 4. Decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | Custom page **overrides**, default tabbed view is the **fallback** | Departments opt in gradually; goal 3. A hard replacement would strand ~200 departments with a 404 or a blank page |
| D2 | Add a `slug` column to `departments` | Every department needs a resolvable slug — including the ones with no page. Deriving from `Name` at runtime cannot be indexed, and a 24SO rename would silently break live URLs |
| D3 | Bind page → department by **slug convention**: `pages.slug === "units/" + department.slug` | The web route reuses `cachedPublishedPage` verbatim — same reader, same cache semantics, zero new page-builder code. The alternatives (marker column, pointer column) each cost a second schema migration *and* a new cached reader |
| D3a | The department row is resolved **first**, on every request, including the published-page path | `active` must gate both paths (§6.2), and the fallback needs the row anyway. Both reads are `"use cache"`, so this is two cache hits, not two Appwrite round-trips per visitor |
| D4 | Slug assignment lives in the existing `POST /api/units/sync` | It is already the only writer of department rows. `upsertRow` patches named columns, so a slug set once survives every later sync. The first run *is* the backfill; no migration script |
| D5 | Non-admins redirect to their department only when they have **exactly one** | A two-board member sent to an arbitrary one, with the other unreachable, is a bug. Zero resolved departments must not fall through to the full listing |
| D6 | No slug-editing UI; slugs immutable from admin | Removes the need for cascade logic entirely rather than building rename machinery for a rename nobody can trigger |
| D7 | Publish/unpublish stay in the editor topbar | The detail page showing status and linking into the editor avoids duplicating the publish authorization surface |
| D8 | Unit pages stay visible in the `/pages` list | A page vanishing from the list it was created in is more surprising than it appearing in two places |
| D9 | Slug/department immutability enforced **server-side**, not just in the UI | Read-only inputs are convenience. `savePageEditorDoc` is the boundary |

## 5. Data model

### 5.1 Schema change

Add to table `departments` (database `app`) in `packages/api/appwrite.config.json`:

- Column `slug` — `string`, size `128`, **not required**, no default.
- Index `department_slug_unique` — `unique`, on `slug`, ascending.

Nullable on purpose: rows exist before the first sync run assigns them a slug,
and a unique index in Appwrite permits multiple nulls.

The repo owner pushes this to Appwrite and regenerates
`packages/api/types/appwrite.ts` via `appwrite types -l ts ./types`. Both files
are normally generated-only; editing the config here is a one-off exception the
owner has authorised for this change.

### 5.2 Slug generation

New module `packages/shared/utils/unit-slug.ts`, needed by `apps/admin` (sync +
actions) and available to `apps/web`, so both produce byte-identical output.

```
unitSlug("OSL Fadderullan")  → "osl-fadderullan"
unitSlug("BGO Bærekraft")    → "bgo-baerekraft"
unitSlug("TRD Ølutvalget")   → "trd-oelutvalget"
```

Order of operations: lowercase → map `æ→ae`, `ø→oe`, `å→aa` → NFD-normalise and
strip remaining combining marks → drop anything outside `[a-z0-9\s-]` →
collapse whitespace to `-` → collapse repeated `-` → trim leading/trailing `-`
→ fall back to `"unit"` when the result is empty.

The Norwegian mapping must run **before** the NFD strip; otherwise `ø` (which
has no decomposition) is dropped outright and `Ølutvalget` becomes `lutvalget`.

A second export handles collisions:

```
uniqueUnitSlug(base, taken: Set<string>) → base | `${base}-2` | `${base}-3` …
```

### 5.3 Assignment in the sync

`POST /api/units/sync` gains one read before its upsert loop: list all
`departments` selecting `$id, slug`, producing

- `slugged: Set<$id>` — rows that already have a slug, and
- `taken: Set<string>` — every slug currently in use.

Then, per 24SO department, `slug` is added to the upsert payload **only when
`$id ∉ slugged`**, computed as `uniqueUnitSlug(unitSlug(name), taken)` with each
newly-assigned slug added to `taken` so a single batch cannot self-collide.

Consequences, stated plainly:

- A slug, once set, is never rewritten by a later sync.
- A 24SO rename changes `Name` and leaves the live URL alone.
- Departments created in 24SO after the first run get their slug on the next run.

## 6. Public site (`apps/web`)

### 6.1 Route

`(public)/units/[id]/` is **renamed** to `(public)/units/[slug]/` — Next.js
cannot host two different dynamic segment names at one path level. The existing
`components/` subtree (`department-hero.tsx`, `*-tab.tsx`, `social-links.tsx`)
moves with it unchanged.

### 6.2 Resolution order

```
/units/osl-fadderullan
 │
 ├─1. cachedDepartmentBySlug("osl-fadderullan")
 │     not found  →  getRow("departments", param) — legacy $id URL
 │                     found && row.slug  →  permanentRedirect(`/units/${row.slug}`)
 │                     otherwise          →  notFound()
 │     found but not active  →  notFound()
 │
 ├─2. cachedPublishedPage("units/osl-fadderullan", locale)
 │     translation.is_published && doc  →  resolvePageFeeds  →  <RenderedPage>
 │
 └─3. getDepartmentById($id, locale)
       →  <DepartmentHero> + <DepartmentTabsClient>   (today's view)
```

The department is resolved first, on every request, for two reasons. It gates
both paths on `active` — a department dissolved in 24SO must stop serving its
custom page, not just its default view, and today's route already 404s on
`!department_ref.active`. And the fallback needs the row regardless. Since both
reads are `"use cache"`, this is two cache hits per visitor rather than two
Appwrite round-trips (D3a).

Step 2 is the reader the catch-all already uses, so guest permissions, the
`read(any)`-on-publish row model and the `"use cache"` lifetime all carry over
without modification. The catch-all's session-scoped fallback for members-only
pages is deliberately **not** ported — per §1.1 every page is `visibility:
PUBLIC`, so there is nothing for it to find.

Resolving by slug before falling back to `$id` also fixes the precedence
question the other way round: if a generated slug ever equals some *other*
department's numeric `$id`, the slug wins, which is the correct answer.

`export const instant = false` carries over from the catch-all, for the reason
documented there: once the instant shell flushes, the response is committed as
200 and `notFound()` can no longer produce a real 404 for a crawler.

### 6.3 New cached reader

`cachedDepartmentBySlug(slug)` joins `apps/web/src/lib/data/public-content.ts`,
following that module's rules — `"use cache"`, `cacheLife("minutes")`,
`createPublicClient()`, errors left to throw so a transient failure cannot
poison the cache.

### 6.4 Metadata, links, sitemap

- `generateMetadata` prefers the published page's translation title/description,
  falling back to the existing department translation, then to a bare title.
- `getDepartments` adds `department_ref.slug` to its `Query.select` so cards can
  build slug hrefs.
- The two `$id` call sites in §1.1 switch to `dept.slug`, keeping `$id` as a
  fallback so a not-yet-slugged department still links somewhere valid.
- `sitemap.ts` gains one entry per **active** department at `/units/<slug>`.
  This is a net-new addition — department detail pages are absent from the
  sitemap today.

## 7. Admin (`apps/admin`)

### 7.1 Access

`roles.ts`: `"portal.departments"` becomes
`[GLOBAL_ADMIN, CAMPUS_ADMIN, DEPARTMENT_ROLE]`. `requireNavAccess` already
supplies `departmentTeamIds.length > 0` for the pseudo-role, so no other
plumbing changes. The `/departments` nav leaf and command-palette entry both
read from `NAV_ACCESS` and inherit this automatically.

### 7.2 Landing rule

In `(portal)/departments/page.tsx`, after `requireNavAccess("portal.departments")`:

| Caller | Result |
|---|---|
| `globaladmin` or `campusadmin` | Listing, scoped as today |
| Neither, `resolvedDepartmentIds.length === 1` | `redirect("/departments/<id>")` |
| Neither, `resolvedDepartmentIds.length >= 2` | Listing, scoped to exactly those ids |
| Neither, `resolvedDepartmentIds.length === 0` | `notFound()` |

The last row is not hypothetical: `resolveDepartmentIds` returns `[]` on lookup
failure, and an Azure group with no matching Appwrite row resolves to nothing.
Passing the nav gate while owning no department must not become access to the
full listing.

`listDepartments` gains an `ids?: string[]` option applying
`Query.equal("$id", ids)`. The `departments` table is `read("any")`, so this
scoping is the authorization boundary — it cannot be left to row security.

The decision is a pure function `resolveDepartmentsLanding(ctx)` in
`src/lib/departments.ts`, returning a discriminated result, so it is unit
testable without a request.

### 7.3 Detail route

New `(portal)/departments/[id]/page.tsx`. Gate: `requireNavAccess`, then
`canManageDepartment(ctx, department)` — also in `src/lib/departments.ts`:

- `globaladmin` → any department
- `campusadmin` → `department.campus_id ∈ ctx.managedCampusIds`
- otherwise → `department.$id ∈ ctx.resolvedDepartmentIds`

Failure is `notFound()`, matching `requireNavAccess`'s existing behaviour for an
authenticated user who lacks access.

Both helpers live in a plain module rather than the actions file because a
`"use server"` module may export only async functions — a non-async export there
fails the build (and `check-types` does not catch it).

Content, per the approved scope:

```
┌─ OSL Fadderullan · Oslo · Association ──┐
│                                          │
│  Public page                             │
│  ● Published · /units/osl-fadderullan    │
│  [Edit page]                [View live]  │
│                                          │
│  no  ● published    en  ○ draft          │
└──────────────────────────────────────────┘
```

Read-only department header (name, campus, type, member count) sourced from the
24SO-synced row. Per D7 there is no publish control here. `View live` targets
`${NEXT_PUBLIC_BASE_URL}/units/<slug>` and renders only when published. When the
department has no slug yet, the card explains that and disables creation rather
than minting a page at an unreachable slug.

### 7.4 Actions

Two additions to `(portal)/_actions/departments.ts`:

**`getDepartmentWithPage(id)`** → `{ department, page | null }`. Auth-gated by
`canManageDepartment`. The page is the `pages` row where
`slug === "units/" + department.slug`, selected with `translation_refs.*` so the
card can show per-locale published state.

**`createUnitPage(id)`** → `{ pageId } | { error }`:

1. `requireAuth` + `canManageDepartment`, else return an error.
2. Return early with the existing page's id if that slug is already taken —
   **idempotent by design**.
3. Otherwise `savePageDraft` with the seed doc below.
4. `logAuditEvent(ctx, "unit_page_created", …)`, `revalidatePath` for
   `/departments` and `/departments/<id>`.

Seed document:

```
{
  blocks: [],
  meta: {
    title:       department.Name,
    slug:        `units/${department.slug}`,
    department:  department.$id,
    status:      "draft",
    accentColor: "#3DA9E0",
    description: "",
  },
}
```

Step 2 is load-bearing, not defensive padding. `resolveUniquePageSlug` silently
appends `-2` when a new page's slug collides, and a unit page at
`units/osl-fadderullan-2` is permanently unreachable — the web route only ever
looks up the unsuffixed slug. Creating deterministically here, rather than
letting the editor's `new` flow mint the slug on first save, closes that hole.

### 7.5 Protecting the binding

Because the slug *is* the binding (D3), both halves are guarded:

**UI.** `EditorCallbacks` gains optional
`lockedMeta?: { slug?: boolean; department?: boolean }`, threaded from
`(editor)/pages/[id]/page.tsx` → `PageEditorClient` → `EditorShell` → context.
`PageTab` renders those two fields read-only, with a short hint, when set. The
route sets it when the loaded page's `slug` starts with `units/`. Default
undefined, so every other page editor behaves exactly as before.

**Server.** `savePageEditorDoc` rejects any save that changes `slug` or
`department` when the **persisted** page's slug starts with `units/`, returning
the standard `{ error }` shape. This is the enforcement; the read-only inputs
are convenience (D9).

## 8. Known, accepted behaviours

1. **`pages.campus_id` may disagree with `department.campus_id`.** A global
   admin creating a unit page for another campus's department gets `campus` from
   `resolvePageCampusId(ctx)` — their active campus, possibly null. Harmless:
   both the URL and content scoping key off the department. Correcting it would
   change shared `savePageDraft` behaviour for every page type, which is out of
   scope.
2. **Unit pages appear in `/pages`** alongside ordinary pages (D8).
3. **A department with no slug cannot have a page** until the next sync run.
   Surfaced explicitly in the detail card rather than failing silently.

## 9. Testing

`bun:test`, matching the existing `_actions/*.test.ts` convention.

| Unit | Cases |
|---|---|
| `unitSlug` | Norwegian `æ/ø/å`; diacritic stripping; the `ø`-before-NFD ordering trap; empty-result fallback |
| `uniqueUnitSlug` | First-wins, `-2`/`-3` suffixing, no self-collision within a batch |
| `resolveDepartmentsLanding` | All four rows of §7.2, explicitly including team-membership-with-zero-resolved-ids |
| `canManageDepartment` | Global; campus admin in scope; campus admin cross-campus denied; department member; non-member denied |
| `savePageEditorDoc` guard | Slug change rejected, department change rejected, both allowed on a non-`units/` page |

Web route resolution (the four-step order, the 301, the fallback) is verified by
hand against a real published page rather than by mocking Appwrite plus the
`"use cache"` layer.

**`bun run build --filter=admin` is required before this is called done**, not
just `check-types`: the new `"use server"` exports cannot be validated any other
way (`apps/admin/CLAUDE.md`, "App-specific patterns").

## 10. Follow-ups (explicitly out of scope)

- Department profile editing in admin: logo, hero, socials, board members, and
  the translated title/description in `content_translations`.
- A department-scoped content hub (that department's news / events / products).
- Slug editing with cascade to the bound page (D6).
- Blocks that read `department_board` / `department_socials`, so a custom page
  can reproduce the Team and contact sections of the default view.
