import {
  afterAll,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test";
import type { UserAuthContext } from "@/lib/authorization";

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

const GOOD = { accent: "#C8A2F0", dark: "#3B1C6B" };

const adminDb = {
  getRow: mock(),
  updateRow: mock(async (..._args: unknown[]) => ({})),
};
const publishPage = mock(async () => undefined);
const unpublishPage = mock(async () => undefined);
const getPageEditorById = mock(async (): Promise<unknown> => null);
const clearPageTheme = mock(async (_id: string): Promise<void> => undefined);

mock.module("server-only", () => ({}));
mock.module("@repo/api/page-builder", () => ({
  PAGE_LOCALES: ["no", "en"],
  getPageById: mock(async () => null),
  clearPageTheme,
  getPageEditorById,
  publishPage,
  resolvePageCampusId: mock(() => null),
  savePageDraft: mock(async () => ({})),
  savePageTranslationDraft: mock(async () => undefined),
  syncSharedDraftMeta: mock(async () => undefined),
  unpublishPage,
}));
mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db: adminDb })),
  createSessionClient: mock(async () => ({ db: adminDb })),
}));
mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => ctx),
}));
mock.module("next/cache", () => ({ revalidatePath: mock(() => undefined) }));
mock.module("./audit-log", () => ({
  logAuditEvent: mock(async () => undefined),
}));

const { deletePageAction, publishPageAction, unpublishPageAction } =
  await import("./pages");

const originalFetch = globalThis.fetch;
const fetchMock = mock(async (..._args: unknown[]) => new Response("{}"));
const sentTags = (): string[][] =>
  fetchMock.mock.calls.map(
    (call) =>
      (
        JSON.parse((call[1] as RequestInit).body as string) as {
          tags: string[];
        }
      ).tags
  );

const pageRow = (departmentId: string | null) => ({
  $id: "page-1",
  campus: null,
  department: departmentId,
  department_id: departmentId,
  slug: "side",
});

const publishedWith = (theme?: unknown) => ({
  translations: {
    no: {
      publishedDocument: {
        sections: [],
        version: 2,
        meta: {
          department: "",
          description: "d",
          slug: "side",
          status: "published",
          title: "Side",
          ...(theme === undefined ? {} : { theme }),
        },
      },
    },
  },
});

const errorSpy = spyOn(console, "error").mockImplementation(() => undefined);
const warnSpy = spyOn(console, "warn").mockImplementation(() => undefined);

beforeEach(() => {
  process.env.NEXT_PUBLIC_WEB_BASE_URL = "https://biso.no";
  process.env.CRON_SECRET = "s3cret";
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => new Response("{}"));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  adminDb.getRow.mockReset();
  adminDb.updateRow.mockReset();
  adminDb.updateRow.mockImplementation(async () => ({}));
  getPageEditorById.mockReset();
});

afterAll(() => {
  globalThis.fetch = originalFetch;
  errorSpy.mockRestore();
  warnSpy.mockRestore();
});

describe("publishing tells the website to refresh (C5)", () => {
  test("publish notifies once with pages", async () => {
    adminDb.getRow.mockResolvedValue(pageRow(null));
    await publishPageAction("page-1", "no");
    expect(sentTags()).toEqual([["pages"]]);
  });

  test("publish after a department theme copy adds departments", async () => {
    adminDb.getRow.mockResolvedValue(pageRow("dept-1"));
    getPageEditorById.mockResolvedValue(publishedWith(GOOD));
    await publishPageAction("page-1", "no");
    expect(sentTags()).toEqual([["pages", "departments"]]);
  });

  test("a department page without a theme change notifies pages only", async () => {
    adminDb.getRow.mockResolvedValue(pageRow("dept-1"));
    getPageEditorById.mockResolvedValue(publishedWith(undefined));
    await publishPageAction("page-1", "no");
    expect(sentTags()).toEqual([["pages"]]);
  });

  test("unpublish notifies with pages", async () => {
    adminDb.getRow.mockResolvedValue(pageRow(null));
    await unpublishPageAction("page-1", "no");
    expect(sentTags()).toEqual([["pages"]]);
  });

  test("archiving notifies with pages", async () => {
    adminDb.getRow.mockResolvedValue(pageRow(null));
    await deletePageAction("page-1");
    expect(sentTags()).toEqual([["pages"]]);
  });

  test("a rejecting fetch never fails publish, unpublish or archive", async () => {
    fetchMock.mockImplementation(() =>
      Promise.reject(new Error("website down"))
    );
    adminDb.getRow.mockResolvedValue(pageRow(null));
    await expect(publishPageAction("page-1", "no")).resolves.toBeDefined();
    await expect(unpublishPageAction("page-1", "no")).resolves.toBeUndefined();
    await expect(deletePageAction("page-1")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
