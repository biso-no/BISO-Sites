import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { UserAuthContext } from "@/lib/authorization";
import { parseTeamMemberships } from "@/lib/authorization-team-memberships";
import { CAMPUS_NAME_TO_ID } from "@/lib/campus-constants";

/**
 * Can the Winter Games board edit and publish its own page?
 *
 * The page is `projects/winter-games`, bound to the campus-5 Wintergames
 * unit. M365 syncs the department team (SG-App-Dept-Wintergames) and the
 * campus team (SG-App-Campus-<City>) separately, and a board member's campus
 * team is their city, not National. These cases build the context the way
 * `getUserAuthContext` does (team parse, then campus names to ids) and run the
 * real page actions against it.
 */

const WG = "dept-w";
const NATIONAL = "5";

/** The context `getUserAuthContext` derives from these team memberships. */
function contextFromTeams(
  teams: { $id: string; name: string }[],
  resolvedDepartmentIds: string[]
): UserAuthContext {
  const parsed = parseTeamMemberships(teams);
  return {
    activeCampusId: undefined,
    campusNames: parsed.campusNames,
    campusTeamIds: parsed.campusTeamIds,
    departmentNames: parsed.departmentNames,
    departmentTeamIds: parsed.departmentTeamIds,
    email: null,
    managedCampusIds: [],
    managedCampuses: [],
    name: null,
    resolvedCampusIds: parsed.campusNames
      .map((name) => CAMPUS_NAME_TO_ID[name])
      .filter((id): id is string => Boolean(id)),
    // `resolveDepartmentIds`: departments whose Name equals the team name.
    resolvedDepartmentIds,
    roles: parsed.roles,
    userId: "user-1",
  };
}

const WG_TEAM = { $id: "sg-app-dept-wintergames", name: "Wintergames" };
/** A Winter Games board member whose campus team is Oslo. */
const boardMemberInOslo = () =>
  contextFromTeams(
    [WG_TEAM, { $id: "sg-app-campus-oslo", name: "Oslo" }],
    [WG]
  );
/** A Winter Games board member with no campus team at all. */
const boardMemberWithoutCampus = () => contextFromTeams([WG_TEAM], [WG]);

let currentCtx: UserAuthContext = boardMemberInOslo();

const tables: {
  departments: Record<string, Record<string, unknown>>;
  pages: Record<string, Record<string, unknown>>;
} = { departments: {}, pages: {} };

const adminDb = {
  getRow: mock((_db: string, table: string, id: string) => {
    const row = tables[table as keyof typeof tables]?.[id];
    if (!row) {
      return Promise.reject(
        Object.assign(new Error("Row not found"), { code: 404 })
      );
    }
    return Promise.resolve(row);
  }),
  // Departments by `Name` (the grant's uniqueness read); nothing else here
  // needs rows.
  listRows: mock((_db: string, table: string, queries: string[] = []) => {
    if (table !== "departments") {
      return Promise.resolve({ rows: [], total: 0 });
    }
    const names = queries
      .map((query) => JSON.parse(query) as Record<string, unknown>)
      .filter((query) => query.method === "equal" && query.attribute === "Name")
      .flatMap((query) => query.values as unknown[]);
    const rows = Object.values(tables.departments).filter((row) =>
      names.includes(row.Name)
    );
    return Promise.resolve({ rows, total: rows.length });
  }),
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
const publishPage = mock(async () => undefined);
const unpublishPage = mock(async () => undefined);
const getPageEditorById = mock((id: string) => {
  const row = tables.pages[id];
  if (!row) {
    return Promise.resolve(null);
  }
  return Promise.resolve({
    availableLocales: ["no", "en"],
    page: {
      campusId: row.campus_id ?? null,
      departmentId: row.department_id ?? "",
      id,
      slug: row.slug,
      status: "draft",
      visibility: "public",
    },
    translations: {},
  });
});

mock.module("server-only", () => ({}));
const archivePage = mock(async (..._args: unknown[]) => undefined);
mock.module("@repo/api/page-builder", () => ({
  PAGE_DRAFTS_TABLE_ID: "page_drafts",
  PAGE_LOCALES: ["no", "en"],
  archivePage,
  clearPageTheme: mock(async () => undefined),
  getPageById: mock(async () => null),
  getPageEditorById,
  publishPage,
  resolvePageCampusId: mock(() => null),
  savePageDraft,
  savePageTranslationDraft: mock(async () => ({
    translationId: "t-en",
    updatedAt: "v",
  })),
  syncSharedDraftMeta: mock(async () => undefined),
  unpublishPage,
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

const {
  deletePageAction,
  getPageEditorById: openInEditor,
  listPages,
  publishPageAction,
  savePageEditorDoc,
  unpublishPageAction,
} = await import("./pages");

const winterGamesDoc = (department = WG) => ({
  meta: {
    campus: NATIONAL,
    department,
    description: "",
    slug: "projects/winter-games",
    status: "draft",
    title: "Winter Games",
  },
  sections: [],
  version: 2,
});

beforeEach(() => {
  currentCtx = boardMemberInOslo();
  tables.departments = {
    [WG]: {
      $id: WG,
      campus: NATIONAL,
      campus_id: NATIONAL,
      Name: "Wintergames",
    },
    "dept-x": { $id: "dept-x", campus: "1", campus_id: "1", Name: "OSL Other" },
  };
  tables.pages = {
    pw: {
      $id: "pw",
      campus: NATIONAL,
      campus_id: NATIONAL,
      department: WG,
      department_id: WG,
      slug: "projects/winter-games",
      status: "draft",
    },
  };
  savePageDraft.mockClear();
  publishPage.mockClear();
  unpublishPage.mockClear();
  adminDb.listRows.mockClear();
  adminDb.updateRow.mockClear();
});

describe("the Winter Games board without the National campus team", () => {
  test("is derived as a plain department member of Wintergames", () => {
    const ctx = boardMemberInOslo();
    expect(ctx.roles).not.toContain("globaladmin");
    expect(ctx.managedCampusIds).toEqual([]);
    expect(ctx.resolvedCampusIds).toEqual(["1"]);
    expect(ctx.resolvedCampusIds).not.toContain(NATIONAL);
    expect(ctx.departmentNames).toEqual(["Wintergames"]);
  });

  for (const [who, ctx] of [
    ["in Oslo", boardMemberInOslo],
    ["with no campus team", boardMemberWithoutCampus],
  ] as const) {
    test(`${who}: opens the unit's page in the editor`, async () => {
      currentCtx = ctx();
      expect(await openInEditor("pw")).not.toBeNull();
    });

    test(`${who}: saves it, and it stays on its unit's campus`, async () => {
      currentCtx = ctx();
      const saved = await savePageEditorDoc({
        doc: winterGamesDoc() as never,
        id: "pw",
      });
      expect(saved).not.toHaveProperty("error");
      expect(savePageDraft.mock.calls[0]?.[0].campusId).toBe(NATIONAL);
    });

    test(`${who}: publishes and unpublishes it`, async () => {
      currentCtx = ctx();
      await publishPageAction("pw", "no");
      expect(publishPage).toHaveBeenCalledTimes(1);
      await unpublishPageAction("pw");
      expect(unpublishPage).toHaveBeenCalledTimes(1);
    });

    test(`${who}: archives it`, async () => {
      currentCtx = ctx();
      await deletePageAction("pw");
      expect(archivePage).toHaveBeenCalledWith(adminDb, "pw");
    });
  }
});

describe("the department-campus grant stays narrow", () => {
  test("only the bound department's own campus: a row on another campus is refused", async () => {
    tables.pages.pw = { ...tables.pages.pw, campus: "2", campus_id: "2" };

    expect(await openInEditor("pw")).toBeNull();
    expect(
      await savePageEditorDoc({ doc: winterGamesDoc() as never, id: "pw" })
    ).toHaveProperty("error");
    await expect(publishPageAction("pw", "no")).rejects.toThrow();
    await expect(unpublishPageAction("pw")).rejects.toThrow();
    await expect(deletePageAction("pw")).rejects.toThrow();
    expect(savePageDraft).not.toHaveBeenCalled();
    expect(publishPage).not.toHaveBeenCalled();
  });

  test("only departments the caller belongs to: another unit's member gets nothing", async () => {
    currentCtx = contextFromTeams(
      [
        { $id: "sg-app-dept-other", name: "OSL Other" },
        { $id: "sg-app-campus-oslo", name: "Oslo" },
      ],
      ["dept-x"]
    );

    expect(await openInEditor("pw")).toBeNull();
    expect(
      await savePageEditorDoc({ doc: winterGamesDoc() as never, id: "pw" })
    ).toHaveProperty("error");
    await expect(publishPageAction("pw", "no")).rejects.toThrow();
    expect(savePageDraft).not.toHaveBeenCalled();
    expect(publishPage).not.toHaveBeenCalled();
  });

  test("no grant when the member's department name matches two departments", async () => {
    // A second "Wintergames" row on Bergen: the team name resolves to both.
    tables.departments["dept-w-bergen"] = {
      $id: "dept-w-bergen",
      campus: "2",
      campus_id: "2",
      Name: "Wintergames",
    };
    currentCtx = contextFromTeams(
      [WG_TEAM, { $id: "sg-app-campus-oslo", name: "Oslo" }],
      [WG, "dept-w-bergen"]
    );

    expect(await openInEditor("pw")).toBeNull();
    expect(
      await savePageEditorDoc({ doc: winterGamesDoc() as never, id: "pw" })
    ).toHaveProperty("error");
    await expect(publishPageAction("pw", "no")).rejects.toThrow();
    expect(savePageDraft).not.toHaveBeenCalled();
    expect(publishPage).not.toHaveBeenCalled();
  });

  test("a campus admin keeps the managed-campus rule, department or not", async () => {
    currentCtx = {
      ...boardMemberInOslo(),
      managedCampusIds: ["1"],
      managedCampuses: ["Oslo"],
      roles: ["campusadmin"],
    };

    expect(await openInEditor("pw")).toBeNull();
    await expect(publishPageAction("pw", "no")).rejects.toThrow();
  });

  test("the /pages list is scoped as before: the member's own campus only", async () => {
    await listPages();

    const [, , queries] = adminDb.listRows.mock.calls[0] as unknown as [
      string,
      string,
      string[],
    ];
    const scope = queries.filter((query) => query.includes("campus.$id"));
    expect(scope).toHaveLength(1);
    expect(scope[0]).toContain('"1"');
    expect(scope[0]).not.toContain(`"${NATIONAL}"`);
  });
});
