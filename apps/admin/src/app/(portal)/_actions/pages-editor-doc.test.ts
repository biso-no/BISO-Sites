import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { PageDoc } from "@repo/api/page-builder";
import type { UserAuthContext } from "@/lib/authorization";
import { assertUnitPageNamespace } from "@/lib/unit-page-guard";

/**
 * Regression coverage for the WIRING inside `savePageEditorDoc`, not the pure
 * helpers behind it (`assertUnitPageNamespace`, `assertUnitPageBindingUnchanged`,
 * `resolvePageSaveCampusId` all have their own unit tests). The concern here is
 * narrower and easy to miss: this action creates ORDINARY pages too — the same
 * block editor used for department "unit" pages also saves plain content pages
 * with no department at all — and the new unit-page guards must never reject
 * that path or feed it the wrong campus.
 *
 * Only the true I/O boundaries are mocked (`@repo/api/server`'s admin client,
 * `@repo/api/page-builder`'s `savePageDraft`/`resolvePageCampusId`, auth,
 * revalidation, audit log). `@/lib/unit-page-guard`, `@/lib/content-authorization`,
 * `@/lib/utils/authorization`, and `@/lib/page-campus` run for REAL, matching
 * the mocking pattern in `admin-content-boundary.test.ts` — those are exactly
 * the modules whose wiring this file is meant to prove.
 */

const adminDb = {
  getRow: mock(),
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

const globalAdminCtx = makeCtx({ roles: ["globaladmin"] });
const campusAdminCtx = makeCtx({
  managedCampusIds: ["campus-oslo"],
  resolvedCampusIds: ["campus-oslo"],
  roles: ["campusadmin"],
});
const departmentCtx = makeCtx({
  resolvedCampusIds: ["campus-oslo"],
  resolvedDepartmentIds: ["dept-1"],
});

let currentCtx: UserAuthContext = globalAdminCtx;

const savePageDraftSpy = mock(
  async (params: {
    id: string | null;
    doc: PageDoc;
    campusId?: string | null;
  }) => ({
    pageId: params.id ?? "new-page-id",
    slug: params.doc.meta.slug,
    translationId: "translation-1",
  })
);

/**
 * Faithful, minimal re-implementation of the real `resolvePageCampusId` in
 * `packages/api/page-builder.ts` — mirrored here (not imported) because the
 * whole `@repo/api/page-builder` module must be mocked to intercept
 * `savePageDraft`. Keep this in sync if that function's logic changes.
 */
function resolvePageCampusIdMock(ctx: UserAuthContext): string | null {
  if (ctx.roles.includes("globaladmin")) {
    return ctx.activeCampusId ?? null;
  }
  if (ctx.managedCampusIds.length > 0) {
    return ctx.managedCampusIds[0];
  }
  if (ctx.resolvedCampusIds.length > 0) {
    return ctx.resolvedCampusIds[0];
  }
  return null;
}

mock.module("@repo/api/page-builder", () => ({
  PAGE_LOCALES: ["no", "en"],
  getPageById: mock(async () => null),
  getPageEditorById: mock(async () => null),
  publishPage: mock(async () => undefined),
  resolvePageCampusId: mock(resolvePageCampusIdMock),
  savePageDraft: savePageDraftSpy,
  savePageTranslationDraft: mock(async () => undefined),
  unpublishPage: mock(async () => undefined),
}));
mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db: adminDb })),
  createSessionClient: mock(async () => ({ db: adminDb })),
}));
mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => currentCtx),
}));
mock.module("next/cache", () => ({
  revalidatePath: mock(() => undefined),
}));
mock.module("./audit-log", () => ({
  logAuditEvent: mock(async () => undefined),
}));

const { savePageEditorDoc } = await import("./pages");

function makeDoc(overrides: Partial<PageDoc["meta"]> = {}): PageDoc {
  return {
    sections: [],
    version: 2,
    meta: {
      accentColor: "#001731",
      department: "",
      description: "An ordinary page",
      slug: "about/team",
      status: "draft",
      title: "Team",
      ...overrides,
    },
  };
}

beforeEach(() => {
  currentCtx = globalAdminCtx;
  adminDb.getRow.mockReset();
  savePageDraftSpy.mockClear();
});

describe("savePageEditorDoc: ordinary (non-unit) pages", () => {
  test("creating an ordinary page succeeds and reaches savePageDraft", async () => {
    currentCtx = globalAdminCtx;
    const doc = makeDoc({ department: "", slug: "about/team" });

    const result = await savePageEditorDoc({ id: null, doc });

    expect(result).not.toHaveProperty("error");
    expect(adminDb.getRow).not.toHaveBeenCalled();
    expect(savePageDraftSpy).toHaveBeenCalledTimes(1);
    const call = savePageDraftSpy.mock.calls[0]?.[0];
    expect(call?.id).toBeNull();
    expect(call?.doc.meta.slug).toBe("about/team");
  });

  test("renaming an ordinary page's slug is still allowed on update", async () => {
    currentCtx = campusAdminCtx;
    adminDb.getRow.mockResolvedValueOnce({
      $id: "page-1",
      campus: "campus-oslo",
      campus_id: "campus-oslo",
      department: null,
      department_id: null,
      slug: "about/old-name",
      status: "draft",
    });
    const doc = makeDoc({ department: "", slug: "about/new-name" });

    const result = await savePageEditorDoc({ id: "page-1", doc });

    expect(result).not.toHaveProperty("error");
    expect(savePageDraftSpy).toHaveBeenCalledTimes(1);
    const call = savePageDraftSpy.mock.calls[0]?.[0];
    expect(call?.id).toBe("page-1");
    expect(call?.doc.meta.slug).toBe("about/new-name");
  });

  test("updating an ordinary page preserves its persisted campus over the author's", async () => {
    // Global admin currently scoped to a DIFFERENT campus than the page's own
    // persisted campus. If savePageEditorDoc re-derived the campus from the
    // author (the old, buggy behavior), this would silently move the page.
    currentCtx = makeCtx({
      activeCampusId: "campus-bergen",
      roles: ["globaladmin"],
    });
    adminDb.getRow.mockResolvedValueOnce({
      $id: "page-1",
      campus: "campus-oslo",
      campus_id: "campus-oslo",
      department: null,
      department_id: null,
      slug: "about/team",
      status: "draft",
    });
    const doc = makeDoc({ department: "", slug: "about/team" });

    const result = await savePageEditorDoc({ id: "page-1", doc });

    expect(result).not.toHaveProperty("error");
    expect(savePageDraftSpy).toHaveBeenCalledTimes(1);
    const call = savePageDraftSpy.mock.calls[0]?.[0];
    // Persisted campus (campus-oslo) wins, not the author's active campus
    // (campus-bergen).
    expect(call?.campusId).toBe("campus-oslo");
  });

  test("creating a page under units/ is rejected before savePageDraft is reached", async () => {
    currentCtx = departmentCtx;
    const doc = makeDoc({ department: "", slug: "units/oslo/fadderullan" });
    const expectedError = assertUnitPageNamespace(
      null,
      "units/oslo/fadderullan"
    );
    if (!expectedError) {
      throw new Error("expected assertUnitPageNamespace to reject this slug");
    }

    const result = await savePageEditorDoc({ id: null, doc });

    expect(result).toEqual({ error: expectedError });
    expect(savePageDraftSpy).not.toHaveBeenCalled();
  });

  /**
   * Regression for the guard/storage mismatch: a leading-space slug used to
   * pass assertUnitPageNamespace's untrimmed check, then get trimmed down to
   * the exact canonical unit slug by resolveUniquePageSlug on the way to
   * storage — stealing the department's address while looking like an
   * ordinary save. savePageEditorDoc must trim the slug ONCE, before the
   * guard runs, so the value that is checked and the value that would be
   * persisted can never disagree.
   */
  test("a padded slug reaching into units/ is rejected the same as its trimmed form", async () => {
    currentCtx = departmentCtx;
    const doc = makeDoc({
      department: "",
      slug: " units/oslo/fadderullan",
    });
    const expectedError = assertUnitPageNamespace(
      null,
      "units/oslo/fadderullan"
    );
    if (!expectedError) {
      throw new Error("expected assertUnitPageNamespace to reject this slug");
    }

    const result = await savePageEditorDoc({ id: null, doc });

    expect(result).toEqual({ error: expectedError });
    expect(savePageDraftSpy).not.toHaveBeenCalled();
  });

  test("an ordinary slug with surrounding whitespace is trimmed before it reaches savePageDraft", async () => {
    currentCtx = globalAdminCtx;
    const doc = makeDoc({ department: "", slug: "  about/team  " });

    const result = await savePageEditorDoc({ id: null, doc });

    expect(result).not.toHaveProperty("error");
    expect(savePageDraftSpy).toHaveBeenCalledTimes(1);
    const call = savePageDraftSpy.mock.calls[0]?.[0];
    expect(call?.doc.meta.slug).toBe("about/team");
  });
});

describe("savePageEditorDoc: campus chosen in the editor", () => {
  test("a global admin's chosen campus is saved, on create and on update", async () => {
    currentCtx = { ...globalAdminCtx, activeCampusId: "campus-oslo" };

    await savePageEditorDoc({
      doc: makeDoc({ campus: "campus-bergen" }),
      id: null,
    });
    expect(savePageDraftSpy.mock.calls[0]?.[0].campusId).toBe("campus-bergen");

    adminDb.getRow.mockResolvedValueOnce({
      $id: "page-1",
      campus: "campus-oslo",
      campus_id: "campus-oslo",
      department: null,
      department_id: null,
      slug: "about/team",
      status: "draft",
    });
    await savePageEditorDoc({
      doc: makeDoc({ campus: "campus-bergen" }),
      id: "page-1",
    });
    expect(savePageDraftSpy.mock.calls[1]?.[0].campusId).toBe("campus-bergen");
  });

  test("a global admin may save a national page with no campus", async () => {
    currentCtx = { ...globalAdminCtx, activeCampusId: "campus-oslo" };

    await savePageEditorDoc({ doc: makeDoc({ campus: "" }), id: null });

    expect(savePageDraftSpy.mock.calls[0]?.[0].campusId).toBeNull();
  });

  test("a department user cannot move a page to another campus", async () => {
    currentCtx = departmentCtx;
    // The department is re-read to check it belongs to the campus.
    adminDb.getRow.mockResolvedValueOnce({
      $id: "dept-1",
      campus: { $id: "campus-oslo" },
    });

    await savePageEditorDoc({
      doc: makeDoc({ campus: "campus-bergen", department: "dept-1" }),
      id: null,
    });

    expect(savePageDraftSpy.mock.calls[0]?.[0].campusId).toBe("campus-oslo");
  });

  test("a unit page keeps its campus even if the document says otherwise", async () => {
    currentCtx = globalAdminCtx;
    adminDb.getRow.mockResolvedValueOnce({
      $id: "page-unit",
      campus: "campus-oslo",
      campus_id: "campus-oslo",
      department: "dept-1",
      department_id: "dept-1",
      slug: "units/oslo/fadderullan",
      status: "draft",
    });
    adminDb.getRow.mockResolvedValueOnce({
      $id: "dept-1",
      campus: { $id: "campus-oslo" },
    });

    await savePageEditorDoc({
      doc: makeDoc({
        campus: "campus-bergen",
        department: "dept-1",
        slug: "units/oslo/fadderullan",
      }),
      id: "page-unit",
    });

    expect(savePageDraftSpy.mock.calls[0]?.[0].campusId).toBe("campus-oslo");
  });
});

describe("savePageEditorDoc: rich text", () => {
  test("persists sanitized text-block HTML, not what the client sent", async () => {
    currentCtx = globalAdminCtx;
    const doc: PageDoc = {
      ...makeDoc(),
      sections: [
        {
          columns: [
            {
              blocks: [
                {
                  body: [
                    { text: "<img src=x onerror=alert(1)>hei", type: "p" },
                    {
                      text: '<a href="javascript:alert(1)">x</a> <b>fet</b>',
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
    };

    const result = await savePageEditorDoc({ doc, id: null });

    expect(result).not.toHaveProperty("error");
    const saved = savePageDraftSpy.mock.calls[0]?.[0].doc as unknown as {
      sections: { columns: { blocks: { body: { text: string }[] }[] }[] }[];
    };
    expect(
      saved.sections[0].columns[0].blocks[0].body.map((item) => item.text)
    ).toEqual(["hei", "<a>x</a> <b>fet</b>"]);
  });
});
