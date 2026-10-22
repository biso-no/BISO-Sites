# Push notifications: automatic content alerts, composer rework, app deep links — design

## Why

Students should hear about new events, news and job postings without anyone
remembering to send a notification. Today nothing is automatic except an
opt-in "notify on publish" path for events, and that one re-sends every time a
published event is saved.

The manual composer in admin (`/communications`) works, but it was built
around raw values: a free-text Event ID, a comma-separated recipients box, a
disabled Segment option. Our administrators are **not technical**. The
composer must be obvious to someone who has never heard the word "topic".

In the app, tapping a notification about an event lands on the events list,
not the event. News does not exist in the app at all. Every push arrives in
Norwegian regardless of the student's language.

## Success looks like

- A Bergen editor publishes an event; a few minutes later every Bergen student
  who follows Events gets **one** push, in their own language, and tapping it
  opens that event.
- Tickster adds eight new events overnight; at 08:00 Bergen students get one
  push, "8 new events in Bergen", which opens a list of them.
- A non-technical admin sends a notification about an event by searching for
  the event by name, choosing "Students who follow Events at Bergen", seeing
  "≈ 412 students" and pressing Send. No IDs anywhere.
- A student's in-app notification screen shows exactly what they were sent:
  nothing from other campuses, nothing from before they joined.

## Non-goals

- iOS critical alerts (needs a special Apple entitlement).
- Rich images in iOS pushes (needs a Notification Service Extension). Android
  may show the image if passed; that's a bonus, not a requirement.
- Linking shop items from the composer. The "Shop" topic stays as a manual
  channel.
- Automatic notifications for anything other than events, news and jobs.
- Fixing the other broken app deep links found during recon (missing
  `/chat/conversation/:id` route, ignored expense `extra`, wrong
  `large-event-detail` route name). Listed so they're not forgotten.
- Quiet hours and per-user rate limiting beyond the night hold and bursts below.

## Anti-goals (would make this a failure even if it "works")

- A student gets the same notification twice (two languages, two channels,
  two triggers, a re-save, a retry).
- Editing an old published item notifies everyone.
- The WordPress backfill, or any bulk import, spams students.
- A campus admin accidentally notifies all of Norway.
- The admin UI exposes topic IDs, user IDs or event IDs to the admin.

## Current state (from recon, 2026-10-20)

**Sites repo**
- Sending lives in `apps/admin/src/lib/announcements/send.ts`
  (`dispatchAnnouncement`, `createPush` to `[topic]` or to `users`). Every
  push has an `announcements` row, which doubles as the app's inbox source.
- Topic IDs: `{news|events|jobs|shop}_{oslo|bergen|trondheim|stavanger|national}`
  plus `general` (21 topics, `appwrite.config.json` ~line 12074). Built by
  `packages/shared/utils/notification-topics.ts` (`topicIdFor`), mirrored by
  the app's `lib/core/constants/notification_topics.dart`. Campus IDs "1".."5"
  map to oslo, bergen, trondheim, stavanger, national.
- Events push on publish via `sendEventAnnouncement`
  (`apps/admin/src/app/(portal)/_actions/events.ts` ~109–153), gated by the
  `events.notify_push` column, with no "already sent" check.
- Content reaches `published` through many paths: `createX`/`updateX` upserts
  in the studio editors, `publishEvent`, `publishDueJobs` (cron), approvals
  (`approvals.ts` ~301), the AI assistant (`api/assistant/route.ts` ~558),
  Tickster sync (`apps/api/src/lib/tickster-events-sync.ts`, creates events as
  `published` by default) and the WordPress import (`packages/wp-import`).
- Translations live in `content_translations` (locale `en`/`no`) and the
  second locale may be written later by background AI translation.
- Functions live in `functions/*`. `member-roster-sync` is the pattern to copy
  (workspace deps, `bun build` bundle, `x-appwrite-key` → admin client).
  `scheduled-dispatch` pings the admin `/api/announcements/dispatch` route
  every 5 minutes for manually scheduled announcements.

**App repo (`/Users/markus/Documents/dev/BISO-Flutter`)**
- Push via Firebase Messaging; Appwrite push targets and topic subscriptions
  are managed client-side in `lib/data/services/notification_service.dart`
  (`reconcile` diffs desired vs. stored subscriptions).
- A device subscribes to `general` plus, for each enabled topic,
  `{topic}_{ownCampus}` **and** `{topic}_national`. This stays.
- Event deep link goes to `/explore/events` with `extra` that `EventsScreen`
  ignores; there is no fetch-event-by-id. Jobs and products deep-link fine.
- Events open in a private bottom sheet (`_EventDetailSheet`,
  `events_screen.dart`).
- No news model, service, route or screen.
- Inbox: `notifications_screen.dart` + `notification_inbox_service.dart`. Logic
  is mostly correct (own campus + national, honours topic opt-outs), but shows
  up to 50 items from before the user joined, and all UI strings are English.
- Android shows nothing for a push received while the app is in the
  foreground (no local-notifications plugin).
- The app's language comes from `localeProvider`, which defaults to `en`
  regardless of the device.
- The repo is currently on branch `feat/push-permission-at-sign-in` with
  uncommitted work by the user (inbox `Query.select` fix + version bump to
  2.2.7+91). **Decided:** commit that work on that branch and build on top
  of it.

## Decisions

### D1. One channel per language

Appwrite sends identical text to every device on a topic, and data-only pushes
that the app localizes itself are unreliable on iOS. So each channel exists
once per language and the server sends each language separately.

New topic scheme (all `subscribe: ["users"]`, like today):

| Purpose | Topic ID | Count |
|---|---|---|
| Everyone, all campuses | `general_{no,en}` | 2 |
| Everyone at a campus | `general_{oslo,bergen,trondheim,stavanger}_{no,en}` | 8 |
| Topic at a campus / national | `{news,events,jobs,shop}_{oslo,bergen,trondheim,stavanger,national}_{no,en}` | 40 |

50 topics. The 21 old topics are removed once the new app build is installed
(only the user is subscribed to them today, so no transition period).

A device subscribes to exactly one language: `general_{lang}`,
`general_{ownCampus}_{lang}` (skip when campus is National/unknown), and for
each enabled topic `{topic}_{ownCampus}_{lang}` + `{topic}_national_{lang}`.
Because one device holds one language and each send goes to exactly one
campus scope, nobody can receive a message twice.

`announcements.audience_value` stays **language-neutral** (`events_bergen`,
`general_bergen`, `general`). The send fans out to `…_no` and `…_en`.

Update both `notification-topics.ts` and `notification_topics.dart` (kept in
sync by hand, as today). Add a shared test in each repo listing the full
expected topic set so drift is caught.

### D2. App language follows the device

- Effective language = the user's explicit choice if they made one, otherwise
  the device locale: `nb`, `nn` or `no` → Norwegian, anything else → English.
- Changing the language in settings, or the device language changing while no
  explicit choice is stored, re-runs `reconcile` (moves subscriptions to the
  other language) and updates the user's stored language (D3).

### D3. Language for person-targeted sends

"Specific people" and "Group from an event" push to `users`, not topics, so
the server needs each user's language. Add `user.locale` (enum `en`, `no`).
The app writes it at sign-in and whenever the effective language changes.
The server groups recipients by `locale` and sends one push per language;
missing locale → English. *(My call: a column, not account prefs, so it can be
read in one query. Builder must verify the app can update the user's own row
under row security; if not, fall back to account prefs and `users.getPrefs`.)*

### D4. Push text per language

Use the `_no` text for `_no` channels and `_en` for `_en`. If one language is
missing at send time, use the other for both.

### D5. Automatic content notifications: rules

One Appwrite Function, `content-notifier`, handles events, news and jobs.

**Notify** when an item is `published` for the first time and its
`notify_push` is true, however it got there: create, draft → published,
scheduled publish, approval, AI assistant, Tickster.

**Skip** when any of these hold (checked on trigger *and* again just before
sending):
- status is not `published`;
- `notify_push` is false;
- event: status `cancelled`, or already over (`end_date`, else `start_date`,
  is in the past);
- job: status `closed`, or `application_deadline` has passed;
- already notified (D6).

**Members-only** events and jobs notify like any other. Their rows are only
readable by the members team, so a non-member who taps can't load the item.
*(My call:)* the app then shows a "Members only" teaser built from the
announcement row's own snapshot (title, image, date, campus; see D11) with a
"Become a member" button, instead of an error. Same for inbox photos and
burst lists: they render from the snapshot, not from the content row.

**Who receives it:** `topicIdFor(contentTopic, campus_id)` → e.g. a Bergen
event goes to `events_bergen_{no,en}`, a National event to
`events_national_{no,en}` (reaches everyone following Events).

**When:**
- A short delay after publish (default 3 minutes, env-configurable) so
  background translation can land and a mistaken publish can be undone.
- If the item has a `scheduled_publish_at` in the future, wait for it:
  `due_at` = the later of `scheduled_publish_at` and now + delay. *(My call.
  Today the event editor's "Schedule for…" saves the event as published
  immediately; making event scheduling actually hide events until then is a
  non-goal here.)*
- **Night hold:** anything that would go out between 22:00 and 08:00
  Europe/Oslo waits until 08:00.

**Bursts:** when two or more items for the **same channel** (e.g.
`events_bergen`) are due in the same dispatch run, send **one** push:
"5 new events in Bergen" / "5 nye arrangementer i Bergen" (National: "…from
BISO"), body listing the first two or three titles. Tapping opens a detail
page listing all of them (D11).

### D6. "Only once": a lock row per content item

New table `content_notifications`, row ID derived from the content:
`{type}_{contentId}` (hash the content ID if the result would exceed
Appwrite's 36-char limit). Creating the row is the lock; a second create for
the same item fails with 409 and the trigger exits.

Columns (my call; adjust as needed): `content_type` (event|news|job),
`content_id`, `campus_id`, `channel` (language-neutral topic, e.g.
`events_bergen`), `status` (pending|sent|skipped|cancelled), `reason`
(why skipped/cancelled, for debugging), `due_at`, `sent_at`,
`announcement_id`. Index `[status, due_at]`. No public permissions (function
uses the admin client).

- Item unpublished before its push went out → row `cancelled`. If it is
  published again later it gets a fresh chance (row back to `pending`). Once
  `sent`, never again.
- *(My call:)* a lock row is created only when the item is published **with**
  `notify_push` on. Publishing with the box unticked creates no row, so an
  editor can tick it later and save to notify then (deliberate, explicit
  action; the editor labels it "Notify students now"). Unticking while
  `pending` → `cancelled`; re-ticking → `pending` again. The launch backfill's
  `skipped` rows are permanent, so pre-launch items can never notify.
- The function never writes to the content rows themselves, so it can't
  trigger itself.

**Launch backfill (required):** before the function is enabled, a one-off
script creates `skipped` rows (reason "existed before launch") for every
currently published event, news item and job. Otherwise the first edit of an
old item would notify, since old events can have `notify_push = true`.

### D7. `content-notifier` mechanics

- Location `functions/content-notifier/`, Bun runtime, bundled like
  `member-roster-sync` so it can import `@repo/api` and `@repo/shared`.
- **Triggers:** row `create` and `update` events on `events`, `news`, `jobs`
  in database `app` (builder: confirm exact TablesDB event strings), plus a
  **schedule** (every minute or two).
- **On a row event:** re-fetch the row (don't trust the payload), apply D5
  skip rules, take the lock (D6), compute `due_at` (delay + night hold),
  exit. Also handles the unpublish → `cancelled` and republish → `pending`
  transitions.
- **On the schedule:** load `pending` rows with `due_at <= now`, re-check each
  item against D5, group by `channel`, then for each group create an
  `announcements` row (`source: auto`) and send via the shared send module
  (D8). Mark lock rows `sent` with the `announcement_id`.
- Idempotent per run: mark rows before or atomically with sending such that a
  crashed run can't send twice (builder's call on exact ordering; prefer
  "might skip once" over "might send twice").
- Unit tests (`bun test`) for: skip rules, `due_at` with night hold (incl.
  DST), burst grouping, lock behaviour.

### D8. One shared send module

Move the delivery logic out of `apps/admin/src/lib/announcements/send.ts` into
a workspace package both admin and the function can import (builder's call:
`@repo/shared` or a new small package). It owns:
- resolving an announcement's audience to topic IDs (both languages) or to
  users grouped by language (D3);
- building per-language title/body (D4) and the data payload (D10);
- `priority: high` for Urgent, `normal` otherwise;
- writing `user_notifications` rows for person-targeted sends (as today).
Remove the duplicate `buildDataPayload` in the actions file.

### D9. Editor checkbox

- Add `notify_push` (bool, default **false** at DB level) to `news` and `jobs`.
  Events already have it.
- News, job and event editors show "Notify students when published",
  **ticked by default for new items**. Once a notification has gone out, the
  editor shows "Students were notified on {date}" instead. A published item
  that was never notified shows an unticked "Notify students now" (see D6).
- DB default false keeps programmatic writers (WordPress import) silent.
- Tickster sync sets `notify_push: true` when it **creates** a new event.
- AI-assistant-created content should default to true, like the editors.
- Remove the direct push from `events.ts` (`sendEventAnnouncement` and its
  callers); the function replaces it.

### D10. Push payload contract

Every push still has an `announcements` row. Data (all strings):

```
type: "announcement"
announcement_id
category            general|trip|urgent|event|news|job
content_type        event|news|job|""        (single item)
content_id          id or ""
deep_link           biso://event?id=… | biso://news?id=… | biso://job?id=… | biso://announcement?id=…
```

Bursts use `biso://announcement?id=<burst row>`. The app routes on
`deep_link` first (existing behaviour). Old keys (`event_id`, `segment_id`)
may be dropped; nobody depends on them.

### D11. Announcements table changes

Add: `source` (manual|auto, default manual), `content_type`
(event|news|job, nullable), `content_id`, `content_ids` (string array, for
bursts), and a readable snapshot of the linked item(s) for the inbox, burst
list and members-only teaser (e.g. `image`, plus a JSON `items` column with
title_en/title_no/date/campus/image per item; builder's call on shape). The
app selects these explicitly (it never fetches the `data` column; see the
`Query.select` in `notification_inbox_service.dart`). `event_id` is superseded by `content_type`+`content_id` (builder may
keep it populated for old rows). Category enum gains `news` and `job`.

### D12. Admin composer rework (`/communications`)

Approved mockup: `docs/superpowers/specs/2026-10-20-push-notifications/admin-composer.html`.
Keep the studio's existing visual language (BRAND constants, Instrument Serif
headings).

**Who may send (decided by the user):** only campus admins and global
("national") admins. Department members can no longer send notifications;
`/communications` sending is closed to them (they may keep read access to the
history, builder's call). Enforced server-side, not only in the UI.

| | Global admin | Campus admin |
|---|---|---|
| Everyone, all campuses | ✓ | – |
| Everyone at a campus | ✓ | own campuses |
| Topic followers at a campus | ✓ | own campuses |
| Topic followers, all campuses (national channel) | ✓ | – |
| Specific people | ✓ | ✓ |
| Group from an event | ✓ | own campuses' events |
| "Notify students" on **National** content (automatic) | can tick | box off and locked |

The last row also applies to department members publishing content: their
campus content notifies normally through the automatic function, but only a
global admin can enable the automatic push for National content (enforced in
the save actions, since the function can't see who published).

Steps renamed: **What → Message → Who → Check & send.**

**What**
- Type cards: General, Event, News, Job, Trip, Urgent.
- Event/News/Job reveal a search box over **published** items (photo, date,
  campus, status). Drafts are shown greyed out with "can't link drafts" or
  hidden (builder's call). Default list filtered to the admin's campuses;
  search covers all. Trip may optionally link an event.
- Picking an item fills title and text in both languages from the item
  (only fields the admin hasn't typed in) and pre-selects audience = that
  item's topic + campus. Everything stays editable.
- Urgent: shown in red, sent with `priority: high`, pinned to the top of the
  app inbox until read (max 3 days).
- The Distribution tab's Event ID field is removed.

**Who** (cards, one selected; sub-options appear inside the card)
- **Everyone at a campus** → `general_{campus}`; "All campuses" →
  `general`, available to global admins only. Campus admins see only their
  campuses. Confirmation dialog before sending.
- **Students who follow a topic** → topic pills (News, Events, Jobs, Shop) +
  campus pills; "All campuses" → the topic's national channel.
- **Specific people** → searchable multi-select (name or email, min 2 chars,
  debounced), selected people as removable chips showing name; stored as user
  IDs. Replaces the free-text recipients box. No new component exists in
  `@repo/ui` (only single-select `combobox.tsx`); build on `Command` +
  `Popover`, styled like `department-combobox.tsx`.
- **A group from an event** (the old "Segment") → pick an event that has
  groups, then a group (shows member count). Uses the existing
  `event_segments` / `segment_members` delivery. Remove the "Coming in Phase 2"
  and "behaves like a broadcast" text.
- **Reach box**, live: "≈ N students" (sum of subscriber counts of both
  language channels via `listSubscribers`; person count for people/groups),
  one plain sentence of who, and "Tapping opens: {item}".

**Check & send**
- Plain-language summary: what, to whom, in which languages, what tapping
  opens.
- Sending between 22:00 and 08:00 offers "Send at 08:00 instead" (not forced).
  **Urgent** messages never get this offer: they always go out immediately,
  day or night. The night hold (D5) applies only to automatic content
  notifications, never to manual sends.
- "Specific people" with zero resolved people cannot be sent.

**History list** shows automatic notifications too, labelled "Automatic",
with a Manual/Automatic filter.

### D13. App work (`BISO-Flutter`)

Follow the app's `CLAUDE.md` / `AGENTS.md` and Biso design system
(`lib/presentation/widgets/biso/`, `BisoPalette`, `BisoAccent`).

1. **Topics & language:** D1 + D2 in `notification_topics.dart` and
   `reconcile`; write `user.locale` (D3).
2. **Event screen:** events get a full screen at `/explore/events/:eventId`
   (move `_EventDetailSheet` content into it). The events list opens it too,
   so there's one way to view an event. Add `EventService.getEvent(id)`
   (select `*` + `translation_refs.*`, as `buildEventQueries` does). Fix
   `biso://event?id=` and the `https://biso.no/app/events/...` universal link.
3. **News:** model, service (list with campus filter like events; get by id),
   a news list in Explore, a "Latest news" section on Home, and an article
   screen at `/explore/news/:newsId`; `biso://news?id=` and universal link.
4. **Smart inbox** (approved mockup:
   `docs/superpowers/specs/2026-10-20-push-notifications/app-inbox.html`, option A):
   - Grouped by day (Today, Earlier this week, …); filter chips All · Events ·
     News · Jobs · From BISO.
   - Content rows show the item's photo; others use `BisoIconTile` accents.
   - Burst rows expand inline into mini cards with "See all N"; tapping the
     row or the push opens an announcement detail listing every item.
   - Urgent pinned at top until read (max 3 days).
   - Shows only what this user was sent: personal sends, `general`,
     `general_{ownCampus}`, and topic sends for own campus + national that
     they follow — **and only items sent after the user's account was
     created**. Based on topic choices, not on whether the phone's
     notification permission is on. *(My call.)*
   - All strings localized (en/no).
5. **Android foreground:** add `flutter_local_notifications`; show pushes
   received while the app is open; two Android channels (default, urgent =
   high importance); tapping uses the same routing as background taps.
6. **Cold start:** the announcement fallback that calls `context.go` directly
   must queue like other deep links.

### D14. Event groups: import, matching, personal messages (separate phase)

**The case that drives it:** Winter Games (February, national, owned by the
existing national department "Wintergames"; Finago projects per year such as
"Wintergames 2027", so no department/Finago work is needed). Students from
all four campuses buy tickets on Tickster; BISO runs buses from each campus
to Storefjell. Hundreds of attendees. Each student must learn **their** bus:
"You're on Bus 1", "You're on Bus 2". Tickster's API exposes events, not
buyers, so the source of truth is the **Tickster participant export (.xlsx)**
the organizers download from Tickster admin. Must also work for other uses
(hotels, teams, shifts).

**Hard constraint from the user:** no Excel/CSV templates. Organizers bring
the file they already have.

**What exists** (`/events/[id]/segments`, `_actions/event-segments.ts`):
groups (`event_segments`: kind, name, campus, capacity, metadata), attendees
(`event_attendees`), membership (`segment_members`, per-user row
permissions), `importAttendeesCsv` (CSV only, fixed English header aliases),
`matchAttendeeUser` (exact account email only), `autoAssign` (campus +
capacity), `assignToSegment`, `messageSegment` (same text to all). Build on
this; don't start over.

1. **Import anything tabular.** Upload `.xlsx` (primary: the Tickster export),
   `.csv`, or paste rows copied from a spreadsheet. Word/PDF lists are a
   later nice-to-have. Column detection: known aliases first (English and
   Norwegian, plus Tickster's export headers, which the builder must look up
   from a real export the user provides), AI fallback otherwise. A preview
   shows the detected mapping in plain words ("Column D looks like the bus")
   and the admin confirms or corrects it. If the file already has a
   group/bus column, groups are created/assigned from its values.
   Re-importing an updated export updates rows (dedupe by order reference,
   else email). No xlsx library exists in the repo yet; pick a maintained
   one (builder's call; avoid the abandoned npm `xlsx` package).
2. **Privacy when using AI (my call):** the model sees only the header row and
   at most five sample rows for column detection, and only names (no emails or
   phones) when ranking fuzzy name candidates. Uses the existing `@repo/ai`
   setup.
3. **Matching ladder:** email (case-insensitive exact) → phone (normalized,
   +47 default) → student number → name + campus. Name matches are **never**
   auto-confirmed: they land in a "Please check" list with ranked candidates;
   the admin confirms, picks another, or searches (reuse the composer's
   people search).
4. **Who will actually get it.** Every attendee is in one of three lists:
   - ✅ Will get the push: matched account with a push target.
   - ⚠️ Has an account, notifications off: no push target. They'll see it in
     the app (item 6), but should be reached another way too.
   - ❌ No account found.
   Each list has "Copy emails" and the whole thing can be downloaded, so
   organizers can email or post in a group chat.
5. **Groups with details.** Each group has a name, kind (Bus, Hotel, Team,
   Other), campus, capacity and details: time, meeting point, contact person
   and phone, free note. Auto-fill by campus and capacity (exists); move
   people between groups by drag or select.
6. **Personal message.** One message for all groups; placeholders inserted
   with buttons, not typed syntax: first name, group, time, meeting point,
   contact. Preview shows the real text for one person per group. Sent per
   group and per language (D3); one `announcements` row per group
   (`audience_type: segment`) holding that group's resolved text, plus
   `user_notifications` per person. Available from the event's Groups page
   ("Message all groups" / one group) and from the composer's "Group from an
   event" card.
7. **"Your bus" in the app.** On the event screen (D13.2), a signed-in
   student who is in a group of that event sees a card: group name, time,
   meeting point, contact. `event_segments` is readable by users and
   `segment_members` rows are per-user readable, so the app can read this
   directly (builder: verify).
8. **Self-claim for unmatched students.** Per event, admin gets a link and QR
   (universal link into the app). A signed-in student enters the email or
   order number used on the ticket; on an exact match to an unmatched
   attendee row, that row is linked to them and they join its group. The app
   can't read `event_attendees`, so this needs a server endpoint (`apps/api`
   or a function; builder's call), rate-limited, and it only ever answers
   "found / not found", never other people's data. Claimed students move to
   ✅ or ⚠️ in the admin lists.
9. **Who can do it:** global admins for any group; campus admins for groups
   whose campus is one of theirs, even when the event is national (the Bergen
   admin handles Bergen buses). *(My call.)*
10. **Retention (my call):** attendee rows imported from files are deleted 30
    days after the event ends; group memberships stay for history.

## Suggested build order

1. Schema: topics (D1), columns (D3, D9, D11), `content_notifications` (D6).
   Edit `packages/api/appwrite.config.json`; **the user pushes it** and
   regenerates types.
2. Shared send module with language fan-out (D8, D10); admin keeps working.
3. App: topics/language, event screen, news, inbox, Android (D13).
4. `content-notifier` + launch backfill + Tickster flag + editor checkboxes;
   remove the old event push path (D5–D7, D9).
5. Admin composer rework (D12).
6. Event groups: import, matching, personal messages, "Your bus", self-claim
   (D14). Should be live well before Winter Games in February 2027.

## Left to the builder

- Exact TablesDB event strings, cron interval, delay default within 2–5 min.
- Where the shared send module lives.
- Ordering inside a dispatch run to avoid double sends.
- Burst copy beyond the examples above.
- Whether drafts appear greyed out or hidden in the content picker.
- Paging in the app inbox.
- Verify `nb`/`nn` device locale handling on both platforms.

## Verification

- `bun run check-types`, `bun run lint`, `bun run build --filter=admin`.
- `bun test` in `functions/content-notifier` and for the shared send module.
- `flutter analyze` and `flutter test` in the app; topic-set tests in both
  repos agree.
- End-to-end on a device with the user: publish a Bergen event → one push in
  the device's language after the delay, opens the event; switch app
  language → next push arrives in the other language, still once; Tickster
  burst → one grouped push; edit an old published event → no push.
