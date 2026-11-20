import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  decrementRowColumn: vi.fn(),
  incrementRowColumn: vi.fn(),
  listRows: vi.fn(),
}));
const run = vi.hoisted(() => ({
  noAgent: vi.fn(),
  runExpenseCheck: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({ db })),
}));
vi.mock("@/lib/expense-check/run", () => run);

import { POST } from "./route";

const SECRET = "cron-secret-value";
const auth = { authorization: `Bearer ${SECRET}` };
const request = (headers: Record<string, string> = auth) =>
  new Request("https://api.biso.no/api/cron/expense-check-backstop", {
    headers,
    method: "POST",
  });

/** Rows the list returns, with the claim each one's increment yields. */
function stuck(
  rows: { $id: string; check_claim: number; check_state?: string }[]
) {
  const withState = rows.map((row) => ({
    check_state: "running",
    ...row,
  }));
  db.listRows.mockResolvedValue({ rows: withState, total: rows.length });
  db.incrementRowColumn.mockImplementation(({ rowId }: { rowId: string }) =>
    Promise.resolve({
      check_claim:
        (rows.find((row) => row.$id === rowId)?.check_claim ?? 0) + 1,
    })
  );
}

describe("POST /api/cron/expense-check-backstop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("CRON_SECRET", SECRET);
    run.runExpenseCheck.mockResolvedValue("done");
    db.decrementRowColumn.mockResolvedValue({});
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("refuses without the cron secret", async () => {
    expect((await POST(request({}))).status).toBe(401);
    expect(db.listRows).not.toHaveBeenCalled();
  });

  it("the backstop finishes a stuck check", async () => {
    stuck([{ $id: "expense-1", check_claim: 1 }]);

    const response = await POST(request());

    expect(await response.json()).toEqual({
      failed: 0,
      fallbackOnly: 0,
      found: 1,
      ran: 1,
      skipped: 0,
    });
    expect(db.incrementRowColumn).toHaveBeenCalledWith(
      expect.objectContaining({ column: "check_claim", rowId: "expense-1" })
    );
    expect(run.runExpenseCheck).toHaveBeenCalledWith("expense-1", {
      claim: 2,
    });
    expect(db.decrementRowColumn).not.toHaveBeenCalled();
  });

  it("asks for stale queued and running checks, oldest first, five at most", async () => {
    stuck([]);

    await POST(request());

    const [, table, queries] = db.listRows.mock.calls[0] as [
      string,
      string,
      string[],
    ];
    expect(table).toBe("expense");
    const text = queries.join(" ");
    expect(text).toContain("queued");
    expect(text).toContain("running");
    expect(text).toContain("check_started_at");
    expect(text).toContain("$updatedAt");
    expect(text).toContain("orderAsc");
    expect(text).toContain("limit");
    expect(text).toContain("5");
  });

  it("asks only for checks stale for ten minutes, so a fresh one is left alone", async () => {
    // The list holds only stale rows; a fresh one never comes back, and the
    // cutoff it was asked with is ten minutes ago.
    stuck([]);

    const response = await POST(request());

    const queries = (
      db.listRows.mock.calls[0] as [string, string, string[]]
    )[2];
    const cutoffs = queries
      .join(" ")
      .match(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g)
      ?.map((iso) => Date.parse(iso));
    expect(cutoffs?.length).toBeGreaterThan(0);
    const tenMinutes = 10 * 60_000;
    for (const cutoff of cutoffs ?? []) {
      const age = Date.now() - cutoff;
      expect(age).toBeGreaterThanOrEqual(tenMinutes);
      expect(age).toBeLessThan(tenMinutes + 5000);
    }
    expect(await response.json()).toMatchObject({ found: 0, ran: 0 });
    expect(db.incrementRowColumn).not.toHaveBeenCalled();
    expect(run.runExpenseCheck).not.toHaveBeenCalled();
  });

  it("a check stale twice runs without the agent", async () => {
    stuck([
      { $id: "expense-1", check_claim: 1 },
      { $id: "expense-2", check_claim: 2 },
    ]);

    const response = await POST(request());

    expect(run.runExpenseCheck).toHaveBeenNthCalledWith(1, "expense-1", {
      claim: 2,
    });
    expect(run.runExpenseCheck).toHaveBeenNthCalledWith(2, "expense-2", {
      agent: run.noAgent,
      claim: 3,
    });
    expect(await response.json()).toMatchObject({ fallbackOnly: 1, ran: 2 });
  });

  it("steps aside when an overlapping tick took the row first", async () => {
    stuck([{ $id: "expense-1", check_claim: 1 }]);
    db.incrementRowColumn.mockResolvedValueOnce({ check_claim: 3 });

    const response = await POST(request());

    expect(run.runExpenseCheck).not.toHaveBeenCalled();
    expect(db.decrementRowColumn).toHaveBeenCalledWith(
      expect.objectContaining({
        column: "check_claim",
        min: 0,
        rowId: "expense-1",
        value: 1,
      })
    );
    expect(await response.json()).toMatchObject({ ran: 0, skipped: 1 });
  });

  it("runs the tick's takeovers side by side, so each gets the whole budget", async () => {
    stuck([
      { $id: "expense-1", check_claim: 1 },
      { $id: "expense-2", check_claim: 1 },
      { $id: "expense-3", check_claim: 1 },
    ]);
    const started: string[] = [];
    let finishFirst: () => void = () => undefined;
    run.runExpenseCheck.mockImplementation((expenseId: string) => {
      started.push(expenseId);
      if (expenseId !== "expense-1") {
        return Promise.resolve("done");
      }
      return new Promise((resolve) => {
        finishFirst = () => resolve("done");
      });
    });

    const response = POST(request());

    // The oldest is still running when the others start.
    await vi.waitFor(() =>
      expect(started).toEqual(["expense-1", "expense-2", "expense-3"])
    );
    finishFirst();
    expect(await (await response).json()).toMatchObject({
      failed: 0,
      found: 3,
      ran: 3,
    });
  });

  it("goes on after one expense fails, and counts it", async () => {
    stuck([
      { $id: "expense-1", check_claim: 1 },
      { $id: "expense-2", check_claim: 1 },
    ]);
    run.runExpenseCheck.mockRejectedValueOnce(new Error("boom"));

    const response = await POST(request());

    expect(run.runExpenseCheck).toHaveBeenCalledTimes(2);
    expect(await response.json()).toMatchObject({ failed: 1, ran: 1 });
  });

  it("counts a check another run took as skipped", async () => {
    stuck([{ $id: "expense-1", check_claim: 1 }]);
    run.runExpenseCheck.mockResolvedValue("skipped");

    expect(await (await POST(request())).json()).toMatchObject({
      ran: 0,
      skipped: 1,
    });
  });
});
