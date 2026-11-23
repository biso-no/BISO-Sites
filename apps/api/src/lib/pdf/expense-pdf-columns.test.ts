import { describe, expect, it } from "vitest";
import { pdfColumns } from "./expense-pdf-columns";

const PERCENT = /%$/;
const sum = (widths: Record<string, string>, keys: string[]) =>
  keys.reduce(
    (total, key) => total + Number.parseInt(widths[key] ?? "0", 10),
    0
  );

describe("pdfColumns", () => {
  it("the posting cover sheet keeps its old columns", () => {
    const { showDetails, widths } = pdfColumns([
      {},
      { account: "", project: " " },
    ]);
    expect(showDetails).toBe(false);
    expect(widths).toMatchObject({
      amount: "25%",
      date: "25%",
      description: "50%",
      totalAmount: "25%",
      totalBlank: "50%",
      totalLabel: "25%",
    });
  });

  it("a checked expense gets type, account and project columns", () => {
    const { showDetails, widths } = pdfColumns([{}, { type: "Taxi" }]);
    expect(showDetails).toBe(true);
    expect(
      sum(widths, [
        "description",
        "date",
        "type",
        "account",
        "project",
        "amount",
      ])
    ).toBe(100);
    expect(sum(widths, ["totalBlank", "totalLabel", "totalAmount"])).toBe(100);
    expect(Number.parseInt(widths.date, 10)).toBeGreaterThanOrEqual(14);
    expect(widths.date).toMatch(PERCENT);
  });
});
