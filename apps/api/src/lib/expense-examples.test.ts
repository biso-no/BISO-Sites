import type { CostTypeOption } from "@repo/shared/utils/expense-cost-types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  normalizeVendor,
  selectExamples,
  writeExamples,
} from "./expense-examples";

const listRows = vi.fn();
const createRow = vi.fn();
const db = { createRow, listRows } as unknown as Parameters<
  typeof selectExamples
>[0];

function type(slug: string): CostTypeOption {
  return { accountNumber: 7140, label: slug, slug, taxCode: 0 };
}

const types = ["food", "travel", "gifts"].map(type);

function row(over: Record<string, unknown>) {
  return {
    $createdAt: "2026-01-01T00:00:00.000Z",
    description: "d",
    final_cost_type: "food",
    source: "student",
    vendor_key: "rema",
    ...over,
  };
}

describe("normalizeVendor", () => {
  it("lowercases and drops legal suffixes", () => {
    expect(normalizeVendor("Peppes Pizza AS")).toBe("peppes pizza");
  });

  it("removes punctuation and collapses whitespace", () => {
    expect(normalizeVendor("REMA 1000, Majorstuen")).toBe(
      "rema 1000 majorstuen"
    );
  });

  it("keeps æøå but strips other diacritics", () => {
    expect(normalizeVendor("Café Ærø Å")).toBe("cafe ærø å");
  });

  it("returns an empty string for empty input", () => {
    expect(normalizeVendor(null)).toBe("");
    expect(normalizeVendor(undefined)).toBe("");
    expect(normalizeVendor("  ")).toBe("");
  });
});

describe("selectExamples", () => {
  beforeEach(() => {
    listRows.mockReset();
    createRow.mockReset();
  });

  it("puts approver vendor matches before student ones", async () => {
    listRows.mockImplementation(async (_d: string, _t: string, q: string[]) =>
      q.some((s) => s.includes("vendor_key"))
        ? {
            rows: [
              row({ description: "s1", source: "student" }),
              row({ description: "a1", source: "approver" }),
            ],
          }
        : { rows: [] }
    );
    const result = await selectExamples(db, { types, vendor: "Rema" });
    expect(result.map((r) => r.description)).toEqual(["a1", "s1"]);
  });

  it("leaves out the example named by excludeId", async () => {
    listRows.mockResolvedValue({
      rows: [
        row({ $id: "self", description: "self" }),
        row({ $id: "other", description: "other" }),
      ],
    });
    const result = await selectExamples(db, {
      excludeId: "self",
      types,
      vendor: "Rema",
    });
    expect(result.map((r) => r.description)).toEqual(["other"]);
  });

  it("caps vendor matches at 6 and the total at 10", async () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      row({ description: `v${i}` })
    );
    const recent = ["food", "travel", "gifts"].map((t) =>
      row({ description: `r-${t}`, final_cost_type: t, vendor_key: "x" })
    );
    listRows.mockImplementation(async (_d: string, _t: string, q: string[]) =>
      q.some((s) => s.includes("vendor_key"))
        ? { rows: many }
        : { rows: recent }
    );
    const result = await selectExamples(db, { types, vendor: "Rema" });
    expect(result).toHaveLength(8);
    expect(result.filter((r) => r.description.startsWith("v"))).toHaveLength(6);
  });

  it("never returns more than 10 examples", async () => {
    const slugs = Array.from({ length: 14 }, (_, i) => `t${i}`);
    const many = Array.from({ length: 8 }, (_, i) =>
      row({ description: `v${i}`, final_cost_type: "t0" })
    );
    const recent = slugs.map((t) =>
      row({ description: `r-${t}`, final_cost_type: t, vendor_key: "x" })
    );
    listRows.mockImplementation(async (_d: string, _t: string, q: string[]) =>
      q.some((s) => s.includes("vendor_key"))
        ? { rows: many }
        : { rows: recent }
    );
    const result = await selectExamples(db, {
      types: slugs.map(type),
      vendor: "Rema",
    });
    expect(result).toHaveLength(10);
  });

  it("fills with the newest example of each unrepresented type", async () => {
    listRows.mockResolvedValue({
      rows: [
        row({ description: "f1", final_cost_type: "food" }),
        row({ description: "f2", final_cost_type: "food" }),
        row({ description: "t1", final_cost_type: "travel" }),
      ],
    });
    const result = await selectExamples(db, { types, vendor: null });
    expect(result.map((r) => r.description)).toEqual(["f1", "t1"]);
    expect(listRows).toHaveBeenCalledTimes(1);
  });

  it("skips inactive types and free-text examples", async () => {
    listRows.mockResolvedValue({
      rows: [
        row({ description: "old", final_cost_type: "retired" }),
        row({ description: "free", final_cost_type: null }),
        row({ description: "ok", final_cost_type: "gifts" }),
      ],
    });
    const result = await selectExamples(db, { types, vendor: null });
    expect(result.map((r) => r.description)).toEqual(["ok"]);
  });

  it("returns [] on db error", async () => {
    listRows.mockRejectedValue(new Error("boom"));
    expect(await selectExamples(db, { types, vendor: "Rema" })).toEqual([]);
  });
});

describe("writeExamples", () => {
  beforeEach(() => {
    createRow.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  const input = {
    accountNumber: 7140,
    aiConfidence: 0.8,
    aiCostType: "food",
    amount: 100,
    description: "x".repeat(300),
    finalCostType: "food",
    finalText: null,
    source: "approver" as const,
    vendor: "Peppes Pizza AS",
  };

  it("writes one anonymous row per example", async () => {
    createRow.mockResolvedValue({});
    await writeExamples(db, [input, input]);
    expect(createRow).toHaveBeenCalledTimes(2);
    const [, table, , data] = createRow.mock.calls[0];
    expect(table).toBe("expense_type_examples");
    expect(data.vendor_key).toBe("peppes pizza");
    expect(data.description).toHaveLength(255);
    expect(Object.keys(data)).not.toContain("expense_id");
  });

  it("never throws and continues after a failure", async () => {
    createRow.mockRejectedValueOnce(new Error("boom")).mockResolvedValue({});
    await expect(writeExamples(db, [input, input])).resolves.toBeUndefined();
    expect(createRow).toHaveBeenCalledTimes(2);
  });
});
