import { beforeEach, describe, expect, it, vi } from "vitest";

const sync = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({ db: { marker: true } })),
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
const request = (headers: Record<string, string> = {}) =>
  new Request("https://api.biso.no/api/cron/sync-finago-projects", {
    headers,
    method: "POST",
  });

describe("POST /api/cron/sync-finago-projects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", SECRET);
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
});
