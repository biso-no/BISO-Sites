import { describe, expect, it } from "vitest";
import {
  codeOnlyHint,
  hintTextKey,
  MAX_HINT_REASON_CHARS,
  parseApproverHints,
  parseReceiptIssues,
  storedHint,
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
    expect(Array.from(text)).toHaveLength(MAX_HINT_REASON_CHARS);
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

describe("storedHint", () => {
  it("keeps a reason only where the text shows one, cut to 120 characters", () => {
    const reason = `Two types fit. ${"x".repeat(300)}`;
    expect(MAX_HINT_REASON_CHARS).toBe(120);
    const unsure = storedHint({
      attachmentId: "a1",
      code: "type_unsure",
      data: { reason },
    });
    expect(Array.from(String(unsure.data?.reason))).toHaveLength(120);
    expect(String(unsure.data?.reason).endsWith("…")).toBe(true);
    // These texts never show a reason, so none is stored.
    expect(
      storedHint({
        attachmentId: "a1",
        code: "ai_check_disagrees",
        data: { aiType: "food", reason },
      })
    ).toEqual({
      attachmentId: "a1",
      code: "ai_check_disagrees",
      data: { aiType: "food" },
    });
    for (const code of ["ai_account_unsure", "project_missing"] as const) {
      expect(
        storedHint({ attachmentId: "a1", code, data: { reason } })
      ).toEqual({ attachmentId: "a1", code });
    }
  });
});

describe("codeOnlyHint", () => {
  it("keeps only the data its text needs", () => {
    expect(
      codeOnlyHint({
        attachmentId: "a1",
        code: "type_unsure",
        data: { reason: "Two types fit" },
      })
    ).toEqual({ attachmentId: "a1", code: "type_unsure" });
    expect(
      codeOnlyHint({
        attachmentId: "a1",
        code: "possible_duplicate",
        data: { match: "file", reimbursementNumber: "10042" },
      })
    ).toEqual({ attachmentId: "a1", code: "possible_duplicate" });
    for (const hint of [
      {
        attachmentId: "a1",
        code: "project_not_created" as const,
        data: { series: "BBL", year: 2027 },
      },
      {
        attachmentId: "a1",
        code: "amount_differs" as const,
        data: { entered: 10, read: 12 },
      },
      {
        attachmentId: "a1",
        code: "app_type_replaced" as const,
        data: { aiType: "food", appType: "taxi" },
      },
      { code: "receipt_issue" as const, data: { issue: "unreadable" } },
    ]) {
      expect(codeOnlyHint(hint)).toEqual(hint);
    }
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
