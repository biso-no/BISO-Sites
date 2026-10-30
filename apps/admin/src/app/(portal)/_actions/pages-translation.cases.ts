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
const liveEnglishDocument: PageDoc = {
  ...translatedDocument,
  meta: { ...translatedDocument.meta, title: "Live English page" },
};

type Locale = "no" | "en";

/** One `page_translations` row, as the editor loader reports it. */
interface StoredTranslation {
  draftDocument: PageDoc | null;
  isPublished: boolean;
  /** When the locale was last published; a republish changes it. */
  publishedAt?: string | null;
  publishedDocument: PageDoc | null;
  /** The draft row's `$updatedAt`: only a draft save changes it. */
  updatedAt: string;
}

/**
 * The page and its translation rows. The page-builder mocks below change it
 * the way `@repo/api/page-builder` changes Appwrite, so a test can unpublish
 * a locale mid-task and the action sees what it would see in production.
 */
const store: {
  pageUpdatedAt: string;
  pageRowExtras: Record<string, unknown>;
  status: "draft" | "published";
  translations: Partial<Record<Locale, StoredTranslation>>;
} = {
  pageRowExtras: {},
  pageUpdatedAt: "page-0",
  status: "draft",
  translations: {},
};
let version = 0;
/** A fresh `$updatedAt`: Appwrite bumps it on every write. */
const bump = (row: string) => {
  version += 1;
  return `${row}-${version}`;
};

/**
 * One locale going offline while the translation runs: the page row becomes
 * a draft only when no other locale is still live, and is not written
 * otherwise, so its `$updatedAt` stays. The Unpublish action now takes every
 * locale down at once; these cases keep the per-locale checks in
 * `translatePublishedPage` honest against any row that goes offline alone.
 */
function unpublishLocale(locale: Locale) {
  const translation = store.translations[locale];
  if (translation) {
    translation.isPublished = false;
  }
  const stillLive = Object.entries(store.translations).some(
    ([other, row]) => other !== locale && row?.isPublished
  );
  if (stillLive) {
    return;
  }
  store.status = "draft";
  store.pageUpdatedAt = bump("page");
}

/** A page live in both locales, as the editor last published it. */
function liveInBothLocales() {
  store.status = "published";
  store.pageUpdatedAt = bump("page");
  store.translations = {
    en: {
      draftDocument: liveEnglishDocument,
      isPublished: true,
      publishedDocument: liveEnglishDocument,
      updatedAt: bump("en"),
    },
    no: {
      draftDocument: sourceDocument,
      isPublished: true,
      publishedDocument: sourceDocument,
      updatedAt: bump("no"),
    },
  };
}

const operations: string[] = [];
const publishPageSpy = mock(
  ({
    locale,
    updateParentStatus = true,
  }: {
    id: string;
    locale: Locale;
    updateParentStatus?: boolean;
  }) => {
    operations.push(`publish:${locale}`);
    const translation = store.translations[locale];
    if (!translation) {
      return Promise.reject(new Error("No translation found to publish"));
    }
    translation.publishedDocument = translation.draftDocument;
    translation.isPublished = true;
    translation.publishedAt = bump(locale);
    if (updateParentStatus) {
      store.status = "published";
      store.pageUpdatedAt = bump("page");
    }
    return Promise.resolve();
  }
);
const saveTranslation = ({ doc, locale }: { doc: PageDoc; locale: Locale }) => {
  operations.push(`save:${locale}`);
  const existing = store.translations[locale];
  const updatedAt = bump(locale);
  store.translations[locale] = {
    draftDocument: doc,
    isPublished: existing?.isPublished ?? false,
    publishedAt: existing?.publishedAt ?? null,
    publishedDocument: existing?.publishedDocument ?? null,
    updatedAt,
  };
  return Promise.resolve({ translationId: `translation-${locale}`, updatedAt });
};
const savePageTranslationDraftSpy = mock(saveTranslation);
const loadEditor = () =>
  Promise.resolve({
    availableLocales: ["no", "en"],
    page: {
      campusId: "campus-oslo",
      departmentId: "department-1",
      id: "page-1",
      slug: "page",
      status: store.status,
      visibility: "public",
    },
    translations: structuredClone(
      Object.fromEntries(
        Object.entries(store.translations).map(([locale, row]) => [
          locale,
          { ...row, publishedAt: row?.publishedAt ?? null },
        ])
      )
    ),
  });
const getPageEditorByIdSpy = mock(loadEditor);
const translatePageDocumentSpy = mock(
  async (_input: { document: PageDoc }) => translatedDocument
);
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
      ...store.pageRowExtras,
      $updatedAt: store.pageUpdatedAt,
      campus_id: "campus-oslo",
      status: store.status,
    })
  ),
  updateRow: mock(async () => ({})),
};

// `@repo/editor/sanitize` opens with `import "server-only"`, which throws
// outside a react-server build.
mock.module("server-only", () => ({}));
const clearPageThemeSpy = mock(async (_id: string) => undefined);
mock.module("@repo/api/page-builder", () => ({
  PAGE_DRAFTS_TABLE_ID: "page_drafts",
  PAGE_LOCALES: ["no", "en"],
  archivePage: mock(async () => undefined),
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

const publishNorwegianWithTranslation = () =>
  publishPageAction("page-1", "no", { enabled: true, sourceLocale: "no" });

beforeEach(() => {
  deferredTask = undefined;
  operations.length = 0;
  version = 0;
  store.pageRowExtras = {};
  store.pageUpdatedAt = "page-0";
  store.status = "draft";
  store.translations = {
    no: {
      draftDocument: sourceDocument,
      isPublished: false,
      publishedDocument: null,
      updatedAt: "no-0",
    },
  };
  publishPageSpy.mockClear();
  savePageTranslationDraftSpy.mockReset();
  savePageTranslationDraftSpy.mockImplementation(saveTranslation);
  getPageEditorByIdSpy.mockClear();
  translatePageDocumentSpy.mockReset();
  translatePageDocumentSpy.mockImplementation(async () => translatedDocument);
  scheduleContentTranslationSpy.mockClear();
  notifyWebsiteSpy.mockClear();
  db.getRow.mockClear();
  db.updateRow.mockClear();
  clearPageThemeSpy.mockReset();
  clearPageThemeSpy.mockImplementation(async () => undefined);
});

describe("page auto-translation", () => {
  test("a theme the publish copied to the department does not ride into the translation", async () => {
    const theme = { accent: "#c8a2f0", dark: "#3b1c6b" };
    const themed: PageDoc = {
      ...sourceDocument,
      meta: { ...sourceDocument.meta, theme },
    };
    store.pageRowExtras = {
      department: "department-1",
      department_id: "department-1",
    };
    store.translations = {
      no: {
        draftDocument: themed,
        isPublished: false,
        publishedDocument: themed,
        updatedAt: "no-0",
      },
    };
    clearPageThemeSpy.mockImplementation(() => {
      for (const row of Object.values(store.translations)) {
        for (const key of ["draftDocument", "publishedDocument"] as const) {
          const document = row?.[key];
          if (row && document) {
            const { theme: _copied, ...meta } = document.meta;
            row[key] = { ...document, meta };
          }
        }
      }
      return Promise.resolve(undefined);
    });
    // The real translator copies everything it does not translate.
    translatePageDocumentSpy.mockImplementationOnce(async ({ document }) => ({
      ...translatedDocument,
      meta: { ...translatedDocument.meta, theme: document.meta.theme },
    }));

    const result = await publishNorwegianWithTranslation();
    expect(result).toMatchObject({ themeCopied: true });
    await deferredTask?.();

    const [call] = savePageTranslationDraftSpy.mock.calls;
    // What is stored: the draft goes to Appwrite as JSON.
    const written = JSON.parse(JSON.stringify(call?.[0].doc)) as PageDoc;
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
    await publishNorwegianWithTranslation();

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
    expect(store.translations.en?.isPublished).toBe(true);
    // One for the source publish, one for the auto-translated locale.
    expect(notifyWebsiteSpy.mock.calls).toEqual([[["pages"]], [["pages"]]]);
  });

  test("retranslates over a live destination when nobody touched it", async () => {
    liveInBothLocales();

    await publishNorwegianWithTranslation();
    await deferredTask?.();

    expect(operations).toEqual(["publish:no", "save:en", "publish:en"]);
    expect(store.translations.en?.publishedDocument?.meta.title).toBe(
      "English page"
    );
  });

  test("unpublishing the only live locale during the translation publishes nothing", async () => {
    // The page row goes back to draft: no other locale is live.
    translatePageDocumentSpy.mockImplementationOnce(() => {
      unpublishLocale("no");
      return Promise.resolve(translatedDocument);
    });

    await publishNorwegianWithTranslation();
    await deferredTask?.();

    expect(store.status).toBe("draft");
    expect(translatePageDocumentSpy).toHaveBeenCalledTimes(1);
    expect(savePageTranslationDraftSpy).not.toHaveBeenCalled();
    expect(operations).toEqual(["publish:no"]);
  });

  test("unpublishing the source during the translation publishes nothing, though the other locale keeps the page row live", async () => {
    liveInBothLocales();
    translatePageDocumentSpy.mockImplementationOnce(() => {
      unpublishLocale("no");
      return Promise.resolve(translatedDocument);
    });

    await publishNorwegianWithTranslation();
    const pageRowAfterPublish = store.pageUpdatedAt;
    await deferredTask?.();

    // The one-locale unpublish left the page row alone.
    expect(store.status).toBe("published");
    expect(store.pageUpdatedAt).toBe(pageRowAfterPublish);
    expect(savePageTranslationDraftSpy).not.toHaveBeenCalled();
    expect(operations).toEqual(["publish:no"]);
    expect(store.translations.no?.isPublished).toBe(false);
    expect(store.translations.en?.publishedDocument).toEqual(
      liveEnglishDocument
    );
  });

  test("unpublishing the source between the draft save and the publish publishes nothing", async () => {
    liveInBothLocales();
    savePageTranslationDraftSpy.mockImplementationOnce(async (input) => {
      const saved = await saveTranslation(input);
      unpublishLocale("no");
      return saved;
    });

    await publishNorwegianWithTranslation();
    await deferredTask?.();

    expect(operations).toEqual(["publish:no", "save:en"]);
    expect(store.translations.en?.publishedDocument).toEqual(
      liveEnglishDocument
    );
  });

  test("unpublishing the destination during the translation keeps it unpublished", async () => {
    liveInBothLocales();
    translatePageDocumentSpy.mockImplementationOnce(() => {
      unpublishLocale("en");
      return Promise.resolve(translatedDocument);
    });

    await publishNorwegianWithTranslation();
    await deferredTask?.();

    expect(savePageTranslationDraftSpy).not.toHaveBeenCalled();
    expect(operations).toEqual(["publish:no"]);
    expect(store.translations.en?.isPublished).toBe(false);
  });

  test("unpublishing the destination between the draft save and the publish keeps it unpublished", async () => {
    liveInBothLocales();
    savePageTranslationDraftSpy.mockImplementationOnce(async (input) => {
      const saved = await saveTranslation(input);
      unpublishLocale("en");
      return saved;
    });

    await publishNorwegianWithTranslation();
    await deferredTask?.();

    expect(operations).toEqual(["publish:no", "save:en"]);
    expect(store.translations.en?.isPublished).toBe(false);
  });

  test("a destination published by hand during the translation is left as published", async () => {
    store.translations.en = {
      draftDocument: liveEnglishDocument,
      isPublished: false,
      publishedDocument: null,
      updatedAt: "en-0",
    };
    translatePageDocumentSpy.mockImplementationOnce(() => {
      // The editor publishes the English they wrote themselves.
      const en = store.translations.en;
      if (en) {
        en.isPublished = true;
        en.publishedDocument = en.draftDocument;
        en.publishedAt = bump("en");
      }
      return Promise.resolve(translatedDocument);
    });

    await publishNorwegianWithTranslation();
    await deferredTask?.();

    expect(savePageTranslationDraftSpy).not.toHaveBeenCalled();
    expect(store.translations.en?.publishedDocument).toEqual(
      liveEnglishDocument
    );
  });

  test("a destination republished during the translation is not overwritten or republished", async () => {
    liveInBothLocales();
    translatePageDocumentSpy.mockImplementationOnce(() => {
      // Unpublished and published again: still live, same draft, new publish.
      const en = store.translations.en;
      if (en) {
        en.publishedAt = bump("en");
      }
      return Promise.resolve(translatedDocument);
    });

    await publishNorwegianWithTranslation();
    await deferredTask?.();

    expect(savePageTranslationDraftSpy).not.toHaveBeenCalled();
    expect(operations).toEqual(["publish:no"]);
  });

  test("a destination republished between the draft save and the publish is not published again", async () => {
    liveInBothLocales();
    savePageTranslationDraftSpy.mockImplementationOnce(async (input) => {
      const saved = await saveTranslation(input);
      const en = store.translations.en;
      if (en) {
        en.publishedAt = bump("en");
      }
      return saved;
    });

    await publishNorwegianWithTranslation();
    await deferredTask?.();

    expect(operations).toEqual(["publish:no", "save:en"]);
  });

  test("skips the destination write when the source changes during translation", async () => {
    await publishNorwegianWithTranslation();
    const no = store.translations.no;
    if (no) {
      no.draftDocument = {
        ...sourceDocument,
        meta: { ...sourceDocument.meta, title: "Newer title" },
      };
      no.updatedAt = bump("no");
    }
    await deferredTask?.();

    expect(translatePageDocumentSpy).toHaveBeenCalledTimes(1);
    expect(savePageTranslationDraftSpy).not.toHaveBeenCalled();
    expect(operations).toEqual(["publish:no"]);
  });

  test("skips a destination document edited during translation", async () => {
    await publishNorwegianWithTranslation();
    // Hand-written English between scheduling and now.
    store.translations.en = {
      draftDocument: {
        ...translatedDocument,
        meta: { ...translatedDocument.meta, title: "Hand-written English" },
      },
      isPublished: false,
      publishedDocument: null,
      updatedAt: bump("en"),
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

    await publishNorwegianWithTranslation();
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
