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

  test("holds the names and the note to the column sizes", () => {
    const accepts = (over: Record<string, unknown>) =>
      expenseTypeInputSchema.safeParse({ ...valid, ...over }).success;
    expect(accepts({ label: "x".repeat(80), labelNo: "x".repeat(80) })).toBe(
      true
    );
    expect(accepts({ label: "x".repeat(81) })).toBe(false);
    expect(accepts({ labelNo: "x".repeat(81) })).toBe(false);
    expect(accepts({ description: "x".repeat(255) })).toBe(true);
    expect(accepts({ description: "x".repeat(256) })).toBe(false);
  });

  test("keeps an explicit tax code, zero included", () => {
    expect(expenseTypeInputSchema.parse({ ...valid, taxCode: 0 }).taxCode).toBe(
      0
    );
    expect(expenseTypeInputSchema.parse({ ...valid, taxCode: 5 }).taxCode).toBe(
      5
    );
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
