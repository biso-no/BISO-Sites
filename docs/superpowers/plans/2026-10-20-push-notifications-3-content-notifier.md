# Push Notifications — Plan 3: Automatic content notifications (`content-notifier`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When an event, news article or job goes live with "Notify students" on, students who follow that topic at that campus (plus National followers for national content) get one push in their language a few minutes later. The push is held overnight and grouped when several arrive together. Editors see whether and when it went out. The old direct event push is removed.

**Architecture:** Pure rules live in `@repo/shared`: eligibility, lock id, due time with the night hold, and the text of single and grouped notifications. One Appwrite Function, `functions/content-notifier`, has two entry paths:
1. **Row event.** A row create or update on `events`/`news`/`jobs` makes it re-read the row and move its lock row in `content_notifications` (none → pending → cancelled/sent).
2. **HTTP ping.** `scheduled-dispatch` calls it every 5 minutes with `CRON_SECRET`, and it sends every due pending lock, grouped by channel, through Plan 1's `dispatchAnnouncement`.

Appwrite documents that a function uses events *or* a schedule, not both, so the dispatch tick comes from the existing pinger. Admin gets the "Notify students" toggle and status for all three editors. Tickster and the AI assistant default the flag on. A one-off script backfills `skipped` locks for everything already published.

**Tech Stack:** TypeScript, Bun (function bundle), node-appwrite 29 (TablesDB, Messaging), vitest (`packages/shared`), bun:test (`apps/admin`, `functions/*`, `apps/api` uses vitest), Next.js 16 admin.

**Spec:** `docs/superpowers/specs/2026-10-20-push-notifications-design.md` (D5, D6, D7, D9, D10, D11; D12's National rule). Plans 1–2 are done. Plan 1's `push-dispatch.ts`, `notification-topics.ts` and the `content_notifications` table are the foundation.

**Plan 3 of 5.**

## Global Constraints

- **Branch:** BISO-Sites `feat/content-notifier`, cut from `feat/push-notifications` (PR #101, unmerged). Bun only. Shared tests use vitest; admin and functions use `bun test`.
- **Function triggers:**
  - Events: `tablesdb.app.tables.events.rows.*.create`, `tablesdb.app.tables.events.rows.*.update`, and the same pair for `news` and `jobs`.
  - Dispatch: an HTTP POST from `scheduled-dispatch` carrying `CRON_SECRET` (`x-cron-secret` or `Authorization: Bearer`). A `schedule` trigger, if Appwrite ever sends one, runs dispatch too.
- **Lock row id:** `${type}_${contentId}`, where `type` is `event`|`news`|`job`. If that is over 36 chars or contains characters outside `[A-Za-z0-9._-]`, use `${type}_` + the first `36 - type.length - 1` hex chars of `sha256(contentId)`.
- **Channel:** `topicIdFor(topic, campus_id)`, where `topic` is `events`|`news`|`jobs` (job maps to `jobs`). National or no campus gives `{topic}_national`.
- **Eligible to notify** (checked on every event and again before sending):
  - `status == "published"` and `notify_push === true` (null counts as false).
  - **Events:** not over, where "over" means `end_date ?? start_date` is before now.
  - **Jobs:** `application_deadline` absent or not before now.
- **Due time** = `max(now + delay, scheduled_publish_at)`, with delay = `NOTIFY_DELAY_MINUTES` (default 3).
- **Night hold:** if the due time falls at or after 22:00 Oslo, it moves to 08:00 the next Oslo day. Before 08:00 Oslo, it moves to 08:00 the same day. Use `isoToOsloWallClock` / `osloWallClockToIso` from `@repo/shared/utils/oslo-time` so DST is handled.
- **Grouping:** two or more due items with the same channel in one dispatch run become one grouped notification.
- **Lock state machine:**
  - A lock is created only when the item is eligible.
  - Ineligible while `pending` → `cancelled`, with a reason.
  - `cancelled` and eligible again → `pending`, with a new `due_at`.
  - `sent` and `skipped` are final.
  - A content row that has disappeared (404) → `cancelled`.
- **Send order:** create the `announcements` row, then mark the locks `sent` (with `announcement_id`, `sent_at`), then push. We prefer "might skip once" to "might send twice".
- **Announcement row for an automatic send:**
  - Status and source: `status: "sent"`, `sent_at`, `source: "auto"`, `push: true`.
  - Audience: `audience_type: "topic"`, `audience_value: <channel>`, `campus`/`campus_id` from the content.
  - Category: `category` = the type (`event`|`news`|`job`), and `content_type` = the type.
  - Content link: a single item gets `content_id`. A grouped one gets `content_ids` and `content_id: null`.
  - Snapshot: `items` = JSON array of `{type, id, title_en, title_no, image, date, campus_id}`, and `image` = the first item's image.
  - Text: `title_en/no`, `body_en/no` as in the copy table. Leave `deep_link` null; Plan 1's `buildDeepLink` derives it.
- **Copy, single item:**

  | Type | `title_en` / `title_no` | `body_en` / `body_no` |
  |---|---|---|
  | Event | the event title | `{weekday short} {day} {month short} · {HH:mm}` (Oslo time), plus ` · {location}` when there is one |
  | News | the article title | the short description; if none, the plain-text description cut to 140 chars plus `…` |
  | Job | `New position: {title}` / `Ny stilling: {title}` | `Apply by {day} {month long}` / `Søknadsfrist {day}. {month long}`; if there's no deadline, the short description |

  Format dates with `formatOsloDate`, using `en-GB` and `nb-NO`.
- **Copy, grouped** (`{n}` = count; `{Campus}` = Oslo|Bergen|Trondheim|Stavanger; national uses "from BISO" / "fra BISO" in place of "in {Campus}" / "i {Campus}"):

  | Type | English | Norwegian |
  |---|---|---|
  | Events | `{n} new events in {Campus}` | `{n} nye arrangementer i {Campus}` |
  | News | `{n} new news stories in {Campus}` | `{n} nye nyheter i {Campus}` |
  | Jobs | `{n} new positions in {Campus}` | `{n} nye stillinger i {Campus}` |

  The body is the first three titles in that language joined with ` · `, followed by ` …` when `n > 3`.
- **Language fallback:** a missing translation uses the other language, the same as `localizedPushContent`.
- **National content:** only `ctx.roles.includes("globaladmin")` may turn `notify_push` on for `campus_id === "5"`. For anyone else the server keeps the stored value (false on create), and the editor shows the toggle disabled with "Only national admins can notify every student."
- **Defaults:** editors tick "Notify students when published" for new items. Tickster sets `notify_push: true` only when it creates an event. AI-assistant-created events, news and jobs set it true. The WordPress import never sets it.
- **Admin copy is English.** Admin "use server" files export only async functions; run `bun run build --filter=admin` after touching them.
- Do not hand-edit `packages/api/types/appwrite.ts` or the schema. No schema change is needed: every column exists after Plan 1.

## Review Focus

- An item published at 23:30 must wait until 08:00 Oslo, and the DST weekends must not shift that (last Sunday of March and October). Pinned in Task 1.
- An editor re-saving a published item many times must cause exactly one push. Pinned in Task 3.
- Unpublishing within the delay must mean no push, and republishing later must mean exactly one push. Pinned in Task 3.
- Two row events for the same new item arriving at once must leave one lock (the create's 409 is handled). Pinned in Task 3.
- A Tickster sync that updates an existing event must never switch `notify_push` on. Pinned in Task 8.

---

### Task 1: Shared rules (lock id, channel, eligibility, due time)

**Files:**
- Create: `packages/shared/utils/content-notifications.ts`, `packages/shared/utils/content-notifications.test.ts`

**Interfaces:**
- Produces:
  - `type NotifyContentType = "event" | "news" | "job"`
  - `contentTableFor(type): "events" | "news" | "jobs"` and `contentTypeForTable(table: string): NotifyContentType | null`
  - `lockRowIdFor(type: NotifyContentType, contentId: string): string`
  - `channelFor(type: NotifyContentType, campusId: string | null | undefined): string`
  - `type Eligibility = { ok: true } | { ok: false; reason: string }`
  - `eligibilityFor(type: NotifyContentType, row: Record<string, unknown>, now: Date): Eligibility`. Reasons (exact strings): `"not published"`, `"notify off"`, `"event over"`, `"deadline passed"`.
  - `dueAtFor(input: { now: Date; scheduledPublishAt?: string | null; delayMinutes: number }): Date`
  - `NOTIFY_DEFAULT_DELAY_MINUTES = 3`, `NIGHT_START_HOUR = 22`, `NIGHT_END_HOUR = 8`

- [ ] **Step 1: Write the failing tests:**

```ts
it("uses a readable lock id", () => expect(lockRowIdFor("event", "abc123")).toBe("event_abc123"));
it("hashes ids that would be too long or unsafe", () => {
  const id = lockRowIdFor("news", "x".repeat(40));
  expect(id.startsWith("news_")).toBe(true);
  expect(id).toHaveLength(36);
  expect(lockRowIdFor("news", "x".repeat(40))).toBe(id);           // stable
  expect(lockRowIdFor("job", "a/b")).toMatch(/^job_[0-9a-f]+$/);
});
it("maps content to its channel", () => {
  expect(channelFor("event", "2")).toBe("events_bergen");
  expect(channelFor("job", "5")).toBe("jobs_national");
  expect(channelFor("news", null)).toBe("news_national");
});
describe("eligibilityFor", () => {
  const now = new Date("2026-11-02T12:00:00Z");
  it("needs published and notify on", () => {
    expect(eligibilityFor("news", { status: "draft", notify_push: true }, now)).toEqual({ ok: false, reason: "not published" });
    expect(eligibilityFor("news", { status: "published", notify_push: null }, now)).toEqual({ ok: false, reason: "notify off" });
    expect(eligibilityFor("news", { status: "published", notify_push: true }, now)).toEqual({ ok: true });
  });
  it("skips events that are over", () => {
    expect(eligibilityFor("event", { status: "published", notify_push: true, start_date: "2026-11-01T18:00:00Z", end_date: null }, now)).toEqual({ ok: false, reason: "event over" });
    expect(eligibilityFor("event", { status: "published", notify_push: true, start_date: "2026-11-01T18:00:00Z", end_date: "2026-11-03T18:00:00Z" }, now)).toEqual({ ok: true });
  });
  it("skips jobs past their deadline", () => {
    expect(eligibilityFor("job", { status: "published", notify_push: true, application_deadline: "2026-11-01T22:59:59Z" }, now)).toEqual({ ok: false, reason: "deadline passed" });
    expect(eligibilityFor("job", { status: "published", notify_push: true, application_deadline: null }, now)).toEqual({ ok: true });
  });
});
describe("dueAtFor", () => {
  it("waits the delay in the daytime", () =>
    expect(dueAtFor({ now: new Date("2026-11-02T12:00:00Z"), delayMinutes: 3 }).toISOString()).toBe("2026-11-02T12:03:00.000Z"));
  it("waits for a later scheduled publish time", () =>
    expect(dueAtFor({ now: new Date("2026-11-02T12:00:00Z"), scheduledPublishAt: "2026-11-03T09:00:00Z", delayMinutes: 3 }).toISOString()).toBe("2026-11-03T09:00:00.000Z"));
  it("holds 23:30 Oslo until 08:00 next day (winter, UTC+1)", () =>
    expect(dueAtFor({ now: new Date("2026-11-02T22:30:00Z"), delayMinutes: 3 }).toISOString()).toBe("2026-11-03T07:00:00.000Z"));
  it("holds 05:00 Oslo until 08:00 same day (summer, UTC+2)", () =>
    expect(dueAtFor({ now: new Date("2027-06-10T03:00:00Z"), delayMinutes: 3 }).toISOString()).toBe("2027-06-10T06:00:00.000Z"));
  it("lands on 08:00 Oslo across the spring DST change", () =>
    expect(dueAtFor({ now: new Date("2027-03-27T22:30:00Z"), delayMinutes: 3 }).toISOString()).toBe("2027-03-28T06:00:00.000Z"));
  it("lands on 08:00 Oslo across the autumn DST change", () =>
    expect(dueAtFor({ now: new Date("2026-10-24T21:30:00Z"), delayMinutes: 3 }).toISOString()).toBe("2026-10-25T07:00:00.000Z"));
  it("07:59 is still night, 08:00 is not, 21:59 is day, 22:00 is night", () => { /* boundary cases in Oslo wall-clock */ });
});
```

- [ ] **Step 2: Run to verify they fail.** Run `cd packages/shared && bunx vitest run utils/content-notifications`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement.** Use `node:crypto` `createHash("sha256")`. The night hold works on the Oslo wall-clock string from `isoToOsloWallClock`: add one calendar day with `Date.UTC` arithmetic on the date part, then convert back with `osloWallClockToIso(\`${date}T08:00\`)`.
- [ ] **Step 4: Run.** `bunx vitest run utils/content-notifications` passes, and `bun run --cwd packages/shared check-types` is clean.
- [ ] **Step 5: Commit.** `feat(shared): content notification rules`

---

### Task 2: Shared composition (notification text and snapshot)

**Files:**
- Create: `packages/shared/utils/content-notification-compose.ts`, `packages/shared/utils/content-notification-compose.test.ts`

**Interfaces:**
- Consumes: Task 1, `formatOsloDate`/`formatOsloTime`, `htmlToPlainText` (push-dispatch), `campusSlugFor`/`NATIONAL_SLUG`.
- Produces:
  - `interface NotifyItem { type: NotifyContentType; id: string; campusId: string | null; channel: string; titleEn: string | null; titleNo: string | null; summaryEn: string | null; summaryNo: string | null; descriptionEn: string | null; descriptionNo: string | null; date: string | null; location: string | null; image: string | null }`. `date` is the event start, the news `$createdAt` or the job `application_deadline`.
  - `toNotifyItem(type, row: Record<string, unknown>, translations: Array<{ locale: string; title?: string | null; short_description?: string | null; description?: string | null }>): NotifyItem`
  - `interface AutoAnnouncementColumns { category: string; source: "auto"; status: "sent"; push: true; audience_type: "topic"; audience_value: string; campus: string | null; campus_id: string | null; content_type: NotifyContentType; content_id: string | null; content_ids: string[] | null; items: string; image: string | null; title_en: string; title_no: string; body_en: string; body_no: string; sent_at: string; deep_link: null }`
  - `composeAutoAnnouncement(items: NotifyItem[], now: Date): AutoAnnouncementColumns`. `items` is non-empty and shares one channel. `title_*` is cut to 200 characters and `body_*` to 500.

- [ ] **Step 1: Write the failing tests,** asserting the exact copy from Global Constraints:
  - Single event: Bergen event "Autumn party" / "Høstfest" on `2026-10-24T18:00:00Z` at "Kafé" gives `title_no` "Høstfest" and `body_no` "lør. 24. okt. · 20:00 · Kafé". Use whatever `nb-NO` `Intl` produces for `{weekday:"short", day:"numeric", month:"short"}`; compute the expected value with the same `formatOsloDate` call in the test, so a Node/ICU difference can't make it flaky. Check `body_en` the same way, and `content_id` = the event id, `content_ids` null.
  - Single event with only an English translation: both languages use the English title.
  - Single news with no short description and an HTML description: the body is plain text cut to 140 chars plus `…`.
  - Single job: "New position: Marketing" / "Ny stilling: Marketing", with the deadline body in both languages. With no deadline, the short description.
  - Grouped events, 4 Bergen items: "4 new events in Bergen" / "4 nye arrangementer i Bergen", the body is the first three titles plus " …", `content_ids` has 4 entries, `content_id` is null, `items` parses to 4 objects with the snapshot keys, and `image` is the first item's image.
  - Grouped national jobs, 2 items: "2 new positions from BISO" / "2 nye stillinger fra BISO".
  - Audience: `audience_value` equals the items' channel and `campus_id` equals the first item's campus.
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Tests pass and check-types is clean.
- [ ] **Step 5: Commit.** `feat(shared): compose automatic content notifications`

---

### Task 3: Function core (state machine + dispatch)

**Files:**
- Create: `functions/content-notifier/package.json`, `tsconfig.json`, `src/run.ts`, `src/run.test.ts`. Copy `functions/member-roster-sync` exactly (name `content-notifier`, `type: module`, scripts `check-types`/`test`/`bundle`, deps `@repo/api`, `@repo/shared`, devDeps `@types/bun`, `@types/node`, `typescript` from catalog). Run `bun install` at the root.

**Interfaces:**
- Consumes: Tasks 1–2, plus `dispatchAnnouncement` and `DispatchClients` from `@repo/shared/utils/push-dispatch`.
- Produces (`src/run.ts`):
  - `interface NotifierDeps`:
    - `getContent(type, id): Promise<Record<string, unknown> | null>`, which returns null on 404
    - `getTranslations(type, id): Promise<TranslationRow[]>`
    - `getLock(lockId): Promise<ContentNotifications | null>`
    - `createLock(lockId, data): Promise<"created" | "exists">` (409 maps to "exists")
    - `updateLock(lockId, data): Promise<void>`
    - `listDueLocks(now: Date, limit: number): Promise<ContentNotifications[]>` (status pending, `due_at <= now`, ascending)
    - `createAnnouncement(columns: AutoAnnouncementColumns): Promise<Announcements>`
    - `dispatch(announcement: Announcements): Promise<void>`
    - `delayMinutes: number`
    - `log(msg: string): void`
  - `handleContentChange(deps, type: NotifyContentType, contentId: string, now: Date): Promise<"created" | "reopened" | "cancelled" | "unchanged">`
  - `dispatchDue(deps, now: Date): Promise<{ sent: number; cancelled: number; announcements: number }>`
  - `DUE_PAGE_SIZE = 100`

- [ ] **Step 1: Write the failing tests** (`bun test`, an in-memory fake `NotifierDeps` with a Map of locks):
  - `"publishing with notify on creates one pending lock due after the delay"`
  - `"re-saving a published item never creates a second lock or a second push"`. Call `handleContentChange` 5 times, then `dispatchDue` twice: `dispatch` is called once.
  - `"two events at once leave one lock"`. Run two `handleContentChange` calls with `Promise.all`; the fake `createLock` returns "exists" on the second; the result is one lock and no throw.
  - `"unpublishing within the delay cancels; republishing later sends once"`
  - `"turning notify off while pending cancels"`
  - `"moving a pending item to another campus updates its channel and keeps its due time"`
  - `"sent and skipped locks are final"`. Content changes don't touch them.
  - `"a deleted item cancels its pending lock"`
  - `"dispatch re-checks eligibility and cancels items that became ineligible"`. For example, the event ended before due.
  - `"dispatch groups items on the same channel into one announcement and marks every lock sent with its id"`
  - `"locks are marked sent before the push"`. Check call order: `createAnnouncement`, then all `updateLock(status: "sent")`, then `dispatch`.
  - `"a failed push does not reopen the locks"`. `dispatch` rejects, locks stay `sent`, and the error is logged.
  - `"items on different channels get separate announcements"`
- [ ] **Step 2: Run to verify they fail.** `cd functions/content-notifier && bun test`.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** `bun test` and `bun run check-types` pass.
- [ ] **Step 5: Commit.** `feat(functions): content-notifier core`

---

### Task 4: Function wiring, deploy docs, pinger target

**Files:**
- Create: `functions/content-notifier/src/main.ts`, `src/runtime-key.ts` (copy member-roster-sync's), `src/trigger.ts`, `src/trigger.test.ts`, `README.md`
- Modify: `functions/scheduled-dispatch/src/main.ts` (add target `CONTENT_NOTIFIER_URL` first in the list), `functions/scheduled-dispatch/README.md` and `.env.example`

**Interfaces:**
- Produces (`src/trigger.ts`):
  - `type Trigger = { kind: "content"; type: NotifyContentType; id: string } | { kind: "dispatch" } | { kind: "reject"; status: number; reason: string }`
  - `classifyTrigger(headers: Record<string, string | undefined>, secret: string | undefined, body?: Record<string, unknown> | null): Trigger`:
    - `x-appwrite-trigger: event` plus `x-appwrite-event` `tablesdb.app.tables.<events|news|jobs>.rows.<id>.<create|update>` gives `content`. Any other event gives a reject with 400.
    - If the event header carries `*` instead of a concrete id or table, fall back to the body's `$id` and `$tableId`. Appwrite's docs don't say whether the header holds the concrete event, so this covers both cases.
    - `schedule` gives `dispatch`.
    - `http` with a matching `x-cron-secret` or `Authorization: Bearer <secret>` gives `dispatch`. A missing secret config gives 500, and a wrong secret gives 401.
- `main.ts` adopts the runtime key, builds `NotifierDeps` from `createAdminClient()` (`db`, `messaging`), routes by `classifyTrigger`, and returns `res.json(result)`. `delayMinutes` comes from env `NOTIFY_DELAY_MINUTES` (default 3). `getTranslations` queries `content_translations` with `content_type` (`event`|`news`|`job`), `content_id` and `Query.limit(10)`. `listDueLocks` queries `content_notifications` with `Query.equal("status","pending")`, `Query.lessThanEqual("due_at", now.toISOString())`, `Query.orderAsc("due_at")` and `Query.limit(limit)`. Permissions: lock rows get none; the announcement row's read permission is set by `dispatchAnnouncement`.
- `README.md` documents the console setup:
  - Runtime: Bun. Root directory: the repo root.
  - Build: `bun install --filter content-notifier && bun run --cwd functions/content-notifier bundle && rm -rf node_modules`
  - Entrypoint: `functions/content-notifier/dist/main.js`
  - Events: the 6 strings. Execute: any, needed for the HTTP ping, which the secret guards.
  - Scopes: `rows.read`, `rows.write`, `messages.write`. Timeout: 120s.
  - Env: `CRON_SECRET`, optional `NOTIFY_DELAY_MINUTES`. "Do not set `APPWRITE_*`."
  - A domain for the function, set as `CONTENT_NOTIFIER_URL` on `scheduled-dispatch`.

- [ ] **Step 1: Write the failing tests** for `classifyTrigger`, covering each branch above, including `tablesdb.app.tables.news.rows.n1.update` giving `{kind:"content", type:"news", id:"n1"}` and `tablesdb.app.tables.campus.rows.x.update` giving a reject. Also add a scheduled-dispatch test, if that package has tests: `CONTENT_NOTIFIER_URL` is pinged when set. If it has none, state it in the report.
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** `bun test` and `check-types` pass in `functions/content-notifier`, `bun run --cwd functions/content-notifier bundle` produces `dist/main.js`, and scheduled-dispatch's checks pass.
- [ ] **Step 5: Commit.** `feat(functions): wire content-notifier and ping it from scheduled-dispatch`

---

### Task 5: Admin — remove the direct event push

**Files:**
- Modify: `apps/admin/src/app/(portal)/_actions/events.ts`. Delete `sendEventAnnouncement` (~112-153) and its three call sites in `createEvent` (~712-721), `updateEvent` (~815-826, including the interim guard) and `publishEvent` (~955-973). Drop imports that become unused (`topicIdFor`, `dispatchAnnouncement`).
- Modify: `apps/admin/src/app/(portal)/_actions/events-relationships.test.ts`. Replace the "event push on publish" describe (~234-300) with tests asserting that none of create, update or publish creates an `announcements` row or calls `dispatchAnnouncement`.

- [ ] **Step 1: Update the tests first.** `"publishing an event with notify on no longer pushes directly"` covers create, update and publish: `dispatchAnnouncement` is not called, and `db.createRow` is never called with `"announcements"`.
- [ ] **Step 2: Run to verify they fail.** `cd apps/admin && bun test "src/app/(portal)/_actions/events-relationships.test.ts"`.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the full admin `bun test ./src`, `bun run check-types --filter=admin` and `bun run build --filter=admin`.
- [ ] **Step 5: Commit.** `refactor(admin): events no longer push directly; content-notifier does`

---

### Task 6: Admin — `notify_push` for news and jobs, National guard, notification state action

**Files:**
- Modify: `apps/admin/src/app/(portal)/_actions/schemas.ts` (`newsSchema`: `notify_push: z.boolean().default(false)`)
- Modify: `packages/shared/types/recruitment.ts` (`recruitmentVacancyUpsertSchema`: same field)
- Modify: `apps/admin/src/app/(portal)/_actions/news.ts`. `createNews`/`updateNews` write `notify_push` to the row.
- Modify: `apps/admin/src/app/(portal)/_actions/jobs.ts`. `buildJobUpsertPayload` writes the `notify_push` column, not metadata.
- Modify: `apps/admin/src/app/(portal)/_actions/events.ts`. Apply the National guard in `createEvent`/`updateEvent`.
- Create: `apps/admin/src/lib/notify-push-guard.ts`, `apps/admin/src/lib/notify-push-guard.test.ts`
- Create: `apps/admin/src/app/(portal)/_actions/content-notifications.ts` ("use server"), `apps/admin/src/lib/content-notification-state.ts`, `apps/admin/src/lib/content-notification-state.test.ts`

**Interfaces:**
- Produces:
  - `resolveNotifyPush(input: { requested: boolean; campusId: string | null | undefined; stored: boolean | null | undefined; isGlobalAdmin: boolean }): boolean`. It returns `requested` unless `campusId === "5"` and the user is not a global admin, in which case it returns `stored ?? false`.
  - `type ContentNotificationState = { kind: "none" } | { kind: "pending"; dueAt: string } | { kind: "sent"; sentAt: string } | { kind: "skipped" } | { kind: "cancelled" }`
  - `toNotificationState(lock: ContentNotifications | null): ContentNotificationState` (pure, in `lib/content-notification-state.ts`)
  - `getContentNotificationState(type: NotifyContentType, contentId: string): Promise<ContentNotificationState>` (server action). It calls `requireAuth()`, then the admin `db.getRow("app","content_notifications", lockRowIdFor(type, contentId))`, mapping 404 to `none` with the `isRowNotFound` helper from `apps/admin/src/lib/shop/sales-type.ts`.

- [ ] **Step 1: Write the failing tests:**
  - `resolveNotifyPush`: a campus admin on National keeps the stored value, a global admin on National gets the requested value, and anyone on Bergen gets the requested value.
  - `toNotificationState` maps each lock status.
  - News and jobs action tests (existing harnesses, e.g. `news.test.ts`, the jobs harness): a save with `notify_push: true` writes the column, and a campus admin saving National news with `notify_push: true` writes the stored value.
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement.** Use `ctx.roles.includes("globaladmin")` for `isGlobalAdmin`. `stored` is the pre-save row's `notify_push` (null on create).
- [ ] **Step 4: Run** admin `bun test ./src`, shared vitest, `check-types` for admin and shared, and `bun run build --filter=admin`.
- [ ] **Step 5: Commit.** `feat(admin): notify flag for news and jobs, national guard, notification state`

---

### Task 7: Admin — editor toggle and status (events, news, jobs)

**Files:**
- Create: `apps/admin/src/lib/notify-toggle-copy.ts`, `apps/admin/src/lib/notify-toggle-copy.test.ts`
- Modify:
  - Event editor: `events/[id]/_components/event-studio-editor.tsx` (the `ToggleCard` at ~2685; default at ~354 becomes `fallback(event?.notify_push, isNew)`), and `events/[id]/page.tsx` (fetch the state and pass it plus `canNotifyNational`).
  - News editor: `news/[id]/_components/news-studio-editor.tsx` (a switch after the sticky switch in `NewsMediaVisibilityStep`, ~553), `news-studio-state.ts` (default `notify_push: isNew`), and `news/[id]/page.tsx`.
  - Job editor: `jobs/[id]/_components/job-studio-editor.tsx` (a card in the toggle grid ~2044), `buildDefaultValues` (default `notify_push` = true when new, else the stored value), and `jobs/[id]/page.tsx`.

**Interfaces:**
- Produces: `notifyToggleCopy(input: { state: ContentNotificationState; isPublished: boolean; isNational: boolean; canNotifyNational: boolean; dueAtLabel?: string; sentAtLabel?: string }): { showToggle: boolean; disabled: boolean; title: string; description: string }`, with this exact copy:

  | State | `title` | `description` | Toggle |
  |---|---|---|---|
  | sent | "Students were notified" | "Sent {sentAtLabel}." | hidden |
  | skipped | "Published before automatic notifications" | "This item can't send a notification." | hidden |
  | pending | "Notification scheduled" | "Goes out {dueAtLabel}. Untick to cancel." | shown |
  | published, never notified | "Notify students now" | "Sends one notification to students who follow this topic, a few minutes after you save." | shown |
  | not published | "Notify students when published" | "Students who follow this topic get one notification when it goes live." | shown |
  | national, user can't notify national | (title as above) | "Only national admins can notify every student." | disabled |

  Format the labels in Oslo time with `formatOsloDate`/`formatOsloTime`, e.g. "Mon 2 Nov at 08:00".

- [ ] **Step 1: Write the failing tests** for `notifyToggleCopy`, one per row of the table. Add an editor test per studio where a test file already exists (news: `news-studio-state.test.ts` default `notify_push` true for new and stored value for existing; events: extend `event-studio-push.test.ts` or the state tests if present; jobs: `buildDefaultValues` test if present). Name the tests you add in the report.
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement.** Keep each editor's own toggle visuals: the events `ToggleCard`, the news switch button and the jobs card. The events description keeps the subscriber-count line from `describePushAudience` after the copy.
- [ ] **Step 4: Run** admin `bun test ./src`, `check-types` and `bun run build --filter=admin`.
- [ ] **Step 5: Commit.** `feat(admin): notify students toggle and status in event, news and job editors`

---

### Task 8: Defaults from Tickster and the AI assistant

**Files:**
- Modify: `apps/api/src/lib/tickster-events-sync.ts`. `upsertRow` gains `createOnlyData?: Record<string, unknown>`, merged into the data only in the `createRow` fallback, never in `updateRow`. The new-event path passes `createOnlyData: { notify_push: true }`.
- Modify: `apps/api/src/lib/tickster-events-sync.test.ts`
- Modify: `apps/admin/src/app/api/assistant/route.ts`. In `createAssistantContent` (~366-399) and `createJobContent` (~404-426), set `notify_push: true` on created events, news and jobs.
- Test: the existing assistant route tests, if any; otherwise state it in the report.

- [ ] **Step 1: Write the failing tests:**
  - `"a newly created Tickster event notifies"`: the createRow data has `notify_push: true`.
  - `"syncing an existing Tickster event never switches notify on"`: the updateRow data has no `notify_push` key.
  - `"a 409 on create falls back to an update without notify_push"`.
- [ ] **Step 2: Run to verify they fail.** `cd apps/api && bun run test -- tickster-events-sync`, or the package's vitest invocation.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the apps/api tests and `check-types --filter=api`, plus the admin tests and build if the assistant changed.
- [ ] **Step 5: Commit.** `feat: Tickster and assistant-created content notify by default`

---

### Task 9: Launch backfill script

**Files:**
- Create: `packages/shared/scripts/backfill-content-notification-locks.ts`
- Create: `packages/shared/utils/content-notification-backfill.ts`, `packages/shared/utils/content-notification-backfill.test.ts`
- Modify: `packages/shared/package.json` (script `backfill:notification-locks`: `bun --env-file=../../apps/admin/.env.local scripts/backfill-content-notification-locks.ts`)

**Interfaces:**
- Produces: `backfillLocks(deps: { listPublished(table, cursor): Promise<{ rows: Array<{ $id: string; campus_id?: string | null }>; nextCursor: string | null }>; createLock(lockId, data): Promise<"created" | "exists"> }, opts: { dryRun: boolean }): Promise<{ created: number; existing: number }>`. For every published row in events, news and jobs, it creates `{ content_type, content_id, campus_id, channel, status: "skipped", reason: "existed before launch" }` at `lockRowIdFor(...)`. It never modifies existing locks. The script prints a summary and accepts `--dry-run`.

- [ ] **Step 1: Write the failing tests:**
  - It creates one skipped lock per published row across three tables with paging.
  - It counts existing locks without touching them.
  - Dry run creates nothing but reports counts.
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement.** The script wires `createAdminClient()` and pages with `Query.cursorAfter`, `Query.equal("status","published")`, `Query.select(["$id","campus_id"])` and `Query.limit(100)`.
- [ ] **Step 4: Run.** Tests pass, check-types is clean, and `bun run --cwd packages/shared backfill:notification-locks --dry-run` is **not** run by the implementer (it needs production credentials). State that in the report.
- [ ] **Step 5: Commit.** `feat(shared): backfill notification locks for content published before launch`

---

### Task 10: CHECKPOINT (human) — go live

Run only after Tasks 1–9 are reviewed and the branch is deployed (admin and api).

- [ ] **Step 1:** Ask the user to run `bun run --cwd packages/shared backfill:notification-locks --dry-run`, check the counts, then run it without `--dry-run`. This must happen **before** the function gets its event triggers.
- [ ] **Step 2:** Ask the user to create the `content-notifier` function in the Appwrite console per `functions/content-notifier/README.md`: events, scopes, env, domain, and `CONTENT_NOTIFIER_URL` on `scheduled-dispatch`. Deploy.
- [ ] **Step 3:** Ask the user to smoke-test:
  1. Publish a test event at their campus with "Notify students" on. Within about 3 to 8 minutes, one push arrives in the phone's language, the inbox shows it, and the editor shows "Students were notified".
  2. Edit and save it again. No second push.
  3. Publish two events quickly. They arrive as one grouped push.
  4. Unpublish a fresh one within 3 minutes. No push.
