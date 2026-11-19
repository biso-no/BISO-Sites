import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { UserAuthContext } from "@/lib/authorization";

const db = { listRows: mock(), updateRow: mock() };
const logAuditEvent = mock(async () => undefined);
const syncFinagoProjects = mock();

const ctx: UserAuthContext = {
  activeCampusId: undefined,
  campusNames: [],
  campusTeamIds: [],
  departmentNames: [],
  departmentTeamIds: [],
  email: "admin@example.com",
  managedCampusIds: [],
  managedCampuses: [],
  name: "Admin",
  resolvedCampusIds: [],
  resolvedDepartmentIds: [],
  roles: ["globaladmin"],
  userId: "user-1",
};
let currentCtx: UserAuthContext = ctx;

mock.module("server-only", () => ({}));
mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db })),
}));
mock.module("@/lib/authorization", () => ({
  getUserAuthContext: mock(async () => currentCtx),
}));
mock.module("@repo/shared/utils/finago-project-sync", () => ({
  syncFinagoProjects,
}));
mock.module("@repo/connectors/24sevenoffice", () => ({
  getProjects: mock(),
  listCostLines: mock(),
}));
mock.module("next/cache", () => ({ revalidatePath: mock(() => undefined) }));
mock.module("../../../_actions/audit-log", () => ({ logAuditEvent }));

const { setProjectEventDate, syncProjectsFromFinago } = await import(
  "./actions"
);

beforeEach(() => {
  currentCtx = ctx;
  db.updateRow.mockReset();
  db.updateRow.mockResolvedValue({});
  logAuditEvent.mockClear();
  syncFinagoProjects.mockReset();
  syncFinagoProjects.mockResolvedValue({ partial: false, projects: 4 });
});

describe("project settings actions", () => {
  test("only global admins can sync projects", async () => {
    currentCtx = { ...ctx, roles: ["campusadmin"] };

    expect(await syncProjectsFromFinago()).toEqual({ error: "forbidden" });
    expect(syncFinagoProjects).not.toHaveBeenCalled();
  });

  test("a sync runs with a budget that fits the page timeout", async () => {
    const result = await syncProjectsFromFinago();

    expect(result).toEqual({ data: { partial: false, projects: 4 } });
    const deps = syncFinagoProjects.mock.calls[0]?.[1];
    expect(deps.budgetMs).toBeLessThanOrEqual(25_000);
  });

  test("only global admins can set an event date", async () => {
    currentCtx = { ...ctx, roles: ["department"] };

    expect(await setProjectEventDate("p1", "2026-03-14")).toEqual({
      error: "forbidden",
    });
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  test("an event date is stored and audited", async () => {
    expect(await setProjectEventDate("p1", "2026-03-14")).toEqual({
      data: null,
    });
    expect(db.updateRow).toHaveBeenCalledWith("app", "finago_projects", "p1", {
      event_date: "2026-03-14T00:00:00.000Z",
    });
    expect(logAuditEvent).toHaveBeenCalledTimes(1);

    expect(await setProjectEventDate("p1", null)).toEqual({ data: null });
    expect(db.updateRow).toHaveBeenLastCalledWith(
      "app",
      "finago_projects",
      "p1",
      { event_date: null }
    );
  });

  test("a date that is not a real day is refused", async () => {
    expect(await setProjectEventDate("p1", "2026-02-31")).toEqual({
      error: "invalid_date",
    });
    expect(db.updateRow).not.toHaveBeenCalled();
  });
});
