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
    blocks: [],
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
