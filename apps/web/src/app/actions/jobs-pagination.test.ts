import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionDb = vi.hoisted(() => ({ listRows: vi.fn() }));

vi.mock("@repo/api/server", () => ({
  createSessionClient: vi.fn(async () => ({ db: sessionDb })),
  createAdminClient: vi.fn(async () => ({ db: sessionDb })),
}));

// recruitment-screener imports "server-only", which throws outside Next's
// webpack loader (vitest runs in a plain node environment).
vi.mock("@repo/ai/server/recruitment-screener", () => ({
  normalizeScreeningScore: vi.fn(),
  screenApplication: vi.fn(),
}));

// React's cache() memoizes on argument identity, so two tests calling
// listJobs({ page: 1 }) would share one result and the second would never
// reach the mocked db. Identity stub keeps each test independent.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: <T>(fn: T) => fn,
}));

import { listJobs } from "./jobs";

const queriesOf = (call: number): string[] =>
  sessionDb.listRows.mock.calls[call][2].map(String);

describe("listJobs pagination", () => {
  beforeEach(() => {
    sessionDb.listRows.mockReset();
    sessionDb.listRows.mockResolvedValue({ rows: [], total: 0 });
  });

  it("filters open vacancies in the query, not after the fetch", async () => {
    await listJobs({ page: 1 });

    const serialized = queriesOf(0).join("|");
    expect(serialized).toContain("published");
    expect(serialized).toContain("application_deadline");
    // A post-fetch filter would make Appwrite's total overcount and leave
    // holes in every page slice.
    expect(serialized).toContain("or");
  });

  it("pages by 12 and offsets from the 1-based page", async () => {
    await listJobs({ page: 3 });

    const serialized = queriesOf(0).join("|");
    expect(serialized).toContain("12");
    expect(serialized).toContain("24");
  });

  it("reports Appwrite's total rather than the page length", async () => {
    sessionDb.listRows.mockResolvedValue({
      rows: [{ $id: "j1", translations: [], metadata: "{}" }],
      total: 28,
    });

    const result = await listJobs({ page: 1 });

    expect(result.total).toBe(28);
    expect(result.page).toBe(1);
    expect(result.size).toBe(12);
    expect(result.capped).toBe(false);
  });

  it("filters unit category through the department relationship", async () => {
    await listJobs({ category: "society" });

    // Verified working against the live instance: filter operators traverse
    // relationships even though ordering does not.
    expect(queriesOf(0).join("|")).toContain("department.type");
  });

  it("orders by deadline ascending when asked, newest first by default", async () => {
    await listJobs({ sort: "deadline" });
    expect(queriesOf(0).join("|")).toContain("application_deadline");

    sessionDb.listRows.mockClear();
    await listJobs({});
    expect(queriesOf(0).join("|")).toContain("$createdAt");
  });

  it("resolves a search to ids first, then filters jobs by them", async () => {
    sessionDb.listRows
      .mockResolvedValueOnce({ rows: [{ content_id: "j7" }], total: 1 })
      .mockResolvedValueOnce({ rows: [], total: 0 });

    await listJobs({ search: "analyst", locale: "en" });

    expect(sessionDb.listRows.mock.calls[0][1]).toBe("content_translations");
    expect(sessionDb.listRows.mock.calls[1][1]).toBe("jobs");
    expect(queriesOf(1).join("|")).toContain("j7");
  });

  it("short-circuits without a second query when the search matches nothing", async () => {
    sessionDb.listRows.mockResolvedValueOnce({ rows: [], total: 0 });

    const result = await listJobs({ search: "nothingmatchesthis" });

    // Issuing Query.equal("$id", []) would be meaningless and may throw.
    expect(sessionDb.listRows).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      rows: [],
      total: 0,
      page: 1,
      size: 12,
      capped: false,
    });
  });

  it("returns an empty result rather than throwing when Appwrite fails", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    sessionDb.listRows.mockRejectedValue(new Error("appwrite down"));

    const result = await listJobs({ page: 2 });

    expect(result.rows).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.page).toBe(2);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
