import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { PageDoc } from "@repo/api/page-builder";

const sourceDocument: PageDoc = {
  sections: [
    {
      columns: [
        {
          blocks: [{ props: { title: "Norsk blokk" }, type: "hero" }],
          id: "c-1",
        },
      ],
      id: "s-1",
      layout: {},
    },
  ],
  version: 2,
  meta: {
    department: "department-1",
    description: "Norsk beskrivelse",
    slug: "page",
    status: "draft",
    title: "Norsk side",
  },
};
const translatedDocument: PageDoc = {
  ...sourceDocument,
  sections: [
    {
      columns: [
        {
          blocks: [{ props: { title: "English block" }, type: "hero" }],
          id: "c-1",
        },
      ],
      id: "s-1",
      layout: {},
    },
  ],
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
  getRow: mock(
    async (): Promise<Record<string, unknown>> => ({
      $updatedAt: "publish-1",
      campus_id: "campus-oslo",
      status: "published",
    })
  ),
  updateRow: mock(async () => ({})),
};

// `@repo/editor/sanitize` opens with `import "server-only"`, which throws
// outside a react-server build.
mock.module("server-only", () => ({}));
const clearPageThemeSpy = mock(async (_id: string) => undefined);
mock.module("@repo/api/page-builder", () => ({
  PAGE_LOCALES: ["no", "en"],
  clearPageTheme: clearPageThemeSpy,
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
  syncSharedDraftMeta: mock(async () => undefined),
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
const notifyWebsiteSpy = mock(async (_tags: string[]) => undefined);
mock.module("@/lib/web-revalidate", () => ({
  notifyWebsite: notifyWebsiteSpy,
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
  notifyWebsiteSpy.mockClear();
  db.getRow.mockClear();
  db.updateRow.mockClear();
  clearPageThemeSpy.mockReset();
  clearPageThemeSpy.mockImplementation(async () => undefined);
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
  test("a theme the publish copied to the department does not ride into the translation", async () => {
    const theme = { accent: "#c8a2f0", dark: "#3b1c6b" };
    let stored: PageDoc = {
      ...sourceDocument,
      meta: { ...sourceDocument.meta, theme },
    };
    db.getRow.mockImplementation(async () => ({
      $updatedAt: "publish-1",
      campus_id: "campus-oslo",
      department: "department-1",
      department_id: "department-1",
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
      translations: {
        no: { draftDocument: stored, publishedDocument: stored },
      } as never,
    }));
    clearPageThemeSpy.mockImplementation(() => {
      const { theme: _copied, ...meta } = stored.meta;
      stored = { ...stored, meta };
      return Promise.resolve(undefined);
    });
    // The real translator copies everything it does not translate.
    translatePageDocumentSpy.mockImplementationOnce((async ({
      document,
    }: {
      document: PageDoc;
    }) => ({
      ...translatedDocument,
      meta: { ...translatedDocument.meta, theme: document.meta.theme },
    })) as never);

    const result = await publishPageAction("page-1", "no", {
      enabled: true,
      sourceLocale: "no",
    });
    expect(result).toMatchObject({ themeCopied: true });
    await deferredTask?.();

    const [call] = savePageTranslationDraftSpy.mock.calls as unknown as [
      [{ doc: PageDoc }],
    ];
    // What is stored: the draft goes to Appwrite as JSON.
    const written = JSON.parse(JSON.stringify(call[0].doc)) as PageDoc;
    expect(written.meta.title).toBe("English page");
    expect("theme" in written.meta).toBe(false);
  });

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
    // One for the source publish, one for the auto-translated locale.
    expect(notifyWebsiteSpy.mock.calls).toEqual([[["pages"]], [["pages"]]]);
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
    // One stateful mock: the deferred pass re-reads through the same spy, so
    // flipping the state between the publish and the callback is what makes the
    // source look edited.
    let currentSource = sourceDocument;
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
      translations: { no: { draftDocument: currentSource } },
    }));

    await publishPageAction("page-1", "no", {
      enabled: true,
      sourceLocale: "no",
    });
    currentSource = {
      ...sourceDocument,
      meta: { ...sourceDocument.meta, title: "Newer title" },
    };
    await deferredTask?.();

    expect(translatePageDocumentSpy).toHaveBeenCalledTimes(1);
    expect(savePageTranslationDraftSpy).not.toHaveBeenCalled();
    expect(operations).toEqual(["publish:no"]);
  });

  test("skips a destination document edited during translation", async () => {
    let englishDocument: PageDoc | null = null;
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
      translations: {
        no: { draftDocument: sourceDocument },
        ...(englishDocument ? { en: { draftDocument: englishDocument } } : {}),
      },
    }));

    await publishPageAction("page-1", "no", {
      enabled: true,
      sourceLocale: "no",
    });
    // Hand-written English between scheduling and now.
    englishDocument = {
      ...translatedDocument,
      meta: { ...translatedDocument.meta, title: "Hand-written English" },
    };
    await deferredTask?.();

    expect(translatePageDocumentSpy).toHaveBeenCalledTimes(1);
    expect(savePageTranslationDraftSpy).not.toHaveBeenCalled();
    expect(operations).toEqual(["publish:no"]);
  });
});

describe("page auto-translation: rich text", () => {
  test("saves the model's text-block HTML only after sanitizing it", async () => {
    translatePageDocumentSpy.mockImplementationOnce(async () => ({
      ...translatedDocument,
      sections: [
        {
          columns: [
            {
              blocks: [
                {
                  body: [
                    {
                      text: '<b>Hi</b><img src=x onerror="alert(1)">',
                      type: "p",
                    },
                  ],
                  id: "b-1",
                  type: "text",
                },
              ],
              id: "c-1",
            },
          ],
          id: "s-1",
          layout: {},
        },
      ],
    }));

    await publishPageAction("page-1", "no", {
      enabled: true,
      sourceLocale: "no",
    });
    await deferredTask?.();

    const [[saved]] = savePageTranslationDraftSpy.mock.calls as unknown as [
      [
        {
          doc: {
            sections: {
              columns: { blocks: { body: { text: string }[] }[] }[];
            }[];
          };
        },
      ],
    ];
    expect(saved.doc.sections[0].columns[0].blocks[0].body[0].text).toBe(
      "<b>Hi</b>"
    );
  });
});
