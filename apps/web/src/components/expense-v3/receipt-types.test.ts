import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api-error";
import {
  attachmentTypeFields,
  missingTypes,
  occasionRequired,
  submitErrorKind,
  typeFromAttachment,
  typeFromOcr,
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

  it("hydrates an old draft's slugs as chosen", () => {
    expect(typeFromAttachment({ cost_type: "travel" }, options)).toMatchObject({
      costType: "travel",
      typeState: "chosen",
    });
    expect(typeFromAttachment({ cost_type: "retired" }, options)).toMatchObject(
      { costType: "retired", typeState: "chosen" }
    );
    expect(typeFromAttachment({ cost_type: "" }, options).typeState).toBe(
      "needs_choice"
    );
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
        receipt({ documentType: "bank-statement" }),
        receipt({ id: "r2", parentId: "r1" }),
        receipt({ id: "r3", amount: 0 }),
      ])
    ).toEqual([]);
    expect(missingTypes([receipt()])).toHaveLength(1);
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

  it("ignores a statement row when deciding on an occasion", () => {
    expect(
      occasionRequired(
        [receipt({ costType: "social", documentType: "bank-statement" })],
        options
      )
    ).toBe(false);
    expect(
      occasionRequired(
        [receipt({ costType: "social", parentId: "r0" })],
        options
      )
    ).toBe(false);
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
});
