import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { UserAuthContext } from "@/lib/authorization";
import type { NewsFormValues } from "./schemas";

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

let currentCtx: UserAuthContext = departmentCtx;

const departmentValues: NewsFormValues = {
  author: "BISO",
  campus_id: "campus-oslo",
  category: "announcement",
  department_id: "dept-1",
  description_en: "",
  description_no: "<p>Norsk brødtekst</p>",
  image: "",
  slug: "student-news",
  status: "draft",
  sticky: false,
  title_en: "",
  title_no: "Norsk tittel",
};

mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db })),
  createSessionClient: mock(async () => ({ db })),
}));
mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => currentCtx),
}));
mock.module("@/lib/recruitment", () => ({
  loadRecruitmentLookups: mock(async () => ({
    campusIdsByName: new Map([["Oslo", "campus-oslo"]]),
    campusNamesById: new Map([["campus-oslo", "Oslo"]]),
    departmentIdsByName: new Map([["Sosialutvalget", "dept-1"]]),
    departmentNamesById: new Map([["dept-1", "Sosialutvalget"]]),
  })),
}));
mock.module("next/cache", () => ({
  revalidatePath: mock(() => undefined),
}));
mock.module("./audit-log", () => ({
  logAuditEvent: mock(async () => undefined),
}));

const { createNews, deleteNews, getNewsArticle, updateNews } = await import(
  "./news"
);

beforeEach(() => {
  currentCtx = departmentCtx;
  db.createRow.mockReset();
  db.deleteRow.mockReset();
  db.getRow.mockReset();
  db.listRows.mockReset();
  db.updateRow.mockReset();
  db.upsertRow.mockReset();

  db.getRow.mockImplementation(
    (_databaseId: string, tableId: string, rowId: string) => {
      if (tableId === "departments") {
        return { $id: rowId, campus: { $id: "campus-oslo" } };
      }
      throw new Error(`Unexpected getRow for ${tableId}`);
    }
  );
  db.upsertRow.mockImplementation(
    async (
      _databaseId: string,
      _tableId: string,
      rowId: string,
      data: Record<string, unknown>
    ) => ({ $id: rowId, ...data })
  );
  db.listRows.mockResolvedValue({ rows: [], total: 0 });
  db.deleteRow.mockImplementation(async () => undefined);
});

describe("news relationship persistence", () => {
  test("createNews persists ownership and the nested source locale", async () => {
    const result = await createNews(departmentValues);

    expect(result).toEqual({ data: expect.any(String) });
    expect(db.upsertRow).toHaveBeenCalledWith(
      "app",
      "news",
      expect.any(String),
      expect.objectContaining({
        campus: "campus-oslo",
        department: "dept-1",
        translation_refs: expect.arrayContaining([
          expect.objectContaining({
            $permissions: expect.any(Array),
            content_type: "news",
            locale: "no",
          }),
        ]),
      }),
      expect.any(Array)
    );
    expect(db.createRow).not.toHaveBeenCalled();
  });

  test("updateNews keeps an existing locale child by id", async () => {
    db.listRows.mockImplementation(
      async (_databaseId: string, tableId: string) => ({
        rows:
          tableId === "news"
            ? [
                {
                  $id: "news-1",
                  campus: { $id: "campus-oslo" },
                  department: { $id: "dept-1" },
                  status: "draft",
                },
              ]
            : [
                {
                  $id: "translation-no",
                  content_id: "news-1",
                  locale: "no",
                  title: "Gammel tittel",
                },
              ],
        total: 1,
      })
    );

    const result = await updateNews("news-1", departmentValues);

    expect(result).toEqual({ data: "news-1" });
    expect(db.upsertRow).toHaveBeenCalledWith(
      "app",
      "news",
      "news-1",
      expect.objectContaining({
        campus: "campus-oslo",
        department: "dept-1",
        translation_refs: [
          expect.objectContaining({
            $id: "translation-no",
            locale: "no",
            title: "Norsk tittel",
          }),
        ],
      }),
      expect.any(Array)
    );
  });

  test("department author cannot create outside their department", async () => {
    const result = await createNews({
      ...departmentValues,
      department_id: "dept-other",
    });

    expect(result).toEqual({
      error: "Unauthorized: no write access to this department",
    });
    expect(db.upsertRow).not.toHaveBeenCalled();
  });

  test("department author cannot clear the department", async () => {
    const result = await createNews({
      ...departmentValues,
      department_id: null,
    });

    expect(result).toEqual({
      error: "Unauthorized: no write access to this department",
    });
    expect(db.upsertRow).not.toHaveBeenCalled();
  });

  test("cross-campus departments are rejected for campus admins", async () => {
    currentCtx = campusAdminCtx;
    db.getRow.mockImplementation(
      async (_databaseId: string, _tableId: string, rowId: string) => ({
        $id: rowId,
        campus: { $id: "campus-bergen" },
      })
    );

    const result = await createNews(departmentValues);

    expect(result).toEqual({
      error: "Department does not belong to the selected campus",
    });
    expect(db.upsertRow).not.toHaveBeenCalled();
  });
});

describe("news relationship authorization", () => {
  test("updateNews authorizes the persisted relationship scope", async () => {
    db.listRows.mockImplementation(
      async (_databaseId: string, tableId: string) => ({
        rows:
          tableId === "news"
            ? [
                {
                  $id: "news-1",
                  campus: { $id: "campus-bergen" },
                  department: { $id: "dept-9" },
                  status: "draft",
                },
              ]
            : [],
        total: tableId === "news" ? 1 : 0,
      })
    );

    const result = await updateNews("news-1", departmentValues);

    expect(result).toEqual({
      error: "Unauthorized: no access to this campus",
    });
    expect(db.upsertRow).not.toHaveBeenCalled();
  });

  test("getNewsArticle hides rows outside the relationship scope", async () => {
    db.listRows.mockImplementation(
      async (_databaseId: string, tableId: string) => ({
        rows:
          tableId === "news"
            ? [
                {
                  $id: "news-1",
                  campus: { $id: "campus-bergen" },
                  department: { $id: "dept-9" },
                  status: "published",
                },
              ]
            : [],
        total: tableId === "news" ? 1 : 0,
      })
    );

    await expect(getNewsArticle("news-1")).resolves.toBeNull();
  });

  test("deleteNews refuses rows outside the relationship scope", async () => {
    db.listRows.mockImplementation(
      async (_databaseId: string, tableId: string) => ({
        rows:
          tableId === "news"
            ? [
                {
                  $id: "news-1",
                  campus: { $id: "campus-bergen" },
                  department: { $id: "dept-9" },
                  status: "draft",
                },
              ]
            : [],
        total: tableId === "news" ? 1 : 0,
      })
    );

    const result = await deleteNews("news-1");

    expect(result).toEqual({
      error: "Unauthorized: no access to this campus",
    });
    expect(db.deleteRow).not.toHaveBeenCalled();
  });

  test("legacy scalar ownership still authorizes rows without relations", async () => {
    db.listRows.mockImplementation(
      async (_databaseId: string, tableId: string) => ({
        rows:
          tableId === "news"
            ? [
                {
                  $id: "news-1",
                  campus_id: "campus-oslo",
                  department_id: "dept-1",
                  status: "draft",
                },
              ]
            : [],
        total: tableId === "news" ? 1 : 0,
      })
    );

    await expect(getNewsArticle("news-1")).resolves.toEqual(
      expect.objectContaining({ $id: "news-1" })
    );
  });
});
