import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { UserAuthContext } from "@/lib/authorization";
import type { DocumentMetadataFormValues } from "./schemas";

const db = {
  createRow: mock(),
  deleteRow: mock(),
  getRow: mock(),
  listRows: mock(),
  updateRow: mock(),
  upsertRow: mock(),
};

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

const departmentCtx = makeCtx({
  campusNames: ["Oslo"],
  departmentNames: ["Sosialutvalget"],
  departmentTeamIds: ["sg-app-dept-sosialutvalget"],
  resolvedCampusIds: ["campus-oslo"],
  resolvedDepartmentIds: ["dept-1"],
});
const campusAdminCtx = makeCtx({
  campusNames: ["Oslo"],
  campusTeamIds: ["sg-app-campus-oslo"],
  managedCampuses: ["Oslo"],
  managedCampusIds: ["campus-oslo"],
  resolvedCampusIds: ["campus-oslo"],
  roles: ["campusadmin"],
});
const globalAdminCtx = makeCtx({ roles: ["globaladmin"] });

let currentCtx: UserAuthContext = departmentCtx;

const departmentValues: DocumentMetadataFormValues = {
  campus_id: "campus-oslo",
  category: "campus-bylaws",
  department_id: "dept-1",
  description: null,
  language: "no",
  scope: "campus",
  sort_order: 0,
  status: "draft",
  title: "Vedtekter",
  version: null,
  version_number: 1,
};

mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db })),
  createSessionClient: mock(async () => ({ db })),
}));
mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => currentCtx),
}));
mock.module("@repo/connectors/sharepoint", () => ({
  getSharePointConfig: mock(() => ({})),
  SharePointService: class SharePointService {},
}));
mock.module("next/cache", () => ({
  revalidatePath: mock(() => undefined),
}));
mock.module("./audit-log", () => ({
  logAuditEvent: mock(async () => undefined),
}));

const { deleteDocument, getDocument, updateDocumentMetadata } = await import(
  "./documents"
);

function mockDocumentRow(row: Record<string, unknown> | null): void {
  db.listRows.mockImplementation(
    async (_databaseId: string, tableId: string) => {
      if (tableId === "documents") {
        return { rows: row ? [row] : [], total: row ? 1 : 0 };
      }
      return { rows: [], total: 0 };
    }
  );
}

const SHAREPOINT_FIELDS = {
  file_size: 1234,
  sharepoint_drive_id: "drive-1",
  sharepoint_item_id: "item-1",
  sharepoint_web_url: "https://example.sharepoint.com/doc",
};

beforeEach(() => {
  currentCtx = departmentCtx;
  db.createRow.mockReset();
  db.deleteRow.mockReset();
  db.getRow.mockReset();
  db.listRows.mockReset();
  db.updateRow.mockReset();
  db.upsertRow.mockReset();

  db.getRow.mockImplementation(
    async (_databaseId: string, tableId: string, rowId: string) => {
      if (tableId === "departments") {
        return { $id: rowId, campus: { $id: "campus-oslo" } };
      }
      throw new Error(`Unexpected getRow for ${tableId}`);
    }
  );
  db.updateRow.mockImplementation(
    async (
      _databaseId: string,
      _tableId: string,
      rowId: string,
      data: Record<string, unknown>
    ) => ({ $id: rowId, ...data })
  );
  db.deleteRow.mockImplementation(async () => undefined);
  db.listRows.mockResolvedValue({ rows: [], total: 0 });
});

describe("document ownership persistence", () => {
  test("updateDocumentMetadata persists both ownership relationships", async () => {
    mockDocumentRow({
      $id: "doc-1",
      ...SHAREPOINT_FIELDS,
      campus: { $id: "campus-oslo" },
      department: { $id: "dept-1" },
      status: "draft",
      version_number: 1,
    });

    const result = await updateDocumentMetadata("doc-1", departmentValues);

    expect(result).toEqual({ data: "doc-1" });
    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "documents",
      "doc-1",
      expect.objectContaining({
        campus: "campus-oslo",
        campus_id: "campus-oslo",
        department: "dept-1",
        // SharePoint metadata is not rewritten by metadata updates.
        title: "Vedtekter",
      })
    );
    const payload = db.updateRow.mock.calls[0]?.[3] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("sharepoint_item_id");
    expect(payload).not.toHaveProperty("sharepoint_drive_id");
  });

  test("department author cannot move a document to another department", async () => {
    mockDocumentRow({
      $id: "doc-1",
      ...SHAREPOINT_FIELDS,
      campus: { $id: "campus-oslo" },
      department: { $id: "dept-1" },
      status: "draft",
      version_number: 1,
    });

    await expect(
      updateDocumentMetadata("doc-1", {
        ...departmentValues,
        department_id: "dept-other",
      })
    ).rejects.toThrow("Unauthorized: no write access to this department");
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  test("campus-wide documents stay open to campus admins only", async () => {
    currentCtx = campusAdminCtx;
    mockDocumentRow({
      $id: "doc-1",
      ...SHAREPOINT_FIELDS,
      campus: { $id: "campus-oslo" },
      department: null,
      status: "draft",
      version_number: 1,
    });

    const result = await updateDocumentMetadata("doc-1", {
      ...departmentValues,
      department_id: null,
    });

    expect(result).toEqual({ data: "doc-1" });
  });

  test("national documents remain global-admin only", async () => {
    currentCtx = campusAdminCtx;
    mockDocumentRow({
      $id: "doc-1",
      ...SHAREPOINT_FIELDS,
      campus: null,
      campus_id: null,
      department: null,
      status: "draft",
      version_number: 1,
    });

    const denied = await updateDocumentMetadata("doc-1", {
      ...departmentValues,
      campus_id: null,
      department_id: null,
      scope: "national",
    });
    expect(denied).toEqual({
      error: "Only global admins can manage national documents",
    });

    currentCtx = globalAdminCtx;
    const allowed = await updateDocumentMetadata("doc-1", {
      ...departmentValues,
      campus_id: null,
      department_id: null,
      scope: "national",
    });
    expect(allowed).toEqual({ data: "doc-1" });
  });

  test("getDocument hides rows outside the relationship scope", async () => {
    mockDocumentRow({
      $id: "doc-1",
      campus: { $id: "campus-bergen" },
      department: { $id: "dept-9" },
      status: "published",
    });

    await expect(getDocument("doc-1")).resolves.toBeNull();
  });

  test("deleteDocument refuses rows outside the relationship scope", async () => {
    mockDocumentRow({
      $id: "doc-1",
      campus: { $id: "campus-bergen" },
      department: { $id: "dept-9" },
      status: "draft",
    });

    await expect(deleteDocument("doc-1")).rejects.toThrow(
      "Unauthorized: no access to this campus"
    );
    expect(db.deleteRow).not.toHaveBeenCalled();
  });
});
