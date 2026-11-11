import { describe, expect, it } from "vitest";
import type { Receipt } from "./store";
import {
  receiptCostTypeText,
  shouldPrefillOccasion,
  shouldRegenerate,
  summaryKey,
} from "./summary-rules";
import type { ExpenseTypeOption } from "./types";

const OPTIONS: ExpenseTypeOption[] = [
  { slug: "travel", label: "Travel", labelNo: "Reise", askOccasion: false },
  { slug: "social", label: "Social", labelNo: "Sosialt", askOccasion: true },
];

const receipt = (overrides: Partial<Receipt> = {}): Receipt => ({
  amount: 249,
  confidence: 1,
  currency: "NOK",
  date: "2026-11-05",
  description: "Pizza",
  fileId: "f1",
  fileName: "pizza.jpg",
  fileType: "image/jpeg",
  fileUrl: "",
  id: "r1",
  progress: 100,
  status: "ready",
  vendor: "Peppes Pizza",
  ...overrides,
});

const assignment = {
  campusId: "5",
  campusName: "Oslo",
  departmentId: "d1",
  departmentName: "Events",
};

const key = (
  receipts: Receipt[],
  extra: Partial<{ eventName: string; locale: string; occasion: string }> = {}
) =>
  summaryKey({
    assignment,
    eventName: "",
    locale: "en",
    occasion: "",
    options: OPTIONS,
    receipts,
    ...extra,
  });

const ready = {
  allReady: true,
  descriptionEditedByStudent: false,
  key: "b",
  lastKey: "a",
  missingTypes: 0,
};

describe("shouldRegenerate", () => {
  it("waits until every receipt has a type", () => {
    expect(shouldRegenerate({ ...ready, missingTypes: 1 })).toBe(false);
    expect(shouldRegenerate(ready)).toBe(true);
  });

  it("keeps a description the student edited", () => {
    expect(
      shouldRegenerate({ ...ready, descriptionEditedByStudent: true })
    ).toBe(false);
  });

  it("waits for every receipt to be ready and skips an unchanged key", () => {
    expect(shouldRegenerate({ ...ready, allReady: false })).toBe(false);
    expect(shouldRegenerate({ ...ready, lastKey: "b" })).toBe(false);
  });
});

describe("summaryKey", () => {
  it("regenerates when a type changes", () => {
    const base = key([receipt({ costType: "travel" })]);
    expect(key([receipt({ costType: "social" })])).not.toBe(base);
    expect(key([receipt({ costTypeText: "Gifts" })])).not.toBe(base);
    expect(key([receipt({ costType: "travel" })])).toBe(base);
  });

  it("includes occasion and event in the key", () => {
    const base = key([receipt({ costType: "travel" })]);
    expect(
      key([receipt({ costType: "travel" })], { occasion: "Board dinner" })
    ).not.toBe(base);
    expect(
      key([receipt({ costType: "travel" })], { eventName: "Fadderuka" })
    ).not.toBe(base);
  });

  it("follows the locale of the type label", () => {
    expect(key([receipt({ costType: "travel" })], { locale: "no" })).not.toBe(
      key([receipt({ costType: "travel" })])
    );
  });
});

describe("receiptCostTypeText", () => {
  it("prefers the student's own text, then the localised label", () => {
    expect(
      receiptCostTypeText(receipt({ costTypeText: " Gifts " }), OPTIONS, "no")
    ).toBe("Gifts");
    expect(
      receiptCostTypeText(receipt({ costType: "travel" }), OPTIONS, "no")
    ).toBe("Reise");
    expect(receiptCostTypeText(receipt(), OPTIONS, "no")).toBeUndefined();
  });
});

describe("shouldPrefillOccasion", () => {
  const base = {
    occasion: "",
    shown: true,
    suggestion: "Board dinner",
    touched: false,
  };

  it("prefills an untouched, shown field", () => {
    expect(shouldPrefillOccasion(base)).toBe(true);
  });

  it("never overwrites the student or fills a hidden field", () => {
    expect(shouldPrefillOccasion({ ...base, touched: true })).toBe(false);
    expect(shouldPrefillOccasion({ ...base, occasion: "My text" })).toBe(false);
    expect(shouldPrefillOccasion({ ...base, shown: false })).toBe(false);
    expect(shouldPrefillOccasion({ ...base, suggestion: null })).toBe(false);
    expect(shouldPrefillOccasion({ ...base, suggestion: "  " })).toBe(false);
  });
});
