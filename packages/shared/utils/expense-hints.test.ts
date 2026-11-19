import { describe, expect, it } from "vitest";
import {
  hintTextKey,
  MAX_HINT_TEXT_CHARS,
  parseApproverHints,
  parseReceiptIssues,
} from "./expense-hints";

const LINE_BREAK_OR_DOUBLE_SPACE = /\s{2}|[\n\t]/;

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

describe("hint text data", () => {
  it("collapses a reason to one line and cuts it with an ellipsis", () => {
    const reason = `first line\n\n  second\tline ${"x".repeat(500)}`;
    const [hint] = parseApproverHints(
      JSON.stringify([{ code: "type_unsure", data: { reason } }])
    );
    const text = String(hint?.data?.reason);
    expect(text.startsWith("first line second line xxx")).toBe(true);
    expect(text).not.toMatch(LINE_BREAK_OR_DOUBLE_SPACE);
    expect(Array.from(text)).toHaveLength(MAX_HINT_TEXT_CHARS);
    expect(text.endsWith("…")).toBe(true);
  });

  it("leaves a short reason and numbers alone", () => {
    const [hint] = parseApproverHints(
      JSON.stringify([
        { code: "type_unsure", data: { reason: "two fit", year: 2026 } },
      ])
    );
    expect(hint?.data).toEqual({ reason: "two fit", year: 2026 });
  });
});

describe("hintTextKey", () => {
  it("picks the longer wording when the hint carries the data for it", () => {
    expect(hintTextKey("type_unsure", { reason: "x" })).toBe(
      "type_unsure_reason"
    );
    expect(hintTextKey("project_unsure", { reason: "x" })).toBe(
      "project_unsure_reason"
    );
    expect(hintTextKey("type_unsure")).toBe("type_unsure");
    expect(hintTextKey("project_unsure", {})).toBe("project_unsure");
    expect(
      hintTextKey("possible_duplicate", { reimbursementNumber: "1" })
    ).toBe("possible_duplicate_number");
    expect(hintTextKey("possible_duplicate")).toBe("possible_duplicate");
  });
});
