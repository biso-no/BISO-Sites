import { beforeEach, describe, expect, it, vi } from "vitest";

const sync = vi.hoisted(() => vi.fn());
const getRow = vi.hoisted(() => vi.fn());
const updateRow = vi.hoisted(() => vi.fn());
const createRow = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({
    db: { createRow, getRow, updateRow },
  })),
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
const auth = { authorization: `Bearer ${SECRET}` };
const request = (headers: Record<string, string> = {}, query = "") =>
  new Request(`https://api.biso.no/api/cron/sync-finago-projects${query}`, {
    headers,
    method: "POST",
  });
const hoursAgo = (h: number) =>
  new Date(Date.now() - h * 3_600_000).toISOString();
const full = {
  accountCount: 4,
  completed: 4,
  departments: 2,
  inactive: 1,
  partial: false,
  projects: 5,
  usageRows: 7,
  written: 6,
};
const stateUpdates = () => updateRow.mock.calls.map((call) => call[3]);

describe("POST /api/cron/sync-finago-projects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("CRON_SECRET", SECRET);
    getRow.mockResolvedValue({ $id: "projects", next_offset: 0 });
  });

  it("refuses without the cron secret", async () => {
    expect((await POST(request())).status).toBe(401);
    expect((await POST(request({ "x-cron-secret": "wrong" }))).status).toBe(
      401
    );
    expect(sync).not.toHaveBeenCalled();
  });

  it("skips when a full sync is recent", async () => {
    getRow.mockResolvedValue({ last_full_at: hoursAgo(2) });
    const response = await POST(request(auth));
    expect(await response.json()).toEqual({ reason: "recent", skipped: true });
    expect(sync).not.toHaveBeenCalled();
    expect(updateRow).not.toHaveBeenCalled();
  });

  it("cools down after a recent attempt that did not finish", async () => {
    getRow.mockResolvedValue({
      last_attempt_at: hoursAgo(1),
      last_full_at: hoursAgo(30),
    });
    const response = await POST(request(auth));
    expect(await response.json()).toEqual({
      reason: "cooling_down",
      skipped: true,
    });
    expect(sync).not.toHaveBeenCalled();
  });

  it("a full run stamps last_full_at and resets the offset", async () => {
    getRow.mockResolvedValue({
      last_attempt_at: hoursAgo(3),
      last_full_at: hoursAgo(25),
      next_offset: 2,
    });
    sync.mockResolvedValue(full);
    const response = await POST(request(auth));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(full);
    expect(sync.mock.calls[0]?.[1]).toMatchObject({ startOffset: 2 });
    const [attempt, result] = stateUpdates();
    expect(attempt).toHaveProperty("last_attempt_at");
    expect(result).toMatchObject({ next_offset: 0 });
    expect(result).toHaveProperty("last_full_at");
    expect(String(result.last_result)).toContain('"projects":5');
  });

  it("a zero-row full run still counts as full", async () => {
    sync.mockResolvedValue({ ...full, projects: 0, usageRows: 0, written: 0 });
    await POST(request(auth));
    expect(stateUpdates()[1]).toHaveProperty("last_full_at");
  });

  it("a partial run advances next_offset and leaves last_full_at", async () => {
    getRow.mockResolvedValue({ next_offset: 3 });
    sync.mockResolvedValue({
      ...full,
      accountCount: 5,
      completed: 4,
      partial: true,
    });
    await POST(request(auth));
    const result = stateUpdates()[1];
    expect(result).toMatchObject({ next_offset: 2 });
    expect(result).not.toHaveProperty("last_full_at");
  });

  it("an error stores last_result and returns 500", async () => {
    sync.mockRejectedValue(new Error("finago down"));
    const response = await POST(request(auth));
    expect(response.status).toBe(500);
    const last = stateUpdates().at(-1);
    expect(last?.last_result).toBe("error: finago down");
    expect(last).not.toHaveProperty("last_full_at");
  });

  it("force bypasses both skips but still writes state", async () => {
    getRow.mockResolvedValue({
      last_attempt_at: hoursAgo(0.1),
      last_full_at: hoursAgo(1),
    });
    sync.mockResolvedValue(full);
    await POST(request(auth, "?force=1"));
    expect(sync).toHaveBeenCalledOnce();
    expect(updateRow).toHaveBeenCalledTimes(2);
  });

  it("reads for 20 seconds by default, so the run fits a 30-second limit", async () => {
    sync.mockResolvedValue(full);
    await POST(request(auth));
    expect(sync.mock.calls[0]?.[1]).toMatchObject({ budgetMs: 20_000 });
  });

  it("FINAGO_PROJECTS_SYNC_BUDGET_MS sets the reading budget", async () => {
    vi.stubEnv("FINAGO_PROJECTS_SYNC_BUDGET_MS", "120000");
    sync.mockResolvedValue(full);
    await POST(request(auth));
    expect(sync.mock.calls[0]?.[1]).toMatchObject({ budgetMs: 120_000 });
  });

  it("an unusable budget falls back to the default", async () => {
    vi.stubEnv("FINAGO_PROJECTS_SYNC_BUDGET_MS", "soon");
    sync.mockResolvedValue(full);
    await POST(request(auth));
    expect(sync.mock.calls[0]?.[1]).toMatchObject({ budgetMs: 20_000 });
  });

  it("a missing state row runs and creates it", async () => {
    getRow.mockRejectedValue({ code: 404 });
    sync.mockResolvedValue(full);
    const response = await POST(request({ "x-cron-secret": SECRET }));
    expect(response.status).toBe(200);
    expect(createRow).toHaveBeenCalledWith(
      "app",
      "finago_sync_state",
      "projects",
      expect.objectContaining({ last_attempt_at: expect.any(String) })
    );
    expect(sync.mock.calls[0]?.[1]).toMatchObject({ startOffset: 0 });
  });
});
