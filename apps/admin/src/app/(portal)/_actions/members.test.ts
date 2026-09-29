import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { UserAuthContext } from "@/lib/authorization";

const campusAdminCtx: UserAuthContext = {
  activeCampusId: undefined,
  campusNames: [],
  campusTeamIds: [],
  departmentNames: [],
  departmentTeamIds: [],
  email: "leder@biso.no",
  managedCampuses: ["Oslo"],
  managedCampusIds: ["1"],
  name: "Kari Leder",
  resolvedCampusIds: ["1"],
  resolvedDepartmentIds: [],
  roles: ["campusadmin"],
  userId: "staff-1",
};
const globalAdminCtx: UserAuthContext = {
  ...campusAdminCtx,
  managedCampuses: [],
  managedCampusIds: [],
  roles: ["globaladmin"],
  userId: "global-1",
};
let ctx: UserAuthContext = globalAdminCtx;

const db = { listRows: mock() };
const functions = { createExecution: mock(), listExecutions: mock() };
// bun module mocks are process-wide; keep `users` so other action tests that
// share this module shape still find it.
const users = { create: mock(), get: mock(), list: mock() };

mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => ctx),
  requireNavAccess: mock(async () => ctx),
}));
mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db, functions, users })),
}));

const { listRosterMembers, refreshMemberRoster } = await import("./members");

function executions(...statuses: string[]) {
  return {
    executions: statuses.map((status) => ({
      $updatedAt: "2026-09-29T03:00:00.000Z",
      responseStatusCode: 200,
      status,
    })),
    total: statuses.length,
  };
}

beforeEach(() => {
  ctx = globalAdminCtx;
  process.env.MEMBER_ROSTER_FUNCTION_ID = "member-roster-sync";
  for (const fn of [...Object.values(db), ...Object.values(functions)]) {
    fn.mockReset();
  }
});

describe("refreshMemberRoster", () => {
  test("does not start a second run while one is processing", async () => {
    functions.listExecutions.mockResolvedValue(executions("processing"));
    expect(await refreshMemberRoster()).toEqual({
      ok: false,
      reason: "already-running",
    });
    expect(functions.createExecution).not.toHaveBeenCalled();
  });

  test("starts an async execution when idle", async () => {
    functions.listExecutions.mockResolvedValue(executions("completed"));
    expect(await refreshMemberRoster()).toEqual({ ok: true });
    expect(functions.createExecution).toHaveBeenCalledWith({
      async: true,
      functionId: "member-roster-sync",
    });
  });

  test("campus admins cannot start a run", async () => {
    ctx = campusAdminCtx;
    expect(await refreshMemberRoster()).toEqual({
      ok: false,
      reason: "forbidden",
    });
    expect(functions.createExecution).not.toHaveBeenCalled();
  });

  test("reports not-configured without the function id", async () => {
    delete process.env.MEMBER_ROSTER_FUNCTION_ID;
    expect(await refreshMemberRoster()).toEqual({
      ok: false,
      reason: "not-configured",
    });
  });
});

describe("listRosterMembers", () => {
  const params = { page: 1, q: "", size: 25 as const };

  function rosterQueries(): string[] {
    const call = db.listRows.mock.calls.find(
      (c) => (c as unknown[])[1] === "member_roster"
    ) as unknown[];
    return call[2] as string[];
  }

  beforeEach(() => {
    db.listRows.mockImplementation(async (_db: string, table: string) =>
      table === "campus"
        ? { rows: [{ $id: "1", name: "Oslo" }], total: 1 }
        : {
            rows: [
              {
                $id: "3975",
                campus_id: "1",
                email: null,
                expiry_date: "2026-12-31",
                membership_name: "Semester",
                name: "Ada",
              },
            ],
            total: 1,
          }
    );
  });

  test("scopes a campus admin to their managed campuses", async () => {
    ctx = campusAdminCtx;
    await listRosterMembers(params);
    const campusFilter = rosterQueries().find((q) => q.includes("campus_id"));
    expect(campusFilter).toBeDefined();
    expect(JSON.parse(campusFilter as string)).toMatchObject({
      attribute: "campus_id",
      method: "equal",
      values: ["1"],
    });
  });

  test("global admins see every campus, including unknown", async () => {
    await listRosterMembers(params);
    expect(rosterQueries().some((q) => q.includes("campus_id"))).toBe(false);
  });

  test("maps rows with the campus name", async () => {
    const result = await listRosterMembers(params);
    expect(result.rows).toEqual([
      {
        campusId: "1",
        campusName: "Oslo",
        email: null,
        expiryDate: "2026-12-31",
        id: "3975",
        name: "Ada",
        planName: "Semester",
      },
    ]);
    expect(result.total).toBe(1);
  });
});
