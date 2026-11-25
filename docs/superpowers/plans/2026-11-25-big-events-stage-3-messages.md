# Big events — Stage 3 (Messages) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Organizers write messages to a big event's participants (everyone, a campus, buses/rooms/groups, or chosen people), with personal details inserted by buttons, translated automatically, sent now or later as push (when the person has the app with notifications) or email (otherwise), Important messages both ways, SMS behind a switch; the app also sends the bus messages Stage 2 marks and a reminder before each bus leaves.

**Architecture:** Two new tables (`big_event_messages`, `big_event_message_recipients`) plus a few columns. Pure text/audience/plan logic and a server-only send engine in `packages/shared/big-events/messages/` so admin ("send now") and the api cron (scheduled + automatic) share one path. Pushes reuse `dispatchAnnouncement` (`announcements` rows, locale fan-out, app inbox); emails and SMS go through the Stage 1 delivery queue as kind `message`.

**Tech Stack:** Next.js 16 admin + api, Appwrite TablesDB via `@repo/api`, bun:test (admin), vitest (shared/api), `ai` via `translateContentFields`.

**Spec:** `docs/superpowers/specs/2026-11-24-big-events-design.md` — D6, D7, D9 (binding), D2, D13. Stage 1/2 handovers in `.superpowers/` (rulings, carry-overs).

**Stacked on Stage 2** (`feat/big-events-buses`, PR #131). Base commit `2a491399`.

## Decisions this plan makes (binding; record as rulings)

- **M1 Push = announcements.** One `announcements` row per push group (recipients whose resolved push text is identical), `audience_type: "users"`, at most 100 user ids per row, `category: "trip"` (Important → `"urgent"`, high priority), `source: "manual"` or `"auto"`, `deep_link: "biso://big-event?slug=<slug>"` (the app falls back to the announcement screen until Stage 5 handles it). `dispatchAnnouncement` does the locale fan-out and the app inbox.
- **M2 Email/SMS = delivery queue** rows of kind `message` (one per recipient per channel, `message_id`, `participant_ids: [id]`, `to_address`). SMS rows are created only when the `big_events_sms` flag is on and the message asks for it; the processor marks them `skipped` with `last_error: "No SMS provider"` (D9).
- **M3 Delivery rule (D6):** push when the participant is linked and the account has a push target; otherwise email to `ticket_email`, else the account email. Important: push (when possible) **and** email. Nobody gets the same message twice on one channel.
- **M4 Placeholders:** `{first name}`, `{bus}`, `{departure}`, `{meeting point}`, `{bus contact}`, `{room}` in English and `{fornavn}`, `{buss}`, `{avgang}`, `{oppmøtested}`, `{busskontakt}`, `{rom}` in Norwegian — inserted by buttons, case-insensitive, either language accepted in either text (so AI translation may translate them). Unknown `{…}` blocks sending with a plain message. In **pushes** `{first name}`/`{fornavn}` is removed (D6), so pushes group by bus/room details; emails and the stored per-person copy use everything.
- **M5 Bus details per message leg:** a message to buses names a leg (out/home); otherwise the out leg. `{departure}` = Oslo "fre. 24. jan. kl. 14:00"-style (no) / "Fri 24 Jan, 14:00" (en); missing values render as an empty string and the preview flags it ("Bus 3 has no meeting point yet").
- **M6 Language:** the organizer writes one language; "Translate" fills the other with `translateContentFields` (sync) before Check & send; both editable; both required to send. Pushes and emails to linked people use the account's `user.locale` (`"no"` → Norwegian, else English); emails to unlinked people carry Norwegian first, then English.
- **M7 Audience:** everyone · campus(es) · groups (buses with a leg, rooms, buddy groups, teams) · chosen participants. Campus admins see and reach only their campus's participants (D2). "Not checked in on a bus leg" waits for check-in (Stage 6).
- **M8 Message lifecycle:** `scheduled` (send time in the future) → `sending` → `sent` | `failed`. "Send now" creates the row and sends in the same action. A scheduled message can be cancelled (deleted) before it starts. Sending is idempotent: recipients rows are keyed by message + participant and carry `pushed_at`; a retry only pushes recipients without `pushed_at` and only enqueues missing deliveries.
- **M9 Automatic messages (D7):** big events gain three switches (default on when Travel is on) and optional custom texts. The api cron sends: (a) **bus messages** for participants whose `bus_notice_due_at` is at least **10 minutes** old, only when `bus_lists_published_at` is set — "assigned" when `bus_notified_at` is null, else "moved", and "no bus" when they have no out bus; then clears `bus_notice_due_at` and sets `bus_notified_at`; with the switch off it just clears/stamps without sending; (b) **departure reminders** 2 hours before each bus leg's departure (window: departs within the next 2 h and not yet reminded), to that bus's people for that leg, stamping `out_reminder_sent_at`/`home_reminder_sent_at` on the bus.
- **M10 Important** messages are `important` + `pinned`; organizers can unpin. History lists every message (automatic ones labelled "Automatic") with counts: people, pushes, emails, SMS, failed.
- **M11 Expected refusals return** `{ ok: false, error: "<code>" }` from the new message actions and the UI shows a localized sentence per code (Stage 2 carry: generic toasts). Unexpected errors still throw.
- **M12 Carry-overs:** extract the duplicated big-event action helpers into one plain module first; a participant's campus change removes their seats on other campuses' buses (and marks a bus notice after publishing); the delivery kick logs non-2xx responses.

## Global Constraints

- Everything in Stage 1/2 Global Constraints still applies (Bun; `@repo/api`; service-only tables; `"use server"` exports only async functions + `bun run build --filter=admin` after touching one; audit with ids/counts only; no IDs/jargon in admin copy; all strings in BOTH `en` and `no`; never push, deploy, push the schema or write production data; commit trailer two lines per the contract).
- Access decisions only via `apps/admin/src/lib/big-events/access.ts` helpers (R16).
- No participant personal data to AI: translation receives only the organizer's message text (with placeholders), never resolved per-person text.
- Nobody rides or is messaged about another campus's bus (Stage 2 R19/R23).
- New tables/columns in `packages/api/appwrite.config.json` + `packages/shared/big-events/schema.test.ts`; owner pushes.

## Review Focus

1. **A retry after a partial send** — nobody gets a second push or a second email. → Task 5 `a retried send pushes and emails nobody twice`.
2. **Bus messages while organizers are still moving people** — a person moved three times within ten minutes gets one message with the latest bus. → Task 7 `moves within the settle time give one message with the latest bus`.
3. **A campus admin's audience "everyone"** — only their campus's people are reached and counted. → Task 4 `a campus admin's everyone is their campus`.
4. **A placeholder with no value** (bus with no meeting point, person with no room) — preview warns; sent text has no "{…}" left. → Task 3 `empty values leave no braces`.
5. **Departure time changed after the reminder went out / reminder window across cron gaps** — one reminder per leg, never for a departure already passed by more than the window. → Task 7 `one reminder per leg even across late cron runs`.

---

### Task 1: Shared big-event action helpers (refactor, no behaviour change)

**Files:** Create `apps/admin/src/lib/big-events/action-helpers.ts` (plain module, `import "server-only"`). Modify `_actions/big-event-{participants,groups,buses,linking,import}.ts` to use it.

**Produces:** `type AdminDb`, `type GrantedAccess`, `requireBigEvent(id): Promise<{ event; access: GrantedAccess }>`, `revalidateBigEvent(id): void` (list + `[id]` layout), `WRITE_CONCURRENCY = 8`, `type PhaseCount = { written: number; failed: number }`, `settleWrites<T, R>(items: T[], write: (item: T) => Promise<R>): Promise<{ count: PhaseCount; done: R[] }>`, `writePhase`/`WriteLog`/`newWriteLog`/`assertComplete` as in big-event-buses.ts, `markNotices(db, ids: string[], now: Date): Promise<PhaseCount>`.

- [ ] **Step 1:** Move the helpers verbatim (keep behaviour; linking's revalidate becomes the shared one — note it now also revalidates the list, harmless). **Step 2:** Run `cd apps/admin && bun test src` → same results as before (only content-translation fails). **Step 3:** check-types + `bun run build --filter=admin`. **Step 4: Commit** `refactor(big-events): share action helpers`.

---

### Task 2: Schema, types and the SMS switch

**Files:** `packages/api/appwrite.config.json`, `packages/shared/big-events/{tables,types,schema.test}.ts`, `packages/shared/utils/feature-flags.ts`, `apps/admin/src/app/(portal)/settings/feature-flags/page.tsx` (+ i18n group label).

**Produces:**
- Table `big_event_messages` (service-only): `big_event_id`[36] req, `kind` enum [manual, bus_assigned, bus_moved, bus_none, departure_reminder] req, `status` enum [scheduled, sending, sent, failed] default `scheduled`, `title_no`[200], `title_en`[200], `body_no`[2000], `body_en`[2000], `audience`[4000] (JSON), `campus_ids` string[8] array, `leg` enum [out, home], `important` bool default false, `pinned` bool default false, `also_sms` bool default false, `scheduled_at` datetime, `sent_at` datetime, `created_by`[36], `recipients` int default 0, `push_count` int default 0, `email_count` int default 0, `sms_count` int default 0, `failed_count` int default 0. Indexes: key [big_event_id], key [status, scheduled_at].
- Table `big_event_message_recipients` (service-only): `big_event_id`[36] req, `message_id`[36] req, `participant_id`[36] req, `user_id`[36], `vars`[1000] (JSON), `push` bool default false, `email` bool default false, `sms` bool default false, `pushed_at` datetime. Indexes: key [message_id], key [big_event_id, participant_id], unique [message_id, participant_id].
- `big_events` + `auto_bus_assigned`, `auto_bus_moved`, `auto_departure_reminder` (bool default true), `auto_texts`[4000] (JSON). `big_event_groups` + `out_reminder_sent_at`, `home_reminder_sent_at` (datetime).
- `BIG_EVENT_TABLES.messages = "big_event_messages"`, `.messageRecipients = "big_event_message_recipients"`, enum lists `MESSAGE_KINDS`, `MESSAGE_STATUSES` + types, row types `BigEventMessageRow`, `BigEventMessageRecipientRow`, new fields on existing row types.
- Feature flag `{ key: "big_events_sms", group: "big_events", title: "Big events: SMS", description: "Show \"Also send as SMS\" on big event messages. No SMS provider is connected yet.", defaultEnabled: false }`; group label en "Big events" / no "Store arrangementer".

- [ ] **Step 1:** Update `EXPECTED_COLUMNS`/enum tests → FAIL. **Step 2:** Config + types + flag. **Step 3:** shared tests + root check-types PASS. **Step 4: Commit** `feat(big-events): schema for messages`.

---

### Task 3: Message text — placeholders and rendering (pure, shared)

**Files:** Create `packages/shared/big-events/messages/text.ts` (+ test, vitest).

**Produces:**
```ts
export const PLACEHOLDERS = ["first_name","bus","departure","meeting_point","bus_contact","room"] as const;
export type Placeholder = (typeof PLACEHOLDERS)[number];
export type MessageVars = Partial<Record<Placeholder, string>>;
export const PLACEHOLDER_LABELS: Record<"no"|"en", Record<Placeholder, string>>; // e.g. no.first_name = "fornavn", en.first_name = "first name"
export function placeholderToken(locale: "no"|"en", key: Placeholder): string; // "{fornavn}"
export function findPlaceholders(text: string): { known: Placeholder[]; unknown: string[] };
export function renderText(text: string, vars: MessageVars, opts?: { forPush?: boolean }): string; // forPush drops first_name; collapses doubled spaces/space-before-punctuation left by empty values
export function defaultAutoTexts(kind: "bus_assigned"|"bus_moved"|"bus_none"|"departure_reminder"): Record<"no"|"en", { title: string; body: string }>;
```
Default texts (fixed copy):
- bus_assigned — no: title "Bussen din", body "Hei {fornavn}! Du skal med {buss}. Den går {avgang} fra {oppmøtested}." en: title "Your bus", body "Hi {first name}! You're on {bus}. It leaves {departure} from {meeting point}."
- bus_moved — no: "Ny buss", "Hei {fornavn}! Du er flyttet til {buss}. Den går {avgang} fra {oppmøtested}." en: "New bus", "Hi {first name}! You've been moved to {bus}. It leaves {departure} from {meeting point}."
- bus_none — no: "Bussplassen din", "Hei {fornavn}! Du har ikke plass på noen buss akkurat nå. Arrangørene gir deg beskjed." en: "Your bus seat", "Hi {first name}! You don't have a seat on a bus right now. The organizers will let you know."
- departure_reminder — no: "Bussen går snart", "{buss} går {avgang} fra {oppmøtested}. Ha medlemsbeviset klart." en: "Your bus leaves soon", "{bus} leaves {departure} from {meeting point}. Have your member pass ready."

- [ ] **Step 1: Failing tests:** `reads placeholders in either language`; `flags unknown braces`; `empty values leave no braces` (and no "  " or " ." left); `push text drops the first name`; `defaults exist for every automatic kind in both languages`. **Step 2–4:** RED → implement → GREEN. **Step 5: Commit** `feat(big-events): message text and placeholders`.

---

### Task 4: Audience and delivery plan

**Files:** Create `packages/shared/big-events/messages/audience.ts`, `plan.ts`, `push-targets.ts` (`import "server-only"` where it reads Appwrite) (+ tests).

**Produces:**
```ts
export type Audience =
  | { type: "everyone" }
  | { type: "campus"; campusIds: string[] }
  | { type: "groups"; groupIds: string[]; leg?: "out"|"home" }
  | { type: "people"; participantIds: string[] };
export function resolveAudience(input: { audience: Audience; participants: Pick<BigEventParticipantRow,"$id"|"campus_id">[]; members: BigEventGroupMemberRow[]; allowedCampusIds: string[] | "all" }): string[]; // participant ids, campus-filtered, deduped, sorted
export function varsFor(input: { participant; leg: "out"|"home"; buses: Map<string, BigEventGroupRow>; rooms: Map<string, BigEventGroupRow>; members; locale: "no"|"en" }): MessageVars;
export interface PlannedRecipient { participantId: string; userId: string | null; push: boolean; email: boolean; sms: boolean; emailTo: string | null; smsTo: string | null; locale: "no"|"en"|null; vars: MessageVars }
export function planDelivery(input: { recipients: { participant: BigEventParticipantRow; userEmail: string | null; userLocale: "no"|"en"|null; vars: MessageVars }[]; pushUsers: Set<string>; important: boolean; sms: boolean }): PlannedRecipient[]; // M3
export function reachSummary(planned: PlannedRecipient[]): { people: number; push: number; email: number; sms: number; unreachable: number };
export async function pushTargetUsers(users: UsersApi, userIds: string[]): Promise<Set<string>>; // move admin's getPushReach logic here (concurrency 8); admin's reach.server.ts wraps it with its cache
```
- [ ] **Step 1: Failing tests:** `a campus admin's everyone is their campus`; `a bus audience uses the chosen leg`; `important goes both ways, others one way`; `nobody without an email or push is counted as unreachable`; `vars use the person's own bus and room`. **Step 2–4.** **Step 5: Commit** `feat(big-events): message audience and delivery plan`.

---

### Task 5: Send engine (shared, server-only)

**Files:** Create `packages/shared/big-events/messages/send.ts` (+ test, vitest with a fake db and mocked `dispatchAnnouncement`).

**Produces:** `sendMessage(deps: { db; messaging; users; now?: () => Date; webBase: string; isSmsEnabled: () => Promise<boolean> }, messageId: string): Promise<{ ok: true; counts } | { ok: false; error: "not_found"|"already_sent"|"busy" }>`:
1. Claim: status `scheduled` → `sending` (re-read and verify, like the queue claim); `sending` older than 10 min may be re-claimed; `sent` → `already_sent`.
2. Load event, participants, members, buses, rooms, linked users (`email`, `locale`), push targets; resolve audience (campus scope = message `campus_ids` or all), plan (M3).
3. Upsert recipients rows (unique message+participant; existing rows kept).
4. Pushes: recipients with `push` and no `pushed_at`, grouped by `(locale-independent push title/body rendered with forPush)` → chunks of ≤100 user ids → create `announcements` row (both languages rendered; `audience_type "users"`, `category` per M1, `deep_link`, `source`, `push: true`, `status "sent"`, `sent_at`) → `dispatchAnnouncement` → stamp `pushed_at` on those recipients.
5. Emails/SMS: create missing `big_event_deliveries` rows (kind `message`, channel, `to_address`, `participant_ids: [id]`, `message_id`).
6. Counts + `status: "sent"`, `sent_at`. Any thrown step → `status: "failed"` with counts so far (a later run may re-claim a `failed`? No — failed stays failed; admin can "Try again" which sets it back to `scheduled`).
- [ ] **Step 1: Failing tests:** `a retried send pushes and emails nobody twice`; `pushes group by identical text, at most 100 people per push`; `important sends push and email`; `a sent message can't be sent again`; `sms rows only when the switch is on`. **Step 2–4.** **Step 5: Commit** `feat(big-events): send big event messages`.

---

### Task 6: Message emails and SMS in the delivery queue

**Files:** Modify `packages/shared/big-events/delivery-queue.ts` (+ test), `apps/admin/src/lib/big-events/kick-deliveries.ts` (+ web's copy in `apps/web/src/app/actions/big-event-connect.ts`).

- `dueQueries`/`releaseStuck` include kind `message`.
- `message` + `email`: load message + recipient (`vars`, linked user's locale) → `renderEmail` with the message title as heading, `renderText(body, vars)` split into paragraphs; locale per M6 (unlinked → no then en sections); subject = title in that locale (both for unlinked: "no-title · en-title"); footer en "You get this because you're on {event} in BISO." / no "Du får denne fordi du er med på {event} i BISO." → `sendEmail`. Stamp `email_count`? (counts are set at send time; the processor updates `failed_count` on final failure.)
- `message` + `sms`: mark `skipped`, `last_error: "No SMS provider"` (M2).
- Kick: log `res.status` (no URL/secret) when `!res.ok`; log once when env is missing.
- [ ] **Step 1: Failing tests:** `sends a message email in the person's language`; `unlinked people get both languages`; `sms rows are skipped with a reason`; `kick logs a failed status`. **Step 2–4.** **Step 5: Commit** `feat(big-events): message emails and sms rows`.

---

### Task 7: Automatic messages and the messages cron

**Files:** Create `packages/shared/big-events/messages/auto.ts` (+ test); `apps/api/src/app/api/cron/big-event-messages/route.ts` (+ test); modify `functions/scheduled-dispatch/*` (new target `BIG_EVENT_MESSAGES_URL`, 60 s), docs scheduled-jobs row, `apps/api/src/app/api/cron/cleanup-big-events/route.ts` (also delete `big_event_message_recipients` 30 days after the end, within the run budget).

**Produces:**
- `runDueMessages(deps, now): Promise<{ scheduled: number; busMessages: number; reminders: number }>`:
  1. Scheduled: messages `status "scheduled"`, `scheduled_at ≤ now` → `sendMessage`.
  2. Bus messages (M9a): per published big event, participants with `bus_notice_due_at ≤ now − 10 min` → group into kinds (assigned/moved/none by `bus_notified_at` and current out bus); for each kind with the switch on create a `big_event_messages` row (kind, `audience: { type: "people", … }`, texts = custom `auto_texts[kind]` or `defaultAutoTexts`, `campus_ids` of those people, status `scheduled`, `scheduled_at: now`) and `sendMessage`; then (switch on or off) clear `bus_notice_due_at` and set `bus_notified_at = now` — only for rows whose `bus_notice_due_at` didn't change since read (re-read; a newer move waits for the next run).
  3. Departure reminders (M9b): buses of published events with the switch on, leg departure in `(now, now + 2h]` and that leg's `*_reminder_sent_at` null → one message per bus leg (`audience: { type: "groups", groupIds: [bus], leg }`, `leg`) → `sendMessage` → stamp the bus.
- Route: same CRON_SECRET + `cron-auth.ts`; returns counts; no chain (it's light), `maxDuration = 60`.
- [ ] **Step 1: Failing tests:** `moves within the settle time give one message with the latest bus`; `bus messages wait until the lists are published`; `switched off bus messages are stamped, not sent`; `someone without a bus gets the no-bus message`; `one reminder per leg even across late cron runs`; `no reminder for a departure already passed`; route `rejects a wrong secret`; cleanup `deletes message recipients 30 days after the end`. **Step 2–4.** **Step 5: Commit** `feat(big-events): automatic bus messages and reminders`.

---

### Task 8: Admin message actions

**Files:** Create `apps/admin/src/app/(portal)/_actions/big-event-messages.ts` (+ test). Modify `_actions/big-events.ts` (auto-message settings in `updateBigEvent` + form schema) and `_actions/big-event-participants.ts` (campus change, M12).

**Produces (all return `{ ok: true, … } | { ok: false; error: MessageError }`, `MessageError = "no_access" | "no_people" | "unknown_placeholder" | "missing_translation" | "in_the_past" | "already_sent" | "not_found"`):**
- `previewMessage(bigEventId, draft: MessageDraft)` → `{ reach, samples: { label: string; text: { no; en } }[] /* one per group, rendered */, warnings: string[] /* e.g. "Bus 3 has no meeting point yet" */ }` where `MessageDraft = { title: {no?, en?}; body: {no?, en?}; audience: Audience; leg?: "out"|"home"; important: boolean; alsoSms: boolean }`.
- `translateMessage(bigEventId, { title, body, from: "no"|"en" })` → `{ title, body }` in the other language (translateContentFields; message text only).
- `sendBigEventMessage(bigEventId, draft, when: { at: "now" } | { at: string /* ISO */ })` → creates the row (campus_ids = caller's scope), then `sendMessage` for "now". Kicks deliveries.
- `cancelMessage(messageId)`, `retryMessage(messageId)` (failed → scheduled now), `unpinMessage(messageId)`, `listMessages(bigEventId)` → history items with counts and "automatic" flag; campus admins see messages whose `campus_ids` overlap theirs.
- `updateBigEvent` accepts `auto_bus_assigned`, `auto_bus_moved`, `auto_departure_reminder`, `auto_texts` (full access or campus settings access).
- `updateParticipant`: when `campus_id` changes, delete their bus seats on buses whose campus ≠ the new campus; after publishing mark `bus_notice_due_at` (M12).
- Who may send: anyone with access to the big event (full, or campus level for their campus) — Stage 1 D2.
- [ ] **Step 1: Failing tests:** refusals per error code; `campus admins only reach their campus`; `scheduling in the past is refused`; `a campus change takes the person off the old campus's bus`; `history shows automatic messages`. **Step 2–4;** check-types; admin build. **Step 5: Commit** `feat(big-events): message actions`.

---

### Task 9: Messages tab and automatic-message settings (UI)

**Files:** Create `apps/admin/src/app/(portal)/big-events/[id]/messages/page.tsx`, `_components/{messages-view,composer,placeholder-buttons,audience-picker,reach-box,check-step,history-list}.tsx` (+ tests); add tab `{ key: "messages", segment: "messages" }` after Groups; settings section in `big-events/_components/big-event-form.tsx` ("Automatic messages": three switches + per-kind custom text with "Reset to default").

Behaviour (copy in both locales; brief verbatim where given):
- Steps **Melding · Hvem · Sjekk og send** (Message · Who · Check & send).
- Message: title + body textareas in the admin's language; placeholder buttons insert `{fornavn}` etc. at the cursor; "Important" switch ("Viktig" — shown in red, pinned, sent as push and email); "Also send as SMS" only when the flag is on, with "No SMS provider is connected, so nothing is sent by SMS yet."
- Who: cards Everyone · Campus · Buses/rooms/groups (multi-select; leg choice for buses) · Chosen people (search by name over the event's participants). Campus admins see only theirs.
- Reach box (live, debounced): "96 people: 81 get a push, 15 get an email" (+ "96 get an SMS"); "3 can't be reached (no email)".
- Check & send: "Translate" fills the other language (editable); previews one rendered sample per group (both languages); warnings; Send now / Schedule (Oslo date + time; refused in the past). Refusal codes shown as plain sentences.
- History: list with title, when, who (summary), counts, "Automatic" label, Important pin with "Unpin", scheduled ones with "Cancel", failed with "Try again".
- [ ] **Step 1: Failing component tests:** placeholder button inserts the token at the cursor; reach box shows the counts; check step requires both languages; schedule in the past shows the message; history labels automatic messages and offers Unpin. **Step 2–4;** check-types; admin build. **Step 5: Commit** `feat(big-events): messages tab`.

---

### Task 10: Staff guide and verification

**Files:** `apps/docs/content/docs/guide/big-events/messages.mdx` (+ `meta.json`, index link); update `buses-and-groups.mdx` (bus messages are now sent after 10 minutes, the switches, reminders 2 h before) and the developer pages (`scheduled-jobs.mdx` new target, `secrets-and-environment.mdx` if needed).
Describe only what works today (Stage 2 R16). Norwegian label first, English in brackets, verbatim.
- [ ] **Step 1:** Write; `cd apps/docs && bun test`. **Step 2:** Full verification (check-types; admin `bun test src` — known content-translation failure only; shared; api; web; docs; builds admin/api/web/docs; biome on changed files). **Step 3: Commit** `docs(big-events): messages guide`.

---

## Owner steps after Stage 3

- Push the new tables/columns; regenerate types.
- Add `BIG_EVENT_MESSAGES_URL` (https://<api>/api/cron/big-event-messages) to the scheduled-dispatch function.
- Deploy admin + api (+ web for the kick change). SMS stays off until a provider exists.
