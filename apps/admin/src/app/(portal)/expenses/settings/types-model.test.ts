import { describe, expect, test } from "bun:test";
import { expenseTypeInputSchema, slugFromLabel } from "./types-model";

const valid = {
  accountNumber: 7140,
  active: true,
  askOccasion: false,
  label: "Travel",
  sortOrder: 0,
};

describe("expenseTypeInputSchema", () => {
  test("accepts a valid type and nulls the optional fields", () => {
    const parsed = expenseTypeInputSchema.parse({ ...valid, labelNo: " " });
    expect(parsed.labelNo).toBeNull();
    expect(parsed.description).toBeNull();
    expect(parsed.taxCode).toBeNull();
  });

  test("rejects an account outside 4000-7999", () => {
    expect(
      expenseTypeInputSchema.safeParse({ ...valid, accountNumber: 3000 })
        .success
    ).toBe(false);
  });

  test("rejects an empty label", () => {
    expect(
      expenseTypeInputSchema.safeParse({ ...valid, label: "  " }).success
    ).toBe(false);
  });
});

describe("slugFromLabel", () => {
  test("transliterates Norwegian letters", () => {
    expect(slugFromLabel("Møtemat", new Set())).toBe("motemat");
  });

  test("suffixes a taken slug", () => {
    expect(slugFromLabel("Travel", new Set(["travel"]))).toBe("travel-2");
    expect(slugFromLabel("Travel", new Set(["travel", "travel-2"]))).toBe(
      "travel-3"
    );
  });

  test("caps at 36 characters, suffix included", () => {
    const long = "a".repeat(60);
    expect(slugFromLabel(long, new Set()).length).toBe(36);
    const taken = new Set([slugFromLabel(long, new Set())]);
    const next = slugFromLabel(long, taken);
    expect(next.length).toBeLessThanOrEqual(36);
    expect(next.endsWith("-2")).toBe(true);
  });
});
