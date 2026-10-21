# Push Notifications — Plan 4: Communications composer rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A non-technical admin can send a notification without seeing an ID:
- pick what it's about, searching for the event, article or job by name
- write the message
- pick who gets it, with the campus channels, people search or event groups, and a live estimate of reach
- check a plain-language summary and send

The server enforces who may send to whom and refuses to send the same announcement twice.

**Architecture:**
- **Server rules:** access and audience rules live in a plain module, `apps/admin/src/lib/announcements/audience-policy.ts`, used both by the server actions and, mirrored, by the UI.
- **New lookup actions** in `_actions/composer.ts`: content search, prefill, people search, events with groups, and reach.
- **The composer** keeps its root component, preview pane and studio primitives in `announcement-studio-editor.tsx`. The four steps and the pickers move into focused files under `communications/_components/composer/`.
- **Linking:** linked content becomes `content_type` + `content_id` on the row, with a snapshot (`items`, `image`) built from the shared Plan 3 composer.

**Tech Stack:** Next.js 16 admin (server actions; client studio with inline BRAND styles), node-appwrite 29, bun:test with the custom DOM harness `@/test/react-dom-harness`, zod.

**Spec:** `docs/superpowers/specs/2026-10-20-push-notifications-design.md`, D12 and its role table, decided by the user. The approved mockup is `docs/superpowers/specs/2026-10-20-push-notifications/admin-composer.html`. Plans 1–3 are merged into `feat/push-notifications` (PR #101).

**Plan 4 of 5.**

## Global Constraints

- **Branch:** BISO-Sites `feat/composer-rework`, cut from `feat/push-notifications`. Read `apps/admin/CLAUDE.md`. "use server" files export only async functions; put sync helpers in plain modules. Verify every task with `bun run build --filter=admin`.
- **Who may send:** only `globaladmin` and `campusadmin`. Department members lose `/communications`: remove `DEPARTMENT_ROLE` from `portal.communications` in `roles.ts`. The server rejects creating, updating, sending or segment-messaging by anyone else with "Only campus and national admins can send notifications."
- **Audience rules** (server-enforced and mirrored in the UI). "Own campuses" means `ctx.managedCampusIds`. National is `"5"`; for broadcasts, no campus also counts as national.

  | Audience | Global admin | Campus admin |
  |---|---|---|
  | Everyone, all campuses (`broadcast`, campus `null`/`"5"`) | ✓ | – |
  | Everyone at a campus (`broadcast`, campus 1–4) | ✓ | own campuses |
  | Topic followers at a campus (`topic`, campus 1–4) | ✓ | own campuses |
  | Topic followers, all campuses (`topic`, campus `null`/`"5"` → national channel) | ✓ | – |
  | Specific people (`users`) | ✓ | ✓ |
  | Group from an event (`segment`) | ✓ | groups whose `campus_id` (else the event's campus) is in their own campuses, including groups on National events |
- **Re-sending:** `sendAnnouncement` refuses a row whose status is `sent` with "This announcement has already been sent." The scheduled cron path is unchanged.
- **Types** (the UI word, then the stored `category`):
  - General → `general`
  - Event → `event`
  - News → `news`
  - Job → `job`
  - Trip → `trip`
  - Urgent → `urgent`
  
  Event, News and Job require linked content; Trip may link an event. `category` gains `news` and `job` in `announcementSchema`.
- **Linked content:** the form fields are `content_type` (`event`|`news`|`job`|null) and `content_id`, and they replace the Event ID field.
  - **What the server writes:** `content_type` and `content_id`; `event_id` = `content_id` when the type is `event`; `deep_link` = `biso://{type}?id={content_id}`; plus `image` and `items`, a one-element JSON snapshot `{type, id, title_en, title_no, image, date, campus_id}` built with `toNotifyItem` from `@repo/shared/utils/content-notification-compose`, the same shape the app reads.
  - **Validation:** the content must exist and be `published`.
  - **Legacy drafts:** a draft with only `event_id` opens as linked event content.
- **Steps (exact labels):** `What` → `Message` → `Who` → `Check & send`.
- **Copy, from the mockup:**

  | Element | Text |
  |---|---|
  | What, title | "What is this about?" |
  | What, help | "Pick a type. If it's about something on the website, link it, and students go straight there when they tap." |
  | Type card: General | "An update from BISO" |
  | Type card: Event | "Links to an event" |
  | Type card: News | "Links to an article" |
  | Type card: Job | "Links to a position" |
  | Type card: Trip | "Travel info for a trip" |
  | Type card: Urgent | "Shown in red, delivered with priority" |
  | Picker label | "Which event?" / "Which article?" / "Which position?" |
  | Picker placeholder | "Search by name…" |
  | Draft row | "Draft (can't link drafts)" |
  | Linked card | "Change" link |
  | Tip after linking | "✓ Title and text filled in from the {event\|article\|position}. Edit freely." plus " Audience set to {Topic} · {Campus}." when the audience was set |
  | Who, title | "Who should get it?" |
  | Who, help | "Everyone gets it in their own language, Norwegian or English, and only once." |
  | Audience card | "Everyone at a campus" — "Every student with notifications on. Use sparingly." |
  | Audience card | "Students who follow a topic" — "Only students who chose to follow it in the app" |
  | Audience card | "Specific people" — "Search by name or email" |
  | Audience card | "A group from an event" — "e.g. everyone on Bus 2 of the Trondheim trip" |
  | Campus pills | Oslo, Bergen, Trondheim, Stavanger, "All campuses" (global admins only) |
  | Topic pills | News, Events, Jobs, Shop |
  | Reach, channel audiences | "About {n} phones", then one sentence: "Bergen students who follow Events." / "Everyone at Bergen." / "Everyone, at all campuses." / "Students who follow Events, at all campuses." |
  | Reach, people | "{n} people" |
  | Reach, group | "{n} people in {group}" |
  | Reach, unknown | "Reach unavailable right now" |
  | Reach, linked content | "Tapping opens: {title} ({date})" |
  | Late-night offer (22:00–08:00 Oslo, not Urgent) | "It's late. Students may be asleep." + button "Send at 08:00 instead" |
  | Everyone confirmation | "Send to everyone at {Campus}?" / "Send to every student?" — "This reaches about {n} phones." — buttons "Send" / "Cancel" |
  | Zero people | "Add at least one person." (send disabled) |
- **Prefill on linking:** fill `title_*` and `body_*` only where the admin hasn't typed (the field is empty, or still holds the previous prefill). The body is the short description, else the plain-text description cut to 300 chars, wrapped in `<p>…</p>`. Set the audience to Topic, with the content's topic and campus, only if the admin hasn't changed the audience yet and that audience is allowed for them.
- **People:** search by name or email, at least 2 chars, 300 ms debounce, 10 results. Each result shows name, email and campus name. Selected people show as chips with removable names. They are stored as IDs (a JSON array in `audience_value`). Drafts reopen with names via `getPeopleByIds`.
- **Reach** comes from the server: the sum of the `_no` and `_en` channel subscribers, cached 300 s. Requests are debounced 400 ms as the audience changes.
- **History list:**
  - Audience labels: "Everyone at {Campus}", "Everyone (all campuses)", "{Topic} · {Campus}", "{Topic} · all campuses", "{n} people", "Group: {name}".
  - An "Automatic" badge for `source === "auto"`.
  - A filter with All / Manual / Automatic. `listAnnouncements` gains `source`, where `manual` means `source != "auto"`, including null.
- **Admin copy is English.** Client components never import runtime values from `@repo/shared/utils/content-notifications` (it uses `node:crypto`); type imports are fine.
- **Tests:** bun:test. Every `mock.module` must keep the export shapes other suites use (bun mocks are process-wide). Action tests mock only `requireAuth` from `@/lib/authorization`, so new actions use `requireAuth` plus role checks on `ctx.roles`, not `requireNavAccess`.

## Review Focus

- A campus admin crafting a request by hand (bypassing the UI) for "Everyone, all campuses", a national topic channel, or another campus's channel must be refused by the server. Pinned in Task 1.
- Clicking "Send" twice, or "Send" on a sent row in the history list, must send once. Pinned in Task 1.
- Linking a draft or deleted article by id (hand-crafted request) must be refused. Pinned in Task 2.
- Linking after the admin has typed a title must not overwrite it; linking again must replace only the previous prefill. Pinned in Task 4.
- A department member who still has an old tab open must be refused when they press Send. Pinned in Task 1.

---

### Task 1: Who may send, audience rules, re-send guard, segment checks

**Files:**
- Create: `apps/admin/src/lib/announcements/audience-policy.ts`, `apps/admin/src/lib/announcements/audience-policy.test.ts`
- Modify:
  - `apps/admin/src/lib/roles.ts` (`portal.communications` drops `DEPARTMENT_ROLE`)
  - `apps/admin/src/app/(portal)/_actions/announcements.ts` (`createAnnouncement`, `updateAnnouncement`, `sendAnnouncement`)
  - `apps/admin/src/app/(portal)/_actions/event-segments.ts` (`messageSegment`: sender guard, and set the `campus` relationship next to `campus_id` so scoped lists show the row)
- Tests:
  - `apps/admin/src/app/(portal)/_actions/announcements-dispatch.test.ts`: the re-dispatch test becomes a refusal test
  - `announcements-relationships.test.ts` (department ctx cases)
  - `events-relationships.test.ts` (`messageSegment`)

**Interfaces:**
- Produces (`audience-policy.ts`, plain module, client-safe):
  - `canSendNotifications(roles: string[]): boolean`
  - `type AudienceRequest = { audienceType: "broadcast" | "topic" | "users" | "segment"; campusId: string | null; segmentCampusId?: string | null }`
  - `isAudienceAllowed(ctx: { roles: string[]; managedCampusIds: string[] }, req: AudienceRequest): boolean`, per the Global Constraints table
  - `allowedCampusChoices(ctx, audienceType): { campusIds: string[]; allCampuses: boolean }`, used by the UI
  - `SEND_FORBIDDEN_MESSAGE`, `AUDIENCE_FORBIDDEN_MESSAGE = "You can't send to that audience."`, `ALREADY_SENT_MESSAGE`
- In the actions:
  - `createAnnouncement`/`updateAnnouncement` reject with `SEND_FORBIDDEN_MESSAGE` unless `canSendNotifications(ctx.roles)`. They reject with `AUDIENCE_FORBIDDEN_MESSAGE` unless `isAudienceAllowed`. For `segment`, they load the segment (admin client) and its event; the segment must exist, and its event must be in scope under `withNationalEventScope`.
  - `sendAnnouncement` re-checks both on the stored row and refuses `status === "sent"`.

- [ ] **Step 1: Write the failing tests:**
  - Policy unit tests for every row of the table, for both roles: a campus admin of Bergen ("2"); a global admin; a campus admin with managed ["1"] sending to a segment whose campus is "1" on a National event (allowed).
  - Action tests:
    - A department ctx creating → refused.
    - A campus admin creating a broadcast with campus null → refused.
    - A campus admin creating a topic for campus "1" when they manage ["2"] → refused.
    - A global admin → allowed.
    - `sendAnnouncement` on a stored `sent` row → `{ error: ALREADY_SENT_MESSAGE }`, and dispatch is not called.
    - `messageSegment` by a department ctx → refused.
    - `messageSegment` writes `campus` alongside `campus_id`.
- [ ] **Step 2: Run to verify they fail.** `cd apps/admin && bun test src/lib/announcements "src/app/(portal)/_actions/announcements" "src/app/(portal)/_actions/events-relationships.test.ts"`
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the full `bun test ./src`, `bun run check-types --filter=admin` and `bun run build --filter=admin`.
- [ ] **Step 5: Commit.** `feat(admin): only campus and national admins send, audience rules, no re-sends`

---

### Task 2: Linked content on announcements

**Files:**
- Modify: `apps/admin/src/app/(portal)/_actions/schemas.ts` (`announcementSchema`: add `content_type: z.enum(["event","news","job"]).nullable().optional()` and `content_id: z.string().nullable().optional()`; `category` adds `news`, `job`; keep `event_id` optional for old clients)
- Create: `apps/admin/src/lib/announcements/linked-content.ts` (plain module, server-only), `apps/admin/src/lib/announcements/linked-content.test.ts`
- Modify: `apps/admin/src/app/(portal)/_actions/announcements.ts` (`buildAnnouncementColumns`, create, update)

**Interfaces:**
- Produces:
  - `resolveLinkedContent(db: AdminDb, link: { type: "event" | "news" | "job"; id: string } | null): Promise<{ ok: true; columns: LinkedColumns } | { ok: false; error: string }>`
  - `LinkedColumns = { content_type; content_id; event_id; deep_link; image; items }`
  - It loads the row (`events`/`news`/`jobs`) and its `content_translations` (`content_type` event|news|job, `content_id`). It requires `status === "published"`, else `{ ok:false, error: "Only published content can be linked." }`; a missing row gives "That content no longer exists."
  - It builds `items`/`image` via `toNotifyItem`.
  - A `null` link gives all-null columns, so unlinking clears them.
  - `normalizeLink(values): { type, id } | null` maps legacy `event_id` to `{type:"event", id}` when `content_*` is absent.
- `buildAnnouncementColumns` takes the resolved `LinkedColumns` (no more `event_id`-only logic).

- [ ] **Step 1: Write the failing tests:**
  - A published news link gives `deep_link` `biso://news?id=n1`, `content_type` news, an `items` JSON with one element and the keys `type,id,title_en,title_no,image,date,campus_id`, and `event_id` null.
  - An event link gives `event_id` equal to the id.
  - A draft is refused, and a missing row is refused.
  - A legacy `event_id`-only value links as an event.
  - Unlinking clears all six columns.
  - The action test: `createAnnouncement` with a draft link returns an error and writes no row.
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the admin tests, check-types and build.
- [ ] **Step 5: Commit.** `feat(admin): announcements link events, news and jobs`

---

### Task 3: Composer lookups (content search, prefill, people, groups, reach)

**Files:**
- Create: `apps/admin/src/app/(portal)/_actions/composer.ts` ("use server"), `apps/admin/src/app/(portal)/_actions/composer.test.ts`
- Create: `apps/admin/src/lib/announcements/composer-lookups.ts` (pure mappers, e.g. `toLinkableItem`, `toPersonResult`, `reachSentence`), plus its test
- Modify: `apps/admin/src/lib/notifications/topic-subscribers.ts` (export `getChannelSubscriberCount(channel)` wrapped in `unstable_cache` keyed by channel, revalidate 300)

**Interfaces** (all actions call `requireAuth()` and require `canSendNotifications`, else return empty results or an error):
- `searchLinkableContent(type: "event"|"news"|"job", query: string): Promise<LinkableItem[]>`
  - `LinkableItem = { id; type; title: string; date: string | null; dateLabel: string; campusId: string | null; campusName: string; image: string | null; status: "published" | "draft"; linkable: boolean }`
  - With a query under 2 chars, it returns the 8 newest items on the admin's campuses (global admin: all).
  - With 2 or more chars, it runs a fulltext search on the translation title across all campuses (`Query.search("translation_refs.title", q)` for events/news, `"translations.title"` for jobs, as `_actions/palette-search.ts` does), limit 10.
  - Drafts come back with `linkable: false`. `title` prefers English, else Norwegian. `dateLabel` is the event start "Fri 24 Oct", the news `$createdAt` "Fri 24 Oct", or the job "Apply by 3 Nov" (Oslo time, `en-GB`).
- `getLinkedContentPrefill(type, id): Promise<{ title_en; title_no; body_en; body_no; topic: "events"|"news"|"jobs"; campusId: string | null; label: string } | null>`. Bodies follow the Global Constraints prefill rule; `label` is "Autumn party (Fri 24 Oct)".
- `searchPeople(query: string): Promise<PersonResult[]>`, with `PersonResult = { id; name; email; campusName }`. It needs at least 2 chars and uses the admin `db` on table `user` with `Query.or([Query.contains("name", q), Query.contains("email", q)])` and `Query.limit(10)`.
- `getPeopleByIds(ids: string[]): Promise<PersonResult[]>`
- `listEventsWithGroups(query: string): Promise<Array<{ id; title; dateLabel; campusName }>>`. These are in-scope events (`withNationalEventScope`) that have at least one `event_segments` row; matching is a case-insensitive title contains; limit 10.
- `listGroupsForEvent(eventId: string)`. It delegates to `listSegments` and maps to `{ id; name; memberCount; campusId }`.
- `getAudienceReach(req: { audienceType; audienceValue: string | null; campusId: string | null }): Promise<{ count: number | null; sentence: string }>`
  - topic/broadcast: the channel via `resolvePushChannel`, then `getChannelSubscriberCount`.
  - users: the length of the ID list.
  - segment: the member count. Sentences are from the copy table.

- [ ] **Step 1: Write the failing tests** (mock `@repo/api/server`, keeping `{ db, messaging, users }`; mock `@/lib/authorization` `requireAuth`):
  - Content search with "aut" calls fulltext search, maps a draft to `linkable:false`, and shows the English title.
  - An empty query returns the newest on own campuses.
  - People search with a 1-char query returns `[]` with no db call; with "kari" it maps to `PersonResult`.
  - A department ctx gets empty results.
  - Reach for topic events campus "2" sums the `events_bergen_no` and `events_bergen_en` counts, with the sentence "Bergen students who follow Events."
  - Reach with one channel count null gives `count: null` and "Reach unavailable right now".
  - `reachSentence` for every audience shape.
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the admin tests, check-types and build.
- [ ] **Step 5: Commit.** `feat(admin): composer lookups for content, people, groups and reach`

---

### Task 4: Composer state and step structure

**Files:**
- Create: `apps/admin/src/app/(portal)/communications/_components/composer/composer-state.ts` (pure, client-safe), `composer-state.test.ts`
- Modify: `announcement-studio-editor.tsx`:
  - `STEPS` becomes the four new labels
  - `buildInitialValues` maps legacy `event_id` to a link
  - the step bodies render the new step components from Tasks 5–7, starting as minimal placeholders that keep current behaviour so the editor works after this task
- Modify: `announcement-studio-editor.test.tsx` (labels "Distribution"/"Review" become "Who"/"Check & send")

**Interfaces** (`composer-state.ts`):
- `COMPOSER_STEPS = ["What", "Message", "Who", "Check & send"] as const`
- `TYPE_CARDS: Array<{ id: "general"|"event"|"news"|"job"|"trip"|"urgent"; label; description; linkType: "event"|"news"|"job"|null; linkRequired: boolean }>`, with copy from the table. Trip has `linkType: "event"` and `linkRequired: false`.
- `topicForType(type): "events"|"news"|"jobs"|null`
- `interface PrefillSnapshot { title_en; title_no; body_en; body_no }`
- `applyPrefill(values: ComposerValues, prefill: PrefillSnapshot, previous: PrefillSnapshot | null): ComposerValues`. It fills a field only if it is empty or equals `previous`'s value.
- `applyLinkedAudience(values, { topic, campusId }, ctx: { audienceTouched: boolean; allowed: boolean }): ComposerValues`
- `ComposerValues` = `AnnouncementFormValues` plus `content_type`/`content_id`.
- `canContinue(step, values): { ok: boolean; reason?: string }`. What needs a title and, for Event/News/Job, a link. Who with people needs at least one person ("Add at least one person.").

- [ ] **Step 1: Write the failing tests:**
  - `applyPrefill`:
    - It fills empty fields.
    - It keeps a typed title.
    - It replaces a field that still holds the previous prefill.
    - It never touches a field changed after the previous prefill.
  - `applyLinkedAudience`: it sets topic and campus only when untouched and allowed.
  - `canContinue`: a News card without a link is blocked.
  - `buildInitialValues`: a legacy `event_id` maps to an event link.
  - The editor test is updated to the new labels and still passes.
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the admin tests and build.
- [ ] **Step 5: Commit.** `refactor(admin): composer steps What, Message, Who, Check & send`

---

### Task 5: "What" step (type cards, content picker, prefill)

**Files:**
- Create: `communications/_components/composer/what-step.tsx`, `content-picker.tsx`, `content-picker.test.tsx` (DOM harness)
- Modify: `announcement-studio-editor.tsx` (render `WhatStep`; the title with Norsk | English tabs, Norsk first, moves here; the old Essentials category grid is removed)

**Interfaces:**
- `ContentPicker({ type, value, onPick, onClear, search = searchLinkableContent })`:
  - A trigger and a dropdown, in the style of `department-combobox.tsx`: inline BRAND styles, `role="listbox"`/`option`, closing on outside `pointerdown`.
  - A debounced (300 ms, `useDebounce` from `@repo/ui/hooks/use-debounce`) server search.
  - Rows show a thumbnail, the title, and "{dateLabel} · {campusName} · {Published|Draft}". Draft rows are disabled, with "Draft (can't link drafts)".
  - Once something is picked, it shows the linked card (image, title, dateLabel · campus, "Change").
  - `search` is injectable for tests.
- On pick, `WhatStep` calls `getLinkedContentPrefill`, then `applyPrefill` and `applyLinkedAudience`, and shows the tip line.

- [ ] **Step 1: Write the failing tests** (the harness, with an injected fake `search`):
  - Typing shows results.
  - A draft row can't be picked.
  - Picking shows the linked card with "Change".
  - Choosing the News card shows "Which article?".
  - Choosing General hides the picker and clears any link.
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the admin tests and build.
- [ ] **Step 5: Commit.** `feat(admin): link an event, article or position by searching for it`

---

### Task 6: "Who" step (audience cards, campus and topic pills, people, groups, reach)

**Files:**
- Create: `communications/_components/composer/who-step.tsx`, `people-picker.tsx`, `group-picker.tsx`, `reach-box.tsx`, and tests (`people-picker.test.tsx`, `who-step.test.tsx`)
- Modify: `announcement-studio-editor.tsx` (render `WhoStep`; the old `DistributionStep`/`AudienceDetail`, the Event ID input and the free-text recipients box are removed; the "From (department)" field stays in the Who step under a small "Sent on behalf of" label, using the existing `DepartmentCombobox`)
- Modify: `communications/[id]/page.tsx` (pass `managedCampusIds` and `isGlobalAdmin` so the UI mirrors `isAudienceAllowed`)

**Interfaces:**
- `WhoStep` renders the four cards from the copy table. Only the selected card expands its sub-controls.
  - **Campus pills:** filtered by `allowedCampusChoices`. "All campuses" appears only when allowed. Choosing it sets `campus_id` to null.
  - **Cards a user can't use** are shown disabled, with "Only national admins can send to every campus."
- `PeoplePicker({ value: string[], onChange, search = searchPeople, resolve = getPeopleByIds })` works as described in the Global Constraints, with chips that have a remove button (`aria-label="Remove {name}"`).
- `GroupPicker({ value: string | null, onChange, listEvents = listEventsWithGroups, listGroups = listGroupsForEvent })`. You choose an event (searchable), then a group (`<select>` showing "Bus 2 (34 people)"). `audience_value` is the segment id.
- `ReachBox({ request, getReach = getAudienceReach, tappingOpens: string | null })` is a dark box (#1a1814) with a serif number. It re-fetches on a 400 ms debounce and shows the copy-table texts.

- [ ] **Step 1: Write the failing tests:**
  - A campus admin sees no "All campuses" pill and a disabled national option.
  - A global admin sees it.
  - Selecting people adds chips; removing a chip updates `audience_value`; the reopened IDs resolve to names.
  - The group picker lists groups only after an event is chosen.
  - The reach box shows "About 412 phones" and the sentence, and "Reach unavailable right now" for null.
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the admin tests and build.
- [ ] **Step 5: Commit.** `feat(admin): choose who gets it, with live reach`

---

### Task 7: "Check & send" step

**Files:**
- Create: `communications/_components/composer/check-step.tsx`, `check-step.test.tsx`, `composer/quiet-hours.ts` (client-safe: `isQuietHoursOslo(now: Date): boolean` and `nextMorningOslo(now: Date): Date`, built on `isoToOsloWallClock`/`osloWallClockToIso`), and `quiet-hours.test.ts`
- Modify: `announcement-studio-editor.tsx` (render `CheckStep`; the push toggle, "Push + inbox" or "Inbox only", and the schedule input move here; the old Review rows are replaced; the send flow gains the Everyone confirmation dialog)

**Interfaces:**
- `CheckStep` shows plain sentences, each with an "Edit" link back to its step:
  - What: "{Type}: {title}" plus "Opens {label}" when linked.
  - Who: the reach sentence plus "About {n} phones".
  - Languages: "Norwegian and English", or "{one} only — students get it in {one}".
  - Timing.
- **Timing:** "Send now" or "Schedule" (a `datetime-local` in Oslo time, as before).
- **Late-night offer:** when it's quiet hours in Oslo and the category isn't `urgent`, show the late-night offer from the copy table. Its button sets `scheduled_at = nextMorningOslo(now)` and switches to Schedule.
- **Everyone confirmation:** for `broadcast` audiences, pressing Send opens the confirmation from the copy table. "Cancel" sends nothing.
- **People:** Send is disabled with "Add at least one person." when a people audience has none.

- [ ] **Step 1: Write the failing tests:**
  - `isQuietHoursOslo` at 21:59 is false, at 22:00 true, at 07:59 true, at 08:00 false (winter and summer).
  - `nextMorningOslo` from 23:30 is 08:00 next day, and across DST.
  - The check step at 23:00 for General shows the offer, and for Urgent doesn't.
  - Clicking the offer switches to Schedule at 08:00.
  - A broadcast Send opens the confirmation, and Cancel doesn't call send.
  - A people audience with 0 people has Send disabled.
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the admin tests and build.
- [ ] **Step 5: Commit.** `feat(admin): check-and-send summary with late-night and everyone safeguards`

---

### Task 8: History list (labels, Automatic badge, filter)

**Files:**
- Modify: `apps/admin/src/app/(portal)/communications/_components/announcement-list-client.tsx`, `communications/page.tsx`, `_actions/announcements.ts` (`listAnnouncements` gains `source?: "all" | "manual" | "auto"`)
- Create: `apps/admin/src/lib/announcements/audience-label.ts` (pure `audienceLabel(row, campusNames, segmentName?)`), plus its test

**Interfaces:**
- `audienceLabel` gives the history-list labels from Global Constraints.
- The list shows the "Automatic" badge and the type label ("Event", "News", …) instead of the raw category.
- A segmented filter (All / Manual / Automatic) driven by the `?source=` query param.
- The list's Send button is hidden for `sent` rows (the server refuses anyway).

- [ ] **Step 1: Write the failing tests:**
  - `audienceLabel` for each audience shape (incl. a stored `general_bergen` broadcast giving "Everyone at Bergen", and `events_national` giving "Events · all campuses").
  - `listAnnouncements({ source: "auto" })` adds `Query.equal("source","auto")`.
  - `"manual"` adds `Query.or([Query.isNull("source"), Query.equal("source","manual")])`.
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the admin tests and build.
- [ ] **Step 5: Commit.** `feat(admin): clearer notification history with automatic sends marked`

---

### Task 9: CHECKPOINT (human) — try it as a non-technical admin

- [ ] **Step 1:** Deploy admin from `feat/composer-rework`. Ask the user to send:
  1. A News notification linked to a published article, to "Students who follow News" at their campus. The title and text prefill, the reach shows a number, and the push opens the article.
  2. To "Specific people", with themselves as the only person.
  3. An "Everyone at a campus" send, to see the confirmation dialog.
  4. One composed after 22:00, to see the offer (or check the copy in a test build).
  
  Also ask the user to try a campus-admin account, if one is available, and confirm the National options are hidden.
- [ ] **Step 2:** Collect wording feedback and turn any changes into a small follow-up.
