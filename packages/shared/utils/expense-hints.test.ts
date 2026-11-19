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

describe("parseApproverHints background check codes", () => {
  it("keeps the codes the AI check writes, with their data", () => {
    const value = JSON.stringify([
      { code: "type_unsure", data: { reason: "two types fit" } },
      { code: "project_unsure" },
      { code: "project_missing" },
      { code: "project_not_created", data: { series: "BISO", year: 2026 } },
      { code: "ai_check_incomplete" },
      {
        attachmentId: "a1",
        code: "ai_check_disagrees",
        data: { aiType: "food" },
      },
    ]);
    expect(parseApproverHints(value)).toEqual([
      { code: "type_unsure", data: { reason: "two types fit" } },
      { code: "project_unsure" },
      { code: "project_missing" },
      { code: "project_not_created", data: { series: "BISO", year: 2026 } },
      { code: "ai_check_incomplete" },
      {
        attachmentId: "a1",
        code: "ai_check_disagrees",
        data: { aiType: "food" },
      },
    ]);
  });
});
