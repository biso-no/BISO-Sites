import { beforeEach, describe, expect, it, vi } from "vitest";

const listRows = vi.hoisted(() => vi.fn());
const deleteRow = vi.hoisted(() => vi.fn());
const deleteFile = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({
    db: { deleteRow, listRows },
    storage: { deleteFile },
  })),
}));

import { POST } from "./route";

const SECRET = "cron-secret-value";
const request = (headers: Record<string, string> = {}) =>
  new Request("https://api.biso.no/api/cron/cleanup-recruitment", {
    headers,
    method: "POST",
  });
const authed = () => request({ "x-cron-secret": SECRET });
const page = (rows: Record<string, unknown>[]) => ({
  rows,
  total: rows.length,
});

describe("POST /api/cron/cleanup-recruitment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-17T00:00:00Z"));
    vi.stubEnv("CRON_SECRET", SECRET);
    deleteRow.mockResolvedValue(undefined);
    deleteFile.mockResolvedValue(undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("requires the cron secret", async () => {
    expect((await POST(request())).status).toBe(401);
    expect((await POST(request({ "x-cron-secret": "wrong" }))).status).toBe(
      401
    );
    vi.stubEnv("CRON_SECRET", "");
    expect((await POST(authed())).status).toBe(500);
  });

  it("queries expired rows with a $createdAt fallback", async () => {
    listRows.mockResolvedValue(page([]));
    await POST(request({ authorization: `Bearer ${SECRET}` }));

    expect(listRows.mock.calls[0]?.[1]).toBe("job_applications");
    expect(listRows.mock.calls[1]?.[1]).toBe("candidate_profiles");
    const queries = JSON.stringify(listRows.mock.calls[0]?.[2]);
    expect(queries).toContain("data_retention_until");
    expect(queries).toContain("2026-09-17T00:00:00.000Z");
    expect(queries).toContain("isNull");
    expect(queries).toContain("2026-03-21T00:00:00.000Z");
  });

  it("deletes the resume before the application, then expired profiles", async () => {
    listRows
      .mockResolvedValueOnce(
        page([
          { $id: "a1", resume_file_id: "f1" },
          { $id: "a2", resume_file_id: null },
        ])
      )
      .mockResolvedValueOnce(page([{ $id: "p1" }]));

    const response = await POST(authed());
    expect(await response.json()).toEqual({
      applicationsDeleted: 2,
      failed: 0,
      profilesDeleted: 1,
      resumesDeleted: 1,
    });
    expect(deleteFile).toHaveBeenCalledWith("resumes", "f1");
    expect(deleteFile.mock.invocationCallOrder[0]).toBeLessThan(
      deleteRow.mock.invocationCallOrder[0] ?? 0
    );
    expect(deleteRow.mock.calls).toEqual([
      ["app", "job_applications", "a1"],
      ["app", "job_applications", "a2"],
      ["app", "candidate_profiles", "p1"],
    ]);
  });

  it("keeps the application when its resume cannot be deleted", async () => {
    listRows
      .mockResolvedValueOnce(page([{ $id: "a1", resume_file_id: "f1" }]))
      .mockResolvedValueOnce(page([]));
    deleteFile.mockRejectedValueOnce(
      Object.assign(new Error("boom"), { code: 500 })
    );

    const body = await (await POST(authed())).json();
    expect(body).toMatchObject({ applicationsDeleted: 0, failed: 1 });
    expect(deleteRow).not.toHaveBeenCalled();
  });

  it("deletes the application when the resume is already gone", async () => {
    listRows
      .mockResolvedValueOnce(page([{ $id: "a1", resume_file_id: "f1" }]))
      .mockResolvedValueOnce(page([]));
    deleteFile.mockRejectedValueOnce(
      Object.assign(new Error("missing"), { code: 404 })
    );

    const body = await (await POST(authed())).json();
    expect(body).toMatchObject({ applicationsDeleted: 1, resumesDeleted: 0 });
    expect(deleteRow).toHaveBeenCalledWith("app", "job_applications", "a1");
  });

  it("pages past the last seen $id and stops after ten batches", async () => {
    const full = (prefix: string) =>
      page(Array.from({ length: 100 }, (_, i) => ({ $id: `${prefix}${i}` })));
    listRows.mockImplementation(async () => full("x"));

    const body = await (await POST(authed())).json();
    expect(body).toMatchObject({
      applicationsDeleted: 1000,
      profilesDeleted: 1000,
    });
    expect(listRows).toHaveBeenCalledTimes(20);
    expect(JSON.stringify(listRows.mock.calls[1]?.[2])).toContain(
      "greaterThan"
    );
  });

  it("returns a clean 500 when listing fails", async () => {
    listRows.mockRejectedValue(new Error("Table not found"));
    const response = await POST(authed());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "failed" });
  });
});
