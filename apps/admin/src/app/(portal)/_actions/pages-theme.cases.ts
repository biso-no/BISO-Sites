import { beforeEach, describe, expect, mock, test } from "bun:test";

const CONTRAST = /contrast/i;

const ctx = {
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

const GOOD = { accent: "#C8A2F0", dark: "#3B1C6B" };
const BAD = { accent: "#3aa3e1", dark: "#9b5de5" };

const adminDb = { getRow: mock(), updateRow: mock(async () => ({})) };
const savePageDraft = mock(async () => ({
  pageId: "page-1",
  slug: "side",
  translationId: "t-1",
}));
const publishPage = mock(async () => undefined);
const getPageEditorById = mock(async (): Promise<unknown> => null);
const logAuditEvent = mock(
  async (_ctx: unknown, _action: string, _opts?: Record<string, unknown>) =>
    undefined
);

mock.module("server-only", () => ({}));
mock.module("@repo/api/page-builder", () => ({
  PAGE_LOCALES: ["no", "en"],
  getPageById: mock(async () => null),
  getPageEditorById,
  publishPage,
  resolvePageCampusId: mock(() => null),
  savePageDraft,
  savePageTranslationDraft: mock(async () => undefined),
  unpublishPage: mock(async () => undefined),
}));
mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db: adminDb })),
  createSessionClient: mock(async () => ({ db: adminDb })),
}));
mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => ctx),
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
  adminDb.getRow.mockReset();
  adminDb.updateRow.mockClear();
  savePageDraft.mockClear();
  publishPage.mockClear();
  getPageEditorById.mockReset();
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
      expect(result).toEqual({ pageId: "page-1", slug: "side" });
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
