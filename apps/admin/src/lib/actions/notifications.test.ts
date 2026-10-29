import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { UserAuthContext } from "@/lib/authorization";

const db = { listRows: mock() };
const createAdminClient = mock(async () => ({ db }));
const createSessionClient = mock(async () => ({ db }));

let currentCtx: UserAuthContext | null = null;

mock.module("@repo/api/server", () => ({
  createAdminClient,
  createSessionClient,
}));
mock.module("@/lib/authorization", () => ({
  getUserAuthContext: mock(async () => currentCtx),
}));

const { fetchPendingItems } = await import("./notifications");

function makeCtx(overrides: Partial<UserAuthContext>): UserAuthContext {
  return {
    activeCampusId: undefined,
    campusNames: [],
    campusTeamIds: [],
    departmentNames: [],
    departmentTeamIds: [],
    email: null,
    managedCampusIds: [],
    managedCampuses: [],
    name: null,
    resolvedCampusIds: [],
    resolvedDepartmentIds: [],
    roles: [],
    userId: "user-1",
    ...overrides,
  };
}

beforeEach(() => {
  createAdminClient.mockClear();
  createSessionClient.mockClear();
  db.listRows.mockReset();
  db.listRows.mockResolvedValue({ rows: [], total: 0 });
});

describe("fetchPendingItems", () => {
  test("a campus admin reads with the admin client and campus scope", async () => {
    currentCtx = makeCtx({
      managedCampusIds: ["campus-oslo"],
      resolvedCampusIds: ["campus-oslo"],
      roles: ["campusadmin"],
    });

    await fetchPendingItems();

    expect(createAdminClient).toHaveBeenCalled();
    expect(createSessionClient).not.toHaveBeenCalled();
    const eventCall = db.listRows.mock.calls.find((c) => c[1] === "events");
    const queries = JSON.stringify(eventCall?.[2]);
    expect(queries).toContain("campus-oslo");
  });

  test("a user without an approving role gets nothing and no client", async () => {
    currentCtx = makeCtx({ roles: ["department"] });

    await expect(fetchPendingItems()).resolves.toEqual([]);
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(createSessionClient).not.toHaveBeenCalled();
  });
});
