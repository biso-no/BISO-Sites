import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { UserAuthContext } from "@/lib/authorization";

const db = { getRow: mock() };
let currentCtx: UserAuthContext;

function makeCtx(overrides: Partial<UserAuthContext> = {}): UserAuthContext {
  return {
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
    roles: [],
    userId: "user-1",
    ...overrides,
  };
}

mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db })),
}));
mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => currentCtx),
}));

const { getContentNotificationState } = await import("./content-notifications");

const sentLock = (campusId: string | null) => ({
  $updatedAt: "2026-10-01T10:00:00.000Z",
  announcement_id: "ann-1",
  campus_id: campusId,
  sent_at: "2026-10-01T10:05:00.000Z",
  status: "sent",
});

beforeEach(() => {
  db.getRow.mockReset();
  currentCtx = makeCtx({ managedCampusIds: ["campus-oslo"] });
});

describe("getContentNotificationState", () => {
  test("returns the state for a lock in the caller's campus", async () => {
    db.getRow.mockResolvedValue(sentLock("campus-oslo"));
    expect(await getContentNotificationState("news", "n1")).toEqual({
      kind: "sent",
      sentAt: "2026-10-01T10:05:00.000Z",
    });
  });

  test("returns none for a lock in another campus", async () => {
    db.getRow.mockResolvedValue(sentLock("campus-bergen"));
    expect(await getContentNotificationState("news", "n1")).toEqual({
      kind: "none",
    });
  });

  test("global admins see any campus and campus-less locks are visible", async () => {
    currentCtx = makeCtx({ roles: ["globaladmin"] });
    db.getRow.mockResolvedValue(sentLock("campus-bergen"));
    expect((await getContentNotificationState("news", "n1")).kind).toBe("sent");
    currentCtx = makeCtx();
    db.getRow.mockResolvedValue(sentLock(null));
    expect((await getContentNotificationState("news", "n1")).kind).toBe("sent");
  });

  test("maps a 404 to none", async () => {
    db.getRow.mockRejectedValue({ code: 404 });
    expect(await getContentNotificationState("job", "j1")).toEqual({
      kind: "none",
    });
  });

  test("rejects an unknown content type without reading", async () => {
    const result = await getContentNotificationState(
      "bogus" as unknown as "news",
      "n1"
    );
    expect(result).toEqual({ kind: "none" });
    expect(db.getRow).not.toHaveBeenCalled();
  });
});
