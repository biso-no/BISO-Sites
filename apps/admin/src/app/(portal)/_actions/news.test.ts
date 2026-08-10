import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Permission, Role } from "@repo/api";
import type { UserAuthContext } from "@/lib/authorization";
import type { NewsFormValues } from "./schemas";

const db = {
  createRow: mock(),
  deleteRow: mock(),
  listRows: mock(),
  updateRow: mock(),
};

const campusAdminCtx: UserAuthContext = {
  activeCampusId: undefined,
  campusNames: ["Oslo"],
  campusTeamIds: ["sg-app-campus-oslo"],
  departmentNames: [],
  departmentTeamIds: [],
  email: "admin@example.com",
  managedCampuses: ["Oslo"],
  managedCampusIds: ["campus-oslo"],
  name: "Oslo Admin",
  resolvedCampusIds: ["campus-oslo"],
  resolvedDepartmentIds: [],
  roles: ["campusadmin"],
  userId: "user-1",
};

const publishedValues: NewsFormValues = {
  author: "BISO",
  campus_id: "campus-oslo",
  category: "announcement",
  department_id: null,
  description_en: "English body",
  description_no: "Norsk brødtekst",
  image: "",
  slug: "student-news",
  status: "published",
  sticky: true,
  title_en: "English title",
  title_no: "Norsk tittel",
};

mock.module("@repo/api/server", () => ({
  createSessionClient: mock(async () => ({ db })),
}));

mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => campusAdminCtx),
}));

mock.module("@/lib/recruitment", () => ({
  loadRecruitmentLookups: mock(async () => ({
    campusIdsByName: new Map([["Oslo", "campus-oslo"]]),
    campusNamesById: new Map([["campus-oslo", "Oslo"]]),
    departmentIdsByName: new Map(),
    departmentNamesById: new Map(),
  })),
}));

mock.module("next/cache", () => ({
  revalidatePath: mock(() => undefined),
}));

mock.module("./audit-log", () => ({
  logAuditEvent: mock(async () => undefined),
}));

const { createNews, updateNews } = await import("./news");

function mockExistingArticleAndTranslations({
  translations,
}: {
  translations: Record<string, unknown>[];
}): void {
  db.listRows.mockImplementation(
    async (_databaseId: string, tableId: string) => ({
      rows:
        tableId === "news"
          ? [
              {
                $id: "news-1",
                campus_id: "campus-oslo",
                department_id: null,
                status: "draft",
              },
            ]
          : translations,
      total: tableId === "news" ? 1 : translations.length,
    })
  );
}

beforeEach(() => {
  db.createRow.mockReset();
  db.deleteRow.mockReset();
  db.listRows.mockReset();
  db.updateRow.mockReset();

  db.createRow.mockImplementation(
    async (
      _databaseId: string,
      tableId: string,
      rowId: string,
      data: Record<string, unknown>
    ) => ({ $id: tableId === "news" ? "news-1" : rowId, ...data })
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
  mockExistingArticleAndTranslations({ translations: [] });
});

describe("news persistence", () => {
  test("stages a new article privately before publishing it", async () => {
    const result = await createNews(publishedValues);

    expect(result).toEqual({ data: "news-1" });
    expect(db.createRow).toHaveBeenCalledWith(
      "app",
      "news",
      "unique()",
      expect.objectContaining({ status: "draft" }),
      expect.any(Array)
    );
    expect(db.createRow).toHaveBeenCalledWith(
      "app",
      "content_translations",
      "unique()",
      expect.objectContaining({ locale: "no", title: "Norsk tittel" }),
      expect.any(Array)
    );
    expect(db.createRow).toHaveBeenCalledWith(
      "app",
      "content_translations",
      "unique()",
      expect.objectContaining({ locale: "en", title: "English title" }),
      expect.any(Array)
    );
    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "news",
      "news-1",
      expect.objectContaining({ status: "published" }),
      expect.any(Array)
    );

    const parentCreateCall = db.createRow.mock.calls.find(
      (call) => call[1] === "news"
    );
    const parentPublishCall = db.updateRow.mock.calls.find(
      (call) => call[1] === "news" && call[3]?.status === "published"
    );
    const creatorUpdatePermission = Permission.update(
      Role.user(campusAdminCtx.userId)
    );
    const creatorDeletePermission = Permission.delete(
      Role.user(campusAdminCtx.userId)
    );

    expect(parentCreateCall?.[4]).toContain(creatorUpdatePermission);
    expect(parentCreateCall?.[4]).toContain(creatorDeletePermission);
    expect(parentPublishCall?.[4]).not.toContain(creatorUpdatePermission);
    expect(parentPublishCall?.[4]).not.toContain(creatorDeletePermission);
  });

  test("removes a staged article when a translation write fails", async () => {
    db.createRow.mockImplementation(
      (
        _databaseId: string,
        tableId: string,
        _rowId: string,
        data: Record<string, unknown>
      ) => {
        if (tableId === "news") {
          return { $id: "news-1", ...data };
        }
        if (data.locale === "en") {
          throw new Error("Translation write failed");
        }
        return { $id: "translation-no", ...data };
      }
    );

    const result = await createNews(publishedValues);

    expect(result).toEqual({ error: "Translation write failed" });
    expect(db.deleteRow).toHaveBeenCalledWith(
      "app",
      "content_translations",
      "translation-no"
    );
    expect(db.deleteRow).toHaveBeenCalledWith("app", "news", "news-1");
    expect(db.updateRow).not.toHaveBeenCalledWith(
      "app",
      "news",
      "news-1",
      expect.objectContaining({ status: "published" }),
      expect.any(Array)
    );
  });

  test("does not create an empty optional locale or retain staging access", async () => {
    await createNews({
      ...publishedValues,
      description_en: "",
      status: "draft",
      title_en: "",
    });

    const translationCalls = db.createRow.mock.calls.filter(
      (call) => call[1] === "content_translations"
    );
    expect(translationCalls).toHaveLength(1);
    expect(translationCalls[0]?.[3]).toEqual(
      expect.objectContaining({ locale: "no" })
    );

    const parentDraftCall = db.updateRow.mock.calls.find(
      (call) => call[1] === "news" && call[3]?.status === "draft"
    );
    expect(parentDraftCall?.[4]).not.toContain(
      Permission.update(Role.user(campusAdminCtx.userId))
    );
    expect(parentDraftCall?.[4]).not.toContain(
      Permission.delete(Role.user(campusAdminCtx.userId))
    );
  });

  test("deletes an existing locale after its content is cleared", async () => {
    mockExistingArticleAndTranslations({
      translations: [
        {
          $id: "translation-en",
          content_id: "news-1",
          locale: "en",
          title: "Existing English",
        },
      ],
    });

    await updateNews("news-1", {
      ...publishedValues,
      description_en: "",
      title_en: "",
    });

    expect(db.createRow).toHaveBeenCalledWith(
      "app",
      "content_translations",
      "unique()",
      expect.objectContaining({ locale: "no" }),
      expect.any(Array)
    );
    expect(db.deleteRow).toHaveBeenCalledWith(
      "app",
      "content_translations",
      "translation-en"
    );
  });
});
