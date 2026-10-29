import { beforeEach, describe, expect, mock, test } from "bun:test";

const realRecruitment = await import("@/lib/recruitment");

const adminDb = {
  getRow: mock(),
  listRows: mock(),
  updateRow: mock(),
};
const sessionDb = { getRow: mock(), listRows: mock() };
const audit = mock(async (..._args: unknown[]) => undefined);
const revalidate = mock((_path: string) => undefined);
const access = mock((..._args: unknown[]) => undefined);

mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db: adminDb })),
  createSessionClient: mock(async () => ({ db: sessionDb })),
}));
mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => ({ roles: [], userId: "editor-1" })),
}));
mock.module("@/lib/recruitment", () => ({
  ...realRecruitment,
  assertRecruitmentVacancyWriteAccess: access,
  loadRecruitmentLookups: mock(async () => ({
    campusIdsByName: new Map(),
    campusNamesById: new Map(),
    departmentIdsByName: new Map(),
    departmentNamesById: new Map(),
  })),
  toRecruitmentAdminScope: mock(() => ({})),
}));
mock.module("next/cache", () => ({ revalidatePath: revalidate }));
mock.module("./audit-log", () => ({ logAuditEvent: audit }));

const { publishJobDraft, setJobStatus } = await import("./jobs");

function jobRow(overrides: Record<string, unknown>) {
  const row = {
    $createdAt: "2026-01-01T00:00:00.000Z",
    $id: "job-1",
    $updatedAt: "2026-01-01T00:00:00.000Z",
    application_deadline: null,
    campus_id: "campus-oslo",
    department_id: null,
    metadata: "{}",
    slug: "job-1",
    status: "published",
    translations: [],
    ...overrides,
  };
  sessionDb.getRow.mockImplementation(async () => row);
  adminDb.getRow.mockImplementation(async () => row);
  adminDb.listRows.mockImplementation(async () => ({
    rows: [
      {
        $id: "tr-1",
        $permissions: ['read("any")', 'update("team:staff")'],
      },
    ],
    total: 1,
  }));
}

beforeEach(() => {
  for (const spy of [
    adminDb.getRow,
    adminDb.listRows,
    adminDb.updateRow,
    sessionDb.getRow,
    sessionDb.listRows,
    audit,
    revalidate,
    access,
  ]) {
    spy.mockReset();
  }
  access.mockImplementation(() => undefined);
  adminDb.updateRow.mockImplementation(async () => ({}));
});

describe("setJobStatus", () => {
  test("closes a published vacancy and drops public read", async () => {
    jobRow({ status: "published" });

    const result = await setJobStatus("job-1", "closed");

    expect(result).toEqual({ data: "closed" });
    const [, table, id, data, perms] = adminDb.updateRow.mock.calls[0] as [
      string,
      string,
      string,
      Record<string, unknown>,
      string[],
    ];
    expect([table, id]).toEqual(["jobs", "job-1"]);
    expect(data).toEqual({ scheduled_publish_at: null, status: "closed" });
    expect(perms).not.toContain('read("any")');
    expect(audit.mock.calls[0]?.[1]).toBe("recruitment.vacancy.close");
    expect(revalidate).toHaveBeenCalledWith("/jobs");
  });

  test("restamps translation reads away from public when closing", async () => {
    jobRow({ status: "published" });

    await setJobStatus("job-1", "closed");

    const translationWrite = adminDb.updateRow.mock.calls.find(
      (call) => call[1] === "content_translations"
    );
    expect(translationWrite?.[2]).toBe("tr-1");
    expect(translationWrite?.[4]).not.toContain('read("any")');
    expect(translationWrite?.[4]).toContain('update("team:staff")');
  });

  test("reopens a closed vacancy with public read and an audit event", async () => {
    jobRow({ status: "closed" });

    const result = await setJobStatus("job-1", "published");

    expect(result).toEqual({ data: "published", deadlinePassed: false });
    const perms = adminDb.updateRow.mock.calls[0]?.[4] as string[];
    expect(perms).toContain('read("any")');
    const translationWrite = adminDb.updateRow.mock.calls.find(
      (call) => call[1] === "content_translations"
    );
    expect(translationWrite?.[4]).toContain('read("any")');
    expect(audit.mock.calls[0]?.[1]).toBe("recruitment.vacancy.reopen");
  });

  test("flags a reopened vacancy whose deadline has passed", async () => {
    jobRow({
      application_deadline: "2020-01-01T00:00:00.000Z",
      status: "closed",
    });

    const result = await setJobStatus("job-1", "published");

    expect(result).toEqual({ data: "published", deadlinePassed: true });
  });

  test("refuses to close a draft or reopen a published vacancy", async () => {
    jobRow({ status: "draft" });
    expect(await setJobStatus("job-1", "closed")).toEqual({
      error: "Only a published vacancy can be closed.",
    });

    jobRow({ status: "published" });
    expect(await setJobStatus("job-1", "published")).toEqual({
      error: "Only a closed vacancy can be reopened.",
    });
    expect(adminDb.updateRow).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  test("writes nothing when the editor has no access to the vacancy", async () => {
    jobRow({ status: "published" });
    access.mockImplementation(() => {
      throw new Error("Unauthorized: no write access to this vacancy");
    });

    const result = await setJobStatus("job-1", "closed");

    expect(result).toEqual({
      error: "Unauthorized: no write access to this vacancy",
    });
    expect(adminDb.updateRow).not.toHaveBeenCalled();
  });

  test("reports a missing vacancy", async () => {
    sessionDb.getRow.mockImplementation(() =>
      Promise.reject(Object.assign(new Error("not found"), { code: 404 }))
    );

    expect(await setJobStatus("nope", "closed")).toEqual({
      error: "Vacancy not found",
    });
  });
});

describe("publishJobDraft", () => {
  test("publishes a draft with public read, restamped translations and audit", async () => {
    jobRow({ status: "draft" });

    const result = await publishJobDraft("job-1");

    expect(result).toEqual({ data: "job-1" });
    expect(access).toHaveBeenCalled();
    const [, table, id, data, perms] = adminDb.updateRow.mock.calls[0] as [
      string,
      string,
      string,
      Record<string, unknown>,
      string[],
    ];
    expect([table, id]).toEqual(["jobs", "job-1"]);
    expect(data).toEqual({ scheduled_publish_at: null, status: "published" });
    expect(perms).toContain('read("any")');
    expect(
      adminDb.updateRow.mock.calls.some((c) => c[1] === "content_translations")
    ).toBe(true);
    expect(audit.mock.calls[0]?.[1]).toBe("recruitment.vacancy.publish");
  });

  test("refuses a vacancy that is not a draft", async () => {
    for (const status of ["published", "closed"]) {
      jobRow({ status });
      const result = await publishJobDraft("job-1");
      expect(result).toEqual({
        error: "Only a draft vacancy can be published.",
      });
    }
    expect(adminDb.updateRow).not.toHaveBeenCalled();
  });

  test("a caller without vacancy access is refused and nothing is written", async () => {
    jobRow({ status: "draft" });
    access.mockImplementation(() => {
      throw new Error("Forbidden");
    });

    const result = await publishJobDraft("job-1");

    expect(result).toEqual({ error: "Forbidden" });
    expect(adminDb.updateRow).not.toHaveBeenCalled();
  });
});
