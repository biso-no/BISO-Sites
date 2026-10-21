# Push Notifications — Plan 1: Foundation (schema, language channels, shared send) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every manual push goes out once per language (`…_no` / `…_en` channels, or users grouped by their stored language), "Everyone" respects the chosen campus, and the delivery code lives in a shared module the upcoming `content-notifier` function can import.

**Architecture:** Schema changes land first in `packages/api/appwrite.config.json` (the user pushes them and regenerates types). The topic taxonomy in `@repo/shared/utils/notification-topics` gains languages, per-campus "everyone" channels and the audience→channel resolver (moved from admin). Delivery moves from `apps/admin/src/lib/announcements/send.ts` into `@repo/shared/utils/push-dispatch` (no `server-only`, so an Appwrite Function can bundle it); admin's `send.ts` becomes a `server-only` facade that re-exports it and keeps the cron `dispatchDueAnnouncements`.

**Tech Stack:** TypeScript, node-appwrite 29 (TablesDB, Messaging), vitest (`packages/shared`), bun:test (`apps/admin`), Bun.

**Spec:** `docs/superpowers/specs/2026-10-20-push-notifications-design.md` (D1, D3, D4, D8, D10, D11, D6 table, D9 columns, D12 "Everyone at a campus").

**This is plan 1 of 5.** Later plans, written after this one lands: 2 App (BISO-Flutter), 3 `content-notifier` function, 4 Composer rework, 5 Event groups.

## Global Constraints

- Bun only (`bun@1.3.1`); never npm/pnpm.
- Topic IDs: `general_{no,en}`, `general_{oslo,bergen,trondheim,stavanger}_{no,en}`, `{news,events,jobs,shop}_{oslo,bergen,trondheim,stavanger,national}_{no,en}` — exactly 50. No `general_national_*`.
- Campus IDs → slugs: `"1"` oslo, `"2"` bergen, `"3"` trondheim, `"4"` stavanger, `"5"` national; null/unknown → national.
- `announcements.audience_value` stays language-neutral (`events_bergen`, `general`); only the push fans out to `_no` / `_en`.
- Push text: `_no` channel gets Norwegian, `_en` gets English; a missing language falls back to the other (D4).
- Person-targeted sends: language from `user.locale`; missing → English (D3).
- Category `urgent` → `priority: "high"`; everything else `"normal"`.
- Push `data` keys, all strings, missing → `""`: `type` (always `"announcement"`), `announcement_id`, `category`, `content_type`, `content_id`, `deep_link` (D10).
- Deep links: `biso://event?id=…`, `biso://news?id=…`, `biso://job?id=…`, else `biso://announcement?id=<announcement $id>`.
- `@repo/shared` modules used by functions must not import `server-only`.
- Do not hand-edit `packages/api/types/appwrite.ts`; the user regenerates it.
- The 21 old topics stay in the config in this plan (Plan 2 removes them after the new app build ships).

## Review Focus

- A users-audience send with more recipients than one `user` lookup page (e.g. 150) — every recipient must be looked up and pushed once; pinned in Task 3 (`groups 150 ids across pages`).
- The `user` table lookup failing (Appwrite error) — the send must still go out, everyone in English, not abort; pinned in Task 3.
- One language's `createPush` throwing — the other language must still be sent; pinned in Task 3.
- An old row with only `event_id` (no `content_type`) — must still deep-link to the event; pinned in Task 3.
- A broadcast saved with campus `"5"` (National) or no campus — must go to `general_{no,en}`, not to a non-existent `general_national_*`; pinned in Task 2.

---

### Task 1: Schema changes in `appwrite.config.json` (user pushes)

**Files:**
- Modify: `packages/api/appwrite.config.json` (`topics` array; tables `user`, `news`, `jobs`, `announcements`; new table `content_notifications`)

**Interfaces:**
- Produces (after the user pushes + regenerates types): `Users.locale`, `News.notify_push`, `Jobs.notify_push`, `Announcements.{source, content_type, content_id, content_ids, items, image}`, type `ContentNotifications`, and 50 new topics.

- [ ] **Step 1: Add the 50 topics** to `topics`, each `{"$id": <id>, "name": <name>, "subscribe": ["users"]}`. Names: `"Everyone (Norsk)"`, `"Everyone (English)"`, `"Everyone — Bergen (Norsk)"`, `"Events — Bergen (English)"`, etc. Generate the list with a throwaway script; keep the existing 21 entries.

- [ ] **Step 2: Add columns** (shapes copied from existing columns in the same file):
  - `user`: `locale` — string enum `["en","no"]`, not required, default `null`.
  - `news`, `jobs`: `notify_push` — boolean, not required, default `false` (same shape as `events.notify_push`).
  - `announcements`:
    - `source` — enum `["manual","auto"]`, default `"manual"`
    - `content_type` — enum `["event","news","job"]`, default `null`
    - `content_id` — string 36
    - `content_ids` — string 36, `array: true`
    - `items` — mediumtext (JSON snapshot of linked item(s): title_en, title_no, date, campus_id, image)
    - `image` — string 500
    - index `idx_content` on `[content_type, content_id]`

- [ ] **Step 3: Add table `content_notifications`** in database `app`: `$permissions: []`, `rowSecurity: false`. Columns:
  - `content_type` — enum `["event","news","job"]`, required
  - `content_id` — string 36, required
  - `campus_id` — string 50
  - `channel` — string 50, required
  - `status` — enum `["pending","sent","skipped","cancelled"]`, default `"pending"`
  - `reason` — string 200
  - `due_at`, `sent_at` — datetime
  - `announcement_id` — string 36

  Indexes: `idx_status_due` (key) on `[status, due_at]`; `uniq_content` (unique) on `[content_type, content_id]`.

- [ ] **Step 4: Validate**

Run: `python3 -I -c "import json;c=json.load(open('packages/api/appwrite.config.json'));print(len(c['topics']))"`
Expected: `71`

- [ ] **Step 5: Commit**

```bash
git add packages/api/appwrite.config.json
git commit -m "feat(api): add language topics, notification columns and content_notifications table"
```

- [ ] **Step 6: CHECKPOINT (human).** Stop and ask the user to push tables + topics with the Appwrite CLI from `packages/api`, then run `bun run --cwd packages/api types:generate`. Continue only when `packages/api/types/appwrite.ts` contains `locale` on `Users`, `content_type` on `Announcements` and `export type ContentNotifications`. Commit the regenerated types (`chore(api): regenerate types`).

---

### Task 2: Topic taxonomy with languages and campus "everyone" channels

**Files:**
- Modify: `packages/shared/utils/notification-topics.ts`
- Modify: `packages/shared/utils/notification-topics.test.ts`
- Create: `packages/shared/utils/notification-topics-config.test.ts`
- Delete: `apps/admin/src/lib/announcements/topic-id.ts`, `apps/admin/src/lib/announcements/topic-id.test.ts` (logic + tests move here)

**Interfaces:**
- Produces (all exported from `@repo/shared/utils/notification-topics`):
  - `PUSH_LOCALES = ["no", "en"] as const`; `type PushLocale = (typeof PUSH_LOCALES)[number]`
  - `localizedTopicId(channel: string, locale: PushLocale): string` → `${channel}_${locale}`
  - `broadcastChannelFor(campusId?: string | null): string` → `general_{slug}` for campuses 1–4, else `general`
  - `resolveAnnouncementTopicId(audienceValue: string | null | undefined, campusId: string | null | undefined): string` (moved unchanged from admin `topic-id.ts`, doc comment included)
  - `resolvePushChannel(audienceType: string, audienceValue: string | null | undefined, campusId: string | null | undefined): string | null` → `"topic"` → `resolveAnnouncementTopicId`, `"broadcast"` → `broadcastChannelFor`, anything else → `null`
  - `ALL_PUSH_TOPIC_IDS: readonly string[]` (the 50 IDs)

- [ ] **Step 1: Write the failing tests** in `notification-topics.test.ts` (move the `resolveAnnouncementTopicId` cases from admin `topic-id.test.ts` verbatim, then add):

```ts
describe("localizedTopicId", () => {
  it("appends the language", () => {
    expect(localizedTopicId("events_bergen", "no")).toBe("events_bergen_no");
    expect(localizedTopicId("general", "en")).toBe("general_en");
  });
});

describe("broadcastChannelFor", () => {
  it("scopes to a real campus", () => {
    expect(broadcastChannelFor("1")).toBe("general_oslo");
    expect(broadcastChannelFor("4")).toBe("general_stavanger");
  });
  it("means everyone for National, no campus or an unknown campus", () => {
    expect(broadcastChannelFor("5")).toBe("general");
    expect(broadcastChannelFor(null)).toBe("general");
    expect(broadcastChannelFor("99")).toBe("general");
  });
});

describe("resolvePushChannel", () => {
  it("resolves topic and broadcast audiences, not people", () => {
    expect(resolvePushChannel("topic", "events", "2")).toBe("events_bergen");
    expect(resolvePushChannel("broadcast", null, "2")).toBe("general_bergen");
    expect(resolvePushChannel("broadcast", null, "5")).toBe("general");
    expect(resolvePushChannel("users", '["u1"]', "2")).toBeNull();
    expect(resolvePushChannel("segment", "seg1", "2")).toBeNull();
  });
});

describe("ALL_PUSH_TOPIC_IDS", () => {
  it("lists exactly the 50 language channels", () => {
    expect(ALL_PUSH_TOPIC_IDS).toHaveLength(50);
    expect(new Set(ALL_PUSH_TOPIC_IDS).size).toBe(50);
    expect(ALL_PUSH_TOPIC_IDS).toContain("general_no");
    expect(ALL_PUSH_TOPIC_IDS).toContain("general_oslo_en");
    expect(ALL_PUSH_TOPIC_IDS).toContain("events_national_en");
    expect(ALL_PUSH_TOPIC_IDS).toContain("shop_stavanger_no");
    expect(ALL_PUSH_TOPIC_IDS).not.toContain("general_national_no");
  });
  it("fits Appwrite's 36-character id limit", () => {
    for (const id of ALL_PUSH_TOPIC_IDS) expect(id.length).toBeLessThanOrEqual(36);
  });
});
```

And `notification-topics-config.test.ts`: read `../../api/appwrite.config.json` with `readFileSync(new URL(..., import.meta.url))`, and assert `it("defines every push topic in appwrite.config.json, subscribable by users")`: every `ALL_PUSH_TOPIC_IDS` entry is a `topics[].$id` whose `subscribe` equals `["users"]`.

- [ ] **Step 2: Run to verify they fail**

Run: `cd packages/shared && bunx vitest run utils/notification-topics`
Expected: FAIL (`localizedTopicId` / `broadcastChannelFor` / … not exported)

- [ ] **Step 3: Implement** the exports listed under Interfaces in `notification-topics.ts`. Update the file's header comment: the Flutter mirror must also add the `_no`/`_en` suffix (Plan 2). Delete admin `topic-id.ts` + test; change imports in `apps/admin/src/lib/announcements/send.ts`, `apps/admin/src/app/(portal)/_actions/announcements.ts` and `apps/admin/src/app/(portal)/_actions/announcements-dispatch.test.ts` to `@repo/shared/utils/notification-topics`.

- [ ] **Step 4: Run to verify they pass**

Run: `cd packages/shared && bunx vitest run utils/notification-topics`
Expected: PASS (both files)

- [ ] **Step 5: Commit**

```bash
git add packages/shared/utils/notification-topics*.ts apps/admin/src/lib/announcements apps/admin/src/app/\(portal\)/_actions/announcements.ts apps/admin/src/app/\(portal\)/_actions/announcements-dispatch.test.ts
git commit -m "feat(shared): language channels and campus-scoped broadcast topics"
```

---

### Task 3: Shared push-dispatch module

**Files:**
- Create: `packages/shared/utils/push-dispatch.ts`
- Create: `packages/shared/utils/push-dispatch.test.ts`
- Modify: `packages/api/index.ts` (add `MessagePriority` to the `node-appwrite` re-export list)

**Interfaces:**
- Consumes: Task 2 exports; types `Announcements`, `Users`, `SegmentMembers`, `UserNotifications` from `@repo/api/types/appwrite`; `ID`, `Permission`, `Query`, `Role`, `MessagePriority`, `TablesDB`, `Messaging` from `@repo/api`.
- Produces (`@repo/shared/utils/push-dispatch`):
  - `interface DispatchClients { db: TablesDB; messaging: Messaging }`
  - `interface LocalizedPush { title: string; body: string }`
  - `htmlToPlainText(html: string | null | undefined): string` (moved verbatim from admin `send.ts`)
  - `localizedPushContent(a: Pick<Announcements, "title_en" | "title_no" | "body_en" | "body_no">): Record<PushLocale, LocalizedPush>`
  - `buildDeepLink(a: Pick<Announcements, "$id" | "content_type" | "content_id" | "event_id">): string`
  - `buildPushData(a: Announcements): Record<string, string>` (`deep_link` = `a.deep_link ?? buildDeepLink(a)`)
  - `pushPriorityFor(category: string | null | undefined): MessagePriority`
  - `groupUserIdsByLocale(db: TablesDB, userIds: string[]): Promise<Record<PushLocale, string[]>>`
  - `interface DispatchAnnouncementResult { recipients: number; topic?: string }` (`topic` = the language-neutral channel, set only for `topic` audiences, as today)
  - `dispatchAnnouncement(a: Announcements, clients: DispatchClients): Promise<DispatchAnnouncementResult>`

- [ ] **Step 1: Write the failing tests** (vitest; `db`/`messaging` are `vi.fn()` stubs cast through `unknown`, a `makeAnnouncement` helper like admin `send.test.ts`):

```ts
describe("localizedPushContent", () => {
  it("uses each language for its own channel", () => {
    const c = localizedPushContent({ title_en: "Party", title_no: "Fest", body_en: "<p>Fri</p>", body_no: "<p>Fre</p>" });
    expect(c.no).toEqual({ title: "Fest", body: "Fre" });
    expect(c.en).toEqual({ title: "Party", body: "Fri" });
  });
  it("falls back to the other language when one is missing", () => {
    const c = localizedPushContent({ title_en: "Party", title_no: null, body_en: null, body_no: "<p>Fre</p>" });
    expect(c.no).toEqual({ title: "Party", body: "Fre" });
    expect(c.en).toEqual({ title: "Party", body: "Fre" });
  });
});

describe("buildDeepLink", () => {
  it("links the content type", () => {
    expect(buildDeepLink({ $id: "a1", content_type: "news", content_id: "n1", event_id: null })).toBe("biso://news?id=n1");
    expect(buildDeepLink({ $id: "a1", content_type: "job", content_id: "j1", event_id: null })).toBe("biso://job?id=j1");
    expect(buildDeepLink({ $id: "a1", content_type: "event", content_id: "e1", event_id: null })).toBe("biso://event?id=e1");
  });
  it("still links an old row that only has event_id", () => {
    expect(buildDeepLink({ $id: "a1", content_type: null, content_id: null, event_id: "e9" })).toBe("biso://event?id=e9");
  });
  it("falls back to the announcement", () => {
    expect(buildDeepLink({ $id: "a1", content_type: null, content_id: null, event_id: null })).toBe("biso://announcement?id=a1");
  });
});

it("buildPushData has exactly the contract keys, all strings", () => {
  const data = buildPushData(makeAnnouncement({ category: "event", content_type: "event", content_id: "e1" }));
  expect(Object.keys(data).sort()).toEqual(["announcement_id", "category", "content_id", "content_type", "deep_link", "type"]);
  expect(data).toMatchObject({ type: "announcement", content_type: "event", content_id: "e1", deep_link: "biso://event?id=e1" });
  expect(buildPushData(makeAnnouncement())).toMatchObject({ content_type: "", content_id: "" });
});

it("pushPriorityFor: urgent is high, others normal", () => {
  expect(pushPriorityFor("urgent")).toBe(MessagePriority.High);
  expect(pushPriorityFor("event")).toBe(MessagePriority.Normal);
  expect(pushPriorityFor(null)).toBe(MessagePriority.Normal);
});

describe("groupUserIdsByLocale", () => {
  it("splits by stored language, unknown → English", async () => { /* rows: u1 no, u2 en, u3 locale null; u4 no row → { no: ["u1"], en: ["u2","u3","u4"] } */ });
  it("groups 150 ids across pages", async () => { /* listRows called twice (pages of 100 ids via Query.equal("$id", chunk)); all 150 appear exactly once */ });
  it("sends everyone English when the lookup fails", async () => { /* listRows rejects → { no: [], en: all ids } */ });
});

describe("dispatchAnnouncement", () => {
  it("pushes a topic audience once per language", async () => {
    // audience topic "events", campus "2", title_en "Party", title_no "Fest"
    // createPush called twice with objects containing
    //   { topics: ["events_bergen_no"], title: "Fest", priority: "normal" } and
    //   { topics: ["events_bergen_en"], title: "Party" }
    // result toEqual { recipients: 0, topic: "events_bergen" }
  });
  it("scopes Everyone to the campus", async () => { /* broadcast campus "1" → topics general_oslo_no / general_oslo_en; result has no topic */ });
  it("sends Everyone with no campus to everyone", async () => { /* campus null → general_no / general_en */ });
  it("sends urgent with high priority", async () => { /* category "urgent" → both calls priority "high" */ });
  it("pushes people in their own language", async () => {
    // users audience '["u1","u2","u3"]'; u1 no, u2 en, u3 unknown
    // createPush({ users: ["u1"], title: <no> }) and ({ users: ["u2","u3"], title: <en> })
    // 3 user_notifications rows created; result.recipients === 3
  });
  it("skips a language with no recipients", async () => { /* all users en → exactly one createPush */ });
  it("still sends the other language when one push fails", async () => { /* first createPush rejects → second still called; promise resolves */ });
  it("sends nothing when push is off", async () => { /* push false → createPush not called; read permissions still applied */ });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd packages/shared && bunx vitest run utils/push-dispatch`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `push-dispatch.ts`**

Port admin `send.ts`'s `dispatchAnnouncement` and its private helpers (`parseUserIds`, `collectSegmentUserIds`, `fanOutUserNotifications`, `applyAnnouncementReadPermissions`) unchanged in behaviour except:
- topic/broadcast: `resolvePushChannel(...)` gives the channel, then one `messaging.createPush({ messageId: ID.unique(), title, body, topics: [localizedTopicId(channel, locale)], data, priority })` per locale in `PUSH_LOCALES`. Each call has its own try/catch.
- users/segment: `groupUserIdsByLocale` then one `createPush({ …, users: ids })` per non-empty locale group.
- Use the object-parameter form of `createPush` (not positional).
- `groupUserIdsByLocale` pages through `user` with `Query.equal("$id", chunk)`, `Query.select(["$id", "locale"])`, `Query.limit(chunk.length)` in chunks of 100.
- Read permissions and `user_notifications` fan-out are unchanged.

Add `MessagePriority` to the export list in `packages/api/index.ts`.

- [ ] **Step 4: Run to verify they pass**

Run: `cd packages/shared && bunx vitest run utils/push-dispatch && bun run --cwd packages/shared check-types`
Expected: PASS, no type errors

- [ ] **Step 5: Commit**

```bash
git add packages/shared/utils/push-dispatch*.ts packages/api/index.ts
git commit -m "feat(shared): per-language push dispatch module"
```

---

### Task 4: Admin uses the shared dispatch

**Files:**
- Modify: `apps/admin/src/lib/announcements/send.ts` (becomes facade + `dispatchDueAnnouncements`)
- Modify: `apps/admin/src/lib/announcements/send.test.ts` (keep only `dispatchDueAnnouncements` tests)
- Modify: `apps/admin/src/app/(portal)/_actions/announcements.ts` (delete `buildDataPayload`, ~line 344; `dispatchPersistedAnnouncement`, ~line 691)
- Modify: `apps/admin/src/app/(portal)/_actions/events.ts:145` (call shape)
- Modify: `apps/admin/src/app/api/announcements/dispatch/route.ts:48-49` (call shape)
- Modify (mock lists): `apps/admin/src/app/(portal)/_actions/{jobs-translation-test-harness.ts,events-relationships.test.ts,announcements-translation.cases.ts,announcements-dispatch.test.ts,announcements-relationships.test.ts}`

**Interfaces:**
- Consumes: Task 3's `@repo/shared/utils/push-dispatch`.
- Produces: `@/lib/announcements/send` still exports `buildDeepLink`, `buildPushData`, `dispatchAnnouncement`, `htmlToPlainText`, `type DispatchClients`, `type DispatchAnnouncementResult` (re-exported), plus `dispatchDueAnnouncements(clients: DispatchClients, now?: Date): Promise<DispatchDueResult>`.

- [ ] **Step 1: Update the test first.** In `send.test.ts`, delete the `describe("dispatchAnnouncement")` block (now covered in shared), drop `users` from `makeClients`, and add:

```ts
test("dispatchDueAnnouncements stores the shared push payload as data", async () => {
  // one due row (topic "events", campus "1", content_type "event", content_id "e1")
  // → updateRow called with data === JSON.stringify(buildPushData(row))
  //   and JSON.parse(data).deep_link === "biso://event?id=e1"
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/admin && bun test src/lib/announcements/send.test.ts`
Expected: FAIL (`deep_link` is `biso://announcement?id=…`: the old `buildDeepLink` ignores `content_type`)

- [ ] **Step 3: Implement**
  - `send.ts`: keep `import "server-only"`; re-export the Produces names from `@repo/shared/utils/push-dispatch`; keep `dispatchDueAnnouncements` using them; remove everything else.
  - `announcements.ts`: delete `buildDataPayload` and use `JSON.stringify(buildPushData(announcement))` (import `buildPushData` from `@/lib/announcements/send`).
  - Callers pass `{ db, messaging }` (not `users`) to `dispatchAnnouncement` / `dispatchDueAnnouncements`.
  - Add `buildPushData: mock(() => ({}))` to each `mock.module("@/lib/announcements/send", …)` in the five listed test files.

- [ ] **Step 4: Run all admin tests, types and build**

Run: `cd apps/admin && bun test ./src && cd ../.. && bun run check-types --filter=admin && bun run build --filter=admin`
Expected: all tests pass, no type errors, build `✓ Compiled`

- [ ] **Step 5: Lint + commit**

```bash
bun x ultracite fix
git add apps/admin packages/shared
git commit -m "refactor(admin): send announcements through shared per-language dispatch"
```

- [ ] **Step 6: Note for the user.** After this deploys, manual pushes go to the new `_no`/`_en` channels. The current app build still subscribes to the old channels, so the user's own phone won't receive pushes until the Plan 2 app build. Nobody else is subscribed.
