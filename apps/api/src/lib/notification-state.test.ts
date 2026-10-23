import { Query } from "@repo/api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyNotificationState,
  MAX_ANNOUNCEMENT_IDS,
  type NotificationStateDb,
  parseAnnouncementIds,
} from "./notification-state";

interface StateRow {
  $id: string;
  announcement_id: string;
  cleared?: boolean;
  read?: boolean;
}

function ids(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `a${i}`);
}

describe("parseAnnouncementIds", () => {
  it("returns the ids once each, in first-seen order", () => {
    expect(parseAnnouncementIds({ announcementIds: ["a", "b", "a"] })).toEqual([
      "a",
      "b",
    ]);
  });

  it(`accepts ${MAX_ANNOUNCEMENT_IDS} ids`, () => {
    expect(
      parseAnnouncementIds({ announcementIds: ids(MAX_ANNOUNCEMENT_IDS) })
    ).toHaveLength(MAX_ANNOUNCEMENT_IDS);
  });

  it.each([
    ["no body", null],
    ["a string body", "x"],
    ["no ids", {}],
    ["ids that are not a list", { announcementIds: "a" }],
    ["an empty list", { announcementIds: [] }],
    ["too many ids", { announcementIds: ids(MAX_ANNOUNCEMENT_IDS + 1) }],
    ["an id with a space", { announcementIds: ["bad id"] }],
    ["an id starting with a symbol", { announcementIds: ["-a"] }],
    ["an id that is not a string", { announcementIds: [7] }],
    ["an id longer than 36", { announcementIds: ["a".repeat(37)] }],
  ])("refuses %s", (_label, body) => {
    expect(parseAnnouncementIds(body)).toBeNull();
  });
});

describe("applyNotificationState", () => {
  let announcements: string[];
  let stateRows: StateRow[];
  let db: {
    listRows: ReturnType<typeof vi.fn>;
    createRow: ReturnType<typeof vi.fn>;
    updateRow: ReturnType<typeof vi.fn>;
  };

  /** The queries of every read of [table], in call order. */
  function readsOf(table: string): string[][] {
    return db.listRows.mock.calls
      .filter(([t]) => t === table)
      .map(([, queries]) => queries as string[]);
  }

  beforeEach(() => {
    announcements = ["a1"];
    stateRows = [];
    db = {
      listRows: vi.fn(async (table: string) => ({
        rows:
          table === "announcements"
            ? announcements.map(($id) => ({ $id }))
            : stateRows,
      })),
      createRow: vi.fn(async () => ({})),
      updateRow: vi.fn(async () => ({})),
    };
  });

  const apply = (
    action: "read" | "clear",
    announcementIds: string[] = ["a1"]
  ) =>
    applyNotificationState(db as unknown as NotificationStateDb, {
      action,
      announcementIds,
      userId: "user-1",
    });

  it("creates a row readable only by the student", async () => {
    await apply("read");

    expect(db.createRow).toHaveBeenCalledWith(
      "user_notifications",
      expect.any(String),
      { announcement_id: "a1", cleared: false, read: true, user_id: "user-1" },
      ['read("user:user-1")']
    );
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  it("clear creates the row read and cleared", async () => {
    await apply("clear");

    expect(db.createRow).toHaveBeenCalledWith(
      "user_notifications",
      expect.any(String),
      { announcement_id: "a1", cleared: true, read: true, user_id: "user-1" },
      ['read("user:user-1")']
    );
  });

  it("updates an existing fan-out row instead of creating one", async () => {
    stateRows = [{ $id: "row-1", announcement_id: "a1", read: false }];

    await apply("clear");

    expect(db.updateRow).toHaveBeenCalledWith("user_notifications", "row-1", {
      cleared: true,
      read: true,
    });
    expect(db.createRow).not.toHaveBeenCalled();
  });

  it("a read never touches cleared", async () => {
    stateRows = [
      { $id: "row-1", announcement_id: "a1", cleared: true, read: false },
    ];

    await apply("read");

    expect(db.updateRow).toHaveBeenCalledWith("user_notifications", "row-1", {
      read: true,
    });
  });

  it("skips ids that are not announcements", async () => {
    await apply("read", ["a1", "ghost"]);

    expect(db.createRow).toHaveBeenCalledTimes(1);
    expect(db.createRow.mock.calls[0]?.[2]).toMatchObject({
      announcement_id: "a1",
    });
  });

  it("writes an announcement that has not been sent yet", async () => {
    await apply("read");

    for (const queries of readsOf("announcements")) {
      expect(queries.join(" ")).not.toContain('"status"');
    }
    expect(db.createRow).toHaveBeenCalledTimes(1);
  });

  it("looks up announcements and state rows for the whole batch at once", async () => {
    announcements = ["a1", "a2"];

    await apply("read", ["a1", "a2", "ghost"]);

    expect(readsOf("announcements")).toEqual([
      [
        Query.equal("$id", ["a1", "a2", "ghost"]),
        Query.select(["$id"]),
        Query.limit(3),
      ],
    ]);
    const [stateQueries] = readsOf("user_notifications");
    expect(stateQueries).toEqual(
      expect.arrayContaining([
        Query.equal("user_id", "user-1"),
        Query.equal("announcement_id", ["a1", "a2"]),
      ])
    );
  });

  it("a create that loses the race becomes an update", async () => {
    db.createRow.mockRejectedValueOnce(
      Object.assign(new Error("exists"), { code: 409 })
    );
    db.listRows.mockImplementation((table: string) => {
      if (table === "announcements") {
        return Promise.resolve({ rows: [{ $id: "a1" }] });
      }
      // The other request's row appears once our create has lost the race.
      const created = db.createRow.mock.calls.length > 0;
      return Promise.resolve({
        rows: created ? [{ $id: "row-9", announcement_id: "a1" }] : [],
      });
    });

    await apply("read");

    expect(db.updateRow).toHaveBeenCalledWith("user_notifications", "row-9", {
      read: true,
    });
  });

  it("rejects when a write fails", async () => {
    stateRows = [{ $id: "row-1", announcement_id: "a1" }];
    db.updateRow.mockRejectedValue(
      Object.assign(new Error("boom"), { code: 500 })
    );

    await expect(apply("read")).rejects.toThrow();
  });
});
