# Big events — Stage 2 (Groups and buses) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Organizers set up buses (with both legs), rooms, buddy groups and teams in admin, fill buses automatically per campus with rooms kept together, move people by hand (which pins them), and publish the bus lists; moves after publishing queue a "you've been moved" notice.

**Architecture:** New columns on the Stage 1 tables (no new tables). Pure seat and auto-fill logic in `apps/admin/src/lib/big-events/buses/`; group and bus actions in two new `_actions` files using the Stage 1 access helpers; a new **Groups** tab with a bus board (dnd-kit) and group lists. Owed notices are recorded on the participant (`bus_notice_due_at`) and sent by Stage 3's message sender.

**Tech Stack:** Next.js 16 admin, Appwrite TablesDB via `@repo/api`, bun:test (admin), vitest (shared), `@dnd-kit/core` (already a dependency).

**Spec:** `docs/superpowers/specs/2026-11-24-big-events-design.md` — D5 (binding), D2 (access), D7 (notices, sending deferred to Stage 3), D13. Stage 1 handover (carry-overs and rulings): `.superpowers/big-events-stage-1-handover.md` in this worktree.

**Stacked on Stage 1** (`feat/big-events`, PR #130). Base commit `7709a3ce`.

## Decisions this plan makes (record as rulings in the ledger)

- **N1 — notices are recorded, not sent, in Stage 2.** A participant owes a bus notice when `bus_notice_due_at` is set. Publishing sets it for everyone with an out bus; a later move sets it when "Tell {name} about the change" is ticked. Stage 3 sends and stamps `bus_notified_at`; whether the text is "You're on…" or "You've been moved…" follows from `bus_notified_at` being null. Moving someone twice before sending just overwrites the timestamp, which gives D5's "only the latest notice is sent".
- **N2 — a room has a bus.** Room groups get `out_bus_id` / `home_bus_id`. Open places of a room reserve seats on its bus, and a person later named into the room takes the room's bus (D5).
- **N3 — publishing is event-wide** and needs `canEditBigEventSettings(access)`. There is no unpublish in Stage 2.
- **N4 — auto-fill before publishing repacks every unpinned person; after publishing it only seats people without a bus** and never moves a seated person (so publishing can't be followed by a mass "you've been moved").
- **N5 — auto-fill needs a seat count on every bus of the campus**; otherwise it refuses with which bus lacks one.
- **N6 — a bus with people on it can't be deleted after publishing**; organizers move them off first.
- **N7 — import (Stage 1 code) respects pins (R31), gives people placed in a room the room's bus, updates a reused booking room's capacity, and marks bus notices due for bus moves after publishing.**
- **N8 — campus admins manage only groups of their campus;** groups with no campus are full-access only (same rule as participants, R16). This answers the Stage 1 carry-over "campus admins can't see campus-less groups": by design.

## Global Constraints

- Everything in Stage 1's Global Constraints still applies (Bun; `@repo/api` only; service-only tables; `"use server"` exports only async functions and `bun run build --filter=admin` after touching one; audit + `revalidatePath` on mutations; no IDs, "segment" or "topic" in admin copy; every string in BOTH `packages/i18n/messages/en/adminPortal.json` and `no/adminPortal.json` under `bigEvents.*`; never push, deploy, push the schema or write production data).
- Access decisions only through `apps/admin/src/lib/big-events/access.ts` helpers — never compare `level` (R16).
- Buses exist only when the big event's `travel_enabled` is true (D5); the server refuses bus creation and bus moves otherwise.
- Capacity is a warning, not a hard stop (D5).
- Moving by hand pins the person (on the legs moved) (D5).
- After publishing, a move shows "Tell {name} about the change", on by default (D5).
- Rooms, buddy groups and teams have no publish step (D5).
- New columns are added to `packages/api/appwrite.config.json` **and** to `packages/shared/big-events/schema.test.ts` `EXPECTED_COLUMNS`; the owner pushes the schema.

## Review Focus

1. **Re-running auto-fill after hand moves** — hand-moved (pinned) people never move, and their seats count. → Task 2 `pinned people never move and their seats count`.
2. **Auto-fill after publishing** — seated people are never moved, only unseated people get seats. → Task 4 `after publishing, auto-fill only seats people without a bus`.
3. **A room bigger than any bus, or whose members are pinned to different buses** — reported with a reason, never silently split or dropped. → Task 2 `a room too big for any bus is reported` and `a room pinned to two buses is reported as split`.
4. **Deleting or emptying a bus after publishing** — refused while it has people (N6). → Task 3 `refuses to delete a published bus with people on it`.
5. **A campus admin moving someone onto another campus's bus, or moving another campus's person** — refused on the server. → Task 4 `campus admins can't move people across campuses`.

---

## File map

- Modify: `packages/api/appwrite.config.json`, `packages/shared/big-events/{types,schema.test}.ts`
- Create: `apps/admin/src/lib/big-events/buses/{seats,plan-auto-fill,group-form}.ts` (+ tests)
- Modify: `apps/admin/src/lib/big-events/access.ts` (+ test) — `canManageGroup`
- Create: `apps/admin/src/app/(portal)/_actions/big-event-groups.ts`, `big-event-buses.ts` (+ tests)
- Modify: `apps/admin/src/app/(portal)/_actions/big-event-import.ts`, `apps/admin/src/lib/big-events/import/{plan-import-rooms,plan-summary}.ts` (+ tests)
- Create: `apps/admin/src/app/(portal)/big-events/[id]/groups/page.tsx`, `groups/_components/{groups-view,group-dialog,group-list,bus-board,bus-column,person-chip,fill-dialog,publish-dialog,move-menu}.tsx` (+ tests)
- Modify: `apps/admin/src/app/(portal)/big-events/_components/big-event-tabs.tsx`, `[id]/layout.tsx`, participants components, `apps/admin/src/lib/big-events/participant-list.ts`
- Docs: `apps/docs/content/docs/guide/big-events/buses-and-groups.mdx`, `meta.json`, wording fixes in `index.mdx` / `import-and-connect.mdx`

---

### Task 1: Schema for buses, room buses, publishing and notices

**Files:** Modify `packages/api/appwrite.config.json`, `packages/shared/big-events/types.ts`, `packages/shared/big-events/schema.test.ts`.

**Interfaces — Produces:**
- `big_event_groups` new columns (all optional, default null): `out_departs_at` datetime, `out_meeting_point` string 300, `out_maps_url` string 1000, `home_departs_at` datetime, `home_meeting_point` string 300, `home_maps_url` string 1000, `home_arrival_note` string 200, `out_bus_id` string 36, `home_bus_id` string 36. Index key `[out_bus_id]`.
- `big_events` new: `bus_lists_published_at` datetime, `bus_lists_published_by` string 36.
- `big_event_participants` new: `bus_notice_due_at` datetime, `bus_notified_at` datetime. Index key `[big_event_id, bus_notice_due_at]`.
- `BigEventGroupRow`, `BigEventRow`, `BigEventParticipantRow` gain these fields (`T | null`).

- [ ] **Step 1:** Add the new keys to `EXPECTED_COLUMNS` in `schema.test.ts`; run `cd packages/shared && bunx vitest run big-events/schema.test.ts` → FAIL (column sets differ).
- [ ] **Step 2:** Add the columns and indexes to `appwrite.config.json` (same object shapes as existing columns; copy `capacity`/`pinned`/a datetime column) and the fields to `types.ts`.
- [ ] **Step 3:** Test → PASS; `bun --filter=@repo/shared check-types` clean.
- [ ] **Step 4: Commit** `feat(big-events): schema for buses, room buses and bus notices`

---

### Task 2: Seat model and auto-fill planner (pure)

**Files:** Create `apps/admin/src/lib/big-events/buses/seats.ts`, `plan-auto-fill.ts` (+ `*.test.ts`, bun:test).

**Interfaces — Consumes:** Task 1 row types. **Produces:**
```ts
export type Leg = GroupLeg; // from @repo/shared/big-events/tables — don't redefine the union
export interface SeatUse { out: number; home: number }
export function busSeatUse(input: { buses: BigEventGroupRow[]; rooms: BigEventGroupRow[]; members: BigEventGroupMemberRow[] }): Map<string, SeatUse>
// people on the bus per leg + open places (capacity − named members, ≥ 0) of rooms whose out_bus_id / home_bus_id is that bus
export function busOf(personId: string, leg: Leg, members: BigEventGroupMemberRow[], buses: Set<string>): string | null

export type UnplacedReason = "no_seat" | "too_big" | "split_room";
export interface AutoFillPlan {
  moves: { participantId: string; busId: string; legs: Leg[] }[];   // memberships to set (unpinned legs only)
  roomBuses: { roomId: string; busId: string }[];                     // room → bus (both legs)
  unplaced: { participantIds: string[]; roomId: string | null; reason: UnplacedReason }[];
  seatsAfter: Map<string, SeatUse>;
}
export function planAutoFill(input: {
  campusId: string;
  buses: BigEventGroupRow[];          // this campus's buses, each with capacity (caller checks N5)
  participants: { $id: string; campus_id: string | null }[];
  rooms: BigEventGroupRow[]; members: BigEventGroupMemberRow[];
  onlyUnseated: boolean;              // N4: true after publishing
}): AutoFillPlan
```
Rules to implement exactly (spec D5 + N2/N4):
- Only this campus's participants and buses. A unit is a room (its members on this campus who aren't pinned on the out leg, plus its open places as seats) or a single person not in a room.
- Pinned memberships stay; their seats count first. A room with a member pinned to bus X goes to X (even if overfull); a room whose members are pinned to two different buses is reported `split_room` and its unpinned members are not moved.
- `onlyUnseated`: units already on a bus (any member has an out bus, or the room has `out_bus_id`) keep it; only unseated units are placed.
- Placement: units by seats needed, largest first (ties by stable id order); each goes to the bus with the most free out seats that still fits it; none fits → `too_big` if it needs more seats than the largest bus's capacity, else `no_seat`.
- Home leg follows the out leg for every moved person, except legs that are pinned.

- [ ] **Step 1: Failing tests:** `counts open places of a room on its bus`; `spreads people evenly across a campus's buses` (60 people, buses 50/50 → 30/30); `keeps a room together`; `pinned people never move and their seats count`; `a room with a pinned member goes to that member's bus`; `a room too big for any bus is reported` (`too_big`); `a room pinned to two buses is reported as split`; `reports people without a seat` (`no_seat`, with the count); `only seats unseated people when asked`; `home follows out except pinned home legs`; `ignores other campuses`.
- [ ] **Step 2:** `cd apps/admin && bun test src/lib/big-events/buses` → FAIL. **Step 3:** Implement. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(big-events): seat model and auto-fill planner`

---

### Task 3: Group management (create, edit, delete) and group access

**Files:** Create `apps/admin/src/lib/big-events/buses/group-form.ts` (zod schema, plain module), `apps/admin/src/app/(portal)/_actions/big-event-groups.ts` (+ test). Modify `apps/admin/src/lib/big-events/access.ts` (+ test).

**Interfaces — Produces:**
- `canManageGroup(access: BigEventAccess, group: Pick<BigEventGroupRow, "campus_id">): boolean` — full: yes; campus level: only `campus_id ∈ campusIds`; `campus_id` null: full only (N8).
- `groupFormSchema` (zod): `kind` ∈ GROUP_KINDS, `name` 1–200, `campus_id` "1".."5"|null, `capacity` 1–200|null, `contact_name` ≤120, `contact_phone` (normalized with `normalizePhone`) ≤32, `note` ≤2000, `room_number` ≤40 (rooms only), bus fields (bus only): `out_departs_at`/`home_departs_at` ISO (entered as Oslo local time, stored UTC — reuse Stage 1 `apps/admin/src/lib/big-events/dates.ts`), meeting points ≤300, maps urls http(s) ≤1000, `home_arrival_note` ≤200.
- Actions: `listGroups(bigEventId): Promise<GroupsView>` where `GroupsView = { groups: GroupView[]; travel: boolean; publishedAt: string | null; canPublish: boolean; campuses: string[] }` and `GroupView = BigEventGroupRow & { members: { participantId: string; name: string; leg: Leg | null; pinned: boolean; roomName: string | null }[]; seats: SeatUse | null; openPlaces: number | null }` (only groups and members the caller may see; names only — no emails/phones). `createGroup(bigEventId, values)`, `updateGroup(groupId, values)`, `deleteGroup(groupId)`.
- Rules: bus kind refused when `travel_enabled` is false; campus admins may only create/edit groups on their campuses; changing a group's campus is refused when it has members; deleting deletes its memberships, and for a bus also clears `out_bus_id`/`home_bus_id` on rooms pointing at it; **after publishing, deleting a bus with people on it is refused** (N6, plain message "Move the people off this bus first"). Audit `big_event.group.{create,update,delete}` (ids/counts only).

- [ ] **Step 1: Failing tests** (bun:test, Stage 1 action-test pattern with `apps/admin/src/test/fake-tables-db.ts`): `canManageGroup` cases (full, own campus, other campus, no campus); `refuses a bus when Travel is off`; `a campus admin can't create a group on another campus`; `deleting a bus clears it from rooms`; `refuses to delete a published bus with people on it`; `listGroups shows only the caller's campus groups and no contact details of participants`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** PASS; admin check-types; admin build.
- [ ] **Step 5: Commit** `feat(big-events): manage groups and buses`

---

### Task 4: Bus board actions (auto-fill, move, pin, publish, notices)

**Files:** Create `apps/admin/src/app/(portal)/_actions/big-event-buses.ts` (+ test).

**Interfaces — Consumes:** Tasks 2–3. **Produces:**
- `previewAutoFill(bigEventId, campusId: string | "all"): Promise<AutoFillPreview>` — `{ placed: number; unplaced: { reason: UnplacedReason; count: number; names: string[] }[]; perBus: { busId: string; name: string; campusId: string; out: number; capacity: number | null }[]; missingCapacity: string[] /* bus names */ }`. `"all"` = every campus the caller may manage, planned one campus at a time with `planAutoFill` (spec D5: "per campus or all campuses"). N5: `missingCapacity` non-empty → apply refuses.
- `applyAutoFill(bigEventId, campusId: string | "all"): Promise<{ moved: number; unplaced: number }>` — recomputes the plan server-side; writes memberships (`pinned: false`), deletes replaced unpinned bus memberships, sets room `out_bus_id`/`home_bus_id`; `onlyUnseated` = published (N4). Requires `canManageGroup` for the campus. Writes settle per phase like the Stage 1 import (`mapAllSettledWithConcurrency`, stop on failure, always audit).
- `moveToBus(bigEventId, input: { participantIds: string[]; busId: string | null; legs: "both" | "out" | "home"; notify: boolean }): Promise<{ moved: number }>` — `busId` null = take off the bus; pins the moved legs; each person and the bus must pass `canSeeParticipant`/`canManageGroup` and be on the same campus as the bus (refuse otherwise); after publishing and `notify`, sets `bus_notice_due_at = now` for moved people.
- `moveToGroup(bigEventId, input: { participantIds: string[]; groupId: string | null; kind: Exclude<GroupKind, "bus"> }): Promise<{ moved: number }>` — one group per kind per person; moving into a room that has a bus also moves the person onto that bus (both legs) unless their legs are pinned, and counts as a bus move for notices (`notify` param, same default).
- `setPinned(bigEventId, input: { participantIds: string[]; pinned: boolean }): Promise<void>` — on all their bus memberships.
- `publishBusLists(bigEventId): Promise<{ notices: number }>` — needs `canEditBigEventSettings` (N3); refuses when already published or Travel is off; sets `bus_lists_published_at/_by`; sets `bus_notice_due_at = now` for every participant with an out bus. Audit with counts.

- [ ] **Step 1: Failing tests:** `applyAutoFill writes the planned seats and room buses`; `refuses to fill when a bus has no seat count`; `after publishing, auto-fill only seats people without a bus`; `moving by hand pins the moved legs`; `moving one leg keeps the other`; `campus admins can't move people across campuses`; `moving after publishing marks a notice when asked, not otherwise`; `moving twice keeps one pending notice` (single `bus_notice_due_at`, overwritten); `moving into a room with a bus moves the person onto that bus`; `publishing marks a notice for everyone with a bus and can't run twice`; `publishing needs settings access`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** PASS; admin check-types; admin build.
- [ ] **Step 5: Commit** `feat(big-events): fill, move and publish buses`

---

### Task 5: Import respects pins and room buses (Stage 1 carry-overs)

**Files:** Modify `apps/admin/src/lib/big-events/import/plan-summary.ts`, `plan-import-rooms.ts`, `apps/admin/src/app/(portal)/_actions/big-event-import.ts` (+ their tests).

**Changes (N7 + handover carry-overs):**
- `replacedMemberships` never removes a `pinned` membership; a person whose target is a different group than their pinned one keeps the pinned membership and is listed in the preview as "kept because they were moved by hand" (new count `keptPinned`).
- A person placed into a room whose `out_bus_id`/`home_bus_id` is set also gets bus memberships for those legs (unless the leg is pinned), and other unpinned bus memberships are removed.
- A reused booking room whose planned capacity differs from the stored one gets a capacity update (new plan field `groupUpdates: { groupKey: string; capacity: number }[]`, written in the groups phase).
- `overfullRooms` subtracts memberships the plan removes.
- After publishing, people whose out or home bus changes through an import get `bus_notice_due_at = now` (no checkbox in the import; the preview says "N people will get a 'you've been moved' notice").

- [ ] **Step 1: Failing tests:** `import never moves a pinned person`; `a person named into a room takes the room's bus`; `a re-import updates a booking room's capacity`; `overfull counts leave out people who move out`; `import bus moves after publishing mark notices`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement (keep phases and R28 settle/stop behaviour). **Step 4:** PASS; check-types; admin build.
- [ ] **Step 5: Commit** `feat(big-events): imports respect pins and room buses`

---

### Task 6: Groups tab — lists and group dialog

**Files:** Create `apps/admin/src/app/(portal)/big-events/[id]/groups/page.tsx`, `_components/groups-view.tsx`, `group-dialog.tsx`, `group-list.tsx`, `move-menu.tsx` (+ test). Modify `big-event-tabs.tsx` (add `{ key: "groups", segment: "groups", settings: false }` between participants and settings), `[id]/layout.tsx` (label), i18n.

**Behaviour:**
- Page: `getBigEvent` (notFound otherwise) → `listGroups`. Sections in order: Buses (only when Travel is on; rendered by Task 7's board), Rooms, Buddy groups, Teams, Other. Each section: "Add …" button (dialog), list of groups (name, campus, capacity "3 of 4" + open places for rooms, room number, contact name, note), members by name, a row menu per person "Move to…" (`moveToGroup`) and per group Edit / Delete (confirm).
- Group dialog: fields from `groupFormSchema`; bus fields shown for kind Bus with two sub-sections "Out" / "Home" (date + time, meeting point, maps link; home also "Arrives around"); room number for Rooms; campus select limited to the caller's campuses; plain labels.
- Copy (en / no): tab "Groups" / "Grupper"; sections "Buses" / "Busser", "Rooms" / "Rom", "Buddy groups" / "Faddergrupper", "Teams" / "Lag", "Other" / "Andre"; "Add bus" / "Legg til buss", "Add room" / "Legg til rom", "Add group" / "Legg til gruppe"; "{count} open places" / "{count} ledige plasser"; delete confirm "Delete {name}? Everyone in it is taken out of it." / "Slette {name}? Alle i den blir tatt ut av den."
- [ ] **Step 1: Failing component tests** (`@/test/react-dom-harness`): renders sections for the event's kinds (no Buses section when Travel is off); shows open places on a room; the dialog shows bus legs only for Bus.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS; check-types; admin build.
- [ ] **Step 5: Commit** `feat(big-events): groups tab`

---

### Task 7: Bus board — drag, select, fill, publish

**Files:** Create `groups/_components/bus-board.tsx`, `bus-column.tsx`, `person-chip.tsx`, `fill-dialog.tsx`, `publish-dialog.tsx` (+ test).

**Behaviour:**
- Campus picker (the caller's campuses that have buses or participants). One column per bus of that campus plus "Not on a bus yet (N)". Column header: name, out time + meeting point, seat counters "Out 38/50 · Home 37/50" (amber when over capacity — warning only).
- Person chip: name, room tag ("Rom · Ola Nordmann"), pin icon when pinned (click to unpin → `setPinned`), checkbox for multi-select. People whose home bus differs show "Home: Bus 3".
- Drag a chip (or a selection) onto a column → `moveToBus` (legs "both"). Selection toolbar: "Move to…" (bus select + legs: "Both ways" / "Only out" / "Only home") and "Take off the bus". Use `@dnd-kit/core` `DndContext` + `useDraggable` + `useDroppable` with keyboard sensor (accessible: every drag action is also reachable through the "Move to…" menu).
- After publishing, every move opens a small confirm with "Tell {name} about the change" (or "Tell {count} people about the change"), ticked by default.
- "Fill buses automatically" → `fill-dialog` (scope: the shown campus, or "All campuses" / "Alle campuser" when the caller manages more than one): calls `previewAutoFill`, shows "142 people on 3 buses", per-bus counts, unplaced groups with reasons ("12 people have no seat. Add a bus." / "Room · Ola Nordmann needs 4 seats; no bus has that many." / "Room · Kari Nordmann is split across buses."), and missing seat counts; Apply → `applyAutoFill`. After publishing, the dialog says it only seats people without a bus.
- "Publish bus lists" (shown when `canPublish`) → `publish-dialog`: "Publish the bus lists? {count} people will get a message saying which bus they're on. You can still move people afterwards." → `publishBusLists`. When published: a "Published {date}" pill instead of the button.
- Copy in both locales (Norwegian natural): include all strings above; "Fill buses automatically" / "Fyll bussene automatisk"; "Publish bus lists" / "Publiser busslistene"; "Not on a bus yet" / "Ikke på buss ennå"; "Both ways" / "Begge veier"; "Only out" / "Bare utreise"; "Only home" / "Bare hjemreise"; "Tell {name} about the change" / "Gi beskjed til {name} om endringen".
- [ ] **Step 1: Failing component tests:** columns per bus with seat counters; over-capacity column is marked (not blocked); the move menu calls `moveToBus` with the chosen legs; after publishing a move asks about telling the person (checkbox ticked by default); fill dialog lists unplaced reasons; publish dialog states the count.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS; check-types; admin build.
- [ ] **Step 5: Commit** `feat(big-events): bus board`

---

### Task 8: Participants tab additions and small carry-overs

**Files:** Modify `apps/admin/src/lib/big-events/participant-list.ts`, participants actions/components, i18n; `apps/docs/content/docs/guide/big-events/*.mdx` wording.

- Participant rows show the out bus (and "Home: …" when different) when Travel is on; new filter chip "Not on a bus yet (N)" (Travel on only). Add `busName: string | null`, `homeBusName: string | null` to the explicit `ParticipantListItem` Pick (R21) — names only.
- New filter chip "Needs a new link (N)": unlinked, has a ticket email, `connect_sent_at` set and `connect_token_hash` null (their email changed after an earlier send — Stage 1 parked item). The row's "Send again" handles it.
- Participant dialog failed-save copy → "Couldn't save. Try again, or reload the page." / "Kunne ikke lagre. Prøv igjen, eller last inn siden på nytt." (Stage 1 carry-over).
- Docs: the retention sentence about rooms is now accurate (room numbers are editable) — re-read and keep it consistent with Task 9's page.
- [ ] **Step 1: Failing tests:** list item carries bus names; "Not on a bus yet" filter; "Needs a new link" filter counts only the described rows.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS; check-types; admin build.
- [ ] **Step 5: Commit** `feat(big-events): buses and new-link filter on the participants tab`

---

### Task 9: Staff guide and verification

**Files:** Create `apps/docs/content/docs/guide/big-events/buses-and-groups.mdx`; modify `meta.json` (`pages: ["index", "import-and-connect", "buses-and-groups"]`), `index.mdx` (link + one-line mention).

Content (apps/docs/CLAUDE.md rules; Norwegian label first, English in brackets, verbatim from the message files; no forward-looking promises): adding buses with out/home details; rooms (room numbers, open places, a room's bus); buddy groups/teams; filling buses automatically (rules: per campus, rooms together, even spread, hand-moved people stay; reasons when someone has no seat; after publishing it only seats people without a bus); moving by hand pins; seat counts are warnings; publishing the bus lists (event-wide, by the board or global admins; who gets marked for a message); moves after publishing and the "tell them" box; deleting a bus after publishing. `covers` = the Stage 1 list plus `apps/admin/src/lib/big-events/buses/**`.

- [ ] **Step 1:** Write the page; `cd apps/docs && bun test` → PASS.
- [ ] **Step 2:** Full verification (`bun run check-types`; admin `bun test src` — known failure content-translation only; shared vitest; api vitest; web vitest; docs; builds admin/web/api/docs; biome on changed files).
- [ ] **Step 3: Commit** `docs(big-events): buses and groups guide`

---

## Owner steps after Stage 2

- Push the new columns (Task 1) and regenerate types.
- Deploy admin (Stage 2 is admin-only). Bus notices are sent once Stage 3 is deployed; until then publishing only marks them.
