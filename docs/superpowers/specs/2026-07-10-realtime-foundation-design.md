# Realtime foundation + live admin inbox — design

**Date:** 2026-07-10
**Status:** Approved
**Scope decision:** Shared realtime module in `@repo/api` + one consumer surface (admin inbox: approvals + submissions). Page-editor presence, recruitment pipeline, shop orders, and all web-app surfaces are explicit follow-ups.

## Context

Appwrite was upgraded to 1.9.5 (self-hosted), which ships the new-generation Realtime API (single WebSocket, `Channel` builder, subscription updates without reconnect, realtime queries) and the new **Presences API**. SDKs are bumped: `appwrite@26.1.0` (browser) and `node-appwrite@26.2.0` (server) in the root catalog.

The repo currently has **zero realtime usage**. The universal admin pattern is: RSC loads once (`force-dynamic`) → server action mutates → `revalidatePath`/`router.refresh`. Data changed by anyone else (another admin, a webhook, the AI assistant) is invisible until full navigation. The inbox is the proving ground: `approval_requests` rows already carry approver-team read permissions, so Appwrite's permission-based event fan-out targets exactly the right users with no schema changes.

### Verified technical facts

- The 26.x web SDK authenticates the WebSocket **post-connect**: on the `connected` message it sends `{type: "authentication", data: {session}}` where `session` comes from `client.config.session` (i.e. `client.setSession(secret)`) or the `cookieFallback` localStorage entry. JWT auth is **not** supported for realtime.
- In production, a browser whose cookies include the standard `a_session_<project>` cookie on `.biso.no` authenticates the WS upgrade automatically. Admin uses a **custom-named httpOnly cookie** (`a_session_biso_admin`), so the browser client must be fed the session secret explicitly — in every environment.
- The SDK has built-in heartbeat and auto-reconnect with backoff (verified in `appwrite@26.1.0` source).
- `react` is already a dependency of `@repo/api`, so React hooks can live in the shared package.

## Architecture (Approach A: realtime as refetch signal)

Chosen over client-side payload merging (B) and an SWR/react-query layer (C).

Subscriptions never carry state into the UI. An incoming event triggers a **debounced re-run of existing server actions** (`getInboxCounts()`) or `router.refresh()` for RSC-loaded lists. Event payloads are used only for toasts. All campus scoping (`applyScopeQueries`), role gating, and permission logic stays server-side where it already lives. The hook exposes raw `RealtimeResponseEvent`s so future surfaces (e.g. the recruitment kanban's `updateCandidate(id, patch)` ingestion point) can opt into payload merging without changing the module.

### 1. Shared module: `@repo/api/realtime`

New file `packages/api/realtime.ts` (client-only, `"use client"`), new `"./realtime"` entry in `packages/api/package.json#exports`.

Exports:

- `setRealtimeSession(secret: string)` — idempotent wrapper over `clientSideClient.setSession()`. Any app authenticates the socket regardless of cookie name or localhost.
- `getRealtime()` — lazy singleton `Realtime` over the existing `clientSideClient` (one WebSocket per tab shared by all subscriptions).
- `useRealtimeChannels({ channels, enabled, onEvent })` — subscribes on mount, updates the subscription when channels change (no reconnect), unsubscribes on unmount, survives React StrictMode double-mounting. `enabled: false` means no socket is opened.
- Re-export of `Channel` (and related types) so app code never imports `appwrite` directly.

### 2. Admin session bridge

- Server action `getRealtimeSessionSecret()` in `apps/admin/src/app/(portal)/_actions/realtime.ts`:
  `requireAuth()` → read httpOnly `a_session_biso_admin` cookie → return the secret string (or `null` unauthenticated). Never logged.
  Security note: the secret already lives in the user's own browser cookie; this makes it visible to first-party JS only, behind the same auth gate. Accepted trade-off for an internal staff app (XSS exposure delta), documented here deliberately.
- Client provider calls it once on portal mount and feeds `setRealtimeSession()`. Same mechanism in prod and localhost dev.

### 3. Inbox consumer

`InboxRealtimeProvider` (client component) mounted in `(portal)/layout.tsx`, props: `initialCounts: InboxCounts`, `isApprover: boolean`, `activeCampusId: string | null`, toast labels.

- Subscribes to row events on `app/approval_requests` and `app/form_submissions` — only when `isApprover` (mirrors the `getInboxCounts` gate; non-approvers get no socket).
- On any relevant event: debounced (~500 ms) call of the existing `getInboxCounts()` server action → context state. The sidebar badge reads from this context (initialized with the server-rendered value) instead of a static layout prop.
- On `create` events: sonner toast ("New approval request from …") from the event payload; click navigates to the inbox. For globaladmins scoped to a campus, toasts filter on payload `campus_id` client-side (cosmetic only — counts are server-computed).
- Approvals/submissions pages: the provider triggers `router.refresh()` when an event touches the corresponding table, so RSC-loaded lists re-render with fresh, correctly-scoped server data. No client-side list merging.

### 4. Resilience & degradation

- SDK handles heartbeat/reconnect. On reconnect and on tab `visibilitychange` (returning from hidden), fire one refetch to cover missed events.
- If the WS cannot connect (proxy, network): behavior degrades to exactly today's server-rendered counts. No user-facing errors; one console warning.

### 5. i18n

Toast strings in `adminPortal` message bundles, English + Norwegian.

## Non-goals (follow-up branches)

- Page-editor presence + draft-conflict detection (flagship, next branch).
- Recruitment pipeline live updates, shop orders feed, notifications bell, M365 turnover progress.
- All web-app surfaces (order status page, expense status, notification bell, cart sync).
- Presence API usage of any kind (module gains presence helpers when the editor branch needs them).

## Infra prerequisite (owner action)

Verify `appwrite.biso.no` passes WebSocket upgrades to `/v1/realtime` (Traefik/nginx config) in staging before merge.

## Testing & verification

- Unit tests (vitest in `packages/api`) for `useRealtimeChannels` bookkeeping and the debounced-refetch behavior, with a mocked `Realtime`.
- `bun run check-types` (repo) and `bun run build --filter=admin` — mandatory because new/edited `"use server"` files are only validated by a real compile (async-only-exports rule).
- Manual smoke: two browser sessions; create an approval request in one, observe badge/toast/list in the other. Repeat on localhost to prove the session bridge.
