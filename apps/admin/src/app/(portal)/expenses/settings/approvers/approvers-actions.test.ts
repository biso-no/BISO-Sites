import { beforeEach, describe, expect, mock, test } from "bun:test";
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
mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db })),
}));
mock.module("@/lib/authorization", () => ({
  getUserAuthContext: mock(async () => ctx),
}));
mock.module("next/cache", () => ({ revalidatePath: mock(() => undefined) }));
mock.module("../../../_actions/audit-log", () => ({ logAuditEvent: audit }));

const { saveApprover, setApproverActive } = await import("./approvers-actions");

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
  ]) {
    fn.mockReset();
  }
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
    expect("error" in result).toBe(true);
    expect(db.createRow).not.toHaveBeenCalled();
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
