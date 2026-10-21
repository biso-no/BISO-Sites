import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { Query } from "@repo/api";
import type { UserAuthContext } from "@/lib/authorization";

const db = {
  createRow: mock(),
  deleteRow: mock(),
  getRow: mock(),
  listRows: mock(),
  updateRow: mock(),
  upsertRow: mock(),
};

const ctx = {
  activeCampusId: undefined,
  campusNames: [],
  campusTeamIds: [],
  departmentNames: [],
  departmentTeamIds: [],
  email: null,
  managedCampuses: [],
  managedCampusIds: [],
  name: null,
  resolvedCampusIds: [],
  resolvedDepartmentIds: [],
  roles: ["globaladmin"],
  userId: "user-1",
} as UserAuthContext;

mock.module("server-only", () => ({}));
mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db, messaging: {}, users: {} })),
  createSessionClient: mock(async () => ({ db })),
}));
mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => ctx),
}));
mock.module("next/cache", () => ({
  revalidatePath: mock(() => undefined),
  unstable_cache: (fn: unknown) => fn,
}));

const { listAnnouncements } = await import("./announcements");

function announcementQueries(): string[] {
  const call = db.listRows.mock.calls.find(
    (args) => args[1] === "announcements"
  );
  return (call?.[2] ?? []) as string[];
}

beforeEach(() => {
  db.listRows.mockReset();
  db.listRows.mockImplementation(() => ({ rows: [], total: 0 }));
});

describe("listAnnouncements source filter", () => {
  test("auto adds an equality query", async () => {
    await listAnnouncements({ source: "auto" });
    expect(announcementQueries()).toContain(Query.equal("source", "auto"));
  });

  test("manual includes rows with no source", async () => {
    await listAnnouncements({ source: "manual" });
    expect(announcementQueries()).toContain(
      Query.or([Query.isNull("source"), Query.equal("source", "manual")])
    );
  });

  test("all and undefined add no source query", async () => {
    await listAnnouncements({ source: "all" });
    await listAnnouncements();
    for (const call of db.listRows.mock.calls) {
      expect((call[2] as string[]).join("")).not.toContain("source");
    }
  });
});

describe("listAnnouncements segment names", () => {
  test("loads segment names in a single batch", async () => {
    db.listRows.mockImplementation((_d: string, table: string) => {
      if (table === "announcements") {
        return {
          rows: [
            { $id: "a1", audience_type: "segment", audience_value: "s1" },
            { $id: "a2", audience_type: "segment", audience_value: "s2" },
            { $id: "a3", audience_type: "segment", audience_value: "s1" },
            { $id: "a4", audience_type: "broadcast", audience_value: null },
          ],
          total: 4,
        };
      }
      return { rows: [{ $id: "s1", name: "Board" }], total: 1 };
    });
    const result = await listAnnouncements();
    const segmentCalls = db.listRows.mock.calls.filter(
      (args) => args[1] === "event_segments"
    );
    expect(segmentCalls).toHaveLength(1);
    expect(segmentCalls[0]?.[2]).toContain(Query.equal("$id", ["s1", "s2"]));
    expect(result.segmentNames).toEqual({ s1: "Board" });
  });

  test("a failed name lookup still lists the announcements", async () => {
    const consoleError = spyOn(console, "error").mockImplementation(
      () => undefined
    );
    db.listRows.mockImplementation((_d: string, table: string) => {
      if (table === "announcements") {
        return {
          rows: [{ $id: "a1", audience_type: "segment", audience_value: "s1" }],
          total: 1,
        };
      }
      return Promise.reject(new Error("event_segments unavailable"));
    });
    try {
      const result = await listAnnouncements();

      expect(result.rows).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.segmentNames).toEqual({});
      expect(consoleError).toHaveBeenCalledTimes(1);
    } finally {
      consoleError.mockRestore();
    }
  });

  test("skips the lookup when there are no segment rows", async () => {
    await listAnnouncements();
    expect(
      db.listRows.mock.calls.some((args) => args[1] === "event_segments")
    ).toBe(false);
  });
});
