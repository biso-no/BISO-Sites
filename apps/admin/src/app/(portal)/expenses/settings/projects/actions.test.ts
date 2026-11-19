import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import type { UserAuthContext } from "@/lib/authorization";

const db = { listRows: mock(), updateRow: mock() };
const logAuditEvent = mock(async () => undefined);
const runProjectSync = mock();

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
mock.module("@repo/shared/utils/finago-project-run", () => ({
  readProjectSyncState: mock(async () => null),
  runProjectSync,
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
  runProjectSync.mockReset();
  runProjectSync.mockResolvedValue({
    outcome: "ran",
    result: { partial: false, projects: 4 },
  });
});

describe("project settings actions", () => {
  test("only global admins can sync projects", async () => {
    currentCtx = { ...ctx, roles: ["campusadmin"] };

    expect(await syncProjectsFromFinago()).toEqual({ error: "forbidden" });
    expect(runProjectSync).not.toHaveBeenCalled();
  });

  test("a sync runs in manual mode with a budget under the page timeout", async () => {
    const result = await syncProjectsFromFinago();

    expect(result).toEqual({ data: { partial: false, projects: 4 } });
    const options = runProjectSync.mock.calls[0]?.[2];
    expect(options.mode).toBe("manual");
    expect(options.budgetMs).toBeLessThanOrEqual(20_000);
    expect(logAuditEvent).toHaveBeenCalledWith(ctx, "finago_projects.sync", {
      payload: { partial: false, projects: 4 },
      resourceType: "finago_projects",
    });
  });

  test("a sync that is already running says so and is not audited", async () => {
    runProjectSync.mockResolvedValue({ outcome: "skipped", reason: "busy" });

    expect(await syncProjectsFromFinago()).toEqual({ error: "in_progress" });
    expect(logAuditEvent).not.toHaveBeenCalled();
  });

  test("a failed sync returns an error and is not audited", async () => {
    const spy = spyOn(console, "error").mockImplementation(() => undefined);
    runProjectSync.mockRejectedValue(new Error("finago down"));

    expect(await syncProjectsFromFinago()).toEqual({ error: "failed" });
    expect(logAuditEvent).not.toHaveBeenCalled();
    spy.mockRestore();
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
    expect(logAuditEvent).toHaveBeenCalledWith(
      ctx,
      "finago_projects.event_date",
      {
        payload: { event_date: "2026-03-14T00:00:00.000Z" },
        resourceId: "p1",
        resourceType: "finago_projects",
      }
    );

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
