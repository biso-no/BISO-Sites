import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { UserAuthContext } from "@/lib/authorization";

/**
 * Department users' pages live under their unit: `units/<campus>/<unit>/<name>`.
 * These cases run the real save action against an in-memory departments and
 * pages table, for a Fadderullan member, an Oslo campus admin and a global
 * admin.
 */

const FADDERULLAN = "24";
const INVEST = "35";
const OSLO = "1";
const UNIT = "units/oslo/fadderullan";

const context = (overrides: Partial<UserAuthContext>): UserAuthContext => ({
  activeCampusId: undefined,
  campusNames: ["Oslo"],
  campusTeamIds: ["sg-app-campus-oslo"],
  departmentNames: [],
  departmentTeamIds: [],
  email: null,
  managedCampusIds: [],
  managedCampuses: [],
  name: null,
  resolvedCampusIds: [OSLO],
  resolvedDepartmentIds: [],
  roles: [],
  userId: "user-1",
  ...overrides,
});

const fadderullanMember = () =>
  context({
    departmentNames: ["OSLFadderullan"],
    departmentTeamIds: ["sg-app-dept-oslfadderullan"],
    resolvedDepartmentIds: [FADDERULLAN],
  });
const osloCampusAdmin = () =>
  context({
    departmentNames: ["Ledelsen Oslo"],
    departmentTeamIds: ["sg-app-dept-ledelsenoslo"],
    managedCampusIds: [OSLO],
    managedCampuses: ["Oslo"],
    resolvedDepartmentIds: ["2"],
    roles: ["campusadmin"],
  });
const globalAdmin = () =>
  context({
    campusNames: ["National"],
    resolvedCampusIds: ["5"],
    roles: ["globaladmin"],
  });

let currentCtx: UserAuthContext = fadderullanMember();

const tables: {
  departments: Record<string, Record<string, unknown>>;
  pages: Record<string, Record<string, unknown>>;
} = { departments: {}, pages: {} };

const adminDb = {
  getRow: mock((_db: string, table: string, id: string) => {
    const row = tables[table as keyof typeof tables]?.[id];
    if (!row) {
      return Promise.reject(
        Object.assign(new Error("Row not found"), {
          code: 404,
          type: "row_not_found",
        })
      );
    }
    return Promise.resolve(row);
  }),
  listRows: mock(() => Promise.resolve({ rows: [], total: 0 })),
  updateRow: mock(async () => ({})),
};
const savePageDraft = mock(
  async (params: {
    campusId?: string | null;
    doc: { meta: { slug: string } };
    id: string | null;
  }) => ({
    pageId: params.id ?? "new-page",
    slug: params.doc.meta.slug,
    translationId: "t-1",
  })
);

mock.module("server-only", () => ({}));
mock.module("@repo/api/page-builder", () => ({
  PAGE_DRAFTS_TABLE_ID: "page_drafts",
  PAGE_LOCALES: ["no", "en"],
  archivePage: mock(async () => undefined),
  clearPageTheme: mock(async () => undefined),
  getPageById: mock(async () => null),
  getPageEditorById: mock(async () => null),
  publishPage: mock(async () => undefined),
  resolvePageCampusId: mock(() => OSLO),
  savePageDraft,
  savePageTranslationDraft: mock(async () => ({
    translationId: "t-en",
    updatedAt: "v",
  })),
  syncSharedDraftMeta: mock(async () => undefined),
  unpublishPage: mock(async () => undefined),
}));
mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db: adminDb })),
  createSessionClient: mock(async () => ({ db: adminDb })),
}));
mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => currentCtx),
}));
mock.module("@/lib/web-revalidate", () => ({
  notifyWebsite: mock(async () => undefined),
}));
mock.module("next/cache", () => ({ revalidatePath: mock(() => undefined) }));
mock.module("./audit-log", () => ({
  logAuditEvent: mock(async () => undefined),
}));

const { savePageEditorDoc } = await import("./pages");

const doc = (slug: string, department = FADDERULLAN, campus?: string) => ({
  meta: {
    ...(campus === undefined ? {} : { campus }),
    department,
    description: "",
    slug,
    status: "draft",
    title: "Program",
  },
  sections: [],
  version: 2,
});

const save = (
  slug: string,
  department = FADDERULLAN,
  id: string | null = null
) => savePageEditorDoc({ doc: doc(slug, department) as never, id });

const department = (id: string, name: string, slug: string, campus = OSLO) => ({
  $id: id,
  campus,
  campus_id: campus,
  Name: name,
  slug,
});

beforeEach(() => {
  currentCtx = fadderullanMember();
  tables.departments = {
    [FADDERULLAN]: department(FADDERULLAN, "OSL Fadderullan", "fadderullan"),
    [INVEST]: department(INVEST, "OSL Invest", "invest"),
  };
  tables.pages = {
    legacy: {
      $id: "legacy",
      campus: OSLO,
      campus_id: OSLO,
      department: FADDERULLAN,
      department_id: FADDERULLAN,
      slug: "uten-navn-7",
    },
    sub: {
      $id: "sub",
      campus: OSLO,
      campus_id: OSLO,
      department: FADDERULLAN,
      department_id: FADDERULLAN,
      slug: `${UNIT}/a`,
    },
  };
  savePageDraft.mockClear();
});

describe("a department member creating a page", () => {
  test("may create it under their unit, on their unit's campus", async () => {
    const saved = await save(`${UNIT}/program`);

    expect(saved).not.toHaveProperty("error");
    expect(savePageDraft.mock.calls[0]?.[0].doc.meta.slug).toBe(
      `${UNIT}/program`
    );
    expect(savePageDraft.mock.calls[0]?.[0].campusId).toBe(OSLO);
  });

  test("may not create it at a top-level address", async () => {
    expect(await save("program")).toEqual({
      error: `Your department's pages live under ${UNIT}/ — give the page a name after that.`,
    });
    expect(savePageDraft).not.toHaveBeenCalled();
  });

  test("may not put it under another unit's address", async () => {
    const saved = await save("units/oslo/invest/program");
    expect(saved).toHaveProperty("error");
    expect(savePageDraft).not.toHaveBeenCalled();
  });

  test("may not put it under a department that isn't theirs", async () => {
    const saved = await save("units/oslo/invest/program", INVEST);
    expect(saved).toHaveProperty("error");
    expect(savePageDraft).not.toHaveBeenCalled();
  });
});

describe("a department member editing a page", () => {
  test("may keep an older page's address", async () => {
    expect(await save("uten-navn-7", FADDERULLAN, "legacy")).not.toHaveProperty(
      "error"
    );
  });

  test("may move an older page under their unit, but nowhere else", async () => {
    expect(await save("about/x", FADDERULLAN, "legacy")).toHaveProperty(
      "error"
    );
    expect(
      await save(`${UNIT}/moved`, FADDERULLAN, "legacy")
    ).not.toHaveProperty("error");
  });

  test("may rename a sub-page within their unit", async () => {
    expect(await save(`${UNIT}/b`, FADDERULLAN, "sub")).not.toHaveProperty(
      "error"
    );
  });
});

describe("admins", () => {
  test("a campus admin still creates pages at any address", async () => {
    currentCtx = osloCampusAdmin();
    expect(await save("program", FADDERULLAN)).not.toHaveProperty("error");
  });

  test("a sub-page takes its department's campus, whatever the editor chose", async () => {
    currentCtx = globalAdmin();
    const saved = await savePageEditorDoc({
      doc: doc(`${UNIT}/program`, FADDERULLAN, "") as never,
      id: null,
    });

    expect(saved).not.toHaveProperty("error");
    expect(savePageDraft.mock.calls[0]?.[0].campusId).toBe(OSLO);
  });
});
