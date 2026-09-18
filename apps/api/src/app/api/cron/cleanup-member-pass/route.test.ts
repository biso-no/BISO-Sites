import { beforeEach, describe, expect, it, vi } from "vitest";

const listRows = vi.hoisted(() => vi.fn());
const deleteRow = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({ db: { deleteRow, listRows } })),
}));

import { POST } from "./route";

const SECRET = "cron-secret-value";
const request = (headers: Record<string, string> = {}) =>
  new Request("https://api.biso.no/api/cron/cleanup-member-pass", {
    headers,
    method: "POST",
  });

describe("POST /api/cron/cleanup-member-pass", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-17T00:00:00Z"));
    vi.stubEnv("CRON_SECRET", SECRET);
    deleteRow.mockResolvedValue(undefined);
  });

  it("requires the cron secret", async () => {
    expect((await POST(request())).status).toBe(401);
    expect((await POST(request({ "x-cron-secret": "wrong" }))).status).toBe(
      401
    );
    vi.stubEnv("CRON_SECRET", "");
    expect((await POST(request({ "x-cron-secret": SECRET }))).status).toBe(500);
  });

  it("deletes old scans and long-expired links in batches", async () => {
    const batch = (prefix: string, count: number) => ({
      rows: Array.from({ length: count }, (_, i) => ({ $id: `${prefix}${i}` })),
      total: count,
    });
    listRows
      .mockResolvedValueOnce(batch("s", 100))
      .mockResolvedValueOnce(batch("s", 3))
      .mockResolvedValueOnce(batch("l", 2));

    const response = await POST(request({ authorization: `Bearer ${SECRET}` }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      linksDeleted: 2,
      scansDeleted: 103,
    });

    expect(JSON.stringify(listRows.mock.calls[0])).toContain(
      "member_pass_scans"
    );
    expect(JSON.stringify(listRows.mock.calls[0]?.[2])).toContain(
      "2026-06-19T00:00:00.000Z"
    );
    expect(JSON.stringify(listRows.mock.calls[2])).toContain(
      "member_pass_scanner_links"
    );
    expect(JSON.stringify(listRows.mock.calls[2]?.[2])).toContain(
      "2026-08-18T00:00:00.000Z"
    );
    expect(deleteRow).toHaveBeenCalledTimes(105);
  });

  it("stops after ten batches per table", async () => {
    listRows.mockResolvedValue({
      rows: Array.from({ length: 100 }, (_, i) => ({ $id: `x${i}` })),
      total: 100,
    });
    const body = await (
      await POST(request({ "x-cron-secret": SECRET }))
    ).json();
    expect(body).toEqual({ linksDeleted: 1000, scansDeleted: 1000 });
  });

  it("returns a clean 500 when the cleanup fails", async () => {
    listRows.mockRejectedValue(new Error("Table not found"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const response = await POST(request({ "x-cron-secret": SECRET }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "failed" });
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
