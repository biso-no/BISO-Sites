# Admin navigation restructure + unified command palette — design

**Date:** 2026-07-09
**Status:** Approved (pending spec review)
**App:** `apps/admin` (plus assistant tools in `packages/ai`)

## Problem

A global administrator currently sees ~20 top-level sidebar items in the admin
app (`apps/admin/src/app/(portal)/sidebar.tsx`). Queue-like pages (Approvals,
Submissions), settings children (Feature flags, Payment settings, Operations
health), and content destinations all compete at the same level. The ⌘K
command palette is a static mirror of that nav, and the AI assistant — although
it already has content/approvals/feature-flag/M365 tools — is a separate,
disconnected surface.

## Goals

1. Cut the global-admin sidebar to ~8 top-level entries without hiding anything
   more than one expand-click away.
2. Make ⌘K the fastest way to reach anything: commands, entities, and AI.
3. Fill assistant tool gaps so it can genuinely operate the platform.

## Non-goals

- No redesign of individual pages (Studio visual language stays).
- No ambient/contextual per-page AI (future project).
- No changes to role derivation or `NAV_ACCESS` semantics — only new keys.

## 1. Information architecture

Top level for a global admin (8 entries):

| Top level | Children (expandable in sidebar) | Route changes |
|---|---|---|
| Overview | — | none (`/`) |
| Inbox (badge) | Approvals, Submissions as tabs | new `/inbox`; `/approvals`, `/submissions` redirect |
| Content | Pages, News, Events, Jobs, Communications, Benefits, Drafts | none — URLs stay flat (`/jobs`, `/news`, …); only the nav nests |
| Shop | — (existing in-page sub-nav) | none |
| Organization | Departments, Documents | none |
| Analytics | — | none |
| System | IT Console, Activity, Operations, Feature flags, Payments, Settings | `/operations` → `/settings/operations`, `/feature-flags` → `/settings/feature-flags`, `/payment-settings` → `/settings/payments`; `/settings` becomes a hub with a shared sub-nav layout. `/it` and `/activity` keep their URLs, nav nests them |

### Sidebar behavior

- `NAV_ITEMS` becomes a tree (`{ navKey, path, icon, labelKey, children?[] }`).
- Accordion: the group containing the active route auto-expands; expanding one
  group collapses the others; a chevron allows manual toggling.
- A group whose visible children filter to zero (via `hasNavAccess`) is hidden.
  A group with exactly one visible child flattens to a plain link.
- `NAV_ACCESS` in `src/lib/roles.ts` remains the single permission source.
  New keys: `portal.inbox` (union of approvals+submissions access). Settings
  children keep `portal.settings`.
- Redirects for moved routes are permanent and live in
  `apps/admin/next.config.ts` `redirects()`.

## 2. Inbox

- New `/inbox` route with tabs: `/inbox/approvals`, `/inbox/submissions`
  (the existing page/component trees move under it; `[topic]` submission detail
  becomes `/inbox/submissions/[topic]`).
- `/inbox` itself redirects to whichever tab has pending items (approvals
  preferred on tie).
- Sidebar badge = pending approvals + open submissions, fetched server-side in
  the portal layout with cheap count queries using the same campus/role scoping
  as the pages themselves, passed to the `Sidebar` client component as a prop.

## 3. Unified command palette (⌘K)

Extend the existing hand-rolled palette
(`(portal)/_components/command-palette.tsx`) — no new dependency:

- **Fuzzy matching** over command labels (small subsequence scorer in
  `src/lib/fuzzy.ts`, unit-tested).
- **Recents**: last ~5 visited sections/entities from `localStorage`
  (recorded by a small hook in the portal layout), shown when the query is
  empty, above nav commands.
- **Entity search**: with ≥2 chars, a debounced (~200 ms) server action
  `searchEverything(query)` in `(portal)/_actions/palette-search.ts` queries
  jobs, events, news, pages, departments, and (when the user has shop access)
  products and orders by name/title. All queries go through the same
  campus/department scoping used by the corresponding list actions. Results
  render grouped by type with a jump-to href.
- **More commands**: create flows (job/event/news/page), campus switch
  (global admins), settings sub-pages.
- **AI escape hatch**: the final row is always “Ask BISO Assistant: ‘<query>’”.
  Selecting it dispatches `admin:open-assistant` with `detail.prompt`; the
  assistant widget (`_components/assistant/assistant-widget.tsx`) opens and
  auto-submits that prompt.

## 4. Assistant tool gaps (`packages/ai/src/assistant/tools/`)

New tools, same authz + confirm-before-mutation patterns as existing tools:

- **Shop**: `searchOrders` (by id/customer/status), `getOrderSummary`
  (status, payment, fulfillment, refunds), `lookupCustomerMembership`.
- **Ops**: `getOpsHealth` (reuses the team-health registry / health endpoint
  logic), `getInboxCounts` (pending approvals/submissions — powers “what needs
  my attention?”).
- **Analytics**: `getAnalyticsSummary` via the Umami read API (degrades to a
  clear “analytics not configured” answer when creds are absent).

All read-only; no new mutating tools in this effort.

## Error handling

- Palette search: failures render a quiet “search unavailable” row; commands
  keep working (search is additive, never blocking).
- Inbox badge: count failures render no badge (never block the layout).
- Redirects guarantee old bookmarks keep working.
- Assistant tools return typed error strings (existing pattern) rather than
  throwing.

## Testing

- `bun:test` units: nav-tree filtering per role (global/campus/department),
  group flatten/hide rules, fuzzy scorer, palette-search scoping (department
  user cannot see other campuses’ entities), inbox count scoping.
- Manual: redirects for the three moved routes + two queue routes; keyboard
  flow in the palette (arrows/enter/esc); AI handoff prompt round-trip.
- `bun run check-types` and `bun run build --filter=admin` (server-action
  files are touched, so the build gate is mandatory).

## Rollout

Single PR is acceptable, but the work splits cleanly into four phases:
IA/sidebar → Inbox → palette → assistant tools. Redirects ship with phase 1
(settings moves) and phase 2 (inbox moves).
