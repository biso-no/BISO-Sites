import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Query } from "@repo/api";
import type { UserAuthContext } from "@/lib/authorization";

const NATIONAL = /national/i;
const HUB_ERROR = /global admin/i;

function makeCtx(overrides: Partial<UserAuthContext> = {}): UserAuthContext {
  return {
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
    roles: [],
    userId: "user-1",
    ...overrides,
  };
}

let currentCtx: UserAuthContext = makeCtx({ roles: ["globaladmin"] });

const adminDb = {
  getRow: mock(),
  listRows: mock(),
};
const savePageDraft = mock(
  async (params: {
    campusId?: string | null;
    doc: { meta: { department?: string; slug: string } };
    id: string | null;
  }) => ({
    pageId: params.id ?? "new-page-id",
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
  resolvePageCampusId: mock(() => null),
  savePageDraft,
  savePageTranslationDraft: mock(async () => undefined),
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
mock.module("next/cache", () => ({ revalidatePath: mock(() => undefined) }));
mock.module("./audit-log", () => ({
  logAuditEvent: mock(async () => undefined),
}));

const {
  deletePageAction,
  publishPageAction,
  savePageEditorDoc,
  unpublishPageAction,
} = await import("./pages");
const { createProjectPage, createUnitPage, getDepartmentWithPage } =
  await import("./departments");

const docAt = (slug: string, department = "") => ({
  meta: {
    department,
    description: "d",
    slug,
    status: "draft",
    title: "T",
  },
  sections: [],
  version: 2,
});

const pagesTable: { rows: Record<string, unknown>[] } = { rows: [] };
const departmentsTable: { rows: Record<string, unknown>[] } = { rows: [] };

beforeEach(() => {
  currentCtx = makeCtx({ roles: ["globaladmin"] });
  pagesTable.rows = [];
  departmentsTable.rows = [];
  savePageDraft.mockClear();
  adminDb.getRow.mockReset();
  adminDb.listRows.mockReset();
  adminDb.listRows.mockImplementation((_db: string, table: string) => {
    let rows: Record<string, unknown>[] = [];
    if (table === "pages") {
      rows = pagesTable.rows;
    } else if (table === "departments") {
      rows = departmentsTable.rows;
    }
    return Promise.resolve({ rows, total: rows.length });
  });
});

describe("savePageEditorDoc and the projects/ namespace", () => {
  test("refuses a new page at a project address, any casing", async () => {
    for (const slug of [
      "projects/winter-games",
      "Projects/winter-games",
      " projects/winter-games",
    ]) {
      const result = await savePageEditorDoc({
        doc: docAt(slug) as never,
        id: null,
      });
      expect(result).toHaveProperty("error");
    }
    expect(savePageDraft).not.toHaveBeenCalled();
  });

  test("reserves the whole projects/ prefix, known project or not", async () => {
    for (const slug of ["projects/charity", "projects/a/b", "PROJECTS/x"]) {
      const result = await savePageEditorDoc({
        doc: docAt(slug) as never,
        id: null,
      });
      expect(result).toHaveProperty("error");
    }
    expect(savePageDraft).not.toHaveBeenCalled();
  });

  test("refuses renaming an ordinary page into a project address", async () => {
    adminDb.getRow.mockResolvedValue({
      $id: "p1",
      campus: null,
      department: null,
      department_id: null,
      slug: "about",
    });
    const result = await savePageEditorDoc({
      doc: docAt("projects/winter-games") as never,
      id: "p1",
    });
    expect(result).toHaveProperty("error");
    expect(savePageDraft).not.toHaveBeenCalled();
  });

  test("a globaladmin may save a hub page", async () => {
    adminDb.getRow.mockResolvedValue({
      $id: "p1",
      campus: null,
      department: null,
      department_id: null,
      slug: "projects/fadderullan",
    });
    const result = await savePageEditorDoc({
      doc: docAt("projects/fadderullan") as never,
      id: "p1",
    });
    expect(result).not.toHaveProperty("error");
    expect(savePageDraft).toHaveBeenCalledTimes(1);
  });

  test("a campus admin who manages the campus still cannot save a hub page", async () => {
    currentCtx = makeCtx({
      managedCampusIds: ["1"],
      resolvedCampusIds: ["1"],
      roles: ["campusadmin"],
    });
    adminDb.getRow.mockResolvedValue({
      $id: "p1",
      campus: "1",
      campus_id: "1",
      department: null,
      department_id: null,
      slug: "projects/fadderullan",
    });
    const result = await savePageEditorDoc({
      doc: docAt("projects/fadderullan") as never,
      id: "p1",
    });
    expect(result).toHaveProperty("error");
    expect(savePageDraft).not.toHaveBeenCalled();
  });

  test("a department user is refused a hub page", async () => {
    currentCtx = makeCtx({
      resolvedCampusIds: ["1"],
      resolvedDepartmentIds: ["dept-1"],
      roles: ["department"],
    });
    adminDb.getRow.mockResolvedValue({
      $id: "p1",
      campus: null,
      department: null,
      department_id: null,
      slug: "projects/fadderullan",
    });
    const result = await savePageEditorDoc({
      doc: docAt("projects/fadderullan", "dept-1") as never,
      id: "p1",
    });
    expect(result).toHaveProperty("error");
    expect(savePageDraft).not.toHaveBeenCalled();
  });

  test("a national unit's member may save the unit's project page", async () => {
    currentCtx = makeCtx({
      resolvedCampusIds: ["5"],
      resolvedDepartmentIds: ["dept-w"],
      roles: ["department"],
    });
    adminDb.getRow.mockResolvedValue({
      $id: "p1",
      campus: "5",
      campus_id: "5",
      department: "dept-w",
      department_id: "dept-w",
      slug: "projects/winter-games",
    });
    adminDb.listRows.mockResolvedValue({ rows: [], total: 0 });
    const result = await savePageEditorDoc({
      doc: docAt("projects/winter-games", "dept-w") as never,
      id: "p1",
    });
    expect(result).not.toHaveProperty("error");
  });
});

const unit = (overrides: Record<string, unknown>) => ({
  $id: "dept-1",
  Name: "Wintergames",
  active: true,
  campus_id: "5",
  slug: "wintergames",
  type: null,
  ...overrides,
});

describe("createUnitPage for project units", () => {
  test("the national Wintergames unit gets projects/winter-games, bound to it", async () => {
    departmentsTable.rows = [unit({})];
    const result = await createUnitPage("dept-1");
    expect(result).not.toHaveProperty("error");
    const call = savePageDraft.mock.calls[0]?.[0];
    expect(call?.doc.meta.slug).toBe("projects/winter-games");
    expect(call?.doc.meta.department).toBe("dept-1");
  });

  test("a campus Fadderullan unit keeps its units/ address", async () => {
    departmentsTable.rows = [
      unit({ Name: "OSL Fadderullan", campus_id: "1", slug: "fadderullan" }),
    ];
    await createUnitPage("dept-1");
    expect(savePageDraft.mock.calls[0]?.[0].doc.meta.slug).toBe(
      "units/oslo/fadderullan"
    );
  });

  test("a national unit that is not a project keeps units/national/", async () => {
    departmentsTable.rows = [unit({ Name: "Rederiet", slug: "rederiet" })];
    await createUnitPage("dept-1");
    expect(savePageDraft.mock.calls[0]?.[0].doc.meta.slug).toBe(
      "units/national/rederiet"
    );
  });

  test("is idempotent and still refuses a squatter at the project slug", async () => {
    departmentsTable.rows = [unit({})];
    pagesTable.rows = [{ $id: "existing", department_id: "dept-1" }];
    expect(await createUnitPage("dept-1")).toEqual({ pageId: "existing" });
    pagesTable.rows = [{ $id: "squatter", department_id: null }];
    expect(await createUnitPage("dept-1")).toHaveProperty("error");
    expect(savePageDraft).not.toHaveBeenCalled();
  });
});

describe("national unit address and the card", () => {
  test("a national unit named like a hub project keeps units/national/", async () => {
    departmentsTable.rows = [
      unit({ Name: "Fadderullan", slug: "fadderullan" }),
    ];
    await createUnitPage("dept-1");
    expect(savePageDraft.mock.calls[0]?.[0].doc.meta.slug).toBe(
      "units/national/fadderullan"
    );
  });

  test("a hub squatting a national project's address is named as a hub", async () => {
    departmentsTable.rows = [unit({})];
    pagesTable.rows = [{ $id: "hub", department_id: null }];
    const result = await createUnitPage("dept-1");
    expect((result as { error: string }).error).toBe(
      "A project hub page already uses this address"
    );
  });

  test("the national Wintergames card looks up projects/winter-games", async () => {
    departmentsTable.rows = [unit({})];
    pagesTable.rows = [{ $id: "pw", department_id: "dept-1" }];
    const result = await getDepartmentWithPage("dept-1");
    expect(result?.page?.$id).toBe("pw");
    const pageQueries = adminDb.listRows.mock.calls
      .filter((call) => call[1] === "pages")
      .flatMap((call) => call[2] as string[]);
    expect(pageQueries).toContain(Query.equal("slug", "projects/winter-games"));
  });
});

describe("hub pages: publish, unpublish, archive, campus", () => {
  const hubRow = {
    $id: "hub",
    campus: "1",
    campus_id: "1",
    department: null,
    department_id: null,
    slug: "projects/fadderullan",
  };
  const campusAdmin = () =>
    makeCtx({
      managedCampusIds: ["1"],
      resolvedCampusIds: ["1"],
      roles: ["campusadmin"],
    });

  test("a campus admin cannot publish, unpublish or archive a hub", async () => {
    currentCtx = campusAdmin();
    adminDb.getRow.mockResolvedValue(hubRow);
    await expect(publishPageAction("hub", "no")).rejects.toThrow(HUB_ERROR);
    await expect(unpublishPageAction("hub")).rejects.toThrow(HUB_ERROR);
    await expect(deletePageAction("hub")).rejects.toThrow(HUB_ERROR);
  });

  test("saving a hub with meta.campus stores a null campus", async () => {
    adminDb.getRow.mockResolvedValue(hubRow);
    const hubDoc = docAt("projects/fadderullan");
    const result = await savePageEditorDoc({
      doc: { ...hubDoc, meta: { ...hubDoc.meta, campus: "1" } } as never,
      id: "hub",
    });
    expect(result).not.toHaveProperty("error");
    expect(savePageDraft.mock.calls[0]?.[0].campusId).toBeNull();
  });
});

describe("createProjectPage", () => {
  test("refuses anyone but a globaladmin", async () => {
    currentCtx = makeCtx({
      managedCampusIds: ["1"],
      roles: ["campusadmin"],
    });
    expect(await createProjectPage("fadderullan")).toHaveProperty("error");
    expect(savePageDraft).not.toHaveBeenCalled();
  });

  test("refuses an unknown project", async () => {
    expect(await createProjectPage("not-a-project")).toHaveProperty("error");
    expect(savePageDraft).not.toHaveBeenCalled();
  });

  test("creates a department-less page at projects/<project>", async () => {
    const result = await createProjectPage("fadderullan");
    expect(result).toEqual({ pageId: "new-page-id" });
    const call = savePageDraft.mock.calls[0]?.[0];
    expect(call?.doc.meta.slug).toBe("projects/fadderullan");
    expect(call?.doc.meta.department ?? "").toBe("");
  });

  test("is idempotent for a hub page", async () => {
    pagesTable.rows = [{ $id: "hub", department_id: null }];
    expect(await createProjectPage("fadderullan")).toEqual({ pageId: "hub" });
    expect(savePageDraft).not.toHaveBeenCalled();
  });

  test("explains a unit's page sitting at a hub address", async () => {
    pagesTable.rows = [{ $id: "national", department_id: "dept-w" }];
    const result = await createProjectPage("fadderullan");
    expect((result as { error: string }).error).toMatch(NATIONAL);
    expect(savePageDraft).not.toHaveBeenCalled();
  });

  test("winter-games as globaladmin creates the national unit's page", async () => {
    departmentsTable.rows = [unit({})];
    const result = await createProjectPage("winter-games");
    expect(result).toEqual({ pageId: "new-page-id" });
    const call = savePageDraft.mock.calls[0]?.[0];
    expect(call?.doc.meta.slug).toBe("projects/winter-games");
    expect(call?.doc.meta.department).toBe("dept-1");
  });

  test("winter-games returns the unit's existing page", async () => {
    departmentsTable.rows = [unit({})];
    pagesTable.rows = [{ $id: "wg", department_id: "dept-1" }];
    expect(await createProjectPage("winter-games")).toEqual({ pageId: "wg" });
    expect(savePageDraft).not.toHaveBeenCalled();
  });

  test("winter-games says so when the unit is missing or inactive", async () => {
    const missing = await createProjectPage("winter-games");
    expect((missing as { error: string }).error).toContain("isn't set up yet");
    departmentsTable.rows = [unit({ active: false })];
    expect(await createProjectPage("winter-games")).toHaveProperty("error");
    expect(savePageDraft).not.toHaveBeenCalled();
  });

  test("winter-games is refused for a non-globaladmin", async () => {
    currentCtx = makeCtx({ managedCampusIds: ["5"], roles: ["campusadmin"] });
    departmentsTable.rows = [unit({})];
    expect(await createProjectPage("winter-games")).toHaveProperty("error");
    expect(savePageDraft).not.toHaveBeenCalled();
  });
});
