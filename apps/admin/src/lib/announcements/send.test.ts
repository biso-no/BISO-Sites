import { describe, expect, mock, test } from "bun:test";
import type { Announcements } from "@repo/api/types/appwrite";
import type { DispatchClients } from "./send";

// `send.ts` starts with `import "server-only"`. Next.js aliases that package
// away via the `react-server` export condition when bundling; plain `bun
// test` doesn't set that condition, so the marker package throws on import
// unless it's neutralized here (same pattern as
// `src/app/(portal)/_actions/approvals.test.ts` and
// `src/lib/notifications/topic-subscribers.test.ts`).
mock.module("server-only", () => ({}));

const {
  dispatchAnnouncement,
  dispatchDueAnnouncements,
  resolveAnnouncementTopicId,
} = await import("./send");

describe("resolveAnnouncementTopicId", () => {
  test("resolves an empty audience value to the general topic", () => {
    expect(resolveAnnouncementTopicId("", "1")).toBe("general");
    expect(resolveAnnouncementTopicId(null, "1")).toBe("general");
    expect(resolveAnnouncementTopicId(undefined, "1")).toBe("general");
  });

  test("resolves a whitespace-only audience value to the general topic", () => {
    expect(resolveAnnouncementTopicId("   ", "1")).toBe("general");
  });

  test("expands a logical topic to its campus-scoped id", () => {
    expect(resolveAnnouncementTopicId("events", "1")).toBe("events_oslo");
  });

  test("falls back to the national scope when the campus is null - campus-less content reaches every campus's subscribers", () => {
    expect(resolveAnnouncementTopicId("events", null)).toBe("events_national");
  });

  test("maps the retired 'products' alias to the 'shop' topic", () => {
    expect(resolveAnnouncementTopicId("products", "2")).toBe("shop_bergen");
  });

  test("passes an already campus-scoped topic id through unchanged, regardless of the announcement's campus", () => {
    expect(resolveAnnouncementTopicId("events_oslo", "2")).toBe("events_oslo");
    expect(resolveAnnouncementTopicId("events_oslo", null)).toBe(
      "events_oslo"
    );
  });

  test("passes 'general' through unchanged", () => {
    expect(resolveAnnouncementTopicId("general", "1")).toBe("general");
  });
});

/**
 * A minimal `Announcements` row. Cast through `unknown` rather than filling
 * in every `Models.Row` field — the same shortcut `sendEventAnnouncement`
 * uses when calling `dispatchAnnouncement` in `_actions/events.ts`.
 */
function makeAnnouncement(
  overrides: Record<string, unknown> = {}
): Announcements {
  return {
    $id: "announcement-1",
    status: "sent",
    category: "general",
    audience_type: "topic",
    audience_value: "events",
    title_en: "Title",
    title_no: null,
    body_en: "<p>Body</p>",
    body_no: null,
    event_id: null,
    campus_id: "1",
    deep_link: null,
    data: null,
    push: true,
    scheduled_at: null,
    sent_at: null,
    created_by: null,
    campus: null,
    department: null,
    ...overrides,
  } as unknown as Announcements;
}

function makeClients(): {
  clients: DispatchClients;
  db: {
    createRow: ReturnType<typeof mock>;
    listRows: ReturnType<typeof mock>;
    updateRow: ReturnType<typeof mock>;
  };
  messaging: { createPush: ReturnType<typeof mock> };
} {
  const db = {
    createRow: mock(async () => ({})),
    // Only exercised by the SEGMENT audience path (`collectSegmentUserIds`);
    // empty by default so a SEGMENT test doesn't need to care about it.
    listRows: mock(async () => ({ rows: [], total: 0 })),
    updateRow: mock(async () => undefined),
  };
  const messaging = { createPush: mock(async () => undefined) };
  const users = {};
  return {
    clients: { db, messaging, users } as unknown as DispatchClients,
    db,
    messaging,
  };
}

describe("dispatchAnnouncement", () => {
  test("returns the resolved topic id for a TOPIC audience", async () => {
    const { clients } = makeClients();

    const result = await dispatchAnnouncement(
      makeAnnouncement({
        audience_type: "topic",
        audience_value: "events",
        campus_id: "1",
      }),
      clients
    );

    expect(result.topic).toBe("events_oslo");
  });

  test("does not include a topic for a BROADCAST audience", async () => {
    const { clients } = makeClients();

    const result = await dispatchAnnouncement(
      makeAnnouncement({ audience_type: "broadcast", audience_value: null }),
      clients
    );

    expect(result.topic).toBeUndefined();
  });

  test("does not include a topic for a USERS audience", async () => {
    const { clients } = makeClients();

    const result = await dispatchAnnouncement(
      makeAnnouncement({
        audience_type: "users",
        audience_value: JSON.stringify(["user-1"]),
      }),
      clients
    );

    expect(result.topic).toBeUndefined();
  });

  test("does not include a topic for a SEGMENT audience", async () => {
    const { clients } = makeClients();

    const result = await dispatchAnnouncement(
      makeAnnouncement({ audience_type: "segment", audience_value: "seg-1" }),
      clients
    );

    expect(result.topic).toBeUndefined();
  });
});

describe("dispatchDueAnnouncements", () => {
  function makeDueClients(dueRows: Announcements[]) {
    const { clients, db, messaging } = makeClients();
    const listRows = mock(async () => ({ rows: dueRows, total: dueRows.length }));
    (clients.db as unknown as { listRows: typeof listRows }).listRows =
      listRows;
    return { clients, db, listRows, messaging };
  }

  test("persists the resolved campus-scoped topic id when marking a topic row sent", async () => {
    const row = makeAnnouncement({
      $id: "row-1",
      status: "scheduled",
      audience_type: "topic",
      audience_value: "events",
      campus_id: "1",
      data: null,
    });
    const { clients, db } = makeDueClients([row]);

    await dispatchDueAnnouncements(clients, new Date("2026-01-01T00:00:00Z"));

    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "announcements",
      "row-1",
      expect.objectContaining({
        status: "sent",
        audience_value: "events_oslo",
      })
    );
  });

  test("resolves a null campus to the national scope", async () => {
    const row = makeAnnouncement({
      $id: "row-2",
      status: "scheduled",
      audience_type: "topic",
      audience_value: "events",
      campus_id: null,
      data: null,
    });
    const { clients, db } = makeDueClients([row]);

    await dispatchDueAnnouncements(clients, new Date("2026-01-01T00:00:00Z"));

    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "announcements",
      "row-2",
      expect.objectContaining({ audience_value: "events_national" })
    );
  });

  test("does not add audience_value when marking a broadcast row sent", async () => {
    const row = makeAnnouncement({
      $id: "row-3",
      status: "scheduled",
      audience_type: "broadcast",
      audience_value: null,
      data: null,
    });
    const { clients, db } = makeDueClients([row]);

    await dispatchDueAnnouncements(clients, new Date("2026-01-01T00:00:00Z"));

    // `db.updateRow` is also called once for the row's read permissions;
    // find the call that actually flips status to "sent" and check that one.
    const sentCall = db.updateRow.mock.calls.find(
      (call) =>
        (call[3] as Record<string, unknown> | undefined)?.status === "sent"
    );
    expect(sentCall).toBeDefined();
    expect(sentCall?.[3]).not.toHaveProperty("audience_value");
  });

  test("keeps an already campus-scoped audience_value unchanged on re-dispatch", async () => {
    const row = makeAnnouncement({
      $id: "row-4",
      status: "scheduled",
      audience_type: "topic",
      audience_value: "events_oslo",
      campus_id: "1",
      data: null,
    });
    const { clients, db } = makeDueClients([row]);

    await dispatchDueAnnouncements(clients, new Date("2026-01-01T00:00:00Z"));

    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "announcements",
      "row-4",
      expect.objectContaining({ audience_value: "events_oslo" })
    );
  });
});
