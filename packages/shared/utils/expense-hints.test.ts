import { describe, expect, it } from "vitest";
import { parseApproverHints, parseReceiptIssues } from "./expense-hints";

describe("parseReceiptIssues", () => {
  it("keeps known codes and drops unknown ones", () => {
    expect(parseReceiptIssues('["no_items","bogus"]')).toEqual(["no_items"]);
  });

  it("returns an empty list for empty, invalid or non-array input", () => {
    expect(parseReceiptIssues(null)).toEqual([]);
    expect(parseReceiptIssues(undefined)).toEqual([]);
    expect(parseReceiptIssues("")).toEqual([]);
    expect(parseReceiptIssues("{")).toEqual([]);
    expect(parseReceiptIssues('{"a":1}')).toEqual([]);
  });
});

describe("parseApproverHints", () => {
  it("keeps known hints with their attachment and data", () => {
    const value = JSON.stringify([
      {
        code: "amount_differs",
        attachmentId: "a1",
        data: { entered: 10, read: "12" },
      },
      { code: "nope" },
      { code: "old_receipt" },
      "junk",
      null,
    ]);
    expect(parseApproverHints(value)).toEqual([
      {
        code: "amount_differs",
        attachmentId: "a1",
        data: { entered: 10, read: "12" },
      },
      { code: "old_receipt" },
    ]);
  });

  it("returns an empty list for invalid input", () => {
    expect(parseApproverHints("{")).toEqual([]);
    expect(parseApproverHints(null)).toEqual([]);
    expect(parseApproverHints('"x"')).toEqual([]);
  });
});
