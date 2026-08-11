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
  createAdminClient: mock(async () => ({ db })),
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

function nestedTranslations(
  call: unknown[] | undefined
): Record<string, unknown>[] {
  const data = call?.[3] as
    | { translation_refs?: Record<string, unknown>[] }
    | undefined;
  return data?.translation_refs ?? [];
}

beforeEach(() => {
  db.createRow.mockReset();
  db.deleteRow.mockReset();
  db.getRow.mockReset();
  db.listRows.mockReset();
  db.updateRow.mockReset();
  db.upsertRow.mockReset();

  db.upsertRow.mockImplementation(
    async (
      _databaseId: string,
      tableId: string,
      rowId: string,
      data: Record<string, unknown>
    ) => ({ $id: tableId === "news" ? "news-1" : rowId, ...data })
  );
  db.deleteRow.mockImplementation(async () => undefined);
  mockExistingArticleAndTranslations({ translations: [] });
});

describe("news persistence", () => {
  test("persists a published article with both nested locales in one write", async () => {
    const result = await createNews(publishedValues);

    expect(result).toEqual({ data: "news-1" });
    expect(db.upsertRow).toHaveBeenCalledTimes(1);
    expect(db.upsertRow).toHaveBeenCalledWith(
      "app",
      "news",
      expect.any(String),
      expect.objectContaining({
        campus: "campus-oslo",
        status: "published",
        translation_refs: expect.arrayContaining([
          expect.objectContaining({ locale: "no", title: "Norsk tittel" }),
          expect.objectContaining({ locale: "en", title: "English title" }),
        ]),
      }),
      expect.any(Array)
    );
    // Single relationship-aware write: no staged create or finalize pass.
    expect(db.createRow).not.toHaveBeenCalled();
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  test("returns the persistence error without partial writes", async () => {
    db.upsertRow.mockRejectedValue(new Error("Translation write failed"));

    const result = await createNews(publishedValues);

    expect(result).toEqual({ error: "Translation write failed" });
    expect(db.createRow).not.toHaveBeenCalled();
    expect(db.deleteRow).not.toHaveBeenCalled();
  });

  test("does not include an empty optional locale", async () => {
    await createNews({
      ...publishedValues,
      description_en: "",
      status: "draft",
      title_en: "",
    });

    const children = nestedTranslations(db.upsertRow.mock.calls[0]);
    expect(children).toHaveLength(1);
    expect(children[0]).toEqual(expect.objectContaining({ locale: "no" }));
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

    const children = nestedTranslations(
      db.upsertRow.mock.calls.find((call) => call[1] === "news")
    );
    expect(children).toHaveLength(1);
    expect(children[0]).toEqual(expect.objectContaining({ locale: "no" }));
    expect(db.deleteRow).toHaveBeenCalledWith(
      "app",
      "content_translations",
      "translation-en"
    );
  });

  test("reuses an existing locale row instead of duplicating it", async () => {
    mockExistingArticleAndTranslations({
      translations: [
        {
          $id: "translation-no",
          content_id: "news-1",
          locale: "no",
          title: "Gammel tittel",
        },
      ],
    });

    await updateNews("news-1", publishedValues);

    const children = nestedTranslations(
      db.upsertRow.mock.calls.find((call) => call[1] === "news")
    );
    expect(children).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ $id: "translation-no", locale: "no" }),
        expect.not.objectContaining({ $id: expect.any(String) }),
      ])
    );
    expect(db.deleteRow).not.toHaveBeenCalled();
  });
});
