import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { UserAuthContext } from "@/lib/authorization";

const CONTRAST = /contrast/i;

const ctx: UserAuthContext = {
  activeCampusId: undefined,
  campusNames: [],
  campusTeamIds: [],
  departmentNames: [],
  departmentTeamIds: [],
  email: null,
  managedCampusIds: [],
  managedCampuses: [],
  name: null,
  resolvedCampusIds: [],
  resolvedDepartmentIds: [],
  roles: ["globaladmin"],
  userId: "user-1",
};

let currentCtx: UserAuthContext = ctx;

const GOOD = { accent: "#C8A2F0", dark: "#3B1C6B" };
const BAD = { accent: "#3aa3e1", dark: "#9b5de5" };

const adminDb = {
  getRow: mock(),
  updateRow: mock(
    async (
      _db: string,
      _table: string,
      _id: string,
      _data?: Record<string, unknown>
    ) => ({})
  ),
};
const savePageDraft = mock(async () => ({
  pageId: "page-1",
  slug: "side",
  translationId: "t-1",
}));
const publishPage = mock(async () => undefined);
const getPageEditorById = mock(async (): Promise<unknown> => null);
const syncSharedDraftMeta = mock(
  async (_args: { id: string; locale: string; meta: object }): Promise<void> =>
    undefined
);
const clearPageTheme = mock(async (_id: string): Promise<void> => undefined);
const logAuditEvent = mock(
  async (_ctx: unknown, _action: string, _opts?: Record<string, unknown>) =>
    undefined
);

mock.module("server-only", () => ({}));
mock.module("@repo/api/page-builder", () => ({
  PAGE_DRAFTS_TABLE_ID: "page_drafts",
  PAGE_LOCALES: ["no", "en"],
  archivePage: mock(async () => undefined),
  getPageById: mock(async () => null),
  clearPageTheme,
  getPageEditorById,
  publishPage,
  resolvePageCampusId: mock(
    (c: { resolvedCampusIds: string[] }) => c.resolvedCampusIds[0] ?? null
  ),
  savePageDraft,
  savePageTranslationDraft: mock(async () => undefined),
  syncSharedDraftMeta,
  unpublishPage: mock(async () => undefined),
}));
mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db: adminDb })),
  createSessionClient: mock(async () => ({ db: adminDb })),
}));
mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => currentCtx),
}));
mock.module("next/cache", () => ({ revalidatePath: mock(() => undefined) }));
mock.module("./audit-log", () => ({ logAuditEvent }));

const { publishPageAction, savePageEditorDoc } = await import("./pages");

const doc = (theme?: unknown) => ({
  sections: [],
  version: 2,
  meta: {
    department: "",
    description: "d",
    slug: "side",
    status: "draft",
    title: "Side",
    ...(theme === undefined ? {} : { theme }),
  },
});

const publishedWith = (theme?: unknown) => ({
  translations: { no: { publishedDocument: doc(theme) } },
});

const pageRow = (departmentId: string | null) => ({
  $id: "page-1",
  campus: null,
  department: departmentId,
  department_id: departmentId,
  slug: "side",
});

beforeEach(() => {
  currentCtx = ctx;
  adminDb.getRow.mockReset();
  adminDb.updateRow.mockReset();
  adminDb.updateRow.mockImplementation(async () => ({}));
  savePageDraft.mockReset();
  savePageDraft.mockImplementation(async () => ({
    pageId: "page-1",
    slug: "side",
    translationId: "t-1",
  }));
  publishPage.mockReset();
  publishPage.mockImplementation(async () => undefined);
  getPageEditorById.mockReset();
  syncSharedDraftMeta.mockReset();
  syncSharedDraftMeta.mockImplementation(async () => undefined);
  clearPageTheme.mockReset();
  clearPageTheme.mockImplementation(async () => undefined);
  logAuditEvent.mockClear();
});

describe("savePageEditorDoc theme", () => {
  test("rejects a failing theme and writes nothing", async () => {
    const result = await savePageEditorDoc({
      doc: doc(BAD) as never,
      id: null,
    });
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toMatch(CONTRAST);
    expect(savePageDraft).not.toHaveBeenCalled();
  });

  test("rejects a malformed theme", async () => {
    const result = await savePageEditorDoc({
      doc: doc({ accent: "red", dark: 4 }) as never,
      id: null,
    });
    expect(result).toHaveProperty("error");
    expect(savePageDraft).not.toHaveBeenCalled();
  });

  test("saves null, absent and passing themes", async () => {
    for (const theme of [null, undefined, GOOD]) {
      const result = await savePageEditorDoc({
        doc: doc(theme) as never,
        id: null,
      });
      expect(result).toEqual({
        department: "",
        pageId: "page-1",
        slug: "side",
      });
    }
    expect(savePageDraft).toHaveBeenCalledTimes(3);
  });
});

describe("publishPageAction theme", () => {
  test("copies a passing theme to the department once and audits it", async () => {
    adminDb.getRow.mockResolvedValue(pageRow("dept-1"));
    getPageEditorById.mockResolvedValue(publishedWith(GOOD));
    await publishPageAction("page-1", "no");
    expect(publishPage).toHaveBeenCalledTimes(1);
    expect(adminDb.updateRow).toHaveBeenCalledTimes(1);
    expect(adminDb.updateRow).toHaveBeenCalledWith(
      "app",
      "departments",
      "dept-1",
      { theme_accent: "#c8a2f0", theme_dark: "#3b1c6b" }
    );
    const actions = logAuditEvent.mock.calls.map((c) => c[1]);
    expect(actions).toContain("department_theme_updated");
    const call = logAuditEvent.mock.calls.find(
      (c) => c[1] === "department_theme_updated"
    );
    expect(call?.[2]).toMatchObject({ resourceId: "dept-1" });
  });

  test("null theme resets the department", async () => {
    adminDb.getRow.mockResolvedValue(pageRow("dept-1"));
    getPageEditorById.mockResolvedValue(publishedWith(null));
    await publishPageAction("page-1", "no");
    expect(adminDb.updateRow).toHaveBeenCalledWith(
      "app",
      "departments",
      "dept-1",
      { theme_accent: null, theme_dark: null }
    );
  });

  test("leaves the department alone when the theme is absent", async () => {
    adminDb.getRow.mockResolvedValue(pageRow("dept-1"));
    getPageEditorById.mockResolvedValue(publishedWith(undefined));
    await publishPageAction("page-1", "no");
    expect(adminDb.updateRow).not.toHaveBeenCalled();
    expect(logAuditEvent.mock.calls.map((c) => c[1])).not.toContain(
      "department_theme_updated"
    );
  });

  test("a stored failing theme does not block the publish or touch the department", async () => {
    adminDb.getRow.mockResolvedValue(pageRow("dept-1"));
    getPageEditorById.mockResolvedValue(publishedWith(BAD));
    await publishPageAction("page-1", "no");
    expect(publishPage).toHaveBeenCalledTimes(1);
    expect(adminDb.updateRow).not.toHaveBeenCalled();
  });

  test("a page without a department never touches departments", async () => {
    adminDb.getRow.mockResolvedValue(pageRow(null));
    getPageEditorById.mockResolvedValue(publishedWith(GOOD));
    await publishPageAction("page-1", "no");
    expect(publishPage).toHaveBeenCalledTimes(1);
    expect(adminDb.updateRow).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// A small in-memory stand-in for the stored pages, translations and
// departments, so a sequence of saves and publishes can be followed end to
// end through the real actions. The page-builder helpers themselves are
// covered in packages/api/page-builder.test.ts.
// ---------------------------------------------------------------------------

type Locale = "en" | "no";
type Doc = ReturnType<typeof doc>;
type Theme = { accent: string; dark: string } | null;

interface StoredPage {
  department: string | null;
  translations: Partial<
    Record<Locale, { draft: string; published: string | null }>
  >;
}

const store = {
  departments: new Map<
    string,
    { theme_accent: string | null; theme_dark: string | null }
  >(),
  pages: new Map<string, StoredPage>(),
};

const parse = (json: string | null | undefined) =>
  json ? (JSON.parse(json) as Doc & { meta: Record<string, unknown> }) : null;

function seedPage(id: string, department: string | null, locales: Locale[]) {
  const translations: StoredPage["translations"] = {};
  for (const locale of locales) {
    translations[locale] = {
      draft: JSON.stringify({
        ...doc(),
        meta: {
          ...doc().meta,
          campus: "campus-oslo",
          department: department ?? "",
        },
      }),
      published: null,
    };
  }
  store.pages.set(id, { department, translations });
}

/** What the editor sends after opening `locale` of `id` from storage. */
function opened(id: string, locale: Locale): Doc {
  const draft = parse(store.pages.get(id)?.translations[locale]?.draft);
  if (!draft) {
    throw new Error(`no ${locale} draft for ${id}`);
  }
  return draft;
}

function withTheme(d: Doc, theme: Theme): Doc {
  return { ...d, meta: { ...d.meta, theme } } as Doc;
}

/** Every stored document of a page that still carries a theme key. */
function docsWithTheme(id: string): string[] {
  const page = store.pages.get(id);
  const found: string[] = [];
  for (const [locale, t] of Object.entries(page?.translations ?? {})) {
    for (const [kind, json] of [
      ["draft", t?.draft],
      ["published", t?.published],
    ] as const) {
      const parsed = parse(json);
      if (parsed && "theme" in parsed.meta) {
        found.push(`${locale}:${kind}`);
      }
    }
  }
  return found;
}

const departmentTheme = (id: string) => store.departments.get(id);

const T = { accent: "#c8a2f0", dark: "#3b1c6b" };
const U = { accent: "#8fe3b5", dark: "#0b3d2e" };

/** Run a synchronous fake as an async I/O call: a throw becomes a rejection. */
function settle<R>(run: () => R): Promise<R> {
  try {
    return Promise.resolve(run());
  } catch (error) {
    return Promise.reject(error);
  }
}

function pageRowOf(id: string) {
  const page = store.pages.get(id);
  if (!page) {
    throw new Error(`no page ${id}`);
  }
  return {
    $id: id,
    campus: "campus-oslo",
    campus_id: "campus-oslo",
    department: page.department,
    department_id: page.department,
    slug: id,
    status: "draft",
  };
}

function storeDraft(saved: Doc, id: string | null, locale: Locale) {
  const pageId = id ?? "page-new";
  const page = store.pages.get(pageId) ?? {
    department: null,
    translations: {},
  };
  page.department = saved.meta.department || null;
  page.translations[locale] = {
    draft: JSON.stringify(saved),
    published: page.translations[locale]?.published ?? null,
  };
  store.pages.set(pageId, page);
  return { pageId, slug: saved.meta.slug, translationId: `t-${locale}` };
}

function syncDrafts(id: string, locale: string, meta: object) {
  const page = store.pages.get(id);
  for (const [other, t] of Object.entries(page?.translations ?? {})) {
    const draft = parse(t?.draft);
    if (other !== locale && t && draft) {
      t.draft = JSON.stringify({ ...draft, meta: { ...draft.meta, ...meta } });
    }
  }
}

function publishDraft(id: string, locale: Locale) {
  const t = store.pages.get(id)?.translations[locale];
  if (!t) {
    throw new Error("No translation found to publish");
  }
  t.published = t.draft;
}

function editorLoad(id: string) {
  const page = store.pages.get(id);
  if (!page) {
    return null;
  }
  const translations: Record<string, unknown> = {};
  for (const [locale, t] of Object.entries(page.translations)) {
    translations[locale] = {
      draftDocument: parse(t?.draft),
      publishedDocument: parse(t?.published),
    };
  }
  return {
    page: { campusId: "campus-oslo", departmentId: page.department ?? "", id },
    translations,
  };
}

function stripTheme(id: string) {
  for (const t of Object.values(store.pages.get(id)?.translations ?? {})) {
    if (!t) {
      continue;
    }
    for (const key of ["draft", "published"] as const) {
      const parsed = parse(t[key]);
      if (parsed && "theme" in parsed.meta) {
        const { theme: _theme, ...meta } = parsed.meta;
        t[key] = JSON.stringify({ ...parsed, meta });
      }
    }
  }
}

function installStore() {
  store.pages.clear();
  store.departments.clear();
  store.departments.set("dept-1", { theme_accent: null, theme_dark: null });
  adminDb.getRow.mockImplementation((_db: string, table: string, id: string) =>
    settle(() =>
      table === "departments"
        ? {
            $id: id,
            campus: { $id: "campus-oslo" },
            ...store.departments.get(id),
          }
        : pageRowOf(id)
    )
  );
  adminDb.updateRow.mockImplementation(
    (_db: string, table: string, id: string, data = {}) =>
      settle(() => {
        if (table === "departments") {
          store.departments.set(
            id,
            data as { theme_accent: string | null; theme_dark: string | null }
          );
        }
        return {};
      })
  );
  savePageDraft.mockImplementation(((params: {
    doc: Doc;
    id: string | null;
    locale?: Locale;
  }) =>
    settle(() =>
      storeDraft(params.doc, params.id, params.locale ?? "no")
    )) as never);
  syncSharedDraftMeta.mockImplementation(({ id, locale, meta }) =>
    settle(() => syncDrafts(id, locale, meta))
  );
  publishPage.mockImplementation(((params: { id: string; locale: Locale }) =>
    settle(() => publishDraft(params.id, params.locale))) as never);
  getPageEditorById.mockImplementation((...args: unknown[]) =>
    settle(() => editorLoad(args[0] as string))
  );
  clearPageTheme.mockImplementation((id: string) =>
    settle(() => stripTheme(id))
  );
}

async function save(id: string | null, locale: Locale, d: Doc) {
  const result = await savePageEditorDoc({ doc: d as never, id, locale });
  if ("error" in result) {
    throw new Error(result.error);
  }
  return result;
}

/** Set a theme on a department page in Norwegian and publish it. */
async function publishThemed(id: string, theme: Theme) {
  await save(id, "no", withTheme(opened(id, "no"), theme));
  const result = await publishPageAction(id, "no");
  if (result.missingTranslation) {
    throw new Error(`no ${id} draft to publish`);
  }
  return result;
}

describe("department pages hold a theme only until it is copied (I1)", () => {
  beforeEach(() => {
    installStore();
    seedPage("page-a", "dept-1", ["no", "en"]);
    seedPage("page-b", "dept-1", ["no"]);
  });

  test("publishing A with T sets the department to T and strips A's stored docs", async () => {
    const result = await publishThemed("page-a", T);
    expect(departmentTheme("dept-1")).toEqual({
      theme_accent: T.accent,
      theme_dark: T.dark,
    });
    expect(result).toMatchObject({ themeCopied: true, themeCopyFailed: false });
    expect(clearPageTheme).toHaveBeenCalledWith("page-a");
    expect(docsWithTheme("page-a")).toEqual([]);
  });

  test("publishing B with U afterwards sets the department to U", async () => {
    await publishThemed("page-a", T);
    await publishThemed("page-b", U);
    expect(departmentTheme("dept-1")).toEqual({
      theme_accent: U.accent,
      theme_dark: U.dark,
    });
  });

  test("republishing A after a text edit leaves the department on U", async () => {
    await publishThemed("page-a", T);
    await publishThemed("page-b", U);
    const edited = opened("page-a", "no");
    await save("page-a", "no", {
      ...edited,
      meta: { ...edited.meta, title: "Typo fixed" },
    });
    const result = await publishPageAction("page-a", "no");
    expect(departmentTheme("dept-1")).toEqual({
      theme_accent: U.accent,
      theme_dark: U.dark,
    });
    expect(result).toMatchObject({
      themeCopied: false,
      themeCopyFailed: false,
    });
  });

  test("a reset on A then publish resets the department to BISO and strips A", async () => {
    await publishThemed("page-a", T);
    const result = await publishThemed("page-a", null);
    expect(departmentTheme("dept-1")).toEqual({
      theme_accent: null,
      theme_dark: null,
    });
    expect(result).toMatchObject({ themeCopied: true });
    expect(docsWithTheme("page-a")).toEqual([]);
  });

  test("publish reports the theme the department now has", async () => {
    const result = await publishThemed("page-a", T);
    expect(result.departmentTheme).toEqual({ id: "dept-1", theme: T });
    const reset = await publishThemed("page-a", null);
    expect(reset.departmentTheme).toEqual({ id: "dept-1", theme: null });
  });

  test("a page with no department keeps its theme", async () => {
    seedPage("page-c", null, ["no"]);
    const result = await publishThemed("page-c", T);
    expect(result).toMatchObject({
      themeCopied: false,
      themeCopyFailed: false,
    });
    expect(clearPageTheme).not.toHaveBeenCalled();
    expect(docsWithTheme("page-c")).toEqual(["no:draft", "no:published"]);
  });
});

describe("a failed department copy (minor 4)", () => {
  beforeEach(() => {
    installStore();
    seedPage("page-a", "dept-1", ["no"]);
  });

  test("the publish succeeds, reports the failure and keeps the theme for a retry", async () => {
    const write = adminDb.updateRow.getMockImplementation();
    adminDb.updateRow.mockImplementationOnce(() =>
      Promise.reject(new Error("appwrite blip"))
    );
    const result = await publishThemed("page-a", T);
    expect(publishPage).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ themeCopied: false, themeCopyFailed: true });
    expect(result.departmentTheme).toBeNull();
    expect(clearPageTheme).not.toHaveBeenCalled();
    expect(docsWithTheme("page-a")).toEqual(["no:draft", "no:published"]);

    adminDb.updateRow.mockImplementation(write as never);
    const retry = await publishPageAction("page-a", "no");
    expect(retry).toMatchObject({ themeCopied: true, themeCopyFailed: false });
    expect(departmentTheme("dept-1")).toEqual({
      theme_accent: T.accent,
      theme_dark: T.dark,
    });
  });
});

describe("theme is shared meta, saved to every locale (I2)", () => {
  beforeEach(() => {
    installStore();
  });

  test("saving no with a new theme writes it to the stored en draft; publishing en ships it", async () => {
    seedPage("page-c", null, ["no", "en"]);
    await save("page-c", "no", withTheme(opened("page-c", "no"), T));
    expect(syncSharedDraftMeta).toHaveBeenCalledWith({
      id: "page-c",
      locale: "no",
      meta: expect.objectContaining({ theme: T }),
    });
    expect(
      parse(store.pages.get("page-c")?.translations.en?.draft)?.meta.theme
    ).toEqual(T);

    await publishPageAction("page-c", "en");
    expect(
      parse(store.pages.get("page-c")?.translations.en?.published)?.meta.theme
    ).toEqual(T);
  });

  test("the synced fields are exactly the shared meta fields", async () => {
    seedPage("page-c", null, ["no", "en"]);
    await save("page-c", "no", withTheme(opened("page-c", "no"), T));
    const meta = syncSharedDraftMeta.mock.calls[0]?.[0].meta as Record<
      string,
      unknown
    >;
    expect(Object.keys(meta).sort()).toEqual(
      ["campus", "department", "slug", "status", "theme"].sort()
    );
  });

  test("a locale with no translation row gets none", async () => {
    seedPage("page-d", null, ["no"]);
    await save("page-d", "no", withTheme(opened("page-d", "no"), T));
    expect(store.pages.get("page-d")?.translations.en).toBeUndefined();
  });

  test("a department page published in en ships the theme saved in no", async () => {
    seedPage("page-a", "dept-1", ["no", "en"]);
    await save("page-a", "no", withTheme(opened("page-a", "no"), T));
    await publishPageAction("page-a", "en");
    expect(departmentTheme("dept-1")).toEqual({
      theme_accent: T.accent,
      theme_dark: T.dark,
    });
  });
});

describe("save returns the bound department (I3)", () => {
  beforeEach(() => {
    installStore();
  });

  test("a department user's new page reports the department it was bound to", async () => {
    currentCtx = {
      ...ctx,
      resolvedCampusIds: ["campus-oslo"],
      resolvedDepartmentIds: ["dept-1"],
      roles: [],
    };
    const result = await save(null, "no", doc() as Doc);
    expect(result.department).toBe("dept-1");
    expect(store.pages.get("page-new")?.department).toBe("dept-1");
  });

  test("an admin's page without a department reports none", async () => {
    const result = await save(null, "no", doc() as Doc);
    expect(result.department).toBe("");
  });
});

describe("a stale second tab cannot re-attach a theme Publish moved to the department", () => {
  beforeEach(() => {
    installStore();
    seedPage("page-a", "dept-1", ["no", "en"]);
  });

  test("saving the department's current theme stores no theme", async () => {
    // Tab 1 publishes T: the department has it, page A's docs are stripped.
    const staleNo = withTheme(opened("page-a", "no"), T);
    await publishThemed("page-a", T);
    expect(docsWithTheme("page-a")).toEqual([]);

    // Tab 2 still holds T (in another case) and saves an edit.
    const edit = {
      ...staleNo,
      meta: {
        ...staleNo.meta,
        theme: { accent: T.accent.toUpperCase(), dark: T.dark.toUpperCase() },
        title: "Typo fixed",
      },
    } as Doc;
    const saved = await save("page-a", "no", edit);
    // The tab is told, so it can stop holding the theme.
    expect(saved).toMatchObject({ themeDropped: true });

    expect(docsWithTheme("page-a")).toEqual([]);
    expect(
      parse(store.pages.get("page-a")?.translations.no?.draft)?.meta.title
    ).toBe("Typo fixed");
    // A later publish of A leaves the department as it is.
    const result = await publishPageAction("page-a", "no");
    expect(result).toMatchObject({ themeCopied: false });
  });

  test("a theme other than the department's is still saved", async () => {
    await publishThemed("page-a", T);
    const saved = await save(
      "page-a",
      "no",
      withTheme(opened("page-a", "no"), U)
    );
    expect(docsWithTheme("page-a")).toEqual(["no:draft", "en:draft"]);
    expect("themeDropped" in saved).toBe(false);
  });

  test("a reset on a department that already has BISO's colours stores no theme", async () => {
    const saved = await save(
      "page-a",
      "no",
      withTheme(opened("page-a", "no"), null)
    );
    expect(docsWithTheme("page-a")).toEqual([]);
    expect(saved).toMatchObject({ themeDropped: true });
  });

  test("a page with no department keeps the theme it saves", async () => {
    seedPage("page-c", null, ["no"]);
    store.departments.set("dept-1", {
      theme_accent: T.accent,
      theme_dark: T.dark,
    });
    const saved = await save(
      "page-c",
      "no",
      withTheme(opened("page-c", "no"), T)
    );
    expect(docsWithTheme("page-c")).toEqual(["no:draft"]);
    expect("themeDropped" in saved).toBe(false);
  });

  test("the department's theme is read once per save, with the admin client", async () => {
    await publishThemed("page-a", T);
    adminDb.getRow.mockClear();
    await save("page-a", "no", withTheme(opened("page-a", "no"), T));
    const themeReads = adminDb.getRow.mock.calls.filter(
      (call) =>
        call[1] === "departments" &&
        JSON.stringify(call[3] ?? "").includes("theme_dark")
    );
    expect(themeReads.length).toBe(1);
  });
});

describe("publishing a language that has no stored draft", () => {
  beforeEach(() => {
    installStore();
    seedPage("page-a", null, ["no"]);
  });

  test("answers missingTranslation as a value, and writes nothing", async () => {
    // A value, not a thrown message: Next.js hides a server action's error
    // message in production, so the editor could not tell this case apart.
    logAuditEvent.mockClear();
    const result = await publishPageAction("page-a", "en");
    expect(result).toEqual({ missingTranslation: true });
    expect(logAuditEvent).not.toHaveBeenCalled();
    expect(store.pages.get("page-a")?.translations.en).toBeUndefined();
  });

  test("an empty language answers missingTranslation too, and writes nothing", async () => {
    publishPage.mockImplementationOnce(() =>
      Promise.reject(new Error("Nothing to publish for en"))
    );
    logAuditEvent.mockClear();
    const result = await publishPageAction("page-a", "en");
    expect(result).toEqual({ missingTranslation: true });
    expect(logAuditEvent).not.toHaveBeenCalled();
  });

  test("other publish failures still throw", async () => {
    publishPage.mockImplementationOnce(() =>
      Promise.reject(new Error("appwrite blip"))
    );
    let message = "";
    const quiet = console.error;
    console.error = () => undefined;
    try {
      await publishPageAction("page-a", "no");
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    } finally {
      console.error = quiet;
    }
    expect(message).toBe("appwrite blip");
  });
});
