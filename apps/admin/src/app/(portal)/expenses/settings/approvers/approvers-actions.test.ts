import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import type { UserAuthContext } from "@/lib/authorization";

const db = {
  createRow: mock(),
  getRow: mock(),
  listRows: mock(),
  updateRow: mock(),
};

const baseCtx: UserAuthContext = {
  activeCampusId: undefined,
  campusNames: [],
  campusTeamIds: [],
  departmentNames: [],
  departmentTeamIds: [],
  email: "admin@example.com",
  managedCampuses: [],
  managedCampusIds: [],
  name: "Admin",
  resolvedCampusIds: [],
  resolvedDepartmentIds: [],
  roles: ["globaladmin"],
  userId: "user-1",
};
let ctx: UserAuthContext = baseCtx;
const campusAdminCtx: UserAuthContext = {
  ...baseCtx,
  managedCampusIds: ["1"],
  roles: ["campusadmin"],
};

const audit = mock(async () => undefined);
const graph = { getUser: mock() };
mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db })),
}));
mock.module("@/lib/it/graph", () => ({ getGraphService: () => graph }));
mock.module("@/lib/authorization", () => ({
  getUserAuthContext: mock(async () => ctx),
}));
mock.module("next/cache", () => ({ revalidatePath: mock(() => undefined) }));
mock.module("../../../_actions/audit-log", () => ({ logAuditEvent: audit }));

const { listApprovers, saveApprover, setApproverActive } = await import(
  "./approvers-actions"
);

const stored = (data: Record<string, unknown> = {}) => ({
  $id: "row-1",
  active: true,
  campus_id: "1",
  confirmed_at: "2026-11-01T00:00:00.000Z",
  department_id: "10",
  email: "old@biso.no",
  key: "dept:10:finance",
  role: "finance",
  scope: "department",
  source: "ai",
  ...data,
});

beforeEach(() => {
  ctx = baseCtx;
  for (const fn of [
    db.createRow,
    db.getRow,
    db.listRows,
    db.updateRow,
    audit,
    graph.getUser,
  ]) {
    fn.mockReset();
  }
  graph.getUser.mockResolvedValue(null);
  db.listRows.mockResolvedValue({ rows: [] });
  db.createRow.mockImplementation(async (_d, _t, id, data) => ({
    $id: id,
    ...data,
  }));
  db.updateRow.mockImplementation(async (_d, _t, id, data) => ({
    $id: id,
    ...data,
  }));
  db.getRow.mockImplementation((_d, table) =>
    table === "departments"
      ? Promise.resolve({ $id: "10", campus_id: "1", Name: "Marketing" })
      : Promise.reject(new Error("not found"))
  );
});

describe("saveApprover", () => {
  test("lowercases and keys the row", async () => {
    const result = await saveApprover({
      campusId: "1",
      departmentId: "10",
      displayName: " Kari ",
      email: "  Kari@BISO.no ",
      role: "finance",
      scope: "department",
    });
    expect("error" in result).toBe(false);
    const data = db.createRow.mock.calls[0]?.[3];
    expect(data).toMatchObject({
      active: true,
      campus_id: "1",
      department_id: "10",
      display_name: "Kari",
      email: "kari@biso.no",
      key: "dept:10:finance",
      role: "finance",
      scope: "department",
      source: "admin",
    });
    expect(audit).toHaveBeenCalled();
  });

  test("a non-biso email is refused", async () => {
    const result = await saveApprover({
      campusId: "1",
      departmentId: "10",
      email: "kari@gmail.com",
      role: "finance",
      scope: "department",
    });
    expect(result).toEqual({ error: "invalid_email" });
    expect(db.createRow).not.toHaveBeenCalled();
  });

  const editing = (data: Record<string, unknown>) => {
    const row = stored(data);
    db.getRow.mockImplementation(async (_d, table) =>
      table === "departments" ? { $id: "10", campus_id: "1" } : row
    );
    db.listRows.mockResolvedValue({ rows: [row] });
  };

  test("editing an AI row's email clears aad_id and confidence", async () => {
    editing({ aad_id: "aad-old", confidence: 0.92 });

    await saveApprover({
      campusId: "1",
      departmentId: "10",
      displayName: "",
      email: "new@biso.no",
      id: "row-1",
      role: "finance",
      scope: "department",
    });

    expect(db.updateRow.mock.calls[0]?.[3]).toMatchObject({
      aad_id: null,
      confidence: null,
      confirmed_at: null,
      email: "new@biso.no",
    });
  });

  test("a new email takes its Microsoft 365 id and name", async () => {
    editing({ aad_id: "aad-old", confidence: 0.92 });
    graph.getUser.mockResolvedValue({
      displayName: "Kari Nordmann",
      id: "aad-new",
    });

    await saveApprover({
      campusId: "1",
      departmentId: "10",
      email: "kari@biso.no",
      id: "row-1",
      role: "finance",
      scope: "department",
    });

    expect(graph.getUser).toHaveBeenCalledWith("kari@biso.no");
    expect(db.updateRow.mock.calls[0]?.[3]).toMatchObject({
      aad_id: "aad-new",
      confidence: null,
      display_name: "Kari Nordmann",
    });
  });

  test("a failed Microsoft 365 lookup still saves, with no account id", async () => {
    editing({ aad_id: "aad-old", confidence: 0.92 });
    graph.getUser.mockRejectedValue(new Error("graph down"));
    const warn = spyOn(console, "warn").mockImplementation(() => undefined);

    const result = await saveApprover({
      campusId: "1",
      departmentId: "10",
      displayName: "Kari",
      email: "kari@biso.no",
      id: "row-1",
      role: "finance",
      scope: "department",
    });

    expect("error" in result).toBe(false);
    expect(db.updateRow.mock.calls[0]?.[3]).toMatchObject({
      aad_id: null,
      display_name: "Kari",
    });
    warn.mockRestore();
  });

  test("an unchanged email keeps the account id and confidence", async () => {
    editing({ aad_id: "aad-old", confidence: 0.92 });

    await saveApprover({
      campusId: "1",
      departmentId: "10",
      email: "old@biso.no",
      id: "row-1",
      role: "finance",
      scope: "department",
    });

    const data = db.updateRow.mock.calls[0]?.[3];
    expect(data).not.toHaveProperty("aad_id");
    expect(data).not.toHaveProperty("confidence");
    expect(graph.getUser).not.toHaveBeenCalled();
  });

  test("a role change re-keys the stored row", async () => {
    const row = stored();
    db.getRow.mockImplementation(async (_d, table) =>
      table === "departments" ? { $id: "10", campus_id: "1" } : row
    );
    db.listRows.mockResolvedValue({ rows: [] });

    await saveApprover({
      campusId: "1",
      departmentId: "10",
      email: "old@biso.no",
      id: "row-1",
      role: "manager",
      scope: "department",
    });

    expect(db.createRow).not.toHaveBeenCalled();
    expect(db.updateRow.mock.calls[0]?.[2]).toBe("row-1");
    expect(db.updateRow.mock.calls[0]?.[3]).toMatchObject({
      key: "dept:10:manager",
      role: "manager",
    });
  });

  test("refuses a role another approver already holds", async () => {
    const row = stored();
    db.getRow.mockImplementation(async (_d, table) =>
      table === "departments" ? { $id: "10", campus_id: "1" } : row
    );
    db.listRows.mockResolvedValue({
      rows: [stored({ $id: "row-2", key: "dept:10:manager", role: "manager" })],
    });

    const result = await saveApprover({
      campusId: "1",
      departmentId: "10",
      email: "old@biso.no",
      id: "row-1",
      role: "manager",
      scope: "department",
    });

    expect(result).toEqual({ error: "role_taken" });
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  test("a campus admin cannot create a row on another campus", async () => {
    ctx = campusAdminCtx;
    db.getRow.mockImplementation(async (_d, table) =>
      table === "departments"
        ? { $id: "20", campus_id: "2" }
        : Promise.reject(new Error("not found"))
    );

    const result = await saveApprover({
      campusId: "2",
      departmentId: "20",
      email: "x@biso.no",
      role: "finance",
      scope: "department",
    });

    expect(result).toEqual({ error: "forbidden" });
    expect(db.createRow).not.toHaveBeenCalled();
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  test("refuses a role that does not fit the level", async () => {
    const campusFinance = await saveApprover({
      campusId: "1",
      email: "x@biso.no",
      role: "finance",
      scope: "campus",
    });
    const departmentController = await saveApprover({
      campusId: "1",
      departmentId: "10",
      email: "x@biso.no",
      role: "controller",
      scope: "department",
    });

    expect(campusFinance).toEqual({ error: "invalid_role" });
    expect(departmentController).toEqual({ error: "invalid_role" });
    expect(db.createRow).not.toHaveBeenCalled();
  });

  test("refuses an unknown campus and a national row off campus 5", async () => {
    const unknown = await saveApprover({
      campusId: "9",
      email: "x@biso.no",
      role: "controller",
      scope: "campus",
    });
    const nationalOnOslo = await saveApprover({
      campusId: "1",
      email: "x@biso.no",
      role: "national",
      scope: "campus",
    });
    const nationalOnNational = await saveApprover({
      campusId: "5",
      email: "x@biso.no",
      role: "national",
      scope: "campus",
    });

    expect(unknown).toEqual({ error: "invalid_campus" });
    expect(nationalOnOslo).toEqual({ error: "invalid_campus" });
    expect("error" in nationalOnNational).toBe(false);
  });

  test("a global admin can add the National controller", async () => {
    const result = await saveApprover({
      campusId: "5",
      email: "controller@biso.no",
      role: "controller",
      scope: "campus",
    });

    expect("error" in result).toBe(false);
  });

  test("a new row whose key exists updates that row", async () => {
    db.listRows.mockResolvedValue({ rows: [stored({ active: false })] });
    await saveApprover({
      campusId: "1",
      departmentId: "10",
      email: "new@biso.no",
      role: "finance",
      scope: "department",
    });
    expect(db.createRow).not.toHaveBeenCalled();
    expect(db.updateRow.mock.calls[0]?.[2]).toBe("row-1");
    expect(db.updateRow.mock.calls[0]?.[3]).toMatchObject({
      active: true,
      confirmed_at: null,
      email: "new@biso.no",
      source: "admin",
    });
  });

  test("editing keeps confirmed_at unless the email changes", async () => {
    db.getRow.mockImplementation(async (_d, table) =>
      table === "departments"
        ? { $id: "10", campus_id: "1" }
        : stored({ email: "same@biso.no" })
    );
    db.listRows.mockResolvedValue({
      rows: [stored({ email: "same@biso.no" })],
    });
    await saveApprover({
      campusId: "1",
      departmentId: "10",
      email: "SAME@biso.no",
      id: "row-1",
      role: "finance",
      scope: "department",
    });
    expect(db.updateRow.mock.calls[0]?.[3]).not.toHaveProperty("confirmed_at");
  });

  test("saveApprover refuses a crafted controller row from a campus admin", async () => {
    ctx = campusAdminCtx;
    const campusRow = await saveApprover({
      campusId: "1",
      email: "x@biso.no",
      role: "controller",
      scope: "campus",
    });
    const deptRow = await saveApprover({
      campusId: "1",
      departmentId: "10",
      email: "x@biso.no",
      role: "controller",
      scope: "department",
    });
    expect("error" in campusRow).toBe(true);
    expect("error" in deptRow).toBe(true);
    expect(db.createRow).not.toHaveBeenCalled();
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  test("a campus admin cannot overwrite a stored row of another campus", async () => {
    ctx = campusAdminCtx;
    db.getRow.mockImplementation(async (_d, table) =>
      table === "departments"
        ? { $id: "10", campus_id: "1" }
        : stored({ campus_id: "2" })
    );
    const result = await saveApprover({
      campusId: "1",
      departmentId: "10",
      email: "x@biso.no",
      id: "row-1",
      role: "finance",
      scope: "department",
    });
    expect("error" in result).toBe(true);
    expect(db.updateRow).not.toHaveBeenCalled();
  });
});

describe("listApprovers", () => {
  /** The approvers read's queries, one per line; undefined when not read. */
  const approverQueries = () =>
    (
      db.listRows.mock.calls.find(
        ([, table]) => table === "expense_approvers"
      )?.[2] as string[] | undefined
    )?.join("\n");
  const rows = (count: number) =>
    Array.from({ length: count }, (_, i) => stored({ $id: `row-${i}` }));

  test("a campus admin lists only the campuses they manage", async () => {
    ctx = campusAdminCtx;

    await listApprovers({ campusId: null, q: "", role: null });

    expect(approverQueries()).toContain(
      '{"method":"equal","attribute":"campus_id","values":["1"]}'
    );
  });

  test("a campus admin filtering another campus gets nothing", async () => {
    ctx = campusAdminCtx;

    const result = await listApprovers({ campusId: "2", q: "", role: null });

    expect(result).toEqual({ data: { capped: false, rows: [] } });
    expect(approverQueries()).toBeUndefined();
  });

  test("says when the list stops at the cap", async () => {
    db.listRows.mockImplementation(async (_d, table) => ({
      rows: table === "expense_approvers" ? rows(501) : [],
    }));

    const capped = await listApprovers({ campusId: null, q: "", role: null });

    expect(approverQueries()).toContain('"values":[501]');
    expect(capped).toMatchObject({ data: { capped: true } });
    expect("data" in capped && capped.data.rows).toHaveLength(500);

    db.listRows.mockImplementation(async (_d, table) => ({
      rows: table === "expense_approvers" ? rows(500) : [],
    }));
    expect(
      await listApprovers({ campusId: null, q: "", role: null })
    ).toMatchObject({ data: { capped: false } });
  });

  test("searches name, email and department in the query", async () => {
    db.listRows.mockImplementation(async (_d, table) => ({
      rows:
        table === "departments"
          ? [
              { $id: "10", Name: "OSL Kari's Club" },
              { $id: "11", Name: "OSL Marketing" },
            ]
          : [],
    }));

    await listApprovers({ campusId: null, q: " Kari ", role: null });

    const query = approverQueries();
    expect(query).toContain('"method":"or"');
    expect(query).toContain(
      '{"method":"contains","attribute":"email","values":["kari"]}'
    );
    expect(query).toContain(
      '{"method":"contains","attribute":"display_name","values":["Kari"]}'
    );
    expect(query).toContain(
      '{"method":"equal","attribute":"department_id","values":["10"]}'
    );
  });
});

describe("listApprovers department search", () => {
  test("a search matching 150 departments builds two equal clauses", async () => {
    ctx = baseCtx;
    db.listRows.mockImplementation(async (_d, table) => ({
      rows:
        table === "departments"
          ? Array.from({ length: 150 }, (_, i) => ({
              $id: `d${i}`,
              Name: "OSL Club",
            }))
          : [],
    }));

    const result = await listApprovers({
      campusId: null,
      q: "club",
      role: null,
    });

    expect("data" in result).toBe(true);
    const query = (
      db.listRows.mock.calls.find(
        ([, table]) => table === "expense_approvers"
      )?.[2] as string[]
    ).join("\n");
    expect(query.match(/"attribute":"department_id"/g)).toHaveLength(2);
  });
});

describe("setApproverActive", () => {
  test("setApproverActive refuses another campus", async () => {
    ctx = campusAdminCtx;
    db.getRow.mockResolvedValue(stored({ campus_id: "2" }));
    const result = await setApproverActive({ active: false, id: "row-1" });
    expect("error" in result).toBe(true);
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  test("a campus admin toggles a row of their campus", async () => {
    ctx = campusAdminCtx;
    db.getRow.mockResolvedValue(stored());
    const result = await setApproverActive({ active: false, id: "row-1" });
    expect("error" in result).toBe(false);
    expect(db.updateRow.mock.calls[0]?.[3]).toEqual({ active: false });
    expect(audit).toHaveBeenCalled();
  });
});
