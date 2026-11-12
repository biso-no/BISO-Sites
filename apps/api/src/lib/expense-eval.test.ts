import type { CostTypeOption } from "@repo/shared/utils/expense-cost-types";
import { beforeEach, describe, expect, it, vi } from "vitest";

const scan = vi.hoisted(() => ({
  CLASSIFY_TIMEOUT_MS: 8000,
  classifyReceipt: vi.fn(),
}));
const examples = vi.hoisted(() => ({ selectExamples: vi.fn() }));
const types = vi.hoisted(() => ({ loadActiveCostTypes: vi.fn() }));

vi.mock("./receipt-scan", () => scan);
vi.mock("./expense-examples", () => examples);
vi.mock("./expense-types", () => types);

import { runRerunCheck } from "./expense-eval";

const listRows = vi.fn();
const db = { listRows } as unknown as Parameters<typeof runRerunCheck>[0];

const active: CostTypeOption[] = [
  { accountNumber: 7140, label: "Food", slug: "food", taxCode: 0 },
  { accountNumber: 7300, label: "Travel", slug: "travel", taxCode: 0 },
];

function row(id: string, over: Record<string, unknown> = {}) {
  return {
    $id: id,
    amount: 100,
    description: `desc ${id}`,
    final_cost_type: "food",
    vendor_key: "rema",
    ...over,
  };
}

beforeEach(() => {
  for (const fn of [
    listRows,
    scan.classifyReceipt,
    examples.selectExamples,
    types.loadActiveCostTypes,
  ]) {
    fn.mockReset();
  }
  types.loadActiveCostTypes.mockResolvedValue(active);
  examples.selectExamples.mockResolvedValue([]);
  scan.classifyReceipt.mockResolvedValue({
    confidence: 0.95,
    costType: "food",
    reason: null,
  });
});

describe("runRerunCheck", () => {
  it("scores a hit only at or above the threshold", async () => {
    listRows.mockResolvedValue({
      rows: [row("a"), row("b"), row("c"), row("d")],
    });
    scan.classifyReceipt
      .mockResolvedValueOnce({
        confidence: 0.8,
        costType: "food",
        reason: null,
      })
      .mockResolvedValueOnce({
        confidence: 0.79,
        costType: "food",
        reason: null,
      })
      .mockResolvedValueOnce({
        confidence: 0.99,
        costType: "travel",
        reason: null,
      })
      .mockResolvedValueOnce({ confidence: 0, costType: null, reason: null });

    const result = await runRerunCheck(db, { concurrency: 1 });

    expect(result.checked).toBe(4);
    expect(result.considered).toBe(4);
    expect(result.hits).toBe(1);
    expect(result.hitRate).toBe(0.25);
    expect(result.stoppedEarly).toBe(false);
    expect(result.misses.map((m) => m.exampleId)).toEqual(["b", "c", "d"]);
    expect(result.misses[1]).toMatchObject({
      confidence: 0.99,
      expected: "food",
      predicted: "travel",
    });
  });

  it("excludes the example itself from its examples", async () => {
    listRows.mockResolvedValue({ rows: [row("a", { vendor_key: "rema" })] });

    await runRerunCheck(db);

    expect(examples.selectExamples).toHaveBeenCalledWith(db, {
      excludeId: "a",
      types: active,
      vendor: "rema",
    });
    const call = scan.classifyReceipt.mock.calls[0]?.[0];
    expect(call.receipt).toMatchObject({
      amount: 100,
      description: "desc a",
      documentType: "receipt",
      vendor: "rema",
    });
    expect(call.abortSignal).toBeInstanceOf(AbortSignal);
  });

  it("skips own-text examples", async () => {
    listRows.mockResolvedValue({
      rows: [row("a"), row("b", { final_cost_type: null })],
    });

    const result = await runRerunCheck(db);

    expect(result.considered).toBe(2);
    expect(result.checked).toBe(1);
    expect(scan.classifyReceipt).toHaveBeenCalledTimes(1);
  });

  it("returns a null hit rate when nothing was scored", async () => {
    listRows.mockResolvedValue({ rows: [] });

    const result = await runRerunCheck(db);

    expect(result).toMatchObject({ checked: 0, hitRate: null, misses: [] });
  });

  it("stops starting new calls when the budget is spent", async () => {
    listRows.mockResolvedValue({
      rows: [row("a"), row("b"), row("c"), row("d")],
    });
    let now = 0;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    scan.classifyReceipt.mockImplementation(() => {
      now += 60_000;
      return Promise.resolve({
        confidence: 0.9,
        costType: "food",
        reason: null,
      });
    });

    const result = await runRerunCheck(db, {
      budgetMs: 100_000,
      concurrency: 1,
    });
    vi.restoreAllMocks();

    expect(result.checked).toBe(2);
    expect(result.considered).toBe(4);
    expect(result.stoppedEarly).toBe(true);
  });

  it("caps misses at 50", async () => {
    listRows.mockResolvedValue({
      rows: Array.from({ length: 60 }, (_, i) => row(`r${i}`)),
    });
    scan.classifyReceipt.mockResolvedValue({
      confidence: 0.9,
      costType: "travel",
      reason: null,
    });

    const result = await runRerunCheck(db);

    expect(result.checked).toBe(60);
    expect(result.hits).toBe(0);
    expect(result.misses).toHaveLength(50);
  });

  it("counts a failed classification as a miss", async () => {
    listRows.mockResolvedValue({ rows: [row("a")] });
    scan.classifyReceipt.mockRejectedValue(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await runRerunCheck(db);
    vi.restoreAllMocks();

    expect(result.misses[0]).toMatchObject({ exampleId: "a", predicted: null });
  });
});
