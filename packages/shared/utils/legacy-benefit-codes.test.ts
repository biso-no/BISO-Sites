import { describe, expect, it } from "vitest";
import {
  formatLegacyCodeClearPlan,
  formatLegacyCodeClearResult,
  planLegacyCodeClear,
} from "./legacy-benefit-codes";

describe("planLegacyCodeClear", () => {
  const rows = [
    { $id: "a", redemption_value: "SECRET-A" },
    { $id: "b", redemption_value: "SECRET-B" },
    { $id: "c", redemption_value: null },
    { $id: "d", redemption_value: "   " },
    { $id: "e" },
  ];

  it("copies only codes that have no private row yet", () => {
    const plan = planLegacyCodeClear(rows, new Set(["b"]));
    expect(plan.copy).toEqual(["a"]);
  });

  it("clears every row that holds a value", () => {
    const plan = planLegacyCodeClear(rows, new Set(["b"]));
    expect(plan.clear).toEqual(["a", "b"]);
  });

  it("plans nothing when no row holds a code", () => {
    expect(
      planLegacyCodeClear([{ $id: "c", redemption_value: "" }], new Set())
    ).toEqual({
      clear: [],
      copy: [],
    });
  });
});

describe("output formatters", () => {
  const plan = { clear: ["a", "b"], copy: ["a"] };

  it("prints counts only", () => {
    const lines = formatLegacyCodeClearPlan(plan, 5).join("\n");
    expect(lines).toContain("copy: 1");
    expect(lines).toContain("clear: 2");
    expect(lines).not.toContain("SECRET");
  });

  it("prints applied counts only", () => {
    const lines = formatLegacyCodeClearResult({ cleared: 2, copied: 1 }).join(
      "\n"
    );
    expect(lines).toContain("copied: 1");
    expect(lines).toContain("cleared: 2");
    expect(lines).not.toContain("SECRET");
  });
});
