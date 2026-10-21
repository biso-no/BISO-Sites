import { expect, mock, test } from "bun:test";
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
  /** Announcement columns in the order they were created. */
  announcements: AutoAnnouncementColumns[];
  /** Writes in the order they happened: creates, updates, announcements, pushes. */
  calls: string[];
  content: Map<string, Row>;
  deps: NotifierDeps;
  /** Lock rows by row id. */
  locks: Map<string, ContentNotifications>;
  logs: string[];
  setContent: (type: NotifyContentType, row: Row) => void;
}

function fake(overrides: Partial<NotifierDeps> = {}): Fake {
  const content = new Map<string, Row>();
  const locks = new Map<string, ContentNotifications>();
  const announcements: AutoAnnouncementColumns[] = [];
  const calls: string[] = [];
  const logs: string[] = [];

  const deps: NotifierDeps = {
    createAnnouncement: mock((columns: AutoAnnouncementColumns) => {
      announcements.push(columns);
      calls.push("createAnnouncement");
      return Promise.resolve({
        ...columns,
        $id: `ann_${announcements.length}`,
      } as unknown as Announcements);
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
    announcements,
    calls,
    content,
    deps,
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
      announcement_id: "ann_1",
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
    "dispatch:ann_1",
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
    sent: 1,
  });
  await dispatchDue(f.deps, at(10));

  expect(lockOf(f, "event", "e1")).toMatchObject({
    announcement_id: "ann_1",
    status: "sent",
  });
  expect(f.logs.some((line) => line.includes("FCM unavailable"))).toBe(true);
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
  f.deps.createAnnouncement = mock(async (columns: AutoAnnouncementColumns) => {
    if (columns.audience_value === "events_oslo") {
      throw new Error("write refused");
    }
    return await createAnnouncement(columns);
  });
  f.setContent("event", eventRow("oslo", { campus_id: "1" }));
  f.setContent("event", eventRow("bergen", { campus_id: "2" }));
  await handleContentChange(f.deps, "event", "oslo", at(0));
  await handleContentChange(f.deps, "event", "bergen", at(0));

  expect(await dispatchDue(f.deps, at(5))).toEqual({
    announcements: 1,
    cancelled: 0,
    sent: 1,
  });

  // Nothing was recorded for Oslo, so it stays pending and retries next run.
  expect(lockOf(f, "event", "oslo")?.status).toBe(
    ContentNotificationsStatus.PENDING
  );
  expect(lockOf(f, "event", "bergen")?.status).toBe(
    ContentNotificationsStatus.SENT
  );
  expect(f.logs.some((line) => line.includes("write refused"))).toBe(true);
  expect(f.deps.dispatch).toHaveBeenCalledTimes(1);
});
