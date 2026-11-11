import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api-error";
import {
  attachmentTypeFields,
  missingTypes,
  needsType,
  occasionRequired,
  receiptNotices,
  rejectedDraftId,
  submitErrorKind,
  submitGaps,
  typeChoice,
  typeFromAttachment,
  typeFromOcr,
  visibleTypeState,
} from "./receipt-types";
import type { Receipt } from "./store";
import type { ExpenseTypeOption } from "./types";

const options: ExpenseTypeOption[] = [
  { slug: "travel", label: "Travel", labelNo: "Reise", askOccasion: false },
  { slug: "social", label: "Social", labelNo: "Sosialt", askOccasion: true },
];

const receipt = (overrides: Partial<Receipt> = {}): Receipt => ({
  amount: 100,
  confidence: 1,
  currency: "NOK",
  date: "2026-11-01",
  description: "x",
  fileId: "f",
  fileName: "f.jpg",
  fileType: "image/jpeg",
  fileUrl: "",
  id: "r1",
  progress: 100,
  status: "ready",
  ...overrides,
});

describe("receipt type state", () => {
  it("marks a confident known AI type as ai", () => {
    expect(
      typeFromOcr(
        { costType: "travel", costTypeConfidence: 0.9 },
        options,
        true
      )
    ).toMatchObject({ costType: "travel", typeState: "ai" });
  });

  it("marks an unknown or unsure AI type as needs-choice", () => {
    expect(
      typeFromOcr({ costType: "nope", costTypeConfidence: 0.95 }, options, true)
    ).toMatchObject({ costType: undefined, typeState: "needs_choice" });
    expect(
      typeFromOcr(
        { costType: "travel", costTypeConfidence: 0.5 },
        options,
        true
      )
    ).toMatchObject({ costType: undefined, typeState: "needs_choice" });
    expect(typeFromOcr({}, options, false).typeState).toBe("needs_choice");
  });

  it("hydrates an old draft's active slugs as chosen", () => {
    expect(typeFromAttachment({ cost_type: "travel" }, options)).toMatchObject({
      costType: "travel",
      typeState: "chosen",
    });
    expect(typeFromAttachment({ cost_type: "" }, options).typeState).toBe(
      "needs_choice"
    );
  });

  it("asks again for a type finance has since deactivated", () => {
    // The server honours only active slugs and would book it as "other".
    expect(typeFromAttachment({ cost_type: "retired" }, options)).toEqual({
      costType: undefined,
      typeState: "needs_choice",
    });
    expect(typeFromAttachment({ cost_type: "travel" }, []).typeState).toBe(
      "needs_choice"
    );
    // Own text is the student's whatever the list holds.
    expect(
      typeFromAttachment({ cost_type: "retired", cost_type_text: "Gifts" }, [])
    ).toMatchObject({ costTypeText: "Gifts", typeState: "chosen" });
  });

  it("hydrates own text as chosen", () => {
    expect(
      typeFromAttachment({ cost_type_text: "Gifts" }, options)
    ).toMatchObject({ costTypeText: "Gifts", typeState: "chosen" });
  });

  it("does not require a type for a linked bank statement", () => {
    expect(
      typeFromOcr({ documentType: "bank-statement" }, options, true).typeState
    ).toBeUndefined();
    expect(
      missingTypes([
        receipt({ documentType: "bank-statement", id: "r2", parentId: "r1" }),
        receipt({ id: "r3", amount: 0 }),
        receipt({ documentType: "bank-statement", id: "r4", amount: 0 }),
      ])
    ).toEqual([]);
    expect(missingTypes([receipt()])).toHaveLength(1);
  });

  it("requires a type for a standalone bank statement with an amount", () => {
    // The server books every row with an amount, so it needs a type too.
    const statement = receipt({ documentType: "bank-statement" });
    expect(needsType(statement)).toBe(true);
    expect(missingTypes([statement])).toEqual([statement]);
    expect(visibleTypeState(statement)).toBe("needs_choice");
    expect(
      needsType(receipt({ documentType: "bank-statement", parentId: "r0" }))
    ).toBe(false);
    expect(
      needsType(receipt({ amount: 0, documentType: "bank-statement" }))
    ).toBe(false);
  });

  it("requires an occasion only for a type that asks", () => {
    expect(occasionRequired([receipt({ costType: "travel" })], options)).toBe(
      false
    );
    expect(occasionRequired([receipt({ costType: "social" })], options)).toBe(
      true
    );
  });

  it("sends cost_type_chosen with slug or own text", () => {
    expect(attachmentTypeFields(receipt({ costType: "travel" }))).toEqual({
      cost_type: "travel",
      cost_type_text: null,
      cost_type_chosen: true,
    });
    expect(attachmentTypeFields(receipt({ costTypeText: "Gifts" }))).toEqual({
      cost_type: "",
      cost_type_text: "Gifts",
      cost_type_chosen: true,
    });
  });

  it("treats exactly 0.8 as confident and 0.79 as not", () => {
    expect(
      typeFromOcr(
        { costType: "travel", costTypeConfidence: 0.8 },
        options,
        true
      ).typeState
    ).toBe("ai");
    expect(
      typeFromOcr(
        { costType: "travel", costTypeConfidence: 0.79 },
        options,
        true
      ).typeState
    ).toBe("needs_choice");
  });

  it("accepts own text as a type but not whitespace-only text", () => {
    expect(missingTypes([receipt({ costTypeText: "Gifts" })])).toEqual([]);
    expect(missingTypes([receipt({ costTypeText: "   " })])).toHaveLength(1);
  });

  it("lets own text win over a slug in the payload", () => {
    expect(
      attachmentTypeFields(
        receipt({ costType: "travel", costTypeText: "Gifts" })
      )
    ).toEqual({
      cost_type: "",
      cost_type_text: "Gifts",
      cost_type_chosen: true,
    });
  });

  it("ignores an attached statement row when deciding on an occasion", () => {
    expect(
      occasionRequired(
        [receipt({ costType: "social", parentId: "r0" })],
        options
      )
    ).toBe(false);
    expect(
      occasionRequired(
        [
          receipt({
            amount: 0,
            costType: "social",
            documentType: "bank-statement",
          }),
        ],
        options
      )
    ).toBe(false);
    // A standalone statement is booked on its type, so its type may ask.
    expect(
      occasionRequired(
        [receipt({ costType: "social", documentType: "bank-statement" })],
        options
      )
    ).toBe(true);
  });

  it("recognises the occasion rejection", () => {
    expect(
      submitErrorKind(
        new ApiError("Occasion is required", 400, {
          error: "Occasion is required",
          field: "occasion",
        })
      )
    ).toBe("occasion");
    expect(submitErrorKind(new ApiError("Nope", 400, { error: "Nope" }))).toBe(
      "other"
    );
    expect(submitErrorKind(new Error("Occasion is required"))).toBe("other");
  });

  it("reads the saved draft's id from an occasion rejection", () => {
    expect(
      rejectedDraftId(
        new ApiError("Occasion is required", 400, {
          error: "Occasion is required",
          expenseId: "expense-1",
          field: "occasion",
        })
      )
    ).toBe("expense-1");
    expect(
      rejectedDraftId(
        new ApiError("Occasion is required", 400, { field: "occasion" })
      )
    ).toBeNull();
    expect(
      rejectedDraftId(
        new ApiError("Nope", 400, { error: "Nope", expenseId: "expense-1" })
      )
    ).toBeNull();
    expect(rejectedDraftId(new Error("Occasion is required"))).toBeNull();
  });
});

describe("receipt type display", () => {
  it("warns about a missing type only on a receipt that needs one", () => {
    expect(visibleTypeState(receipt({ typeState: "needs_choice" }))).toBe(
      "needs_choice"
    );
    expect(visibleTypeState(receipt({ typeState: undefined }))).toBe(
      "needs_choice"
    );
    // A reopened draft's bank statement: amount 0, no link, no document type.
    expect(
      visibleTypeState(receipt({ amount: 0, typeState: "needs_choice" }))
    ).toBeUndefined();
    expect(
      visibleTypeState(receipt({ costType: "travel", typeState: "ai" }))
    ).toBe("ai");
    expect(
      visibleTypeState(receipt({ costTypeText: "Taxi", typeState: "chosen" }))
    ).toBe("chosen");
  });

  it("turns a picker choice into receipt fields", () => {
    expect(typeChoice({ costType: "travel" })).toEqual({
      costType: "travel",
      costTypeText: undefined,
      typeState: "chosen",
    });
    expect(typeChoice({ costTypeText: "Taxi to venue" })).toEqual({
      costType: undefined,
      costTypeText: "Taxi to venue",
      typeState: "chosen",
    });
  });

  it("lists receipt-check and duplicate notices for a receipt", () => {
    expect(
      receiptNotices(
        receipt({
          possibleDuplicate: true,
          receiptIssues: ["not_a_receipt", "missing_date"],
        })
      )
    ).toEqual(["not_a_receipt", "missing_date", "possible_duplicate"]);
    expect(receiptNotices(receipt())).toEqual([]);
  });

  it("shows no receipt notices on a bank statement", () => {
    expect(
      receiptNotices(
        receipt({
          documentType: "bank-statement",
          possibleDuplicate: true,
          receiptIssues: ["not_a_receipt"],
        })
      )
    ).toEqual([]);
    expect(
      receiptNotices(receipt({ parentId: "r0", receiptIssues: ["no_items"] }))
    ).toEqual([]);
  });
});

describe("submitGaps", () => {
  it("names a missing type and a blank occasion", () => {
    expect(
      submitGaps(
        [receipt(), receipt({ id: "r2", costType: "social" })],
        options,
        " "
      )
    ).toEqual({ occasionMissing: true, typesMissing: true });
    expect(
      submitGaps([receipt({ costType: "social" })], options, "Board meeting")
    ).toEqual({ occasionMissing: false, typesMissing: false });
    expect(submitGaps([receipt({ costType: "travel" })], options, "")).toEqual({
      occasionMissing: false,
      typesMissing: false,
    });
  });
});
