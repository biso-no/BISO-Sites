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

const { getProjectsView, setProjectEventDate, syncProjectsFromFinago } =
  await import("./actions");

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

  test("the view lists active projects with the event date in use", async () => {
    const tables: Record<string, unknown[]> = {
      departments: [{ $id: "d1", Name: "Oslo KD" }],
      finago_project_usage: [{ department_id: "d1", project_id: "k26" }],
      finago_projects: [
        {
          $id: "r25",
          active: false,
          event_date: null,
          line_count: 40,
          name: "KD 2025",
          peak_date: "2025-09-28T00:00:00.000+00:00",
          project_id: "k25",
          series: "kd",
          year: 2025,
        },
        {
          $id: "r26",
          active: true,
          event_date: null,
          line_count: 30,
          name: "KD 2026",
          peak_date: "2026-03-20T00:00:00.000+00:00",
          project_id: "k26",
          series: "kd",
          year: 2026,
        },
      ],
    };
    db.listRows.mockImplementation(async (_db: string, table: string) => ({
      rows: tables[table] ?? [],
    }));

    const view = await getProjectsView();

    expect(view.groups).toHaveLength(1);
    expect(view.groups[0]?.projects).toEqual([
      expect.objectContaining({
        departments: [{ id: "d1", name: "Oslo KD" }],
        effectiveDate: "2026-09-28",
        effectiveSource: "bookings",
        eventDate: null,
        id: "r26",
        name: "KD 2026",
      }),
    ]);
  });

  test("a date that is not a real day is refused", async () => {
    expect(await setProjectEventDate("p1", "2026-02-31")).toEqual({
      error: "invalid_date",
    });
    expect(db.updateRow).not.toHaveBeenCalled();
  });
});
