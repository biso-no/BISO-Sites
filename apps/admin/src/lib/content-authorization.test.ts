import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Query } from "@repo/api";
import type { UserAuthContext } from "./authorization";
import {
  applyContentRelationshipScopeQueries,
  assertContentOwnership,
  getContentOwnership,
  relationId,
} from "./content-authorization";

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

const globalAdmin = makeCtx({ roles: ["globaladmin"] });
const campusAdmin = makeCtx({
  campusNames: ["Oslo"],
  campusTeamIds: ["sg-app-campus-oslo"],
  managedCampuses: ["Oslo"],
  managedCampusIds: ["1"],
  resolvedCampusIds: ["1"],
  roles: ["campusadmin"],
});
const departmentUser = makeCtx({
  campusNames: ["Oslo"],
  departmentNames: ["Sosialutvalget"],
  departmentTeamIds: ["sg-app-dept-sosialutvalget"],
  resolvedCampusIds: ["1"],
  resolvedDepartmentIds: ["dept-1"],
});

const getRow = mock((..._args: unknown[]) =>
  Promise.resolve<Record<string, unknown>>({
    $id: "dept-1",
    campus: { $id: "1" },
  })
);
const db = { getRow } as unknown as Parameters<
  typeof assertContentOwnership
>[0];

beforeEach(() => {
  getRow.mockReset();
  getRow.mockResolvedValue({ $id: "dept-1", campus: { $id: "1" } });
});

describe("relationId", () => {
  test("returns a plain string id unchanged", () => {
    expect(relationId("dept-1")).toBe("dept-1");
  });

  test("extracts $id from a related row object", () => {
    expect(relationId({ $id: "dept-1" })).toBe("dept-1");
  });

  test("returns null for null and undefined", () => {
    expect(relationId(null)).toBeNull();
    expect(relationId(undefined)).toBeNull();
  });
});

describe("getContentOwnership", () => {
  test("prefers relationship values over legacy scalars", () => {
    expect(
      getContentOwnership(
        {
          campus: { $id: "1" },
          campus_id: "9",
          department: "dept-1",
          department_id: "dept-9",
        },
        { legacyFallback: true }
      )
    ).toEqual({ campus: "1", department: "dept-1" });
  });

  test("falls back to legacy scalars only when asked", () => {
    const row = { campus_id: "1", department_id: "dept-1" };
    expect(getContentOwnership(row)).toEqual({
      campus: null,
      department: null,
    });
    expect(getContentOwnership(row, { legacyFallback: true })).toEqual({
      campus: "1",
      department: "dept-1",
    });
  });

  test("supports the webshop departmentId legacy spelling", () => {
    expect(
      getContentOwnership(
        { campus_id: "1", departmentId: "dept-1" },
        { legacyFallback: true }
      )
    ).toEqual({ campus: "1", department: "dept-1" });
  });
});

describe("applyContentRelationshipScopeQueries", () => {
  test("global admin is unscoped", () => {
    expect(applyContentRelationshipScopeQueries(globalAdmin)).toEqual([]);
  });

  test("campus admin filters on the campus relationship", () => {
    expect(applyContentRelationshipScopeQueries(campusAdmin)).toEqual([
      Query.equal("campus.$id", ["1"]),
    ]);
  });

  test("department user filters on both relationship paths", () => {
    expect(applyContentRelationshipScopeQueries(departmentUser)).toEqual([
      Query.equal("campus.$id", ["1"]),
      Query.equal("department.$id", ["dept-1"]),
    ]);
  });
});

describe("assertContentOwnership", () => {
  test("department user passes for their own campus and department", async () => {
    await expect(
      assertContentOwnership(db, departmentUser, {
        allowGlobalCampus: false,
        campusId: "1",
        departmentId: "dept-1",
      })
    ).resolves.toBeUndefined();
  });

  test("verifies the department through the admin reader", async () => {
    await assertContentOwnership(db, departmentUser, {
      allowGlobalCampus: false,
      campusId: "1",
      departmentId: "dept-1",
    });
    expect(getRow).toHaveBeenCalledWith("app", "departments", "dept-1", [
      Query.select(["$id", "campus.$id"]),
    ]);
  });

  test("rejects a department that belongs to another campus", async () => {
    getRow.mockResolvedValue({ $id: "dept-1", campus: { $id: "2" } });
    await expect(
      assertContentOwnership(db, campusAdmin, {
        allowGlobalCampus: false,
        campusId: "1",
        departmentId: "dept-1",
      })
    ).rejects.toThrow("Department does not belong to the selected campus");
  });

  test("department user cannot omit the department", async () => {
    await expect(
      assertContentOwnership(db, departmentUser, {
        allowGlobalCampus: false,
        campusId: "1",
        departmentId: null,
      })
    ).rejects.toThrow("Unauthorized: no write access to this department");
  });

  test("department user cannot use another department", async () => {
    getRow.mockResolvedValue({ $id: "dept-other", campus: { $id: "1" } });
    await expect(
      assertContentOwnership(db, departmentUser, {
        allowGlobalCampus: false,
        campusId: "1",
        departmentId: "dept-other",
      })
    ).rejects.toThrow("Unauthorized: no write access to this department");
  });

  test("department user cannot use a department in another campus", async () => {
    getRow.mockResolvedValue({ $id: "dept-2", campus: { $id: "2" } });
    await expect(
      assertContentOwnership(db, departmentUser, {
        allowGlobalCampus: false,
        campusId: "2",
        departmentId: "dept-2",
      })
    ).rejects.toThrow();
  });

  test("campus admin may leave the department empty", async () => {
    await expect(
      assertContentOwnership(db, campusAdmin, {
        allowGlobalCampus: false,
        campusId: "1",
        departmentId: null,
      })
    ).resolves.toBeUndefined();
    expect(getRow).not.toHaveBeenCalled();
  });

  test("campus admin may attach a department in a managed campus", async () => {
    await expect(
      assertContentOwnership(db, campusAdmin, {
        allowGlobalCampus: false,
        campusId: "1",
        departmentId: "dept-1",
      })
    ).resolves.toBeUndefined();
  });

  test("non-global users cannot clear the campus", async () => {
    await expect(
      assertContentOwnership(db, campusAdmin, {
        allowGlobalCampus: true,
        campusId: null,
        departmentId: null,
      })
    ).rejects.toThrow("Unauthorized: campus is required for this content");
  });

  test("global admin may clear the campus only where supported", async () => {
    await expect(
      assertContentOwnership(db, globalAdmin, {
        allowGlobalCampus: true,
        campusId: null,
        departmentId: null,
      })
    ).resolves.toBeUndefined();
    await expect(
      assertContentOwnership(db, globalAdmin, {
        allowGlobalCampus: false,
        campusId: null,
        departmentId: null,
      })
    ).rejects.toThrow("Unauthorized: campus is required for this content");
  });

  test("department-owned content always requires a campus", async () => {
    await expect(
      assertContentOwnership(db, globalAdmin, {
        allowGlobalCampus: true,
        campusId: null,
        departmentId: "dept-1",
      })
    ).rejects.toThrow("Unauthorized: department content requires a campus");
  });

  test("fails closed when the department lookup fails", async () => {
    getRow.mockRejectedValue(new Error("network down"));
    await expect(
      assertContentOwnership(db, campusAdmin, {
        allowGlobalCampus: false,
        campusId: "1",
        departmentId: "dept-1",
      })
    ).rejects.toThrow("Unauthorized: department could not be verified");
  });

  test("fails closed when the department row is missing", async () => {
    getRow.mockResolvedValue(null as unknown as Record<string, unknown>);
    await expect(
      assertContentOwnership(db, campusAdmin, {
        allowGlobalCampus: false,
        campusId: "1",
        departmentId: "dept-1",
      })
    ).rejects.toThrow("Unauthorized: department could not be verified");
  });
});
