import type { CostTypeOption } from "@repo/shared/utils/expense-cost-types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { selectExamples } from "./expense-examples";

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
    confirmed: true,
    department_id: null,
    final_cost_type: "food",
    source: "student",
    type_source: null,
    vendor_key: "rema",
    ...over,
  };
}

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

  it("a prefix vendor match is used when no exact match exists", async () => {
    listRows.mockImplementation(async (_d: string, _t: string, q: string[]) =>
      q.some((s) => s.includes("startsWith"))
        ? { rows: [row({ description: "p1", vendor_key: "rema 1000" })] }
        : { rows: [] }
    );
    const result = await selectExamples(db, {
      types,
      vendor: "Rema 1000 Majorstuen",
    });
    expect(result.map((r) => r.description)).toEqual(["p1"]);
    expect(result[0]?.vendorKey).toBe("rema 1000");
  });

  it("confirmed examples come before unconfirmed ones", async () => {
    listRows.mockResolvedValue({
      rows: [
        row({ confirmed: false, description: "u1" }),
        row({ confirmed: true, description: "c1" }),
      ],
    });
    const result = await selectExamples(db, { types, vendor: "Rema" });
    expect(result.map((r) => r.description).slice(0, 2)).toEqual(["c1", "u1"]);
    expect(result.map((r) => r.confirmed).slice(0, 2)).toEqual([true, false]);
  });

  it("approver corrections come before student choices", async () => {
    listRows.mockResolvedValue({
      rows: [
        row({ description: "s1", type_source: "student" }),
        row({ description: "a1", type_source: "approver" }),
      ],
    });
    const result = await selectExamples(db, { types, vendor: "Rema" });
    expect(result.map((r) => r.description).slice(0, 2)).toEqual(["a1", "s1"]);
  });

  it("same-department examples come first within a group", async () => {
    listRows.mockResolvedValue({
      rows: [
        row({ department_id: "other", description: "o1" }),
        row({ department_id: "dep", description: "d1" }),
      ],
    });
    const result = await selectExamples(db, {
      departmentId: "dep",
      types,
      vendor: "Rema",
    });
    expect(result.map((r) => r.description).slice(0, 2)).toEqual(["d1", "o1"]);
    expect(result.map((r) => r.sameDepartment).slice(0, 2)).toEqual([
      true,
      false,
    ]);
  });

  it("keyword matches fill in when no vendor matches", async () => {
    listRows.mockImplementation(async (_d: string, _t: string, q: string[]) =>
      q.some((s) => s.includes("search"))
        ? { rows: [row({ description: "k1", vendor_key: "other shop" })] }
        : { rows: [] }
    );
    const result = await selectExamples(db, {
      description: "Pizza for the board meeting",
      types,
      vendor: "Unknown Shop",
    });
    expect(result.map((r) => r.description)).toEqual(["k1"]);
  });

  it("keeps what it has when a later query fails", async () => {
    listRows.mockImplementation((_d: string, _t: string, q: string[]) =>
      q.some((s) => s.includes("search"))
        ? Promise.reject(new Error("no index"))
        : Promise.resolve({ rows: [row({ description: "v1" })] })
    );
    const result = await selectExamples(db, {
      description: "pizza",
      types,
      vendor: "Rema",
    });
    expect(result.map((r) => r.description)).toContain("v1");
  });

  it("still adds the filler when the keyword query fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    listRows.mockImplementation((_d: string, _t: string, q: string[]) => {
      if (q.some((s) => s.includes("search"))) {
        return Promise.reject(new Error("no index"));
      }
      return Promise.resolve({
        rows: q.some((s) => s.includes("vendor_key"))
          ? [row({ description: "v1" })]
          : [
              row({
                description: "t1",
                final_cost_type: "travel",
                vendor_key: "x",
              }),
            ],
      });
    });
    const result = await selectExamples(db, {
      description: "pizza",
      types,
      vendor: "Rema",
    });
    expect(result.map((r) => r.description)).toEqual(["v1", "t1"]);
  });

  it("still gets keyword and filler results when the prefix query fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    listRows.mockImplementation((_d: string, _t: string, q: string[]) => {
      if (q.some((s) => s.includes("startsWith"))) {
        return Promise.reject(new Error("boom"));
      }
      if (q.some((s) => s.includes("search"))) {
        return Promise.resolve({
          rows: [row({ description: "k1", vendor_key: "shop" })],
        });
      }
      return Promise.resolve({
        rows: q.some((s) => s.includes("vendor_key"))
          ? []
          : [
              row({
                description: "t1",
                final_cost_type: "travel",
                vendor_key: "x",
              }),
            ],
      });
    });
    const result = await selectExamples(db, {
      description: "pizza",
      types,
      vendor: "Rema 1000 Majorstuen",
    });
    expect(result.map((r) => r.description)).toEqual(["k1", "t1"]);
  });

  it("returns [] on db error", async () => {
    listRows.mockRejectedValue(new Error("boom"));
    expect(await selectExamples(db, { types, vendor: "Rema" })).toEqual([]);
  });
});
