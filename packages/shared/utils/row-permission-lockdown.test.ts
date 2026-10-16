import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  auditStudentLinks,
  revokeOwnerWriteGrants,
  withoutOwnerWriteGrants,
} from "./row-permission-lockdown";

function page<T>(rows: T[]) {
  return { rows, total: rows.length };
}

describe("withoutOwnerWriteGrants", () => {
  it("drops per-user write grants and keeps reads and team grants", () => {
    expect(
      withoutOwnerWriteGrants([
        'read("user:u1")',
        'update("user:u1")',
        'delete("user:u1")',
        'write("user:u1")',
        'update("team:finance")',
        'read("any")',
      ])
    ).toEqual(['read("user:u1")', 'update("team:finance")', 'read("any")']);
  });
});

describe("revokeOwnerWriteGrants", () => {
  const db = { listRows: vi.fn(), updateRow: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    db.updateRow.mockResolvedValue({});
  });

  it("reports what it would change without writing in a dry run", async () => {
    db.listRows.mockResolvedValueOnce(
      page([
        { $id: "e1", $permissions: ['read("user:u1")', 'update("user:u1")'] },
        { $id: "e2", $permissions: ['read("user:u2")'] },
      ])
    );

    const report = await revokeOwnerWriteGrants(db, "expense", {
      apply: false,
    });

    expect(report).toEqual({
      changed: [{ removed: ['update("user:u1")'], rowId: "e1" }],
      errors: [],
      scanned: 2,
    });
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  it("pages through every row and rewrites only rows that change", async () => {
    const fullPage = Array.from({ length: 100 }, (_, index) => ({
      $id: `e${index}`,
      $permissions: ['read("user:u")'],
    }));
    db.listRows.mockResolvedValueOnce(page(fullPage)).mockResolvedValueOnce(
      page([
        {
          $id: "e100",
          $permissions: ['read("user:u")', 'delete("user:u")'],
        },
      ])
    );

    const report = await revokeOwnerWriteGrants(db, "user", { apply: true });

    expect(report.scanned).toBe(101);
    expect(db.listRows).toHaveBeenCalledTimes(2);
    expect(db.updateRow).toHaveBeenCalledTimes(1);
    expect(db.updateRow).toHaveBeenCalledWith({
      databaseId: "app",
      permissions: ['read("user:u")'],
      rowId: "e100",
      tableId: "user",
    });
  });

  it("records a failed write and carries on", async () => {
    db.listRows.mockResolvedValueOnce(
      page([
        { $id: "e1", $permissions: ['update("user:u1")'] },
        { $id: "e2", $permissions: ['update("user:u2")'] },
      ])
    );
    db.updateRow
      .mockRejectedValueOnce(new Error("rate limited"))
      .mockResolvedValueOnce({});

    const report = await revokeOwnerWriteGrants(db, "expense", {
      apply: true,
    });

    expect(report.errors).toEqual([{ message: "rate limited", rowId: "e1" }]);
    expect(db.updateRow).toHaveBeenCalledTimes(2);
  });

  it("handles exact multiple of 100 rows across pages", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      $id: `e${index}`,
      $permissions: ['read("user:u")'],
    }));
    db.listRows
      .mockResolvedValueOnce(page(firstPage))
      .mockResolvedValueOnce(page([]));

    const report = await revokeOwnerWriteGrants(db, "expense", {
      apply: false,
    });

    expect(report.scanned).toBe(100);
    expect(db.listRows).toHaveBeenCalledTimes(2);
  });
});

describe("auditStudentLinks", () => {
  const db = { listRows: vi.fn(), updateRow: vi.fn() };
  const users = { listIdentities: vi.fn() };
  const verified = (studentId: string) => ({
    identities: [
      {
        provider: "oidc",
        providerEmail: `${studentId}@bi.no`,
        providerUid: `${studentId}@bi.no`,
      },
    ],
  });

  beforeEach(() => {
    vi.clearAllMocks();
    db.updateRow.mockResolvedValue({});
  });

  it("reports unverified links and duplicates, clearing nothing in a dry run", async () => {
    db.listRows.mockResolvedValueOnce(
      page([
        { $id: "u1", $permissions: [], student_id: "s1" },
        { $id: "u2", $permissions: [], student_id: "s1" },
        { $id: "u3", $permissions: [], student_id: "s2" },
      ])
    );
    users.listIdentities
      .mockResolvedValueOnce(verified("s1"))
      .mockResolvedValueOnce(verified("s1"))
      .mockResolvedValueOnce({ identities: [] });

    const report = await auditStudentLinks(db, users, {
      clearUnverified: false,
    });

    expect(report.unverified).toEqual([{ rowId: "u3", studentId: "s2" }]);
    expect(report.duplicates).toEqual([
      { rowIds: ["u1", "u2"], studentId: "s1" },
    ]);
    expect(report.cleared).toEqual([]);
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  it("clears the link columns on unverified rows when asked", async () => {
    db.listRows.mockResolvedValueOnce(
      page([{ $id: "u3", $permissions: [], student_id: "s2" }])
    );
    users.listIdentities.mockResolvedValueOnce({ identities: [] });

    const report = await auditStudentLinks(db, users, {
      clearUnverified: true,
    });

    expect(report.cleared).toEqual(["u3"]);
    expect(db.updateRow).toHaveBeenCalledWith({
      data: {
        bi_campus_id: null,
        bi_employee_id: null,
        bi_linked_at: null,
        student_id: null,
      },
      databaseId: "app",
      rowId: "u3",
      tableId: "user",
    });
  });

  it("records listIdentities failure and carries on", async () => {
    db.listRows.mockResolvedValueOnce(
      page([
        { $id: "u1", $permissions: [], student_id: "s1" },
        { $id: "u2", $permissions: [], student_id: "s2" },
      ])
    );
    users.listIdentities
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce({ identities: [] });

    const report = await auditStudentLinks(db, users, {
      clearUnverified: false,
    });

    expect(report.errors).toEqual([{ message: "network error", rowId: "u1" }]);
    expect(report.unverified).toEqual([{ rowId: "u2", studentId: "s2" }]);
    expect(report.cleared).toEqual([]);
  });

  it("records clearing failure and carries on", async () => {
    db.listRows.mockResolvedValueOnce(
      page([
        { $id: "u1", $permissions: [], student_id: "s1" },
        { $id: "u2", $permissions: [], student_id: "s2" },
      ])
    );
    users.listIdentities
      .mockResolvedValueOnce({ identities: [] })
      .mockResolvedValueOnce({ identities: [] });
    db.updateRow
      .mockRejectedValueOnce(new Error("permission denied"))
      .mockResolvedValueOnce({});

    const report = await auditStudentLinks(db, users, {
      clearUnverified: true,
    });

    expect(report.errors).toEqual([
      { message: "permission denied", rowId: "u1" },
    ]);
    expect(report.cleared).toEqual(["u2"]);
  });
});
