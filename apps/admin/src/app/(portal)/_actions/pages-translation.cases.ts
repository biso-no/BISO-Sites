import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { PageDoc } from "@repo/api/page-builder";

const sourceDocument: PageDoc = {
  blocks: [{ props: { title: "Norsk blokk" }, type: "hero" }],
  meta: {
    accentColor: "#001731",
    department: "department-1",
    description: "Norsk beskrivelse",
    slug: "page",
    status: "draft",
    title: "Norsk side",
  },
};
const translatedDocument: PageDoc = {
  ...sourceDocument,
  blocks: [{ props: { title: "English block" }, type: "hero" }],
  meta: {
    ...sourceDocument.meta,
    description: "English description",
    title: "English page",
  },
};

const operations: string[] = [];
const publishPageSpy = mock(({ locale }: { locale: string }) => {
  operations.push(`publish:${locale}`);
  return Promise.resolve();
});
const savePageTranslationDraftSpy = mock(({ locale }: { locale: string }) => {
  operations.push(`save:${locale}`);
  return Promise.resolve();
});
const getPageEditorByIdSpy = mock(async () => ({
  availableLocales: ["no", "en"],
  page: {
    campusId: "campus-oslo",
    departmentId: "department-1",
    id: "page-1",
    slug: "page",
    status: "draft",
    visibility: "public",
  },
  translations: {
    no: { draftDocument: sourceDocument },
  },
}));
const translatePageDocumentSpy = mock(async () => translatedDocument);
let deferredTask: (() => Promise<void>) | undefined;
const scheduleContentTranslationSpy = mock(
  ({ enabled, task }: { enabled: boolean; task: () => Promise<void> }) => {
    if (!enabled) {
      return false;
    }
    deferredTask = task;
    return true;
  }
);
const db = {
  getRow: mock(async () => ({
    $updatedAt: "publish-1",
    campus_id: "campus-oslo",
    status: "published",
  })),
};

mock.module("@repo/api/page-builder", () => ({
  PAGE_LOCALES: ["no", "en"],
  getPageById: mock(async () => null),
  getPageEditorById: getPageEditorByIdSpy,
  publishPage: publishPageSpy,
  resolvePageCampusId: mock(() => "campus-oslo"),
  savePageDraft: mock(async () => ({
    pageId: "page-1",
    slug: "page",
    translationId: "translation-no",
  })),
  savePageTranslationDraft: savePageTranslationDraftSpy,
  unpublishPage: mock(async () => undefined),
}));
mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db })),
  createSessionClient: mock(async () => ({ db })),
}));
mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => ({
    managedCampusIds: ["campus-oslo"],
    resolvedCampusIds: ["campus-oslo"],
    resolvedDepartmentIds: [],
    roles: ["campusadmin"],
    userId: "user-1",
  })),
}));
mock.module("@/lib/utils/authorization", () => ({
  applyScopeQueries: mock(() => []),
  assertPublishAccess: mock(() => undefined),
  assertWriteAccess: mock(() => undefined),
  hasRowAccess: mock(() => true),
}));
mock.module("@/lib/page-document-translation", () => ({
  getPageTranslationSource: (document: PageDoc) => ({
    description: document.meta.description ?? "",
    title: document.meta.title,
  }),
  translatePageDocument: translatePageDocumentSpy,
}));
mock.module("@/lib/content-translation.server", () => ({
  contentLocaleSchema: { parse: (value: unknown) => value },
  parseAutoTranslationOptions: (value: unknown) => value,
  scheduleContentTranslation: scheduleContentTranslationSpy,
}));
mock.module("next/cache", () => ({ revalidatePath: mock(() => undefined) }));
mock.module("./audit-log", () => ({
  logAuditEvent: mock(async () => undefined),
}));

const { publishPageAction } = await import("./pages");

beforeEach(() => {
  deferredTask = undefined;
  operations.length = 0;
  publishPageSpy.mockClear();
  savePageTranslationDraftSpy.mockClear();
  getPageEditorByIdSpy.mockClear();
  translatePageDocumentSpy.mockClear();
  scheduleContentTranslationSpy.mockClear();
  db.getRow.mockClear();
  db.getRow.mockImplementation(async () => ({
    $updatedAt: "publish-1",
    campus_id: "campus-oslo",
    status: "published",
  }));
  getPageEditorByIdSpy.mockImplementation(async () => ({
    availableLocales: ["no", "en"],
    page: {
      campusId: "campus-oslo",
      departmentId: "department-1",
      id: "page-1",
      slug: "page",
      status: "draft",
      visibility: "public",
    },
    translations: { no: { draftDocument: sourceDocument } },
  }));
});

describe("page auto-translation", () => {
  test("publishes without loading or scheduling translation when disabled", async () => {
    await publishPageAction("page-1", "no", {
      enabled: false,
      sourceLocale: "no",
    });

    expect(publishPageSpy).toHaveBeenCalledWith({ id: "page-1", locale: "no" });
    expect(getPageEditorByIdSpy).not.toHaveBeenCalled();
    expect(scheduleContentTranslationSpy).not.toHaveBeenCalled();
  });

  test("queues a source snapshot and saves before publishing the destination", async () => {
    await publishPageAction("page-1", "no", {
      enabled: true,
      sourceLocale: "no",
    });

    expect(operations).toEqual(["publish:no"]);
    expect(deferredTask).toBeDefined();
    await deferredTask?.();

    expect(translatePageDocumentSpy).toHaveBeenCalledWith({
      document: sourceDocument,
      sourceLocale: "no",
      targetLocale: "en",
    });
    expect(savePageTranslationDraftSpy).toHaveBeenCalledWith({
      doc: expect.objectContaining({
        meta: expect.objectContaining({ status: "published" }),
      }),
      id: "page-1",
      locale: "en",
    });
    expect(publishPageSpy).toHaveBeenLastCalledWith({
      id: "page-1",
      locale: "en",
      updateParentStatus: false,
    });
    expect(operations).toEqual(["publish:no", "save:en", "publish:en"]);
  });

  test("does not republish when the source publish is no longer current", async () => {
    db.getRow
      .mockResolvedValueOnce({
        $updatedAt: "before-publish",
        campus_id: "campus-oslo",
        status: "draft",
      })
      .mockResolvedValueOnce({
        $updatedAt: "publish-1",
        campus_id: "campus-oslo",
        status: "published",
      })
      .mockResolvedValueOnce({
        $updatedAt: "unpublish-2",
        campus_id: "campus-oslo",
        status: "draft",
      });

    await publishPageAction("page-1", "no", {
      enabled: true,
      sourceLocale: "no",
    });
    await deferredTask?.();

    expect(translatePageDocumentSpy).toHaveBeenCalledTimes(1);
    expect(savePageTranslationDraftSpy).not.toHaveBeenCalled();
    expect(publishPageSpy).toHaveBeenCalledTimes(1);
    expect(operations).toEqual(["publish:no"]);
  });

  test("skips the destination write when the source changes during translation", async () => {
    getPageEditorByIdSpy
      .mockImplementationOnce(async () => ({
        availableLocales: ["no", "en"],
        page: {
          campusId: "campus-oslo",
          departmentId: "department-1",
          id: "page-1",
          slug: "page",
          status: "draft",
          visibility: "public",
        },
        translations: { no: { draftDocument: sourceDocument } },
      }))
      .mockImplementationOnce(async () => ({
        availableLocales: ["no", "en"],
        page: {
          campusId: "campus-oslo",
          departmentId: "department-1",
          id: "page-1",
          slug: "page",
          status: "draft",
          visibility: "public",
        },
        translations: {
          no: {
            draftDocument: {
              ...sourceDocument,
              meta: { ...sourceDocument.meta, title: "Newer title" },
            },
          },
        },
      }));

    await publishPageAction("page-1", "no", {
      enabled: true,
      sourceLocale: "no",
    });
    await deferredTask?.();

    expect(translatePageDocumentSpy).toHaveBeenCalledTimes(1);
    expect(savePageTranslationDraftSpy).not.toHaveBeenCalled();
    expect(operations).toEqual(["publish:no"]);
  });
});
