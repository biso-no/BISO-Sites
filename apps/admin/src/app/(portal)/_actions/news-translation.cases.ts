import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { UserAuthContext } from "@/lib/authorization";
import type { NewsFormValues } from "./schemas";

let deferredCallback: (() => Promise<void> | void) | undefined;

const afterSpy = mock((callback: () => Promise<void> | void) => {
  deferredCallback = callback;
});
const generateObjectSpy = mock(async ({ prompt }: { prompt: string }) => ({
  object: {
    translations: prompt.includes("Norwegian Bokmål to English")
      ? [
          { key: "title", translated: "English title" },
          { key: "description", translated: "<p>English body</p>" },
        ]
      : [
          { key: "title", translated: "Norsk tittel" },
          { key: "description", translated: "<p>Norsk brødtekst</p>" },
        ],
  },
}));

const adminDb = {
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

const norwegianValues: NewsFormValues = {
  author: "BISO",
  campus_id: "campus-oslo",
  category: "announcement",
  department_id: null,
  description_en: "",
  description_no: "<p>Norsk brødtekst</p>",
  image: "",
  slug: "student-news",
  status: "draft",
  sticky: false,
  title_en: "",
  title_no: "Norsk tittel",
};

const SOURCE_ADDITIONAL_FIELDS = '{"author":"BISO","category":"announcement"}';

mock.module("next/server", () => ({ after: afterSpy }));
mock.module("ai", () => ({ generateObject: generateObjectSpy }));
mock.module("@ai-sdk/openai", () => ({
  openai: mock((model: string) => model),
}));
mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db: adminDb })),
  createSessionClient: mock(async () => ({ db: adminDb })),
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

const { createNews, generateNewsTranslationDraft } = await import("./news");

function mockCurrentArticle(article: Record<string, unknown>): void {
  adminDb.getRow.mockImplementation(
    (_databaseId: string, tableId: string, rowId: string) => {
      if (tableId === "news") {
        return { $id: rowId, ...article };
      }
      return { $id: rowId, campus: { $id: "campus-oslo" } };
    }
  );
}

beforeEach(() => {
  deferredCallback = undefined;
  afterSpy.mockClear();
  generateObjectSpy.mockClear();
  adminDb.createRow.mockReset();
  adminDb.deleteRow.mockReset();
  adminDb.getRow.mockReset();
  adminDb.listRows.mockReset();
  adminDb.updateRow.mockReset();
  adminDb.upsertRow.mockReset();

  adminDb.createRow.mockImplementation(
    async (
      _databaseId: string,
      _tableId: string,
      rowId: string,
      data: Record<string, unknown>
    ) => ({ $id: rowId, ...data })
  );
  adminDb.updateRow.mockImplementation(
    async (
      _databaseId: string,
      _tableId: string,
      rowId: string,
      data: Record<string, unknown>
    ) => ({ $id: rowId, ...data })
  );
  adminDb.upsertRow.mockImplementation(
    async (
      _databaseId: string,
      tableId: string,
      rowId: string,
      data: Record<string, unknown>
    ) => ({ $id: tableId === "news" ? "news-1" : rowId, ...data })
  );
  adminDb.deleteRow.mockImplementation(async () => undefined);
  adminDb.listRows.mockResolvedValue({ rows: [], total: 0 });
  mockCurrentArticle({
    campus_id: "campus-oslo",
    department_id: null,
    status: "draft",
    translation_refs: [
      {
        $id: "translation-no",
        additional_fields: SOURCE_ADDITIONAL_FIELDS,
        description: "<p>Norsk brødtekst</p>",
        locale: "no",
        title: "Norsk tittel",
      },
    ],
  });
});

describe("news translation", () => {
  test("denies manual translation outside the editor's news scope", async () => {
    const result = await generateNewsTranslationDraft({
      campusId: "campus-other",
      description: "<p>Source</p>",
      departmentId: null,
      sourceLocale: "en",
      title: "Source",
    });

    expect(result).toEqual({
      error: "Unauthorized: no write access to this campus",
    });
    expect(generateObjectSpy).not.toHaveBeenCalled();
  });

  test("generates a locale-aware manual draft in both directions", async () => {
    await expect(
      generateNewsTranslationDraft({
        campusId: "campus-oslo",
        description: "<p>Norsk brødtekst</p>",
        departmentId: null,
        sourceLocale: "no",
        title: "Norsk tittel",
      })
    ).resolves.toEqual({
      data: {
        description: "<p>English body</p>",
        title: "English title",
      },
    });
    await expect(
      generateNewsTranslationDraft({
        campusId: "campus-oslo",
        description: "<p>English body</p>",
        departmentId: null,
        sourceLocale: "en",
        title: "English title",
      })
    ).resolves.toEqual({
      data: {
        description: "<p>Norsk brødtekst</p>",
        title: "Norsk tittel",
      },
    });
  });

  test("does not schedule translation when the option is disabled", async () => {
    await createNews(norwegianValues, {
      enabled: false,
      sourceLocale: "no",
    });

    expect(afterSpy).not.toHaveBeenCalled();
  });

  test("does not queue without a headline in the selected source locale", async () => {
    const result = await createNews(
      {
        ...norwegianValues,
        description_en: "<p>English body without a headline</p>",
      },
      { enabled: true, sourceLocale: "en" }
    );

    expect(result).toEqual({ data: "news-1" });
    expect(afterSpy).not.toHaveBeenCalled();
  });

  test("schedules after persistence and links the fresh destination locale", async () => {
    const result = await createNews(norwegianValues, {
      enabled: true,
      sourceLocale: "no",
    });

    expect(result).toEqual({ data: "news-1", translationQueued: true });
    expect(afterSpy).toHaveBeenCalledTimes(1);
    // The synchronous save already persisted the linked source child.
    expect(adminDb.upsertRow).toHaveBeenCalledWith(
      "app",
      "news",
      expect.any(String),
      expect.objectContaining({
        campus: "campus-oslo",
        translation_refs: [
          expect.objectContaining({ locale: "no", title: "Norsk tittel" }),
        ],
      }),
      expect.any(Array)
    );
    expect(adminDb.createRow).not.toHaveBeenCalled();

    await deferredCallback?.();

    expect(adminDb.createRow).toHaveBeenCalledWith(
      "app",
      "content_translations",
      expect.any(String),
      expect.objectContaining({
        content_id: "news-1",
        content_type: "news",
        description: "<p>English body</p>",
        locale: "en",
        news_ref: "news-1",
        title: "English title",
      }),
      expect.any(Array)
    );
    expect(adminDb.updateRow).not.toHaveBeenCalled();
  });

  test("updates an already linked destination without relinking it", async () => {
    mockCurrentArticle({
      campus_id: "campus-oslo",
      department_id: null,
      status: "draft",
      translation_refs: [
        {
          $id: "translation-no",
          additional_fields: SOURCE_ADDITIONAL_FIELDS,
          description: "<p>Norsk brødtekst</p>",
          locale: "no",
          title: "Norsk tittel",
        },
        {
          $id: "translation-en",
          additional_fields: SOURCE_ADDITIONAL_FIELDS,
          description: "<p>Submitted English</p>",
          locale: "en",
          title: "Submitted English title",
        },
      ],
    });

    await createNews(
      {
        ...norwegianValues,
        description_en: "<p>Submitted English</p>",
        title_en: "Submitted English title",
      },
      { enabled: true, sourceLocale: "no" }
    );
    await deferredCallback?.();

    expect(adminDb.updateRow).toHaveBeenCalledWith(
      "app",
      "content_translations",
      "translation-en",
      expect.objectContaining({ locale: "en", title: "English title" }),
      expect.any(Array)
    );
    expect(adminDb.createRow).not.toHaveBeenCalled();
  });

  test("skips a destination edited while the translation was running", async () => {
    mockCurrentArticle({
      campus_id: "campus-oslo",
      department_id: null,
      status: "draft",
      translation_refs: [
        {
          $id: "translation-no",
          additional_fields: SOURCE_ADDITIONAL_FIELDS,
          description: "<p>Norsk brødtekst</p>",
          locale: "no",
          title: "Norsk tittel",
        },
        {
          // Hand-written between scheduling and now — newer than this save.
          $id: "translation-en",
          additional_fields: SOURCE_ADDITIONAL_FIELDS,
          description: "<p>Hand-written English</p>",
          locale: "en",
          title: "Hand-written English title",
        },
      ],
    });

    await createNews(
      {
        ...norwegianValues,
        description_en: "<p>Submitted English</p>",
        title_en: "Submitted English title",
      },
      { enabled: true, sourceLocale: "no" }
    );
    await deferredCallback?.();

    expect(adminDb.updateRow).not.toHaveBeenCalled();
    expect(adminDb.createRow).not.toHaveBeenCalled();
  });

  test("skips a stale source snapshot", async () => {
    mockCurrentArticle({
      campus_id: "campus-oslo",
      department_id: null,
      status: "draft",
      translation_refs: [
        {
          $id: "translation-en",
          additional_fields: SOURCE_ADDITIONAL_FIELDS,
          description: "<p>Edited English body</p>",
          locale: "en",
          title: "Edited English title",
        },
      ],
    });

    await createNews(
      {
        ...norwegianValues,
        description_en: "<p>English body</p>",
        description_no: "",
        title_en: "English title",
        title_no: "",
      },
      { enabled: true, sourceLocale: "en" }
    );
    expect(afterSpy).toHaveBeenCalledTimes(1);
    await deferredCallback?.();

    expect(adminDb.createRow).not.toHaveBeenCalled();
    expect(adminDb.updateRow).not.toHaveBeenCalled();
  });

  test("skips translation when the article publication state changes", async () => {
    mockCurrentArticle({
      campus_id: "campus-oslo",
      department_id: null,
      status: "published",
      translation_refs: [
        {
          $id: "translation-no",
          additional_fields: SOURCE_ADDITIONAL_FIELDS,
          description: "<p>Norsk brødtekst</p>",
          locale: "no",
          title: "Norsk tittel",
        },
      ],
    });

    await createNews(norwegianValues, {
      enabled: true,
      sourceLocale: "no",
    });
    await deferredCallback?.();

    expect(adminDb.createRow).not.toHaveBeenCalled();
    expect(adminDb.updateRow).not.toHaveBeenCalled();
  });
});
