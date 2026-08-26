# Department unit pages

**Date:** 2026-08-25
**Status:** Approved design, not yet implemented
**Scope:** `packages/api` (schema), `packages/editor`, `apps/admin`, `apps/web`

## 1. Problem

A department — say **Fadderullan** — has no way to shape its own public presence.
`apps/web` renders every department through one fixed template at
`/units/{$id}`: a hero plus Overview / News / Products / Team tabs, identical for
all departments, keyed by an opaque 24SO/Finago accounting number that only
BISO staff have ever seen.

Meanwhile the block editor shipped and works. Department users can already
author and publish pages in `apps/admin`, and those pages already carry a
`department_id`. What is missing is the binding: nothing connects a department
to *its* page, and nothing serves that page at a URL a student would recognise.

Fadderullan also exists at four campuses — `OSL Fadderullan`, `BRG Fadderullan`,
`TRD Fadderullan`, `STV Fadderullan` — as four separate rows. The site is already
campus-filtered from the top nav, so the URL students see should be
`/units/fadderullan`, resolving to whichever campus they are looking at.

This document specifies the binding, the admin surface a board member uses to
manage it, and the public routes that serve it.

### 1.1 Verified current state

| Finding | Evidence |
|---|---|
| `departments` (db `app`) has `Id`, `Name`, `campus_id`, `active`, `type`, `logo`, `hero`, `abbreviation` and a `pages` relationship. There is **no `slug` column**. | `packages/api/appwrite.config.json` |
| Department row `$id` **is the 24SO/Finago department number** (e.g. `308`), assigned by the sync. It is internal accounting identity; students never see it. | `apps/admin/src/app/api/units/sync/route.ts:52` |
| `pages` already has `slug` (**globally** unique index `page_slug_unique`), `department_id` **and** a `department` relationship, plus `campus_id`/`campus`, `status`, `visibility`. No schema change needed on `pages`. | `packages/api/appwrite.config.json` |
| **A multi-column unique index in Appwrite constrains the tuple, not each column.** `page_translations.page_locale_unique(page_id, locale)` permits one `no` and one `en` row per page — the translation system depends on it. `content_translations.uniq_content_locale` does the same across three columns. | `packages/api/appwrite.config.json` |
| `apps/admin/src/lib/it/department-matching.ts` **already** exports `CAMPUS_PREFIXES = ["OSL","BRG","TRD","STV"]`, `extractCampusPrefix`, `normalizeForCompare` (strips the prefix, folds `ø→o`, `æ→ae`, `å→a`), `isClosedName` and `stripClosedSuffix`. All unit-tested. | `department-matching.ts`, `department-matching.test.ts` |
| Closed 24SO units are renamed with a `" - nedlagt"` suffix and carry `active: false`. | `department-matching.ts` `CLOSED_REGEX` |
| `getActiveCampus()` returns **`null` for "all campuses"** — the value for every fresh visitor, every cookieless client and every crawler. | `apps/web/src/app/actions/campus.ts:138` |
| Campus identity is `CAMPUS_NAME_TO_ID` — Oslo=1, Bergen=2, Trondheim=3, Stavanger=4, National=5. The `campus` table has a `name` column and no slug. | `apps/admin/src/lib/campus-constants.ts` |
| A department user's saved page is already auto-stamped with their department when they belong to exactly one. | `apps/admin/src/app/(portal)/_actions/pages.ts:203` `ensureDepartmentForScoping` |
| Department users can already **publish** their own department's pages — `assertPublishAccess` delegates verbatim to `assertWriteAccess`. No approval step exists or is being added. | `apps/admin/src/lib/utils/authorization.ts:202` |
| `portal.departments` is gated to `globaladmin` + `campusadmin`. Department users cannot reach `/departments` at all. | `apps/admin/src/lib/roles.ts:68` |
| `ctx.resolvedDepartmentIds` resolves Azure group names to Appwrite department row `$id`s, and returns `[]` on lookup failure. It can be empty while `departmentTeamIds` is non-empty. | `apps/admin/src/lib/authorization.ts:79` |
| The web catch-all resolves published pages via `cachedPublishedPage(slug, locale)` — `"use cache"` over a guest client — then `resolvePageFeeds` before render. | `apps/web/src/app/(public)/[...slug]/page.tsx` |
| `savePageDraft` hardcodes `visibility: PagesVisibility.PUBLIC` for every page. There are no members-only pages. | `packages/api/page-builder.ts:401` |
| `resolveUniquePageSlug` appends `-2`, `-3`… on collision, but **only for new pages**. | `packages/api/page-builder.ts:239` |
| Only two call sites link to a department detail page, both by `$id`. | `apps/web/.../units/components/department-card.tsx:134`, `apps/web/.../campus/components/overview/departments-grid.tsx:58` |
| `sitemap.ts` emits `/units` (the index) and nothing else. **No department detail page is in the sitemap.** | `apps/web/src/app/sitemap.ts:53` |
| `sanitizeSlug` strips everything outside `[a-z0-9\s-]`, so `BGO Bærekraft` → `bgo-brekraft`. Unusable for department names; `normalizeForCompare` is the correct primitive. | `apps/admin/src/lib/utils.ts:71` |
| The editor inspector renders `slug` and `department` as freely editable fields. | `packages/editor/src/components/editor-shell/inspector/index.tsx:133` |
| `EditorCallbacks` is the context seam through which the shell already passes `departments` to the inspector. | `packages/editor/src/editor/callbacks.tsx` |

## 2. Goals

1. A department board member signs into `apps/admin`, lands directly on their
   own department, and can create, edit and publish a page for it.
2. Students reach a department at a campus-agnostic, human-readable URL —
   `/units/fadderullan` — which follows the campus filter in the top nav.
3. Department pages are **indexable and shareable** at a stable, campus-explicit
   URL that does not depend on the visitor's cookie.
4. A department that has **not** built a page keeps exactly the presence it has
   today. Nobody's public page gets worse as a result of this change.
5. Campus and global admins retain the listing view and gain the same page
   management for any department in their scope.

## 3. Non-goals

- Editing department profile data (logo, hero, socials, board members,
  translated title/description) from admin. None of it is editable today; making
  it so is a separate feature. See §11.
- An approval/review step before a department publishes. Department users can
  already publish their own content; this changes nothing there.
- Renaming department slugs from admin. Slugs are assigned once, by the sync,
  and are immutable in this cut. See D6.
- Changing the draft/publish flow in `@repo/api/page-builder`.
- Changing how `/units` (the index) works, beyond linking to slugs.
- Preserving `/units/<24SO-number>` links as a supported contract. A redirect
  exists as a cheap safety net, but those IDs are internal accounting identity
  that students have never been shown. See §9.1.

## 4. Decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | Custom page **overrides**, default tabbed view is the **fallback** | Departments opt in gradually; goal 4. A hard replacement would strand every department with a 404 or a blank page |
| D2 | `departments.slug` is **campus-agnostic** (`fadderullan`), unique on **`(slug, campus_id)`** | Goal 2. The four campus rows share one student-facing name. A composite unique index constrains the tuple, so all four coexist while a second Oslo `fadderullan` is rejected |
| D2a | Index column order is **`(slug, campus_id)`**, not the reverse | Tuple uniqueness is order-independent, but only this order's leftmost prefix serves the chooser's `slug = X across all campuses` query. One index instead of two |
| D3 | Bind page → department by **slug convention**: `pages.slug === "units/<campus>/<dept-slug>"` | Reuses `cachedPublishedPage` verbatim — same reader, same cache semantics, zero new page-builder code. The campus segment is forced by `page_slug_unique` being global: four campuses cannot share one page slug |
| D3a | The department row is resolved **first**, on every request, including the published-page path | `active` must gate both paths (§6.3), and the fallback needs the row anyway. Both reads are `"use cache"`, so this is two cache hits, not two Appwrite round-trips per visitor |
| D4 | Slug assignment lives in the existing `POST /api/units/sync` | It is already the only writer of department rows. `upsertRow` patches named columns, so a slug set once survives every later sync. The first run *is* the backfill; no migration script |
| D5 | Non-admins redirect to their department only when they have **exactly one** | A two-board member sent to an arbitrary one, with the other unreachable, is a bug. Zero resolved departments must not fall through to the full listing |
| D6 | No slug-editing UI; slugs immutable from admin | Removes the need for cascade logic entirely rather than building rename machinery for a rename nobody can trigger |
| D7 | Publish/unpublish stay in the editor topbar | The detail page showing status and linking into the editor avoids duplicating the publish authorization surface |
| D8 | Unit pages stay visible in the `/pages` list | A page vanishing from the list it was created in is more surprising than it appearing in two places |
| D9 | Slug/department immutability enforced **server-side**, not just in the UI | Read-only inputs are convenience. `savePageEditorDoc` is the boundary |
| D10 | **Only active departments get slugs** | A closed `"OSL Foo - nedlagt"` would otherwise hold `foo` at campus 1 and push a live replacement to `foo-2` — the dead unit taking the clean URL. Closed units 404 regardless |
| D11 | Ambiguous or unmatched slug → **campus chooser**, never a guess | With no filter set (the crawler and fresh-visitor case) four departments match. Defaulting to one campus silently serves Oslo to a Bergen student |
| D12 | Reuse `it/department-matching.ts` primitives; do **not** write a second normalizer | It already strips campus prefixes and folds `ø→o`, `æ→ae`, `å→a`, with tests. Two competing normalizations of the same names is a bug farm — which transliteration is nicer matters far less than there being exactly one |
| D13 | Two public routes: `/units/<slug>` (filter-following) and `/units/<campus>/<slug>` (canonical) | Goal 3. Under the chooser alone, a cookieless crawler *always* gets the chooser, so no department page content would ever be indexed |

## 5. Data model

### 5.1 Schema change

Add to table `departments` (database `app`) in `packages/api/appwrite.config.json`:

- Column `slug` — `string`, size `128`, **not required**, no default.
- Index `department_slug_campus_unique` — `unique`, on `(slug, campus_id)`, in
  that order (D2a).

Nullable on purpose: rows exist before the first sync assigns them a slug, and
inactive rows never get one (D10).

**Push order matters.** Push the **column** first, run the sync to backfill, then
push the **index**. Unique indexes do not constrain `NULL`, so unslugged rows are
fine — *if* Appwrite writes unset optional strings as `NULL` rather than `""`. If
it writes `""`, every unslugged Oslo row collides at `('', '1')` and index
creation fails outright. Backfilling first makes the question moot.

The repo owner pushes this to Appwrite and regenerates
`packages/api/types/appwrite.ts` via `appwrite types -l ts ./types`. Both files
are normally generated-only; editing the config here is a one-off exception the
owner has authorised for this change.

### 5.2 Slug generation

New `apps/admin/src/lib/departments.ts` — the same plain module that holds the
authorization helpers in §7.3 — composing the existing primitives (D12):

```
unitSlug(name) =
  stripClosedSuffix(name)        // "OSL Foo - nedlagt" → "OSL Foo"
  |> normalizeForCompare         // strips OSL|BRG|TRD|STV, folds ø→o æ→ae å→a,
                                 //   lowercases, collapses whitespace
  |> replace(/\s+/g, "-")
  |> replace(/[^a-z0-9-]/g, "")
  |> collapse and trim "-"
  |> || "unit"                   // never empty
```

```
unitSlug("OSL Fadderullan")   → "fadderullan"
unitSlug("BRG Næringsliv")    → "naeringsliv"
unitSlug("TRD Sosialt Utvalg")→ "sosialt-utvalg"
unitSlug("Sentralt utvalg")   → "sentralt-utvalg"   // no prefix, unchanged
```

Two further exports from the same module:

```
uniqueUnitSlug(base, takenInCampus: Set<string>) → base | `${base}-2` | …

unitPageSlug(department) → `units/${campusIdToSegment(department.campus_id)}/${department.slug}`
```

`unitPageSlug` is the single definition of the page↔department binding (D3).
Every producer and consumer — `createUnitPage`, `getDepartmentWithPage`, the
"View live" link, both web routes — goes through it, so the convention cannot
drift between the code that writes it and the code that reads it.

The campus prefix is stripped unconditionally, matching `normalizeForCompare`'s
existing behaviour. The prefix set is four specific tokens that no Norwegian
word begins with, so accidental stripping is not a practical risk and no
prefix-matches-campus cross-check is warranted.

### 5.3 Assignment in the sync

`POST /api/units/sync` gains one read before its upsert loop: list all
`departments` selecting `$id, campus_id, slug`, producing

- `slugged: Set<$id>` — rows that already have a slug, and
- `taken: Map<campusId, Set<slug>>` — slugs in use, **per campus**.

Then, per 24SO department, `slug` is added to the upsert payload only when
**both** hold:

1. `$id ∉ slugged` — never rewrite an assigned slug, and
2. the department is active in the REST result — closed units get none (D10).

The value is `uniqueUnitSlug(unitSlug(name), taken.get(campusId))`, with each
newly-assigned slug added to that campus's set so one batch cannot self-collide.

Consequences, stated plainly:

- A slug, once set, is never rewritten by a later sync.
- A 24SO rename changes `Name` and leaves the live URL alone.
- Departments created in 24SO after a run get their slug on the next run.
- A department that goes inactive **keeps** its slug and simply stops resolving.

## 6. Public site (`apps/web`)

### 6.1 Routes

`(public)/units/[id]/` is replaced by a **catch-all**,
`(public)/units/[...segments]/`, handling both shapes:

| URL | Role |
|---|---|
| `/units/fadderullan` | Student-facing. Follows the top-nav campus filter. Chooser when ambiguous. |
| `/units/oslo/fadderullan` | Canonical. Cookie-independent, self-canonical, sitemap-listed, indexable. |

A catch-all rather than two files because **Next.js forbids two different
dynamic segment names at one path level** — `units/[slug]` and
`units/[campus]/[slug]` conflict on the first segment. One dispatch point on
`segments.length` avoids the conflict and shares the rendering logic, which is
identical once a department is resolved. `/units` itself still matches
`units/page.tsx`; a catch-all requires at least one segment.

The existing `components/` subtree (`department-hero.tsx`, `*-tab.tsx`,
`social-links.tsx`) moves across unchanged.

Campus segments are `CAMPUS_NAME_TO_ID` keys lowercased — `oslo`, `bergen`,
`trondheim`, `stavanger`, `national` — with a shared bidirectional helper so
the segment and the id never drift.

### 6.2 Two-segment resolution — `/units/oslo/fadderullan`

```
1. campusSegmentToId("oslo") → "1"        unknown → notFound()
2. cachedDepartmentBySlugAndCampus("fadderullan", "1")
      not found, or not active            → notFound()
3. cachedPublishedPage("units/oslo/fadderullan", locale)
      published → resolvePageFeeds → <RenderedPage>
4. else → getDepartmentById($id, locale) → today's tabbed view
```

No cookie is read, so this URL renders identically for every visitor. It sets
`alternates.canonical` to itself.

### 6.3 One-segment resolution — `/units/fadderullan`

```
1. cachedDepartmentsBySlug("fadderullan")   → active rows, ALL campuses
      none → getRow("departments", segment)  // legacy 24SO $id
               found && row.slug → permanentRedirect(`/units/${row.slug}`)
               otherwise         → notFound()
2. getActiveCampus()
      null                → <CampusChooser> over all matches
      set, no match       → <CampusChooser> over matches, "Not at Stavanger"
      set, match          → that department
3. cachedPublishedPage("units/<campus>/fadderullan", locale)
      published → resolvePageFeeds → <RenderedPage>
4. else → getDepartmentById($id, locale) → today's tabbed view
```

One cached query by slug serves all three branches of step 2. The department is
resolved before the page (D3a) because `active` must gate both paths — a
department dissolved in 24SO must stop serving its custom page, not just its
default view, and today's route already 404s on `!department_ref.active`.

When a department **is** resolved, this URL sets `alternates.canonical` to the
two-segment URL, so the two routes never compete as duplicate content.

Step 3 is the reader the catch-all already uses, so guest permissions, the
`read(any)`-on-publish row model and the `"use cache"` lifetime all carry over
unmodified. The catch-all's session-scoped fallback for members-only pages is
deliberately **not** ported — per §1.1 every page is `visibility: PUBLIC`, so
there is nothing for it to find.

`export const instant = false` carries over from the catch-all, for the reason
documented there: once the instant shell flushes, the response is committed as
200 and `notFound()` can no longer answer a crawler with a real 404.

### 6.4 The campus chooser

A small server component rendered in place of the page body. It receives the
matching departments (campus id, campus name, department name) and an optional
"not at *X*" notice.

Each choice is a form posting to a server action that calls
`setActiveCampus(campusId)`. The action's own re-render then reads the new
cookie and resolves the department, so the student stays on `/units/fadderullan`
and sees the page in one round trip — and the filter they just set follows them
across the whole site, which is the behaviour this option was chosen for. Copy
goes through `next-intl` like the rest of `(public)`.

`setActiveCampus` already exists and is cookie-first, with a best-effort mirror
to an authenticated user's prefs; it never provisions a session for anonymous
visitors (`apps/web/src/app/actions/campus.ts:169`).

### 6.5 New cached readers

Both join `apps/web/src/lib/data/public-content.ts`, following that module's
rules — `"use cache"`, `cacheLife("minutes")`, `createPublicClient()`, errors
left to throw so a transient failure cannot poison the cache:

- `cachedDepartmentsBySlug(slug)` — active rows across all campuses. Served by
  the `(slug, campus_id)` index prefix (D2a).
- `cachedDepartmentBySlugAndCampus(slug, campusId)` — full index hit.

### 6.6 Metadata, links, sitemap

- `generateMetadata` prefers the published page's translation title/description,
  falling back to the existing department translation, then a bare title.
  Canonical per §6.2 / §6.3.
- `getDepartments` adds `department_ref.slug` to its `Query.select` so cards can
  build slug hrefs.
- The two `$id` call sites in §1.1 link to the **canonical** two-segment URL,
  which they can build because they already know each department's campus.
  `$id` stays as a fallback so a not-yet-slugged department still links
  somewhere valid.
- `sitemap.ts` gains one entry per active, slugged department at its
  **canonical** URL. Net-new: no department detail page is in the sitemap today.

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
┌─ OSL Fadderullan · Oslo · Association ──────┐
│                                              │
│  Public page                                 │
│  ● Published · /units/oslo/fadderullan       │
│  [Edit page]                    [View live]  │
│                                              │
│  no  ● published    en  ○ draft              │
└──────────────────────────────────────────────┘
```

Read-only department header (name, campus, type, member count) sourced from the
24SO-synced row. Per D7 there is no publish control here. `View live` targets
`${NEXT_PUBLIC_BASE_URL}/units/<campus>/<slug>` — the canonical URL, so a board
member copying it shares their own campus's page rather than the reader's. When
the department has no slug yet (inactive, or synced since the last run), the
card explains that and disables creation rather than minting a page at an
unreachable slug.

### 7.4 Actions

Two additions to `(portal)/_actions/departments.ts`:

**`getDepartmentWithPage(id)`** → `{ department, page | null }`. Auth-gated by
`canManageDepartment`. The page is the `pages` row where `slug ===
unitPageSlug(department)`, selected with `translation_refs.*` so the card can
show per-locale published state.

**`createUnitPage(id)`** → `{ pageId } | { error }`:

1. `requireAuth` + `canManageDepartment`, else return an error.
2. Error out when the department has no slug.
3. Return early with the existing page's id if that slug is already taken —
   **idempotent by design**.
4. Otherwise `savePageDraft` with the seed doc below.
5. `logAuditEvent(ctx, "unit_page_created", …)`, `revalidatePath` for
   `/departments` and `/departments/<id>`.

Seed document:

```
{
  blocks: [],
  meta: {
    title:       department.Name,
    slug:        `units/${campusSegment(department.campus_id)}/${department.slug}`,
    department:  department.$id,
    status:      "draft",
    accentColor: "#3DA9E0",
    description: "",
  },
}
```

The campus segment derives from **`department.campus_id`**, never from the
author's campus context — a global admin creating a page for an Oslo department
must produce `units/oslo/…` regardless of their own active campus.

Step 3 is load-bearing, not defensive padding. `resolveUniquePageSlug` silently
appends `-2` when a new page's slug collides, and a unit page at
`units/oslo/fadderullan-2` is permanently unreachable — the web routes only ever
look up the unsuffixed slug. Creating deterministically here, rather than letting
the editor's `new` flow mint the slug on first save, closes that hole.

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

## 8. Sequencing

1. Schema: push the `slug` **column** (§5.1).
2. Ship `unitSlug` + the sync change; run the sync to backfill.
3. Schema: push the `department_slug_campus_unique` **index**.
4. Ship the admin surface (§7) and the public routes (§6).

Steps 1–3 are ordered to sidestep the `NULL` vs `""` question entirely, and
because a backfilled dataset is what the unique index should first be applied to.

## 9. Known, accepted behaviours

1. **A legacy `/units/308` link redirects to `/units/fadderullan`, which then
   follows the visitor's filter.** An old Oslo link opened by a Bergen-filtered
   student lands on Bergen's page. Acceptable: those IDs are internal 24SO
   accounting identity that students were never shown, and the alternative — a
   link that silently rewrites a site-wide preference — is worse.
2. **`pages.campus_id` may disagree with `department.campus_id`.** A global
   admin creating a unit page for another campus's department gets `campus` from
   `resolvePageCampusId(ctx)` — their active campus, possibly null. Harmless:
   the URL, the slug and content scoping all key off the department. Correcting
   it would change shared `savePageDraft` behaviour for every page type.
3. **Unit pages appear in `/pages`** alongside ordinary pages (D8).
4. **A department that goes inactive keeps its slug** and stops resolving. If a
   replacement unit is later created with the same name, it gets `-2`. Rare, and
   fixable only once slug editing exists (D6, §11).

## 10. Testing

`bun:test`, matching the existing `_actions/*.test.ts` convention.

| Unit | Cases |
|---|---|
| `unitSlug` | Prefix stripping for all four codes; `ø/æ/å` folding; `" - nedlagt"` suffix; multi-word names; unprefixed national names; empty-result fallback |
| `uniqueUnitSlug` | First-wins; `-2`/`-3` suffixing; **same slug in two campuses does not collide**; no self-collision within a batch |
| Sync assignment | Existing slug never rewritten; inactive department gets none; per-campus `taken` sets kept separate |
| `campusSegmentToId` / `campusIdToSegment` | Round-trips for all five campuses; unknown segment → null |
| `resolveDepartmentsLanding` | All four rows of §7.2, explicitly including team-membership-with-zero-resolved-ids |
| `canManageDepartment` | Global; campus admin in scope; campus admin cross-campus denied; department member; non-member denied |
| `unitPageSlug` | Derives from the department's campus, not the author's |
| `savePageEditorDoc` guard | Slug change rejected; department change rejected; both allowed on a non-`units/` page |

Route resolution (both shapes, the chooser's three branches, the legacy
redirect, the canonical tags) is verified by hand against a real published page
rather than by mocking Appwrite plus the `"use cache"` layer.

**`bun run build --filter=admin` is required before this is called done**, not
just `check-types`: the new `"use server"` exports cannot be validated any other
way (`apps/admin/CLAUDE.md`, "App-specific patterns").

## 11. Follow-ups (explicitly out of scope)

- Department profile editing in admin: logo, hero, socials, board members, and
  the translated title/description in `content_translations`.
- A department-scoped content hub (that department's news / events / products).
- Slug editing with cascade to the bound page (D6), which would also make §9.4
  recoverable.
- Blocks that read `department_board` / `department_socials`, so a custom page
  can reproduce the Team and contact sections of the default view.
- A cross-campus "Fadderullan at other campuses" strip on unit pages, now that
  the sibling departments are one indexed query away.
