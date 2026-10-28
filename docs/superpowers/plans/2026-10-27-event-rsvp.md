# Event RSVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Students answer Going / Maybe / Not going on an event, on the website and in the app, see how many are going, and organisers see the list in admin.

**Architecture:** A new Appwrite table `event_rsvps`, written only by the server with the admin key. One pure helper in `@repo/shared` holds every rule (event open, members-only, upsert, counting). The website calls it from a server action. The app calls it through a new `apps/api` route. Admin lists the rows on the event's Logistics page.

**Tech Stack:** Bun + Turborepo, Next.js 16 (web, admin, api), Appwrite TablesDB via `@repo/api`, next-intl, Vitest (web, api, shared, packages/api), `bun test` (admin); Flutter 3.47 + Riverpod 2.6 + `package:http`, gen-l10n.

**Spec:** `docs/superpowers/specs/2026-10-27-event-rsvp-design.md`

## Global Constraints

- Work only in the worktrees: Sites `/Users/markus/Documents/dev/BISO-Sites/.claude/worktrees/event-rsvp`, Flutter `/Users/markus/Documents/dev/BISO-Flutter/.claude/worktrees/event-rsvp`, both on branch `feat/event-rsvp`. Never touch the main checkouts.
- Bun only (`bun`, `bun x`), never npm/pnpm.
- Never import `appwrite`/`node-appwrite` in app code; use `@repo/api`, `@repo/api/server`.
- Do not hand-edit `packages/api/types/appwrite.ts`; use the local row types defined in Task 2.
- Never push the Appwrite schema, write to production data, deploy, or `git push`.
- Status values on the wire and in the table are exactly `going`, `maybe`, `not_going`. `null` means "no answer".
- Public responses carry counts for `going` and `maybe` only, plus the caller's own answer. Never other users' ids or names.
- Answers are open while `now <= (end_date ?? start_date)`. An event with neither date is open. Only `status = "published"` events accept or show answers.
- Copy, verbatim (en / no): title "Are you going?" / "Blir du med?"; going "Going" / "Kommer"; maybe "Maybe" / "Kanskje"; notGoing "Not going" / "Kommer ikke"; goingCount "{count} going" / "{count} kommer"; maybeCount "{count} maybe" / "{count} kanskje"; signIn "Sign in to respond" / "Logg inn for å svare"; ticketHint "Saying you're going doesn't get you a ticket." / "Du får ikke billett ved å svare her."; saveFailed "Couldn't save your answer. Try again." / "Kunne ikke lagre svaret. Prøv igjen."
- The count line joins the non-zero parts with " · " (going first). With both zero it is not rendered.
- Sites: run `bun x ultracite fix` on touched files before each commit; `bun run check-types --filter=<pkg>` must pass for every package touched.
- Flutter: `flutter analyze` must show no new issues; `flutter test` must pass.
- Commits end with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_014NDgSKoBUDcWkW9AA9FUHk
  ```

## Review Focus

1. **Rapid taps.** A student taps Going then Maybe before the first save returns. Expected: the second tap is ignored while a save runs (web: buttons disabled while pending; app: notifier ignores `respond` while `saving`), so the shown answer always ends on a server summary. Pinned in Task 9 (`ignores a second answer while one is saving`) and Task 5 (buttons disabled while pending).
2. **The event ends between page load and tap.** Expected: the server refuses with `closed`, and the UI reverts and shows saveFailed. Pinned in Task 2 (`refuses a write after the event ends`) and Task 9 (`reverts and reports failure`).
3. **Anonymous web session** (the cart creates one). Expected: treated as signed out, `not_authenticated`, no row written. Pinned in Task 4.
4. **Two devices answer at the same moment.** The create hits the unique index (409). Expected: the helper re-reads and updates, with no error. Pinned in Task 2 (`updates when a create loses the race`).
5. **Popular event with more than 1000 answers.** Expected: the counts are exact, paging with `cursorAfter`. Pinned in Task 2 (`counts across pages`).

---

## Part A: BISO-Sites (`/Users/markus/Documents/dev/BISO-Sites/.claude/worktrees/event-rsvp`)

### Task 1: `event_rsvps` table in the Appwrite config

**Files:**
- Modify: `packages/api/appwrite.config.json` (append a table entry to `tables`, next to `event_attendees`)
- Test: `packages/api/event-rsvps-schema.test.ts`

**Interfaces:**
- Produces: table `event_rsvps` in database `app`, with columns `event_id` (string 50, required), `user_id` (string 50, required) and `status` (string, `format: "enum"`, `elements: ["going","maybe","not_going"]`, required). Indexes: `uniq_event_user` unique `[event_id, user_id]`, `idx_event_status` key `[event_id, status]`, `idx_user_id` key `[user_id]`. `rowSecurity: true`, `$permissions: []`, `enabled: true`, `name: "Event RSVPs"`.

- [ ] **Step 1: Write the failing test** `packages/api/event-rsvps-schema.test.ts`, shaped like `benefits-schema.test.ts` (read the JSON with `readFileSync`). Tests:
  - `event_rsvps is server-written with row security`: `rowSecurity === true`, `$permissions` equals `[]`, `databaseId === "app"`.
  - `event_rsvps has the three answer columns`: the column keys are exactly `["event_id","user_id","status"]`; `status.elements` equals `["going","maybe","not_going"]`; all three are `required: true`.
  - `one answer per student per event`: an index of `type "unique"` with `columns` `["event_id","user_id"]` exists, plus key indexes `["event_id","status"]` and `["user_id"]`.
- [ ] **Step 2: Run** `cd packages/api && bun x vitest run event-rsvps-schema.test.ts`. Expected: FAIL (table missing).
- [ ] **Step 3: Add the table entry.** Copy the exact JSON shape of the `user_notifications` entry (column objects with `array:false`, `default:null`, `encrypt:false`; enum column shaped like `events.status`; index objects with `status:"available"` and `orders`).
- [ ] **Step 4: Run** the new test plus `bun x vitest run appwrite-config.test.ts appwrite-config-permissions.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): event_rsvps table`.

### Task 2: Shared RSVP helper

**Files:**
- Create: `packages/shared/utils/event-rsvp.ts`
- Test: `packages/shared/utils/event-rsvp.test.ts`

**Interfaces:**
- Consumes: Task 1's table and column names.
- Produces (all exported from `@repo/shared/utils/event-rsvp`):
  ```ts
  export const EVENT_RSVPS_TABLE = "event_rsvps";
  export const EVENT_RSVP_STATUSES = ["going", "maybe", "not_going"] as const;
  export type EventRsvpStatus = (typeof EVENT_RSVP_STATUSES)[number];
  export interface EventRsvpSummary {
    counts: { going: number; maybe: number };
    mine: EventRsvpStatus | null;
    open: boolean;
  }
  export interface EventRsvpDb {
    createRow(table: string, id: string, data: Record<string, unknown>, permissions: string[]): Promise<unknown>;
    deleteRow(table: string, id: string): Promise<unknown>;
    listRows<T>(table: string, queries: string[]): Promise<{ rows: T[] }>;
    updateRow(table: string, id: string, data: Record<string, unknown>): Promise<unknown>;
  }
  export type SetEventRsvpResult =
    | { ok: true; summary: EventRsvpSummary }
    | { ok: false; reason: "closed" | "members_only" | "not_found" };
  /** `undefined` = not a valid body value; `null` = clear the answer. */
  export function parseEventRsvpStatus(value: unknown): EventRsvpStatus | null | undefined;
  export function isEventRsvpOpen(event: { end_date?: string | null; start_date?: string | null }, now: Date): boolean;
  /** null when the event is missing or not published. */
  export function readEventRsvp(db: EventRsvpDb, input: { eventId: string; now: Date; userId: string | null }): Promise<EventRsvpSummary | null>;
  export function setEventRsvp(db: EventRsvpDb, input: {
    eventId: string; isMember: () => Promise<boolean>; now: Date;
    status: EventRsvpStatus | null; userId: string;
  }): Promise<SetEventRsvpResult>;
  ```

Rules the code must follow:
- The event is read with `listRows("events", [Query.equal("$id", id), Query.select(["$id","status","start_date","end_date","member_only"]), Query.limit(1)])`. A missing row or `status !== "published"` gives null / `not_found`.
- Counting pages over `[Query.equal("event_id", id), Query.select(["$id","status"]), Query.limit(1000), Query.cursorAfter(lastId)?]` until a page holds fewer than 1000 rows. Never read `.total` (it reports the whole table).
- The caller's own row comes from `[equal event_id, equal user_id, select $id+status, limit 1]`.
- Order in `setEventRsvp`: `not_found`, then `closed` (also for `null`), then members-only. `isMember` is called only when `member_only === true && status !== null`; `false` gives `members_only`.
- A write with `null` deletes the caller's row if one exists. The same status as stored writes nothing. A different status runs `updateRow(..., { status })`. With no row, `createRow(EVENT_RSVPS_TABLE, ID.unique(), { event_id, status, user_id }, [Permission.read(Role.user(userId))])`. On a conflict (`code 409` or type `row_already_exists`/`document_already_exists`, mirroring `isRowConflict` in `benefit-reveal-server.ts`) it re-reads the row and updates it.
- On success it returns `readEventRsvp` of the same event and user.

- [ ] **Step 1: Write the failing tests** with an in-memory fake `EventRsvpDb`. It holds `events` and `rsvps` arrays and interprets `Query.equal`/`limit`/`cursorAfter` by parsing the query JSON strings the way `notification-state.test.ts` in apps/api fakes them. Tests:
  - `parseEventRsvpStatus`: `"going"`→`"going"`, `null`→`null`, `"yes"`→`undefined`, `undefined`→`undefined`.
  - `isEventRsvpOpen`: open before `end_date`; closed 1 ms after `end_date`; falls back to `start_date`; open with neither.
  - `readEventRsvp counts going and maybe and never not_going`: rows `[going, going, maybe, not_going]` give `{going:2, maybe:1}`.
  - `readEventRsvp returns the caller's own answer`: `mine === "maybe"` for that user, and `null` for `userId: null`.
  - `readEventRsvp returns null for a draft or missing event`.
  - `counts across pages`: 1001 `going` rows give `going === 1001`.
  - `setEventRsvp creates a row readable only by the student`: `createRow` gets permissions `['read("user:u1")']` and data `{ event_id, status: "going", user_id: "u1" }`; the summary has `mine: "going"`.
  - `setEventRsvp changes an existing answer`: `updateRow` is called with `{ status: "maybe" }` and no create.
  - `setEventRsvp with null deletes the row`; `mine` becomes `null`.
  - `refuses a write after the event ends`: `{ ok:false, reason:"closed" }`, no write.
  - `members-only: asks isMember only when setting an answer`: a non-member gives `members_only`; `null` on a members-only event succeeds without calling `isMember`.
  - `updates when a create loses the race`: `createRow` rejects `{ code: 409 }` once and a row then exists, so `updateRow` is called and the result is ok.
  - `not_found for an unpublished event`.
- [ ] **Step 2: Run** `cd packages/shared && bun x vitest run utils/event-rsvp.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `packages/shared/utils/event-rsvp.ts` to the interface and rules above.
- [ ] **Step 4: Run** the tests, then `bun run check-types --filter=@repo/shared`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(shared): event RSVP rules and counting`.

### Task 3: `apps/api` route `/api/events/[id]/rsvp`

**Files:**
- Create: `apps/api/src/lib/member-by-profile.ts` (moved from `apps/api/src/app/api/recruitment/applications/route.ts`'s `isMemberByProfile`)
- Modify: `apps/api/src/app/api/recruitment/applications/route.ts` (import it instead)
- Create: `apps/api/src/app/api/events/[id]/rsvp/route.ts`
- Test: `apps/api/src/app/api/events/[id]/rsvp/route.test.ts`

**Interfaces:**
- Consumes: Task 2 (`readEventRsvp`, `setEventRsvp`, `parseEventRsvpStatus`, `EventRsvpDb`).
- Produces: `export async function isMemberByProfile(userId: string): Promise<boolean>` (unchanged behaviour, `refresh: true`). The HTTP contract the app relies on:
  - `GET` (bearer optional) → `200 { counts:{going,maybe}, mine, open }`.
  - `POST` body `{ "status": "going"|"maybe"|"not_going"|null }` → `200 { counts, mine, open }`.
  - Errors as `{ "error": token }`: `400 invalid_request`, `401 not_authenticated`, `403 members_only`, `404 not_found`, `409 closed`, `429 rate_limited`, `503 unavailable`.
  - Every response has `Cache-Control: private, no-store` and CORS (`applyCorsHeaders`); `OPTIONS` → `corsPreflightResponse`.

Route rules:
- The event id must match `/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,35}$/`, else `404 not_found`.
- **GET:** with no `Authorization: Bearer`, `userId` is null. With one, `createAuthenticatedClient(req).account.get()`; if that throws → `401 not_authenticated`; an account failing `isAuthenticatedAppwriteUser` (`@repo/shared/recruitment`) is treated as `userId: null`. If `readEventRsvp` returns null → `404 not_found`.
- **POST:** require a bearer and a real account (`isAuthenticatedAppwriteUser`), else `401`. Parse the body with `parseEventRsvpStatus(body?.status)`; `undefined` or a body without a `status` key → `400 invalid_request`. Rate limit: 30/min per user id via `createRateLimiter` → `429`. `setEventRsvp(..., { isMember: () => isMemberByProfile(userId) })`. Map reasons `not_found`→404, `closed`→409, `members_only`→403. A thrown error → log `errorSummary` only → `503 unavailable`.
- The db adapter is built from `createAdminClient()` bound to database `"app"`, like `createRevealDb` in `benefits/[id]/reveal/route.ts`, plus `deleteRow` and `updateRow`.

- [ ] **Step 1: Write the failing route tests**, mocking `@/lib/auth`, `@repo/api/server` and `@/lib/member-by-profile` in the `notifications/read/route.test.ts` style, and mocking `@repo/shared/utils/event-rsvp`'s `readEventRsvp`/`setEventRsvp` with `vi.hoisted` while keeping the real `parseEventRsvpStatus`. Tests:
  - `GET without a token returns counts with mine null` (`readEventRsvp` called with `userId: null`; header `cache-control` is `private, no-store`).
  - `GET with a token passes the user id`.
  - `GET with a refused token is 401 not_authenticated`.
  - `GET for a missing event is 404 not_found`.
  - `POST without a token is 401`.
  - `POST from an anonymous account is 401` (`email: ""`, `name: "guest_x"`).
  - `POST with status "yes" is 400 invalid_request`.
  - `POST maps closed to 409, members_only to 403, not_found to 404`.
  - `POST returns the summary on success`, and `setEventRsvp` gets `status: null` for `{ "status": null }`.
  - `a malformed event id is 404 without reading`.
  - `a thrown error is 503 unavailable`.
- [ ] **Step 2: Run** `cd apps/api && bun x vitest run "src/app/api/events/[id]/rsvp"`. Expected: FAIL.
- [ ] **Step 3: Move `isMemberByProfile`** into `src/lib/member-by-profile.ts` (with its `isRowNotFound` and imports) and import it in the recruitment route. Then implement the route.
- [ ] **Step 4: Run** the new tests, `bun x vitest run src/app/api/recruitment` and `bun run check-types --filter=api`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): event RSVP endpoint for the app`.

### Task 4: Website server side (action, viewer read, strings)

**Files:**
- Create: `apps/web/src/app/actions/event-rsvp.ts` (`"use server"`)
- Create: `apps/web/src/lib/event-rsvp.ts` (server-only reader for the page; `import "server-only"` if the app uses it elsewhere, otherwise a plain module)
- Modify: `packages/i18n/messages/en/events.json`, `packages/i18n/messages/no/events.json` (new `rsvp` section)
- Test: `apps/web/src/app/actions/event-rsvp.test.ts`

**Interfaces:**
- Consumes: Task 2.
- Produces:
  ```ts
  // app/actions/event-rsvp.ts
  export type RespondToEventError = "closed" | "invalid_request" | "members_only" | "not_authenticated" | "not_found" | "unavailable";
  export async function respondToEvent(eventId: string, status: EventRsvpStatus | null):
    Promise<{ success: boolean; data?: EventRsvpSummary; error?: RespondToEventError }>;
  // lib/event-rsvp.ts
  export async function readEventRsvpForViewer(eventId: string):
    Promise<{ signedIn: boolean; summary: EventRsvpSummary | null }>;
  ```
  i18n keys `events.rsvp.{title,going,maybe,notGoing,goingCount,maybeCount,signIn,ticketHint,saveFailed}` with the Global Constraints copy (`{count}` placeholders).

Rules:
- `respondToEvent`: `parseEventRsvpStatus(status)` → `invalid_request` on `undefined`. Then `createSessionClient()` → `account.get()`. A throw or `!isAuthenticatedAccount(user)` gives `not_authenticated`. Do **not** call `ensureAnonymousSession`. Call `setEventRsvp` with the admin-client adapter and `isMember: async () => (await getLiveMembershipStatus()).isMember`. Map the reasons, and a thrown error → `unavailable`.
- `readEventRsvpForViewer`: `getLoggedInUser()` (null → signed out), then `readEventRsvp`. Any throw → `{ signedIn, summary: null }`, so the block hides and the page still renders.
- Build the adapter once in a small local helper in `lib/event-rsvp.ts` (`createEventRsvpDb()`), which the action imports.

- [ ] **Step 1: Write the failing tests**, mocking the way `member-portal.test.ts` does (`@repo/api/server`, `@/lib/auth-utils`, `@/lib/actions/membership`) and mocking `@repo/shared/utils/event-rsvp`'s `setEventRsvp`. Tests:
  - `refuses an anonymous session without writing`: `isAuthenticatedAccount` false → `{ success:false, error:"not_authenticated" }`, and `setEventRsvp` is not called.
  - `refuses a missing session`: `account.get` rejects → `not_authenticated`.
  - `rejects an unknown status`: `"yes"` → `invalid_request`.
  - `returns the summary`: `setEventRsvp` resolves ok → `{ success:true, data: summary }`.
  - `maps members_only and closed`.
  - `asks live membership only through the isMember callback`: calling the passed `isMember` calls `getLiveMembershipStatus` once.
- [ ] **Step 2: Run** `cd apps/web && bun x vitest run src/app/actions/event-rsvp.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** both modules, and add the strings to both locale files.
- [ ] **Step 4: Run** the tests and `bun run check-types --filter=web`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): RSVP action and strings`.

### Task 5: Website UI on the event page

**Files:**
- Create: `apps/web/src/components/events/v2/event-rsvp.tsx` (`"use client"`)
- Modify: `apps/web/src/components/events/v2/event-detail-v2.tsx` (`ActionCard` and `EventDetailV2` props)
- Modify: `apps/web/src/app/(public)/events/[slug]/page.tsx` (read the summary)
- Modify: `apps/web/src/components/events/v2/event-fields.ts` (add `rsvpCountParts`)
- Test: `apps/web/src/components/events/v2/event-rsvp.test.tsx`; extend `events.test.ts` for `rsvpCountParts`

**Interfaces:**
- Consumes: Task 4 (`respondToEvent`, `readEventRsvpForViewer`, the i18n keys).
- Produces:
  ```ts
  // event-fields.ts
  export function rsvpCountParts(counts: { going: number; maybe: number }):
    { count: number; key: "goingCount" | "maybeCount" }[];   // non-zero only, going first
  // event-rsvp.tsx
  export function EventRsvp(props: {
    canRespond: boolean;      // signed in && (!member_only || isMember)
    eventId: string;          // events.$id
    hasTicket: boolean;
    initial: EventRsvpSummary;
    signInHref: string;       // `/auth/login?redirectTo=${encodeURIComponent(eventPath)}`
    signedIn: boolean;
  }): JSX.Element;
  ```

Behaviour:
- `ActionCard` renders `<EventRsvp>` after the ticket link and before the contact block, only when `summary?.open`. The page reads `readEventRsvpForViewer(event.$id)` alongside its other reads and passes it down through `EventDetailV2` (a new `rsvp` prop).
- Layout inside the card (`mt-5`): the label `t("rsvp.title")` (`type-label text-ink-muted`).
  - **With `canRespond`:** a `role="group"` with `aria-label` = the title, holding three equal-width `<button type="button">`s with `aria-pressed`. The selected one is `bg-action text-action-ink`; the others are `border border-edge text-ink`; each has a `focus-visible:ring-focus-ring` ring.
  - **Signed out:** a link styled `statusPanelSecondaryAction` to `signInHref` with `t("rsvp.signIn")`.
  - **Signed in but `!canRespond`** (non-member on a members-only event): no buttons; the card's existing `MembersOnlyNotice` already explains.
  - Then the count line (`type-body-sm text-ink-muted`) from `rsvpCountParts` joined with " · ", the ticket hint when `hasTicket`, and `t("rsvp.saveFailed")` in `role="status"` after a failure.
- Clicking runs `respondToEvent(eventId, next)`, where `next` is `null` when the clicked status is already `mine`, inside `useTransition`. The local `mine` and counts change at once. On `success` the state becomes `data`; on failure it reverts to the previous summary and shows saveFailed. All buttons are `disabled` while the transition is pending.
- No motion classes and no non-token colours (`src/app/styles.test.ts` and `motion.test.ts` enforce this).

- [ ] **Step 1: Write the failing tests.**
  - `events.test.ts`: `rsvpCountParts({going:3,maybe:0})` → `[{count:3,key:"goingCount"}]`; `({going:0,maybe:0})` → `[]`; `({going:2,maybe:1})` → going first.
  - `event-rsvp.test.tsx`: use `renderToStaticMarkup` with `next-intl` mocked so `useTranslations` returns `(key, values) => key + (values?.count ?? "")`, and the action module mocked. Tests:
    - `signed-in student sees three answers with theirs pressed`: three `aria-pressed` buttons, `aria-pressed="true"` on Maybe when `mine: "maybe"`.
    - `signed-out visitor sees the sign-in link`: `href` contains `/auth/login?redirectTo=%2Fevents%2F`, and there are no buttons.
    - `non-member on a members-only event sees counts only`.
    - `ticket hint only on ticketed events`.
- [ ] **Step 2: Run** `cd apps/web && bun x vitest run src/components/events/v2`. Expected: FAIL.
- [ ] **Step 3: Implement** `rsvpCountParts`, `EventRsvp`, and the wiring in `ActionCard`, `EventDetailV2` and `page.tsx`.
- [ ] **Step 4: Run** `bun x vitest run src/components/events src/app/styles.test.ts src/app/motion.test.ts` and `bun run check-types --filter=web`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): Going / Maybe / Not going on the event page`.

### Task 6: Admin RSVP list on the Logistics page

**Files:**
- Modify: `apps/admin/src/app/(portal)/_actions/event-segments.ts` (add `listEventRsvps` next to `listAttendees`)
- Create: `apps/admin/src/app/(portal)/events/[id]/segments/_components/rsvp-panel.tsx`
- Modify: `apps/admin/src/app/(portal)/events/[id]/segments/page.tsx` and `_components/segments-studio.tsx` (new `rsvps` prop; panel above Attendees)
- Test: `apps/admin/src/app/(portal)/events/[id]/segments/_components/rsvp-panel.test.tsx`

**Interfaces:**
- Consumes: Task 1 table, Task 2 `EVENT_RSVPS_TABLE`, `EventRsvpStatus`.
- Produces:
  ```ts
  export interface EventRsvpEntry {
    email: string | null; name: string | null; status: EventRsvpStatus;
    updatedAt: string; userId: string;
  }
  export async function listEventRsvps(eventId: string): Promise<EventRsvpEntry[]>;
  // rsvp-panel.tsx
  export function sortRsvpEntries(entries: EventRsvpEntry[]): EventRsvpEntry[]; // going→maybe→not_going, then name (nulls last, locale "nb")
  export function RsvpPanel(props: { entries: EventRsvpEntry[] }): JSX.Element;
  ```

Rules:
- `listEventRsvps` uses the same gate as `listAttendees`: `withNationalEventScope(await requireAuth())`, then `loadScopedEvent`; out of scope → `[]`. It pages `event_rsvps` by `event_id` (200 per page, `cursorAfter`) with the admin client. Names and emails come from the `user` table (`Query.equal("$id", ids)`, `Query.select(["$id","name","email"])`, chunks of 100). A user without a profile row gets `name: null, email: null`. `updatedAt` is the row's `$updatedAt`.
- The panel is a `StudioPanel` titled "RSVPs" with a lucide icon (`CalendarCheck`), styled like the Attendees panel.
  - Summary line: "{going} going · {maybe} maybe · {notGoing} not going".
  - A table with columns Name, Email, Answer and Answered, styled like `AttendeeTable` in `attendee-panel.tsx`. Answer labels are Going / Maybe / Not going, and Answered is formatted with `Intl.DateTimeFormat("nb-NO", { dateStyle: "medium", timeStyle: "short" })`. A missing name shows "Unknown student".
  - Empty state: "No one has answered yet."
  - Admin copy stays in English, like the rest of this page.

- [ ] **Step 1: Write the failing tests** in `bun:test`, following `segments-studio.test.tsx`'s harness. Tests:
  - `sortRsvpEntries orders going, maybe, not going, then by name`.
  - `RsvpPanel shows the counts line`: "2 going · 1 maybe · 1 not going".
  - `RsvpPanel shows the empty state`.
- [ ] **Step 2: Run** `cd apps/admin && bun test "src/app/(portal)/events/[id]/segments"`. Expected: FAIL.
- [ ] **Step 3: Implement** the action, the panel and the wiring in the page and studio. Update `segments-studio.test.tsx` props if it now needs `rsvps`.
- [ ] **Step 4: Run** the segment tests and `bun run check-types --filter=admin`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(admin): RSVP list on the event's Logistics page`.

---

## Part B: BISO-Flutter (`/Users/markus/Documents/dev/BISO-Flutter/.claude/worktrees/event-rsvp`)

Run `flutter pub get` once in the worktree before Task 7.

### Task 7: Model and API client

**Files:**
- Create: `lib/data/models/event_rsvp.dart`
- Create: `lib/data/services/event_rsvp_api_client.dart`
- Test: `test/data/models/event_rsvp_test.dart`, `test/data/services/event_rsvp_api_client_test.dart`

**Interfaces:**
- Consumes: the Task 3 HTTP contract.
- Produces:
  ```dart
  enum EventRsvpStatus { going, maybe, notGoing }   // wire: going, maybe, not_going
  extension EventRsvpStatusWire on EventRsvpStatus { String get wire; static EventRsvpStatus? parse(Object? value); }
  class EventRsvpSummary {
    const EventRsvpSummary({required this.going, required this.maybe, required this.mine, required this.open});
    final int going; final int maybe; final EventRsvpStatus? mine; final bool open;
    static EventRsvpSummary? tryParse(Object? json);      // {counts:{going,maybe}, mine, open}
    EventRsvpSummary withAnswer(EventRsvpStatus? next);   // moves the caller's count, for the instant UI
  }
  abstract interface class EventRsvpApi {
    Future<EventRsvpSummary> fetch(String eventId, {required bool signedIn});
    Future<EventRsvpSummary> respond(String eventId, EventRsvpStatus? status);
  }
  enum EventRsvpApiErrorKind { notDeployed, notAuthenticated, invalidRequest, notFound, membersOnly, closed, rateLimited, unavailable, network, unknown }
  class EventRsvpApiException implements Exception { const EventRsvpApiException(this.kind, {this.statusCode}); }
  class EventRsvpApiClient implements EventRsvpApi {
    EventRsvpApiClient({http.Client? httpClient, ApiJwtProvider? jwtProvider, ApiJwtInvalidator? invalidateJwt});
  }
  ```
- `EventRsvpApiClient` copies `BenefitsApiClient`'s `_send`/`_sendOnce`/`_token`/`_failure`/`_json` shape: a 20 s timeout, one retry with a fresh JWT on a 401 when a token was sent, and network errors mapped to `network`. `fetch` sends `GET /api/events/{id}/rsvp` with `authenticated: signedIn`. `respond` sends `POST` with `content-type: application/json` and body `{"status": wire|null}`. A 404 with no error token is `notDeployed`. A 2xx body that doesn't parse is `unknown` with status 502.

- [ ] **Step 1: Write the failing tests.**
  - Model: `tryParse` reads `{"counts":{"going":3,"maybe":1},"mine":"not_going","open":true}`; `tryParse` returns null for a missing `counts`; `withAnswer` going→maybe moves 1 from going to maybe; `withAnswer(null)` from going lowers going; `notGoing`→`going` raises going only.
  - Client (`MockClient` from `package:http/testing.dart`, injected `jwtProvider`/`invalidateJwt`, like `notifications_api_client_test.dart`):
    - `fetch signed out sends no Authorization header`.
    - `fetch signed in sends the bearer token`.
    - `respond posts the wire status`: body `{"status":"not_going"}`; and `{"status":null}` for null.
    - `retries once with a fresh token after a 401`.
    - `maps 409 closed, 403 members_only, 429 rate_limited to their kinds`.
    - `404 without a token is notDeployed`.
- [ ] **Step 2: Run** `flutter test test/data/models/event_rsvp_test.dart test/data/services/event_rsvp_api_client_test.dart`. Expected: FAIL.
- [ ] **Step 3: Implement** both files.
- [ ] **Step 4: Run** the same tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat(events): RSVP model and API client`.

### Task 8: Strings

**Files:**
- Modify: `lib/generated/l10n/app_en.arb`, `lib/generated/l10n/app_no.arb`, then regenerate `lib/generated/l10n/app_localizations*.dart` with `flutter gen-l10n`
- Test: `test/l10n/event_rsvp_strings_test.dart`

**Interfaces:**
- Produces keys: `eventRsvpTitle`, `eventRsvpGoing`, `eventRsvpMaybe`, `eventRsvpNotGoing`, `eventRsvpGoingCount(int count)`, `eventRsvpMaybeCount(int count)`, `eventRsvpSignIn`, `eventRsvpTicketHint`, `eventRsvpSaveFailed`, holding the Global Constraints copy. The count keys use an `int` placeholder `count`, in the compact style of the recent benefits keys.

- [ ] **Step 1: Write the failing test**, in the style of `member_pass_strings_test.dart` (`lookupAppLocalizations`): Norwegian `eventRsvpTitle == "Blir du med?"`, `eventRsvpGoingCount(5) == "5 kommer"`; English `eventRsvpNotGoing == "Not going"`.
- [ ] **Step 2: Run** `flutter test test/l10n/event_rsvp_strings_test.dart`. Expected: FAIL (compile error).
- [ ] **Step 3: Add** the keys to both ARB files and run `flutter gen-l10n`.
- [ ] **Step 4: Run** the test. Expected: PASS.
- [ ] **Step 5: Commit** `feat(events): RSVP strings`.

### Task 9: Provider

**Files:**
- Create: `lib/providers/events/event_rsvp_provider.dart`
- Test: `test/providers/events/event_rsvp_provider_test.dart`

**Interfaces:**
- Consumes: Task 7.
- Produces:
  ```dart
  final eventRsvpApiProvider = Provider<EventRsvpApi>((ref) => EventRsvpApiClient());
  class EventRsvpState {
    const EventRsvpState({this.summary, this.loading = false, this.saving = false});
    final EventRsvpSummary? summary; final bool loading; final bool saving;
  }
  class EventRsvpNotifier extends StateNotifier<EventRsvpState> {
    EventRsvpNotifier(EventRsvpApi api, String eventId, {required bool signedIn});
    Future<void> load();                              // failure → summary stays null, quietly
    Future<bool> respond(EventRsvpStatus? status);    // false = failed and reverted, or ignored
  }
  final eventRsvpProvider = StateNotifierProvider.autoDispose
      .family<EventRsvpNotifier, EventRsvpState, String>(...);  // key: event id
  ```
- The provider watches `authStateProvider.select((s) => s.signedInUserId)`, so it rebuilds and reloads on sign-in and sign-out. It calls `load()` on creation.
- `respond`: it does nothing and returns false when `saving` or `summary == null`. Otherwise it sets `summary: summary.withAnswer(status)` and `saving: true` before the first await. On success it sets the server summary; on an exception it restores the previous summary. It clears `saving` either way and checks `mounted` before every write.

- [ ] **Step 1: Write the failing tests** with a hand-written `_FakeRsvpApi implements EventRsvpApi`, which can hold a `Completer` and fail on demand. Construct the notifier directly. Tests:
  - `load fills the summary`.
  - `load failure leaves summary null`.
  - `respond shows the answer before the server answers`: while the completer is pending, `state.summary!.mine == going` and `saving == true`.
  - `respond takes the server's summary`.
  - `reverts and reports failure`: the API throws `EventRsvpApiException(closed)`, so `respond` returns false and the summary equals the one before.
  - `ignores a second answer while one is saving`: the second `respond` returns false and the API is called once.
- [ ] **Step 2: Run** `flutter test test/providers/events/event_rsvp_provider_test.dart`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the test. Expected: PASS.
- [ ] **Step 5: Commit** `feat(events): RSVP state with instant answer and revert`.

### Task 10: The RSVP card on the event screen

**Files:**
- Create: `lib/presentation/widgets/event/event_rsvp_card.dart`
- Modify: `lib/presentation/widgets/event/event_detail_body.dart` (place the card after the ticket block, before the 24 px gap and `YourTripCard`)
- Modify: `test/presentation/design_rules_test.dart` (add the new file to `migratedFiles`)
- Modify: `test/presentation/screens/events/event_detail_screen_test.dart` (override `eventRsvpProvider`/`eventRsvpApiProvider` with a fake so no test reaches the network)
- Modify: `CLAUDE.md` (add an "Event RSVP" feature section in the style of "🔔 Notification inbox", with Location / Routes / Spec lines; the spec is the BISO-Sites path)
- Test: `test/presentation/widgets/event/event_rsvp_card_test.dart`

**Interfaces:**
- Consumes: Tasks 7–9, `hasValidMembershipProvider`, `authStateProvider`, `eventTicketUri`.
- Produces: `class EventRsvpCard extends ConsumerWidget { const EventRsvpCard({super.key, required this.event}); final EventModel event; }`

Behaviour:
- It renders `SizedBox.shrink()` when `event.isCompleted || event.isCancelled`, when `summary == null` (loading, failure, not deployed), or when `!summary.open`.
- Otherwise it shows the heading `eventRsvpTitle` (`titleMedium`, `palette.ink`):
  - **Signed in, and not (members-only and a non-member):** a `SegmentedButton<EventRsvpStatus>` with `emptySelectionAllowed: true`, `showSelectedIcon: false`, the three segments Going / Maybe / Not going, and `selected` = `{mine}` or `{}`. `onSelectionChanged` is null while saving and otherwise calls `respond(set.isEmpty ? null : set.first)`. When that returns false and the widget is mounted, it shows a `SnackBar(eventRsvpSaveFailed)`.
  - **Signed out:** a `TextButton` labelled `eventRsvpSignIn` with the same navigation as `job_application_screen.dart`'s sign-in CTA.
  - **Members-only and a non-member:** no buttons.
  - Then the count line (`bodyMedium`, `palette.muted`), with the non-zero parts of `eventRsvpGoingCount`/`eventRsvpMaybeCount` joined by " · ". With `eventTicketUri(event) != null` it adds `eventRsvpTicketHint` (`bodySmall`, `palette.muted`).
- Design rules: `BisoPalette.of(context)` colours, CupertinoIcons only, and no `isDark ?` branches.

- [ ] **Step 1: Write the failing widget tests** with `pumpBisoScreen`, overriding `eventRsvpApiProvider` with a fake, `authStateProvider` (signed in or out, in the way existing tests fake it), and `hasValidMembershipProvider`. Tests:
  - `shows three answers with the student's own selected`.
  - `tapping Going saves it and updates the count` (the fake returns going 5 → finds "5 going").
  - `signed out shows sign-in and no answers`.
  - `members-only non-member sees counts only`.
  - `renders nothing for a completed event`.
  - `renders nothing when the API is not deployed` (the fake throws `notDeployed`).
  - `shows a snackbar when saving fails`.
- [ ] **Step 2: Run** `flutter test test/presentation/widgets/event/event_rsvp_card_test.dart`. Expected: FAIL.
- [ ] **Step 3: Implement** the card, place it in `EventDetailBody`, add it to `migratedFiles`, fix the event detail screen test's overrides, and add the CLAUDE.md section.
- [ ] **Step 4: Run** `flutter test` (the whole suite) and `flutter analyze`. Expected: all pass, no new analyzer issues.
- [ ] **Step 5: Commit** `feat(events): Going / Maybe / Not going on the event screen`.

---

## After the tasks

- Sites: `bun run check-types`, the tests of every touched package (`packages/api`, `packages/shared`, `apps/api`, `apps/web` vitest; `apps/admin` bun test on the touched folders), and `bun x ultracite check` on the changed files.
- A whole-branch review in each repo, then PRs (the user asked for them): Sites first, then Flutter, each linking the other with the release order from the spec. **The user pushes `event_rsvps` to Appwrite.**
