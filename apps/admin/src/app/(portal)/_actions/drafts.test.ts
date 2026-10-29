import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { UserAuthContext } from "@/lib/authorization";

const db = {
  getRow: mock(),
  listRows: mock(),
  updateRow: mock(),
};

let currentCtx: UserAuthContext;
const adminCtx = {
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
} as UserAuthContext;

mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db })),
  createSessionClient: mock(async () => ({ db })),
}));
mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => currentCtx),
}));
// Other suites replace this module process-wide, so pin the pieces the draft
// actions use: the vacancy gate refuses everyone but recruiters.
const assertVacancyWrite = mock(
  (scope: { isGlobalAdmin: boolean; isCampusAdmin: boolean }) => {
    if (!(scope.isGlobalAdmin || scope.isCampusAdmin)) {
      throw new Error("Forbidden");
    }
  }
);
mock.module("@/lib/recruitment", () => ({
  assertRecruitmentVacancyWriteAccess: assertVacancyWrite,
  buildJobRowPermissions: mock(() => ['read("any")']),
  loadRecruitmentLookups: mock(async () => ({})),
  toRecruitmentAdminScope: mock((ctx: UserAuthContext) => ({
    isCampusAdmin: ctx.roles.includes("hr"),
    isGlobalAdmin: ctx.roles.includes("globaladmin"),
  })),
}));
mock.module("next/cache", () => ({
  revalidatePath: mock(() => undefined),
}));
mock.module("./audit-log", () => ({
  logAuditEvent: mock(async () => undefined),
}));

const { approveDraft, listDrafts, rejectDraft } = await import("./drafts");

beforeEach(() => {
  currentCtx = adminCtx;
  db.getRow.mockReset();
  db.listRows.mockReset();
  db.updateRow.mockReset();
  db.updateRow.mockResolvedValue({});
  db.listRows.mockResolvedValue({ rows: [], total: 0 });
});

describe("approveDraft", () => {
  test("publishing an event sets public read on the row and its translations", async () => {
    db.getRow.mockResolvedValue({
      $id: "event-1",
      campus: { $id: "campus-oslo" },
      member_only: true,
      status: "draft",
      translation_refs: [{ $id: "tr-no" }, "tr-en"],
    });

    const result = await approveDraft("event-1", "event");

    expect(result).toEqual({ data: true });
    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "events",
      "event-1",
      { status: "published" },
      ['read("any")']
    );
    for (const id of ["tr-no", "tr-en"]) {
      expect(db.updateRow).toHaveBeenCalledWith(
        "app",
        "content_translations",
        id,
        {},
        ['read("any")']
      );
    }
  });

  test("approving a news draft publishes it and restamps its translations", async () => {
    db.getRow.mockResolvedValue({
      $id: "news-1",
      campus: { $id: "campus-oslo" },
      status: "draft",
    });
    db.listRows.mockResolvedValue({
      rows: [{ $id: "tr-1", $permissions: [] }],
      total: 1,
    });

    await approveDraft("news-1", "news");

    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "news",
      "news-1",
      { status: "published" },
      ['read("any")']
    );
    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "content_translations",
      "tr-1",
      {},
      ['read("any")']
    );
  });

  test("approving a job draft restamps translations with staff reads", async () => {
    db.getRow.mockResolvedValue({
      $id: "job-1",
      campus: { $id: "campus-oslo" },
      status: "draft",
    });
    db.listRows.mockResolvedValue({
      rows: [{ $id: "tr-1", $permissions: [] }],
      total: 1,
    });

    await approveDraft("job-1", "job");

    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "content_translations",
      "tr-1",
      {},
      [
        'read("any")',
        'read("team:sg-app-dept-operationsunit")',
        'read("team:sg-app-dept-hr")',
      ]
    );
  });
});

const campusAdminCtx = {
  ...adminCtx,
  managedCampusIds: ["campus-oslo"],
  managedCampuses: ["Oslo"],
  resolvedCampusIds: ["campus-oslo"],
  roles: ["campusadmin"],
} as UserAuthContext;

describe("vacancy drafts stay with recruiters", () => {
  test("a campus admin's draft queue lists no jobs", async () => {
    currentCtx = campusAdminCtx;

    await listDrafts();

    const tables = db.listRows.mock.calls.map((call) => call[1]);
    expect(tables).not.toContain("jobs");
    expect(tables).toContain("events");
    expect(tables).toContain("news");
  });

  test("a global admin's draft queue lists jobs", async () => {
    await listDrafts();

    const tables = db.listRows.mock.calls.map((call) => call[1]);
    expect(tables).toContain("jobs");
  });

  test("a campus admin cannot approve a job draft", async () => {
    currentCtx = campusAdminCtx;
    db.getRow.mockResolvedValue({
      $id: "job-1",
      campus: { $id: "campus-oslo" },
      campus_id: "campus-oslo",
      department_id: null,
      status: "draft",
    });

    const result = await approveDraft("job-1", "job");

    expect(result).toEqual({ error: "Forbidden" });
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  test("a global admin can approve a job draft", async () => {
    db.getRow.mockResolvedValue({
      $id: "job-1",
      campus: { $id: "campus-oslo" },
      campus_id: "campus-oslo",
      department_id: null,
      status: "draft",
    });

    const result = await approveDraft("job-1", "job");

    expect(result).toEqual({ data: true });
    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "jobs",
      "job-1",
      { status: "published" },
      expect.any(Array)
    );
  });

  test("a campus admin cannot reject a job draft", async () => {
    currentCtx = campusAdminCtx;
    db.getRow.mockResolvedValue({
      $id: "job-1",
      campus_id: "campus-oslo",
      department_id: null,
      status: "draft",
    });

    const result = await rejectDraft("job-1", "job", "no");

    expect(result).toEqual({ error: "Forbidden" });
  });
});
