import { expect, mock, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  type Announcements,
  type ContentNotifications,
  ContentNotificationsStatus,
} from "@repo/api/types/appwrite";
import type { AutoAnnouncementColumns } from "@repo/shared/utils/content-notification-compose";
import {
  lockRowIdFor,
  type NotifyContentType,
} from "@repo/shared/utils/content-notifications";
import {
  announcementIdFor,
  DUE_PAGE_SIZE,
  dispatchDue,
  handleContentChange,
  type LockPatch,
  type NewLock,
  type NotifierDeps,
} from "./run";

/** 12:00 in Oslo, so the night hold never moves a due time in these tests. */
const T0 = new Date("2026-10-21T10:00:00.000Z");
const DELAY_MINUTES = 3;
const MS_PER_MINUTE = 60_000;

type Row = Record<string, unknown>;

function at(minutesAfterT0: number): Date {
  return new Date(T0.getTime() + minutesAfterT0 * MS_PER_MINUTE);
}

function iso(minutesAfterT0: number): string {
  return at(minutesAfterT0).toISOString();
}

function eventRow(id: string, overrides: Row = {}): Row {
  return {
    $id: id,
    campus_id: "1",
    end_date: "2026-11-01T20:00:00.000Z",
    image: null,
    location: "Nydalen",
    notify_push: true,
    publish_mode: "now",
    scheduled_publish_at: null,
    start_date: "2026-11-01T17:00:00.000Z",
    status: "published",
    ...overrides,
  };
}

function newsRow(id: string, overrides: Row = {}): Row {
  return {
    $createdAt: iso(0),
    $id: id,
    campus_id: "1",
    image: null,
    notify_push: true,
    status: "published",
    ...overrides,
  };
}

function contentKey(type: NotifyContentType, id: string): string {
  return `${type}:${id}`;
}

function lockRow(lockId: string, data: NewLock | Row): ContentNotifications {
  return {
    $id: lockId,
    announcement_id: null,
    campus_id: null,
    channel: "",
    due_at: null,
    reason: null,
    sent_at: null,
    status: ContentNotificationsStatus.PENDING,
    ...data,
  } as unknown as ContentNotifications;
}

interface Fake {
  /** Announcement rows by row id, as the table holds them. */
  announcementRows: Map<string, Announcements>;
  /** Announcement columns in the order they were created. */
  announcements: AutoAnnouncementColumns[];
  /** Writes in the order they happened: creates, updates, announcements, pushes. */
  calls: string[];
  content: Map<string, Row>;
  deps: NotifierDeps;
  errors: string[];
  /** Lock rows by row id. */
  locks: Map<string, ContentNotifications>;
  logs: string[];
  setContent: (type: NotifyContentType, row: Row) => void;
}

function fake(overrides: Partial<NotifierDeps> = {}): Fake {
  const content = new Map<string, Row>();
  const locks = new Map<string, ContentNotifications>();
  const announcementRows = new Map<string, Announcements>();
  const announcements: AutoAnnouncementColumns[] = [];
  const calls: string[] = [];
  const errors: string[] = [];
  const logs: string[] = [];

  const deps: NotifierDeps = {
    // Like Appwrite: a row id that is taken answers with the existing row.
    createAnnouncement: mock((id: string, columns: AutoAnnouncementColumns) => {
      const existing = announcementRows.get(id);
      if (existing) {
        calls.push("createAnnouncement:exists");
        return Promise.resolve({ announcement: existing, created: false });
      }
      announcements.push(columns);
      calls.push("createAnnouncement");
      const row = { ...columns, $id: id } as unknown as Announcements;
      announcementRows.set(id, row);
      return Promise.resolve({ announcement: row, created: true });
    }),
    createLock: mock((lockId: string, data: NewLock) => {
      calls.push(`createLock:${lockId}`);
      if (locks.has(lockId)) {
        return Promise.resolve("exists" as const);
      }
      locks.set(lockId, lockRow(lockId, data));
      return Promise.resolve("created" as const);
    }),
    delayMinutes: DELAY_MINUTES,
    dispatch: mock((announcement: Announcements) => {
      calls.push(`dispatch:${announcement.$id}`);
      return Promise.resolve();
    }),
    error: mock((message: string) => {
      errors.push(message);
    }),
    getContent: mock((type: NotifyContentType, id: string) => {
      const row = content.get(contentKey(type, id));
      return Promise.resolve(row ? { ...row } : null);
    }),
    getLock: mock((lockId: string) => {
      const lock = locks.get(lockId);
      return Promise.resolve(lock ? { ...lock } : null);
    }),
    getTranslations: mock((_type: NotifyContentType, id: string) =>
      Promise.resolve([
        { locale: "en", title: `Title ${id}` },
        { locale: "no", title: `Tittel ${id}` },
      ])
    ),
    listDueLocks: mock((now: Date, limit: number) =>
      Promise.resolve(
        [...locks.values()]
          .filter(
            (lock) =>
              lock.status === ContentNotificationsStatus.PENDING &&
              lock.due_at !== null &&
              new Date(lock.due_at).getTime() <= now.getTime()
          )
          .sort((a, b) => String(a.due_at).localeCompare(String(b.due_at)))
          .slice(0, limit)
          .map((lock) => ({ ...lock }))
      )
    ),
    log: mock((message: string) => {
      logs.push(message);
    }),
    updateLock: mock((lockId: string, data: LockPatch) => {
      const lock = locks.get(lockId);
      if (!lock) {
        return Promise.reject(new Error(`No lock ${lockId}`));
      }
      calls.push(`updateLock:${lockId}:${data.status ?? "-"}`);
      locks.set(lockId, { ...lock, ...data } as ContentNotifications);
      return Promise.resolve();
    }),
    ...overrides,
  };

  return {
    announcementRows,
    announcements,
    calls,
    content,
    deps,
    errors,
    locks,
    logs,
    setContent: (type, row) => {
      content.set(contentKey(type, String(row.$id)), row);
    },
  };
}

function lockOf(
  f: Fake,
  type: NotifyContentType,
  id: string
): ContentNotifications | undefined {
  return f.locks.get(lockRowIdFor(type, id));
}

test("publishing with notify on creates one pending lock due after the delay", async () => {
  const f = fake();
  f.setContent("event", eventRow("e1"));

  expect(await handleContentChange(f.deps, "event", "e1", at(0))).toBe(
    "created"
  );

  expect(f.deps.createLock).toHaveBeenCalledTimes(1);
  expect(f.deps.createLock).toHaveBeenCalledWith("event_e1", {
    campus_id: "1",
    channel: "events_oslo",
    content_id: "e1",
    content_type: "event",
    due_at: iso(DELAY_MINUTES),
    reason: null,
    status: "pending",
  });
  expect(f.locks.size).toBe(1);
});

test("an item that is not eligible gets no lock", async () => {
  const f = fake();
  f.setContent("event", eventRow("draft", { status: "draft" }));
  f.setContent("event", eventRow("quiet", { notify_push: null }));

  expect(await handleContentChange(f.deps, "event", "draft", at(0))).toBe(
    "unchanged"
  );
  expect(await handleContentChange(f.deps, "event", "quiet", at(0))).toBe(
    "unchanged"
  );
  expect(await handleContentChange(f.deps, "event", "gone", at(0))).toBe(
    "unchanged"
  );

  expect(f.deps.createLock).not.toHaveBeenCalled();
  expect(f.locks.size).toBe(0);
});

test("a scheduled item is due at its publish time when that is later than the delay", async () => {
  const f = fake();
  f.setContent("news", newsRow("n1", { scheduled_publish_at: iso(60) }));

  await handleContentChange(f.deps, "news", "n1", at(0));

  expect(lockOf(f, "news", "n1")?.due_at).toBe(iso(60));
});

test("a Publish now event ignores a stale scheduled date", async () => {
  const f = fake();
  // Scheduled once, then switched to Publish now: the old date is still saved.
  f.setContent(
    "event",
    eventRow("e1", { publish_mode: "now", scheduled_publish_at: iso(60) })
  );

  await handleContentChange(f.deps, "event", "e1", at(0));

  expect(lockOf(f, "event", "e1")?.due_at).toBe(iso(DELAY_MINUTES));
});

test("moving a pending event's scheduled time later moves its due time", async () => {
  const f = fake();
  f.setContent(
    "event",
    eventRow("e1", { publish_mode: "scheduled", scheduled_publish_at: iso(60) })
  );
  await handleContentChange(f.deps, "event", "e1", at(0));
  expect(lockOf(f, "event", "e1")?.due_at).toBe(iso(60));

  f.setContent(
    "event",
    eventRow("e1", {
      publish_mode: "scheduled",
      scheduled_publish_at: iso(120),
    })
  );
  expect(await handleContentChange(f.deps, "event", "e1", at(10))).toBe(
    "unchanged"
  );

  expect(lockOf(f, "event", "e1")).toMatchObject({
    due_at: iso(120),
    status: "pending",
  });
  expect((await dispatchDue(f.deps, at(65))).sent).toBe(0);
  expect((await dispatchDue(f.deps, at(120))).sent).toBe(1);
});

test("a plain re-save keeps the due time", async () => {
  const f = fake();
  f.setContent(
    "event",
    eventRow("e1", { publish_mode: "scheduled", scheduled_publish_at: iso(60) })
  );
  await handleContentChange(f.deps, "event", "e1", at(0));

  // Also just before it goes live, when now + delay is past the schedule.
  for (const minute of [10, 58]) {
    expect(await handleContentChange(f.deps, "event", "e1", at(minute))).toBe(
      "unchanged"
    );
  }

  expect(lockOf(f, "event", "e1")?.due_at).toBe(iso(60));
  expect(f.deps.updateLock).not.toHaveBeenCalled();
});

test("re-saving a published item never creates a second lock or a second push", async () => {
  const f = fake();
  f.setContent("event", eventRow("e1"));

  const results: string[] = [];
  for (const minute of [0, 0.5, 1, 1.5, 2]) {
    results.push(await handleContentChange(f.deps, "event", "e1", at(minute)));
  }
  await dispatchDue(f.deps, at(5));
  await dispatchDue(f.deps, at(10));

  expect(results).toEqual([
    "created",
    "unchanged",
    "unchanged",
    "unchanged",
    "unchanged",
  ]);
  expect(f.deps.createLock).toHaveBeenCalledTimes(1);
  expect(f.locks.size).toBe(1);
  expect(lockOf(f, "event", "e1")?.due_at).toBe(iso(DELAY_MINUTES));
  expect(f.deps.createAnnouncement).toHaveBeenCalledTimes(1);
  expect(f.deps.dispatch).toHaveBeenCalledTimes(1);
});

test("two events at once leave one lock", async () => {
  const f = fake();
  f.setContent("event", eventRow("e1"));

  const results = await Promise.all([
    handleContentChange(f.deps, "event", "e1", at(0)),
    handleContentChange(f.deps, "event", "e1", at(0)),
  ]);

  // Both saw no lock and tried to create it; the second got "exists" and
  // re-read the winner's lock instead of failing.
  expect(f.deps.createLock).toHaveBeenCalledTimes(2);
  expect(f.deps.getLock).toHaveBeenCalledTimes(3);
  expect([...results].sort()).toEqual(["created", "unchanged"]);
  expect(f.locks.size).toBe(1);
  expect(lockOf(f, "event", "e1")).toMatchObject({
    due_at: iso(DELAY_MINUTES),
    status: "pending",
  });
});

test("unpublishing within the delay cancels; republishing later sends once", async () => {
  const f = fake();
  f.setContent("event", eventRow("e1"));
  expect(await handleContentChange(f.deps, "event", "e1", at(0))).toBe(
    "created"
  );

  f.setContent("event", eventRow("e1", { status: "draft" }));
  expect(await handleContentChange(f.deps, "event", "e1", at(1))).toBe(
    "cancelled"
  );
  expect(lockOf(f, "event", "e1")).toMatchObject({
    reason: "not published",
    status: "cancelled",
  });

  expect(await dispatchDue(f.deps, at(5))).toEqual({
    announcements: 0,
    cancelled: 0,
    failed: 0,
    sent: 0,
  });
  expect(f.deps.dispatch).not.toHaveBeenCalled();

  f.setContent("event", eventRow("e1"));
  expect(await handleContentChange(f.deps, "event", "e1", at(30))).toBe(
    "reopened"
  );
  expect(lockOf(f, "event", "e1")).toMatchObject({
    due_at: iso(30 + DELAY_MINUTES),
    reason: null,
    status: "pending",
  });

  expect(await dispatchDue(f.deps, at(31))).toEqual({
    announcements: 0,
    cancelled: 0,
    failed: 0,
    sent: 0,
  });
  await dispatchDue(f.deps, at(40));
  await dispatchDue(f.deps, at(45));

  expect(f.deps.createLock).toHaveBeenCalledTimes(1);
  expect(f.deps.dispatch).toHaveBeenCalledTimes(1);
  expect(lockOf(f, "event", "e1")?.status).toBe(
    ContentNotificationsStatus.SENT
  );
});

test("turning notify off while pending cancels", async () => {
  const f = fake();
  f.setContent("news", newsRow("n1"));
  await handleContentChange(f.deps, "news", "n1", at(0));

  f.setContent("news", newsRow("n1", { notify_push: false }));
  expect(await handleContentChange(f.deps, "news", "n1", at(1))).toBe(
    "cancelled"
  );

  expect(lockOf(f, "news", "n1")).toMatchObject({
    reason: "notify off",
    status: "cancelled",
  });
  await dispatchDue(f.deps, at(10));
  expect(f.deps.dispatch).not.toHaveBeenCalled();
});

test("moving a pending item to another campus updates its channel and keeps its due time", async () => {
  const f = fake();
  f.setContent("event", eventRow("e1", { campus_id: "1" }));
  await handleContentChange(f.deps, "event", "e1", at(0));

  f.setContent("event", eventRow("e1", { campus_id: "2" }));
  expect(await handleContentChange(f.deps, "event", "e1", at(2))).toBe(
    "unchanged"
  );

  expect(lockOf(f, "event", "e1")).toMatchObject({
    campus_id: "2",
    channel: "events_bergen",
    due_at: iso(DELAY_MINUTES),
    status: "pending",
  });

  await dispatchDue(f.deps, at(5));
  expect(f.announcements.map((c) => c.audience_value)).toEqual([
    "events_bergen",
  ]);
});

test("sent and skipped locks are final", async () => {
  const f = fake();
  f.locks.set(
    "event_sent",
    lockRow("event_sent", {
      content_id: "sent",
      content_type: "event",
      status: ContentNotificationsStatus.SENT,
    })
  );
  f.locks.set(
    "event_skipped",
    lockRow("event_skipped", {
      content_id: "skipped",
      content_type: "event",
      status: ContentNotificationsStatus.SKIPPED,
    })
  );
  f.locks.set(
    "event_gone",
    lockRow("event_gone", {
      content_id: "gone",
      content_type: "event",
      status: ContentNotificationsStatus.SENT,
    })
  );
  // Unpublished, eligible again, and deleted: none of it may move a final lock.
  f.setContent("event", eventRow("sent", { status: "draft" }));
  f.setContent("event", eventRow("skipped"));

  for (const id of ["sent", "skipped", "gone"]) {
    expect(await handleContentChange(f.deps, "event", id, at(0))).toBe(
      "unchanged"
    );
  }

  expect(f.deps.createLock).not.toHaveBeenCalled();
  expect(f.deps.updateLock).not.toHaveBeenCalled();
  expect(lockOf(f, "event", "sent")?.status).toBe(
    ContentNotificationsStatus.SENT
  );
  expect(lockOf(f, "event", "skipped")?.status).toBe(
    ContentNotificationsStatus.SKIPPED
  );
});

test("a deleted item cancels its pending lock", async () => {
  const f = fake();
  f.setContent("event", eventRow("e1"));
  await handleContentChange(f.deps, "event", "e1", at(0));

  f.content.clear();
  expect(await handleContentChange(f.deps, "event", "e1", at(1))).toBe(
    "cancelled"
  );

  expect(lockOf(f, "event", "e1")).toMatchObject({
    reason: "deleted",
    status: "cancelled",
  });
});

test("dispatch re-checks eligibility and cancels items that became ineligible", async () => {
  const f = fake();
  // Eligible when published, but the event ends before its push is due.
  f.setContent(
    "event",
    eventRow("e1", { end_date: iso(2), start_date: iso(-60) })
  );
  f.setContent("event", eventRow("e2"));
  await handleContentChange(f.deps, "event", "e1", at(0));
  await handleContentChange(f.deps, "event", "e2", at(0));
  // Deleted after its lock was created; no event reached the function.
  f.content.delete(contentKey("event", "e2"));

  expect(await dispatchDue(f.deps, at(5))).toEqual({
    announcements: 0,
    cancelled: 2,
    failed: 0,
    sent: 0,
  });

  expect(lockOf(f, "event", "e1")).toMatchObject({
    reason: "event over",
    status: "cancelled",
  });
  expect(lockOf(f, "event", "e2")).toMatchObject({
    reason: "deleted",
    status: "cancelled",
  });
  expect(f.deps.createAnnouncement).not.toHaveBeenCalled();
  expect(f.deps.dispatch).not.toHaveBeenCalled();
});

test("dispatch groups items on the same channel into one announcement and marks every lock sent with its id", async () => {
  const f = fake();
  f.setContent("event", eventRow("e1"));
  f.setContent("event", eventRow("e2"));
  await handleContentChange(f.deps, "event", "e1", at(0));
  await handleContentChange(f.deps, "event", "e2", at(1));

  expect(await dispatchDue(f.deps, at(5))).toEqual({
    announcements: 1,
    cancelled: 0,
    failed: 0,
    sent: 2,
  });

  expect(f.deps.listDueLocks).toHaveBeenCalledWith(at(5), DUE_PAGE_SIZE);
  expect(f.announcements).toHaveLength(1);
  expect(f.announcements[0]).toMatchObject({
    audience_value: "events_oslo",
    content_id: null,
    content_ids: ["e1", "e2"],
    sent_at: iso(5),
    title_en: "2 new events in Oslo",
  });
  for (const id of ["e1", "e2"]) {
    expect(lockOf(f, "event", id)).toMatchObject({
      announcement_id: announcementIdFor(["event_e1", "event_e2"]),
      sent_at: iso(5),
      status: "sent",
    });
  }
  expect(f.deps.dispatch).toHaveBeenCalledTimes(1);
});

test("locks are marked sent before the push", async () => {
  const f = fake();
  f.setContent("event", eventRow("e1"));
  f.setContent("event", eventRow("e2"));
  await handleContentChange(f.deps, "event", "e1", at(0));
  await handleContentChange(f.deps, "event", "e2", at(0));
  f.calls.length = 0;

  await dispatchDue(f.deps, at(5));

  expect(f.calls).toEqual([
    "createAnnouncement",
    "updateLock:event_e1:sent",
    "updateLock:event_e2:sent",
    `dispatch:${announcementIdFor(["event_e1", "event_e2"])}`,
  ]);
});

test("a failed push does not reopen the locks", async () => {
  const f = fake({
    dispatch: mock(() => Promise.reject(new Error("FCM unavailable"))),
  });
  f.setContent("event", eventRow("e1"));
  await handleContentChange(f.deps, "event", "e1", at(0));

  expect(await dispatchDue(f.deps, at(5))).toEqual({
    announcements: 1,
    cancelled: 0,
    failed: 1,
    sent: 1,
  });
  await dispatchDue(f.deps, at(10));

  expect(lockOf(f, "event", "e1")).toMatchObject({
    announcement_id: announcementIdFor(["event_e1"]),
    status: "sent",
  });
  expect(f.errors.some((line) => line.includes("FCM unavailable"))).toBe(true);
  expect(f.deps.createAnnouncement).toHaveBeenCalledTimes(1);
  expect(f.deps.dispatch).toHaveBeenCalledTimes(1);
});

test("items on different channels get separate announcements", async () => {
  const f = fake();
  f.setContent("event", eventRow("oslo", { campus_id: "1" }));
  f.setContent("event", eventRow("bergen", { campus_id: "2" }));
  f.setContent("news", newsRow("n1", { campus_id: "1" }));
  await handleContentChange(f.deps, "event", "oslo", at(0));
  await handleContentChange(f.deps, "event", "bergen", at(0));
  await handleContentChange(f.deps, "news", "n1", at(0));

  expect(await dispatchDue(f.deps, at(5))).toEqual({
    announcements: 3,
    cancelled: 0,
    failed: 0,
    sent: 3,
  });

  expect(
    f.announcements.map((c) => [c.audience_value, c.content_id]).sort()
  ).toEqual([
    ["events_bergen", "bergen"],
    ["events_oslo", "oslo"],
    ["news_oslo", "n1"],
  ]);
  expect(f.deps.dispatch).toHaveBeenCalledTimes(3);
});

test("a channel whose announcement cannot be created does not block the others", async () => {
  const f = fake();
  const createAnnouncement = f.deps.createAnnouncement;
  f.deps.createAnnouncement = mock(
    async (id: string, columns: AutoAnnouncementColumns) => {
      if (columns.audience_value === "events_oslo") {
        throw new Error("write refused");
      }
      return await createAnnouncement(id, columns);
    }
  );
  f.setContent("event", eventRow("oslo", { campus_id: "1" }));
  f.setContent("event", eventRow("bergen", { campus_id: "2" }));
  await handleContentChange(f.deps, "event", "oslo", at(0));
  await handleContentChange(f.deps, "event", "bergen", at(0));

  expect(await dispatchDue(f.deps, at(5))).toEqual({
    announcements: 1,
    cancelled: 0,
    failed: 1,
    sent: 1,
  });

  // Nothing was recorded for Oslo, so it stays pending and retries next run.
  expect(lockOf(f, "event", "oslo")?.status).toBe(
    ContentNotificationsStatus.PENDING
  );
  expect(lockOf(f, "event", "bergen")?.status).toBe(
    ContentNotificationsStatus.SENT
  );
  expect(f.errors.some((line) => line.includes("write refused"))).toBe(true);
  expect(f.deps.dispatch).toHaveBeenCalledTimes(1);
});

test("notify off racing a dispatch never cancels or reopens the sent lock", async () => {
  const f = fake();
  f.setContent("event", eventRow("e1"));
  await handleContentChange(f.deps, "event", "e1", at(0));

  // The editor turns notify off. The event for that save reads the lock while
  // it is still pending; meanwhile a dispatch that re-checked the item just
  // before the save marks the lock sent and pushes.
  const readLock = f.deps.getLock;
  let raced = false;
  f.deps.getLock = mock(async (lockId: string) => {
    const snapshot = await readLock(lockId);
    if (!raced) {
      raced = true;
      f.setContent("event", eventRow("e1"));
      await dispatchDue(f.deps, at(5));
      f.setContent("event", eventRow("e1", { notify_push: false }));
    }
    return snapshot;
  });
  f.setContent("event", eventRow("e1", { notify_push: false }));
  expect(await handleContentChange(f.deps, "event", "e1", at(5))).toBe(
    "unchanged"
  );

  // Notify back on later: nothing reopens and nothing is pushed again.
  f.setContent("event", eventRow("e1"));
  expect(await handleContentChange(f.deps, "event", "e1", at(6))).toBe(
    "unchanged"
  );
  await dispatchDue(f.deps, at(20));

  expect(raced).toBe(true);
  expect(f.deps.dispatch).toHaveBeenCalledTimes(1);
  expect(lockOf(f, "event", "e1")).toMatchObject({
    announcement_id: announcementIdFor(["event_e1"]),
    status: "sent",
  });
});

test("a lock that went out stays final even after a stale write changed its status", async () => {
  const f = fake();
  // A stale cancel landed on a sent lock, and a stale reopen on another one;
  // the announcement id survives both because updates are partial.
  f.locks.set(
    "event_cancelled",
    lockRow("event_cancelled", {
      announcement_id: "ann_old",
      campus_id: "1",
      channel: "events_oslo",
      content_id: "cancelled",
      content_type: "event",
      reason: "notify off",
      sent_at: iso(-10),
      status: ContentNotificationsStatus.CANCELLED,
    })
  );
  f.locks.set(
    "event_reopened",
    lockRow("event_reopened", {
      announcement_id: "ann_old",
      campus_id: "1",
      channel: "events_oslo",
      content_id: "reopened",
      content_type: "event",
      due_at: iso(3),
      sent_at: iso(-10),
      status: ContentNotificationsStatus.PENDING,
    })
  );
  f.setContent("event", eventRow("cancelled"));
  f.setContent("event", eventRow("reopened"));

  expect(await handleContentChange(f.deps, "event", "cancelled", at(0))).toBe(
    "unchanged"
  );
  expect(await dispatchDue(f.deps, at(5))).toEqual({
    announcements: 0,
    cancelled: 0,
    failed: 0,
    sent: 0,
  });

  expect(f.deps.createAnnouncement).not.toHaveBeenCalled();
  expect(f.deps.dispatch).not.toHaveBeenCalled();
  for (const id of ["cancelled", "reopened"]) {
    expect(lockOf(f, "event", id)).toMatchObject({
      announcement_id: "ann_old",
      status: "sent",
    });
  }
});

test("a due item whose campus changed since its lock was written goes to its new campus", async () => {
  const f = fake();
  f.setContent("event", eventRow("b1", { campus_id: "2" }));
  f.setContent("event", eventRow("b2", { campus_id: "2" }));
  await handleContentChange(f.deps, "event", "b1", at(0));
  await handleContentChange(f.deps, "event", "b2", at(0));
  // Moved to Oslo; the row event has not been processed yet.
  f.setContent("event", eventRow("b2", { campus_id: "1" }));

  expect(await dispatchDue(f.deps, at(5))).toEqual({
    announcements: 2,
    cancelled: 0,
    failed: 0,
    sent: 2,
  });

  expect(
    f.announcements
      .map((c) => [c.audience_value, c.campus_id, c.content_id])
      .sort()
  ).toEqual([
    ["events_bergen", "2", "b1"],
    ["events_oslo", "1", "b2"],
  ]);
  expect(lockOf(f, "event", "b2")).toMatchObject({
    campus_id: "1",
    channel: "events_oslo",
    status: "sent",
  });
  expect(lockOf(f, "event", "b1")).toMatchObject({
    campus_id: "2",
    channel: "events_bergen",
    status: "sent",
  });
});

test("an item whose re-check fails stays pending and does not block the others", async () => {
  const f = fake();
  f.setContent("event", eventRow("e1"));
  f.setContent("event", eventRow("e2"));
  await handleContentChange(f.deps, "event", "e1", at(0));
  await handleContentChange(f.deps, "event", "e2", at(1));

  const readContent = f.deps.getContent;
  f.deps.getContent = mock((type: NotifyContentType, id: string) =>
    id === "e1"
      ? Promise.reject(new Error("upstream timeout"))
      : readContent(type, id)
  );

  expect(await dispatchDue(f.deps, at(5))).toEqual({
    announcements: 1,
    cancelled: 0,
    failed: 1,
    sent: 1,
  });

  expect(lockOf(f, "event", "e1")?.status).toBe(
    ContentNotificationsStatus.PENDING
  );
  expect(lockOf(f, "event", "e2")?.status).toBe(
    ContentNotificationsStatus.SENT
  );
  expect(f.announcements.map((c) => c.content_id)).toEqual(["e2"]);
  expect(f.errors.some((line) => line.includes("upstream timeout"))).toBe(true);
});

test("a lock reopened after listing waits for its new due time", async () => {
  const f = fake();
  f.setContent("event", eventRow("e1"));
  await handleContentChange(f.deps, "event", "e1", at(0));

  // Listed as due, then reopened (new due time) before the re-check reads it.
  const listed = await f.deps.listDueLocks(at(5), DUE_PAGE_SIZE);
  expect(listed).toHaveLength(1);
  f.locks.set("event_e1", {
    ...(f.locks.get("event_e1") as ContentNotifications),
    due_at: iso(30),
  });
  f.deps.listDueLocks = mock(() => Promise.resolve(listed));

  expect(await dispatchDue(f.deps, at(5))).toEqual({
    announcements: 0,
    cancelled: 0,
    failed: 0,
    sent: 0,
  });
  expect(f.deps.dispatch).not.toHaveBeenCalled();
  expect(lockOf(f, "event", "e1")?.status).toBe(
    ContentNotificationsStatus.PENDING
  );
});

test("a group whose locks cannot be marked sent pushes nothing and names its announcement", async () => {
  const f = fake();
  f.setContent("event", eventRow("e1"));
  await handleContentChange(f.deps, "event", "e1", at(0));
  const writeLock = f.deps.updateLock;
  f.deps.updateLock = mock((lockId: string, data: LockPatch) =>
    data.status === ContentNotificationsStatus.SENT
      ? Promise.reject(new Error("lock write refused"))
      : writeLock(lockId, data)
  );
  const announcementId = announcementIdFor(["event_e1"]);

  expect(await dispatchDue(f.deps, at(5))).toEqual({
    announcements: 0,
    cancelled: 0,
    failed: 1,
    sent: 0,
  });
  expect(f.deps.dispatch).not.toHaveBeenCalled();
  expect(lockOf(f, "event", "e1")?.status).toBe(
    ContentNotificationsStatus.PENDING
  );
  expect(
    f.errors.some(
      (line) =>
        line.includes(announcementId) && line.includes("lock write refused")
    )
  ).toBe(true);

  // The next run meets the recorded announcement: it marks the lock sent and
  // still pushes nothing, so the item skips once and never goes out twice.
  f.deps.updateLock = writeLock;
  expect(await dispatchDue(f.deps, at(10))).toEqual({
    announcements: 0,
    cancelled: 0,
    failed: 0,
    sent: 1,
  });
  expect(f.deps.dispatch).not.toHaveBeenCalled();
  expect(lockOf(f, "event", "e1")).toMatchObject({
    announcement_id: announcementId,
    status: "sent",
  });
});

test("a group's announcement id is auto_ plus the sha256 of its sorted lock ids", async () => {
  const f = fake();
  f.setContent("event", eventRow("e2"));
  f.setContent("event", eventRow("e1"));
  await handleContentChange(f.deps, "event", "e2", at(0));
  await handleContentChange(f.deps, "event", "e1", at(0));

  await dispatchDue(f.deps, at(5));

  const hash = createHash("sha256").update("event_e1,event_e2").digest("hex");
  const expected = `auto_${hash.slice(0, 31)}`;
  expect(expected).toHaveLength(36);
  expect(announcementIdFor(["event_e2", "event_e1"])).toBe(expected);
  expect(f.deps.createAnnouncement).toHaveBeenCalledTimes(1);
  expect(f.deps.createAnnouncement).toHaveBeenCalledWith(
    expected,
    expect.objectContaining({ content_ids: ["e2", "e1"] })
  );
  expect(lockOf(f, "event", "e1")?.announcement_id).toBe(expected);
});

test("a second dispatch of the same group marks its locks sent with the existing announcement and does not push", async () => {
  const f = fake();
  f.setContent("event", eventRow("e1"));
  f.setContent("event", eventRow("e2"));
  await handleContentChange(f.deps, "event", "e1", at(0));
  await handleContentChange(f.deps, "event", "e2", at(0));
  // Another dispatch already recorded this group (and pushes it itself).
  const announcementId = announcementIdFor(["event_e1", "event_e2"]);
  f.announcementRows.set(announcementId, {
    $id: announcementId,
  } as unknown as Announcements);

  expect(await dispatchDue(f.deps, at(5))).toEqual({
    announcements: 0,
    cancelled: 0,
    failed: 0,
    sent: 2,
  });

  expect(f.calls).toContain("createAnnouncement:exists");
  expect(f.deps.dispatch).not.toHaveBeenCalled();
  for (const id of ["e1", "e2"]) {
    expect(lockOf(f, "event", id)).toMatchObject({
      announcement_id: announcementId,
      sent_at: iso(5),
      status: "sent",
    });
  }
});

test("a lock that comes due just before the night waits for the morning", async () => {
  const f = fake();
  // 21:58 and 22:03 in Oslo (CEST, UTC+2), and 08:00 the next Oslo day.
  const dueAt = "2026-10-21T19:58:00.000Z";
  const morning = "2026-10-22T06:00:00.000Z";
  f.setContent("event", eventRow("e1"));
  f.locks.set(
    "event_e1",
    lockRow("event_e1", {
      campus_id: "1",
      channel: "events_oslo",
      content_id: "e1",
      content_type: "event",
      due_at: dueAt,
    })
  );

  expect(
    await dispatchDue(f.deps, new Date("2026-10-21T20:03:00.000Z"))
  ).toEqual({ announcements: 0, cancelled: 0, failed: 0, sent: 0 });

  expect(f.deps.createAnnouncement).not.toHaveBeenCalled();
  expect(f.deps.dispatch).not.toHaveBeenCalled();
  expect(lockOf(f, "event", "e1")).toMatchObject({
    due_at: morning,
    status: "pending",
  });

  expect((await dispatchDue(f.deps, new Date(morning))).sent).toBe(1);
  expect(f.deps.dispatch).toHaveBeenCalledTimes(1);
});

test("an item without a title goes out under its slug, and one with neither is left out", async () => {
  const f = fake();
  const readTranslations = f.deps.getTranslations;
  f.deps.getTranslations = mock((type: NotifyContentType, id: string) =>
    id === "e1" ? readTranslations(type, id) : Promise.resolve([])
  );
  f.setContent("event", eventRow("e1"));
  f.setContent("event", eventRow("e2", { slug: "autumn-party" }));
  f.setContent("event", eventRow("e3", { slug: null }));
  for (const id of ["e1", "e2", "e3"]) {
    await handleContentChange(f.deps, "event", id, at(0));
  }

  expect(await dispatchDue(f.deps, at(5))).toEqual({
    announcements: 1,
    cancelled: 1,
    failed: 0,
    sent: 2,
  });

  expect(f.announcements[0]).toMatchObject({
    body_en: "Title e1 · autumn-party",
    content_ids: ["e1", "e2"],
  });
  expect(lockOf(f, "event", "e3")).toMatchObject({
    reason: "no title",
    status: "cancelled",
  });
  expect(f.logs.some((line) => line.includes("event_e3"))).toBe(true);
});
