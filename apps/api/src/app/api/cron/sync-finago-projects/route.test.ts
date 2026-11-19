import { beforeEach, describe, expect, it, vi } from "vitest";

const sync = vi.hoisted(() => vi.fn());
const listRows = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({ db: { listRows } })),
}));
vi.mock("@repo/connectors/24sevenoffice", () => ({
  getProjects: vi.fn(),
  listCostLines: vi.fn(),
}));
vi.mock("@repo/shared/utils/finago-project-sync", () => ({
  syncFinagoProjects: sync,
}));

import { POST } from "./route";

const SECRET = "cron-secret-value";
const request = (headers: Record<string, string> = {}, query = "") =>
  new Request(`https://api.biso.no/api/cron/sync-finago-projects${query}`, {
    headers,
    method: "POST",
  });

describe("POST /api/cron/sync-finago-projects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", SECRET);
    listRows.mockResolvedValue({ rows: [] });
  });

  it("refuses without the cron secret", async () => {
    expect((await POST(request())).status).toBe(401);
    expect((await POST(request({ "x-cron-secret": "wrong" }))).status).toBe(
      401
    );
    expect(sync).not.toHaveBeenCalled();
  });

  it("runs the sync and reports counts", async () => {
    const counts = {
      departments: 2,
      inactive: 1,
      partial: false,
      projects: 5,
      usageRows: 7,
      written: 6,
    };
    sync.mockResolvedValue(counts);
    const response = await POST(request({ authorization: `Bearer ${SECRET}` }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(counts);
    expect(sync).toHaveBeenCalledOnce();
  });

  it("reports a failed sync", async () => {
    sync.mockRejectedValue(new Error("down"));
    const response = await POST(request({ "x-cron-secret": SECRET }));
    expect(response.status).toBe(500);
  });

  const auth = { authorization: `Bearer ${SECRET}` };
  const hoursAgo = (h: number) =>
    new Date(Date.now() - h * 3_600_000).toISOString();

  it("skips when a full sync is recent", async () => {
    listRows.mockResolvedValue({ rows: [{ synced_at: hoursAgo(2) }] });
    const response = await POST(request(auth));
    expect(await response.json()).toEqual({ reason: "recent", skipped: true });
    expect(sync).not.toHaveBeenCalled();
  });

  it("runs when the last full sync is old, or there is none", async () => {
    sync.mockResolvedValue({});
    listRows.mockResolvedValue({ rows: [{ synced_at: hoursAgo(21) }] });
    await POST(request(auth));
    listRows.mockResolvedValue({ rows: [] });
    await POST(request(auth));
    expect(sync).toHaveBeenCalledTimes(2);
  });

  it("runs on force even when recent", async () => {
    sync.mockResolvedValue({});
    listRows.mockResolvedValue({ rows: [{ synced_at: hoursAgo(1) }] });
    await POST(request(auth, "?force=1"));
    expect(sync).toHaveBeenCalledOnce();
  });
});
