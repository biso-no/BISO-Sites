import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Query } from "@repo/api";
import type { UserAuthContext } from "@/lib/authorization";

/**
 * Regression coverage for two boundary bugs on the department ("unit") page
 * actions:
 *
 * 1. listDepartments' campus scoping must never let a non-global-admin see
 *    another campus's departments via the admin_campus_ctx cookie
 *    (ctx.activeCampusId) — only a global admin's campus-switcher use of that
 *    cookie should narrow the query. See the comment on the `activeCampusId`
 *    branch in ./departments.ts for the full story: the switcher UI is gated
 *    to global admins, but the server action that writes the cookie is not,
 *    so a campus admin could otherwise point it at a campus they don't
 *    manage and see that campus's departments (whose cards then 404 at
 *    getDepartmentWithPage's canManageDepartment check).
 * 2. createUnitPage must reject creating a page for an inactive department,
 *    INCLUDING a department whose `active` is null — the sync deliberately
 *    keeps an inactive department's slug, so without this guard the action
 *    would create a page that both public lookups (which filter
 *    `active = true`, excluding null) can never serve. This deliberately
 *    diverges from listDepartments' own null-as-active treatment, which
 *    answers a different question (does this row appear in the admin
 *    management listing) than this guard does (will this be reachable on
 *    the public site).
 *
 * Only the I/O boundaries are mocked (`@repo/api/server`'s clients,
 * `@repo/api/page-builder`'s `savePageDraft`, auth, revalidation, audit log)
 * — `@/lib/departments`' `canManageDepartment` and `@repo/shared`'s
 * `unitPageSlug` run for real, matching the mocking pattern in
 * `admin-content-boundary.test.ts` and `pages-editor-doc.test.ts`.
 */

const sessionDb = {
  listRows: mock(),
};
const adminDb = {
  listRows: mock(),
};

function makeCtx(overrides: Partial<UserAuthContext> = {}): UserAuthContext {
  return {
    activeCampusId: undefined,
    campusNames: [],
    campusTeamIds: [],
    departmentNames: [],
    departmentTeamIds: [],
    email: null,
    managedCampuses: [],
    managedCampusIds: [],
    name: null,
    resolvedCampusIds: [],
    resolvedDepartmentIds: [],
    roles: [],
    userId: "user-1",
    ...overrides,
  };
}

let currentCtx: UserAuthContext = makeCtx();

const savePageDraftSpy = mock(async (params: { id: string | null }) => ({
  pageId: params.id ?? "new-page-id",
  slug: "units/oslo/fadderullan",
  translationId: "translation-1",
}));

mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db: adminDb })),
  createSessionClient: mock(async () => ({ db: sessionDb })),
}));
mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => currentCtx),
}));
// Bun's `mock.module` replaces a specifier for the WHOLE test run, not just
// this file — whichever test file resolves "@repo/api/page-builder" first
// wins for every other file that imports it too. `pages-editor-doc.test.ts`
// mocks the same specifier with this full export set; mirror it exactly
// (rather than only the `savePageDraft` this file needs) so load order
// between the two files can't leave the other one missing an export.
mock.module("@repo/api/page-builder", () => ({
  PAGE_LOCALES: ["no", "en"],
  getPageById: mock(async () => null),
  getPageEditorById: mock(async () => null),
  publishPage: mock(async () => undefined),
  resolvePageCampusId: mock(() => null),
  savePageDraft: savePageDraftSpy,
  savePageTranslationDraft: mock(async () => undefined),
  unpublishPage: mock(async () => undefined),
}));
mock.module("next/cache", () => ({
  revalidatePath: mock(() => undefined),
}));
mock.module("./audit-log", () => ({
  logAuditEvent: mock(async () => undefined),
}));

const {
  countDepartmentTriage,
  createUnitPage,
  listAllDepartments,
  listDepartments,
} = await import("./departments");

function mockAdminRows(rowsByTable: Record<string, unknown[]>): void {
  adminDb.listRows.mockImplementation(
    async (_databaseId: string, tableId: string) => ({
      rows: rowsByTable[tableId] ?? [],
      total: rowsByTable[tableId]?.length ?? 0,
    })
  );
}

beforeEach(() => {
  currentCtx = makeCtx();
  sessionDb.listRows.mockReset();
  adminDb.listRows.mockReset();
  savePageDraftSpy.mockClear();
  sessionDb.listRows.mockResolvedValue({ rows: [], total: 0 });
  adminDb.listRows.mockResolvedValue({ rows: [], total: 0 });
});

describe("listDepartments campus scoping", () => {
  test("a campus admin's listing is scoped by managed campuses even when admin_campus_ctx points elsewhere", async () => {
    currentCtx = makeCtx({
      activeCampusId: "2", // stale/foreign cookie value — not a campus they manage
      managedCampusIds: ["1"],
      roles: ["campusadmin"],
    });

    await listDepartments({ page: 1, q: "", size: 25 });

    expect(sessionDb.listRows).toHaveBeenCalledTimes(1);
    const queries = sessionDb.listRows.mock.calls[0]?.[2] as string[];
    expect(queries).toEqual(
      expect.arrayContaining([Query.equal("campus_id", ["1"])])
    );
    expect(queries).not.toEqual(
      expect.arrayContaining([Query.equal("campus_id", ["2"])])
    );
  });

  test("a global admin scoped via the campus switcher is filtered by activeCampusId", async () => {
    currentCtx = makeCtx({
      activeCampusId: "2",
      roles: ["globaladmin"],
    });

    await listDepartments({ page: 1, q: "", size: 25 });

    const queries = sessionDb.listRows.mock.calls[0]?.[2] as string[];
    expect(queries).toEqual(
      expect.arrayContaining([Query.equal("campus_id", ["2"])])
    );
  });
});

describe("createUnitPage inactive-department guard", () => {
  test("rejects creating a page for an inactive department", async () => {
    currentCtx = makeCtx({ roles: ["globaladmin"] });
    mockAdminRows({
      departments: [
        {
          $id: "dept-1",
          Name: "Fadderullan",
          active: false,
          campus_id: "1",
          slug: "fadderullan",
        },
      ],
    });

    const result = await createUnitPage("dept-1");

    expect(result).toEqual({
      error:
        "This department is inactive, so a page cannot be published for it.",
    });
    expect(savePageDraftSpy).not.toHaveBeenCalled();
  });

  // Unlike listDepartments (which treats a null `active` as active for the
  // admin management LISTING), createUnitPage must reject it: both public
  // lookups (cachedDepartmentsBySlug, cachedDepartmentBySlugAndCampus) filter
  // `Query.equal("active", true)`, which excludes null, so a page created for
  // a null-active department can only ever 404 on the public site.
  test("rejects a null active value, unlike listDepartments' null-as-active treatment", async () => {
    currentCtx = makeCtx({ roles: ["globaladmin"] });
    mockAdminRows({
      departments: [
        {
          $id: "dept-1",
          Name: "Fadderullan",
          active: null,
          campus_id: "1",
          slug: "fadderullan",
        },
      ],
      pages: [],
    });

    const result = await createUnitPage("dept-1");

    expect(result).toEqual({
      error:
        "This department is inactive, so a page cannot be published for it.",
    });
    expect(savePageDraftSpy).not.toHaveBeenCalled();
  });

  test("an active department still reaches page creation", async () => {
    currentCtx = makeCtx({ roles: ["globaladmin"] });
    mockAdminRows({
      departments: [
        {
          $id: "dept-1",
          Name: "Fadderullan",
          active: true,
          campus_id: "1",
          slug: "fadderullan",
        },
      ],
      pages: [],
    });

    const result = await createUnitPage("dept-1");

    expect(result).not.toHaveProperty("error");
    expect(savePageDraftSpy).toHaveBeenCalledTimes(1);
  });
});

/**
 * Pagination coverage (Plan A, task 9). The department listing used to load
 * 500 rows and triage them in JS; it now pages. The two properties that must
 * hold together are:
 *
 * - the visible slice is a real Appwrite page (`limit`/`offset` in the query,
 *   `total` from Appwrite rather than the page length), and
 * - the triage chip counts still describe the WHOLE scoped set, so they are
 *   identical no matter which page the user is on. That is why
 *   `countDepartmentTriage` is a second query with no `offset` and a size that
 *   is not a `PageSize`.
 */
describe("listDepartments pagination", () => {
  beforeEach(() => {
    sessionDb.listRows.mockReset();
  });

  test("returns the true total and the requested slice", async () => {
    sessionDb.listRows.mockResolvedValueOnce({
      rows: [{ $id: "d1" }],
      total: 280,
    });

    const result = await listDepartments({
      includeInactive: true,
      page: 3,
      q: "",
      size: 25,
    });

    expect(result.total).toBe(280);
    expect(result.page).toBe(3);
    expect(result.size).toBe(25);
    const queries = sessionDb.listRows.mock.calls[0]?.[2] as string[];
    expect(queries).toContain(Query.limit(25));
    expect(queries).toContain(Query.offset(50));
  });

  // parseUnitCategory counts a row as uncategorised for null, "", and
  // whitespace/free text alike, so the FILTER has to cover at least the two
  // forms a query can express — Query.isNull alone would list fewer rows than
  // the `uncategorised` chip advertises.
  test("pushes the uncategorised filter into the query, not into JS", async () => {
    sessionDb.listRows.mockResolvedValueOnce({ rows: [], total: 0 });

    await listDepartments({
      includeInactive: true,
      page: 1,
      q: "",
      size: 25,
      type: "uncategorised",
    });

    const queries = sessionDb.listRows.mock.calls[0]?.[2] as string[];
    expect(queries).toContain(
      Query.or([Query.isNull("type"), Query.equal("type", "")])
    );
  });

  test("pushes the missing_logo filter into the query", async () => {
    sessionDb.listRows.mockResolvedValueOnce({ rows: [], total: 0 });

    await listDepartments({
      includeInactive: true,
      page: 1,
      q: "",
      size: 25,
      type: "missing_logo",
    });

    const queries = sessionDb.listRows.mock.calls[0]?.[2] as string[];
    expect(queries).toContain(
      Query.or([Query.equal("logo", ""), Query.isNull("logo")])
    );
  });

  const typeEqualityValues = (queries: string[]): string[] => {
    const typeQuery = queries.find(
      (query) =>
        query.includes('"method":"equal"') &&
        query.includes('"attribute":"type"')
    );
    return [...(JSON.parse(typeQuery as string).values as string[])].sort();
  };

  // The counts fold legacy aliases onto their canonical category via
  // parseUnitCategory, so an exact-match filter would advertise rows the chip
  // could never list. The filter has to match every raw value that normalises
  // onto the chip's category.
  test("a category filter matches every legacy alias that folds onto it", async () => {
    sessionDb.listRows.mockResolvedValueOnce({ rows: [], total: 0 });

    await listDepartments({
      includeInactive: true,
      page: 1,
      q: "",
      size: 25,
      type: "staff_function",
    });

    const queries = sessionDb.listRows.mock.calls[0]?.[2] as string[];
    expect(typeEqualityValues(queries)).toEqual(
      ["committee", "service", "staff", "staff_function"].sort()
    );
  });

  test("a category with no aliases still filters on itself", async () => {
    sessionDb.listRows.mockResolvedValueOnce({ rows: [], total: 0 });

    await listDepartments({
      includeInactive: true,
      page: 1,
      q: "",
      size: 25,
      type: "other",
    });

    const queries = sessionDb.listRows.mock.calls[0]?.[2] as string[];
    expect(typeEqualityValues(queries)).toEqual(["other"]);
  });

  test("searches the indexed Name column", async () => {
    sessionDb.listRows.mockResolvedValueOnce({ rows: [], total: 0 });

    await listDepartments({
      includeInactive: true,
      page: 1,
      q: "biso",
      size: 25,
    });

    const queries = sessionDb.listRows.mock.calls[0]?.[2] as string[];
    expect(queries).toContain(Query.contains("Name", "biso"));
  });

  test("keeps the id scope, which is the authorization boundary", async () => {
    sessionDb.listRows.mockResolvedValueOnce({ rows: [], total: 0 });

    await listDepartments({ ids: ["d1", "d2"], page: 1, q: "", size: 25 });

    const queries = sessionDb.listRows.mock.calls[0]?.[2] as string[];
    expect(queries).toContain(Query.equal("$id", ["d1", "d2"]));
  });

  test("short-circuits an empty id scope without querying", async () => {
    const result = await listDepartments({
      ids: [],
      page: 1,
      q: "",
      size: 25,
    });

    expect(result).toEqual({ rows: [], page: 1, size: 25, total: 0 });
    expect(sessionDb.listRows).not.toHaveBeenCalled();
  });
});

describe("countDepartmentTriage", () => {
  beforeEach(() => {
    sessionDb.listRows.mockReset();
  });

  test("counts across the full scoped set, not one page", async () => {
    sessionDb.listRows.mockResolvedValueOnce({
      rows: [
        { $id: "d1", logo: "", type: null },
        { $id: "d2", logo: "https://x/logo.png", type: null },
        // `committee` is a legacy alias parseUnitCategory folds into
        // `staff_function`, which is the key the chips actually render.
        { $id: "d3", logo: "", type: "committee" },
      ],
      total: 3,
    });

    const counts = await countDepartmentTriage({ includeInactive: true });

    expect(counts.all).toBe(3);
    expect(counts.uncategorised).toBe(2);
    expect(counts.missing_logo).toBe(2);
    expect(counts.staff_function).toBe(1);
  });

  // `all` must be Appwrite's own total, not the length of the projection: the
  // projection is capped at 500 rows, and a capped `all` would disagree with
  // the `total` feeding PaginationBar on the very same screen.
  test("takes `all` from Appwrite's total, not the projected row count", async () => {
    sessionDb.listRows.mockResolvedValueOnce({
      rows: [{ $id: "d1", logo: "", type: null }],
      total: 239,
    });

    const counts = await countDepartmentTriage({ includeInactive: true });

    expect(counts.all).toBe(239);
  });

  test("selects only the three columns it needs", async () => {
    sessionDb.listRows.mockResolvedValueOnce({ rows: [], total: 0 });

    await countDepartmentTriage({ includeInactive: true });

    const queries = sessionDb.listRows.mock.calls[0]?.[2] as string[];
    expect(queries).toContain(Query.select(["$id", "type", "logo"]));
  });

  test("issues no offset and no page-sized limit, so the counts cannot describe one page", async () => {
    sessionDb.listRows.mockResolvedValueOnce({ rows: [], total: 0 });

    // Narrowing by `q` must not smuggle pagination in with it.
    await countDepartmentTriage({ includeInactive: true, q: "biso" });

    const queries = sessionDb.listRows.mock.calls[0]?.[2] as string[];
    expect(queries.some((query) => query.includes('"method":"offset"'))).toBe(
      false
    );
    for (const pageSize of [25, 50, 100]) {
      expect(queries).not.toContain(Query.limit(pageSize));
    }
    expect(queries).toContain(Query.limit(500));
  });

  test("returns identical counts whichever page the list is showing", async () => {
    const fullSet = {
      rows: [
        { $id: "d1", logo: "", type: null },
        { $id: "d2", logo: "https://x/logo.png", type: null },
        { $id: "d3", logo: "", type: "society" },
      ],
      total: 3,
    };

    sessionDb.listRows.mockResolvedValue(fullSet);
    const onPageOne = await countDepartmentTriage({ includeInactive: true });
    const onPageFour = await countDepartmentTriage({ includeInactive: true });

    expect(onPageFour).toEqual(onPageOne);
    expect(onPageFour.all).toBe(3);
    // Both calls sent exactly the same query — the counts have no notion of a
    // page to vary with.
    expect(sessionDb.listRows.mock.calls[1]?.[2]).toEqual(
      sessionDb.listRows.mock.calls[0]?.[2] as string[]
    );
  });

  test("honours the id scope so a department user never sees global counts", async () => {
    sessionDb.listRows.mockResolvedValueOnce({ rows: [], total: 0 });

    await countDepartmentTriage({ ids: ["d1"], includeInactive: true });

    const queries = sessionDb.listRows.mock.calls[0]?.[2] as string[];
    expect(queries).toContain(Query.equal("$id", ["d1"]));
  });

  test("short-circuits an empty id scope with zeroed counts and no query", async () => {
    const counts = await countDepartmentTriage({
      ids: [],
      includeInactive: true,
    });

    expect(counts.all).toBe(0);
    expect(counts.uncategorised).toBe(0);
    expect(counts.missing_logo).toBe(0);
    expect(sessionDb.listRows).not.toHaveBeenCalled();
  });

  // A chip is a filter control, so its number has to predict what clicking it
  // yields. With a search active the list is narrowed, so the counts must be
  // narrowed by the same term or the chips would describe a set the list can
  // no longer show.
  test("narrows the counts by the active search, exactly as the list does", async () => {
    sessionDb.listRows.mockResolvedValueOnce({ rows: [], total: 0 });

    await countDepartmentTriage({ includeInactive: true, q: "biso" });

    const queries = sessionDb.listRows.mock.calls[0]?.[2] as string[];
    expect(queries).toContain(Query.contains("Name", "biso"));
  });

  // The campus chain is the authorization boundary for a campus admin. It is
  // shared with listDepartments through departmentScopeQueries today, so this
  // guards a future refactor that re-inlines it.
  test("honours the campus chain, so a campus admin never sees another campus's counts", async () => {
    currentCtx = makeCtx({
      activeCampusId: "2", // stale/foreign cookie value — not a campus they manage
      managedCampusIds: ["1"],
      roles: ["campusadmin"],
    });
    sessionDb.listRows.mockResolvedValueOnce({ rows: [], total: 0 });

    await countDepartmentTriage({ includeInactive: true });

    const queries = sessionDb.listRows.mock.calls[0]?.[2] as string[];
    expect(queries).toContain(Query.equal("campus_id", ["1"]));
    expect(queries).not.toContain(Query.equal("campus_id", ["2"]));
  });
});

describe("listAllDepartments", () => {
  beforeEach(() => {
    sessionDb.listRows.mockReset();
  });

  test("returns every active department for a picker, unbounded by PageSize", async () => {
    sessionDb.listRows.mockResolvedValueOnce({
      rows: [{ $id: "d1" }, { $id: "d2" }],
      total: 2,
    });

    const rows = await listAllDepartments();

    expect(rows).toHaveLength(2);
    const queries = sessionDb.listRows.mock.calls[0]?.[2] as string[];
    expect(queries).toContain(Query.limit(500));
    expect(queries).toContain(Query.orderAsc("Name"));
    expect(queries).toContain(
      Query.or([Query.equal("active", true), Query.isNull("active")])
    );
    for (const pageSize of [25, 50, 100]) {
      expect(queries).not.toContain(Query.limit(pageSize));
    }
  });
});
