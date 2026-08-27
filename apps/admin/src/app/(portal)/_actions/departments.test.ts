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
 * 2. createUnitPage must reject creating a page for an inactive department —
 *    the sync deliberately keeps an inactive department's slug, so without
 *    this guard the action would create a page that both public lookups
 *    (which filter active = true) can never serve.
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

const { createUnitPage, listDepartments } = await import("./departments");

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

    await listDepartments();

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

    await listDepartments();

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

  test("treats a null active value as active and proceeds to create the page", async () => {
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

    expect(result).not.toHaveProperty("error");
    expect(savePageDraftSpy).toHaveBeenCalledTimes(1);
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
