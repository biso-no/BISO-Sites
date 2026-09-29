import { expect, mock, test } from "bun:test";
import { runSync, type SyncDeps } from "./run";

function deps(overrides: Partial<SyncDeps> = {}): SyncDeps {
  return {
    countRunningExecutions: async () => 1,
    deleteStaleRows: mock(async () => 0),
    fetchCompanies: async () => [{ Id: 1, Name: "Ada" }],
    fetchInvoiceLines: async () => [],
    fetchTree: async () => [{ categoryId: 10, companyId: 1 }],
    listCampusIds: async () => new Set(["1"]),
    listPlanRows: async () => [
      {
        category: "10",
        expiryDate: "2099-12-31",
        membership_id: "113",
        name: "Plan",
      },
    ],
    log: () => undefined,
    newRunId: () => "run1",
    today: () => "2026-09-29",
    upsertRows: mock(async () => undefined),
    ...overrides,
  };
}

test("skips when another execution is already processing", async () => {
  const d = deps({ countRunningExecutions: async () => 2 });
  expect(await runSync(d)).toEqual({ ok: true, skipped: "already-running" });
  expect(d.upsertRows).not.toHaveBeenCalled();
});

test("throws and writes nothing when the tree yields zero members", async () => {
  const d = deps({ fetchTree: async () => [] });
  await expect(runSync(d)).rejects.toThrow("zero current members");
  expect(d.upsertRows).not.toHaveBeenCalled();
  expect(d.deleteStaleRows).not.toHaveBeenCalled();
});

test("upserts before deleting stale rows, with the run id", async () => {
  const order: string[] = [];
  const d = deps({
    deleteStaleRows: mock(async (runId: string) => {
      order.push(`delete:${runId}`);
      return 3;
    }),
    upsertRows: mock(async () => {
      order.push("upsert");
    }),
  });
  const result = await runSync(d);
  expect(order).toEqual(["upsert", "delete:run1"]);
  expect(result).toMatchObject({
    members: 1,
    ok: true,
    removed: 3,
    unknownCampus: 1,
  });
});
