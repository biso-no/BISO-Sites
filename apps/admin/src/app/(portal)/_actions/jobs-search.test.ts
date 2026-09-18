import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Query } from "@repo/api";

const realRecruitment = await import("@/lib/recruitment");

const db = { listRows: mock() };

let scope = {
  canManageAnyCampus: false,
  isCampusAdmin: true,
  isGlobalAdmin: false,
  managedCampusNames: ["Oslo"],
  managedDepartmentNames: [] as string[],
  userId: "user-1",
};

mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db })),
  createSessionClient: mock(async () => ({ db })),
}));
mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => ({ activeCampusId: undefined })),
}));
mock.module("@/lib/recruitment", () => ({
  ...realRecruitment,
  canReviewRecruitmentVacancy: mock(() => true),
  loadRecruitmentLookups: mock(async () => ({
    campusIdsByName: new Map([["Oslo", "1"]]),
    campusNamesById: new Map([["1", "Oslo"]]),
    departmentIdsByName: new Map(),
    departmentNamesById: new Map(),
  })),
  toRecruitmentAdminScope: mock(() => scope),
}));
mock.module("next/cache", () => ({ revalidatePath: mock(() => undefined) }));
mock.module("./audit-log", () => ({
  logAuditEvent: mock(async () => undefined),
}));

const { listJobApplications, listJobs } = await import("./jobs");

const SCOPE = Query.equal("campus.$id", ["1"]);

function jobRow(id: string, title: string, status = "published") {
  return {
    $createdAt: "2026-01-01T00:00:00.000Z",
    $id: id,
    $updatedAt: "2026-01-01T00:00:00.000Z",
    campus: { $id: "1", name: "Oslo" },
    campus_id: "1",
    department: null,
    department_id: null,
    metadata: "{}",
    slug: id,
    status,
    translations: [{ $id: `${id}-no`, locale: "no", title }],
  };
}

type ListRowsArgs = [string, string, string[]];

function callsFor(tableId: string): string[][] {
  return (db.listRows.mock.calls as ListRowsArgs[])
    .filter(([, table]) => table === tableId)
    .map(([, , queries]) => queries);
}

describe("listJobs search", () => {
  beforeEach(() => {
    db.listRows.mockReset();
    scope = { ...scope, canManageAnyCampus: false };
  });

  test("searches every scoped vacancy, not just the first page", async () => {
    // 100 non-matching vacancies fill the first batch; the match is on the
    // second, which a page-local filter would never have seen.
    const firstBatch = Array.from({ length: 100 }, (_, i) =>
      jobRow(`job-${i}`, "Kasserer")
    );
    const secondBatch = [jobRow("job-hit", "Markedsansvarlig", "draft")];
    db.listRows
      .mockResolvedValueOnce({ rows: firstBatch, total: 101 })
      .mockResolvedValueOnce({ rows: secondBatch, total: 101 });

    const result = await listJobs({ search: "  MARKEDS " });

    expect(result.rows.map((row) => row.$id)).toEqual(["job-hit"]);
    expect(result.total).toBe(1);
    expect(result.counts).toEqual({
      all: 1,
      closed: 0,
      draft: 1,
      published: 0,
    });

    const [first, second] = callsFor("jobs");
    expect(first).toContain(SCOPE);
    expect(second).toContain(Query.cursorAfter("job-99"));
  });

  test("applies status after counting search matches", async () => {
    db.listRows.mockResolvedValueOnce({
      rows: [
        jobRow("a", "Markedsansvarlig", "draft"),
        jobRow("b", "Markedsleder", "published"),
      ],
      total: 2,
    });

    const result = await listJobs({ search: "markeds", status: "published" });

    expect(result.rows.map((row) => row.$id)).toEqual(["b"]);
    expect(result.counts.all).toBe(2);
    expect(result.counts.draft).toBe(1);
  });

  test("pages and counts in Appwrite when not searching", async () => {
    db.listRows.mockResolvedValue({ rows: [], total: 7 });

    const result = await listJobs({ page: 2, status: "draft" });

    expect(result.total).toBe(7);
    expect(result.counts.all).toBe(7);
    const [pageQueries] = callsFor("jobs");
    expect(pageQueries).toContain(SCOPE);
    expect(pageQueries).toContain(Query.equal("status", "draft"));
    expect(pageQueries).toContain(Query.offset(20));
  });
});

describe("listJobApplications search", () => {
  beforeEach(() => {
    db.listRows.mockReset();
  });

  test("pushes the search into the Appwrite query", async () => {
    db.listRows.mockImplementation(async (_db: string, table: string) =>
      table === "jobs"
        ? {
            rows: [jobRow("job-1", "Økonomiansvarlig"), jobRow("job-2", "IT")],
            total: 2,
          }
        : { rows: [], total: 42 }
    );

    const result = await listJobApplications({ page: 3, search: "økonomi" });

    expect(result.total).toBe(42);
    const [queries] = callsFor("job_applications");
    expect(queries).toContain(
      Query.or([
        Query.contains("applicant_name", "økonomi"),
        Query.contains("applicant_email", "økonomi"),
        Query.equal("job_id", ["job-1"]),
      ])
    );
    expect(queries).toContain(Query.limit(20));
    expect(queries).toContain(Query.offset(40));
  });

  test("omits the vacancy clause when no vacancy title matches", async () => {
    db.listRows.mockImplementation(async (_db: string, table: string) =>
      table === "jobs"
        ? { rows: [jobRow("job-1", "IT")], total: 1 }
        : { rows: [], total: 0 }
    );

    await listJobApplications({ search: "kari" });

    const [queries] = callsFor("job_applications");
    expect(queries).toContain(
      Query.or([
        Query.contains("applicant_name", "kari"),
        Query.contains("applicant_email", "kari"),
      ])
    );
  });
});
