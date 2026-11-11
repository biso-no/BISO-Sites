import { costTypeLabel } from "@repo/shared/utils/expense-cost-types";
import type { Receipt } from "./store";
import type { ExpenseTypeOption } from "./types";

/** What the AI is told a receipt's type is: the student's own text, else the label. */
export function receiptCostTypeText(
  receipt: Receipt,
  options: ExpenseTypeOption[],
  locale: string
): string | undefined {
  const own = receipt.costTypeText?.trim();
  if (own) {
    return own;
  }
  const option = options.find((item) => item.slug === receipt.costType);
  return option ? costTypeLabel(option, locale) : undefined;
}

/** Identifies everything the description is written from. */
export function summaryKey(input: {
  assignment: {
    campusId: string;
    campusName: string;
    departmentId: string;
    departmentName: string;
  };
  eventName: string;
  locale: string;
  occasion: string;
  options: ExpenseTypeOption[];
  receipts: Receipt[];
}): string {
  const receipts = input.receipts
    .map((receipt) => ({
      amount: receipt.amount,
      category: receipt.category,
      city: receipt.city,
      costType: receiptCostTypeText(receipt, input.options, input.locale),
      country: receipt.country,
      currency: receipt.currency,
      date: receipt.date,
      description: receipt.description,
      documentType: receipt.documentType,
      id: receipt.id,
      purchaseContext: receipt.purchaseContext,
      vendor: receipt.vendor,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return JSON.stringify({
    assignment: input.assignment,
    eventName: input.eventName.trim(),
    occasion: input.occasion.trim(),
    receipts,
  });
}

export function shouldRegenerate(input: {
  allReady: boolean;
  descriptionEditedByStudent: boolean;
  key: string;
  lastKey: string;
  missingTypes: number;
}): boolean {
  if (
    !input.allReady ||
    input.missingTypes > 0 ||
    input.descriptionEditedByStudent
  ) {
    return false;
  }
  return input.key !== input.lastKey;
}

/** The AI's occasion guess only fills an empty, untouched, visible field. */
export function shouldPrefillOccasion(input: {
  occasion: string;
  shown: boolean;
  suggestion: string | null | undefined;
  touched: boolean;
}): boolean {
  return (
    input.shown &&
    !input.touched &&
    input.occasion.trim().length === 0 &&
    Boolean(input.suggestion?.trim())
  );
}
