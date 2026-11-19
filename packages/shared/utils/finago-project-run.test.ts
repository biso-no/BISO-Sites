import { beforeEach, describe, expect, it, vi } from "vitest";

const sync = vi.hoisted(() => vi.fn());
vi.mock("./finago-project-sync", () => ({ syncFinagoProjects: sync }));

import { type RunDb, runProjectSync } from "./finago-project-run";

const getRow = vi.fn();
const updateRow = vi.fn();
const createRow = vi.fn();
const db = { createRow, getRow, listRows: vi.fn(), updateRow } as RunDb;
const deps = { getProjects: vi.fn(), listCostLines: vi.fn() };
const now = new Date("2026-11-19T12:00:00.000Z");
const minutesAgo = (m: number) =>
  new Date(now.getTime() - m * 60_000).toISOString();
const full = {
  accountCount: 5,
  completed: 5,
  departments: 1,
  inactive: 0,
  partial: false,
  projects: 3,
  usageRows: 2,
  written: 3,
};
const updates = () => updateRow.mock.calls.map((call) => call[3]);

describe("runProjectSync manual mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRow.mockResolvedValue({});
    updateRow.mockResolvedValue({});
    createRow.mockResolvedValue({});
    sync.mockResolvedValue(full);
  });

  it("is busy when an attempt started under 5 minutes ago", async () => {
    getRow.mockResolvedValue({ last_attempt_at: minutesAgo(2) });
    expect(await runProjectSync(db, deps, { mode: "manual", now })).toEqual({
      outcome: "skipped",
      reason: "busy",
    });
    expect(sync).not.toHaveBeenCalled();
    expect(updateRow).not.toHaveBeenCalled();
  });

  it("bypasses the nightly recent and cooldown skips", async () => {
    getRow.mockResolvedValue({
      last_attempt_at: minutesAgo(30),
      last_full_at: minutesAgo(60),
    });
    const out = await runProjectSync(db, deps, { mode: "manual", now });
    expect(out.outcome).toBe("ran");
  });

  it("resumes from next_offset and passes the budget", async () => {
    getRow.mockResolvedValue({ next_offset: 3 });
    await runProjectSync(db, deps, { budgetMs: 20_000, mode: "manual", now });
    expect(sync.mock.calls[0]?.[1]).toMatchObject({
      budgetMs: 20_000,
      startOffset: 3,
    });
  });

  it("writes the same state as the nightly run", async () => {
    await runProjectSync(db, deps, { mode: "manual", now });
    const [attempt, result] = updates();
    expect(attempt).toEqual({ last_attempt_at: now.toISOString() });
    expect(result).toMatchObject({
      last_full_at: now.toISOString(),
      next_offset: 0,
    });
  });

  it("a partial run advances next_offset only", async () => {
    getRow.mockResolvedValue({ next_offset: 3 });
    sync.mockResolvedValue({ ...full, completed: 4, partial: true });
    await runProjectSync(db, deps, { mode: "manual", now });
    const result = updates()[1];
    expect(result).toMatchObject({ next_offset: 2 });
    expect(result).not.toHaveProperty("last_full_at");
  });

  it("stores errors and rethrows", async () => {
    sync.mockRejectedValue(new Error("down"));
    await expect(
      runProjectSync(db, deps, { mode: "manual", now })
    ).rejects.toThrow("down");
    expect(updates().at(-1)).toEqual({ last_result: "error: down" });
  });
});
