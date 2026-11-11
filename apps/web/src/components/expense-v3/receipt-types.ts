import { AI_TYPE_CONFIDENCE_THRESHOLD } from "@repo/shared/utils/expense-cost-types";
import { ApiError } from "@/lib/api-error";
import type { Receipt } from "./store";
import type { ExpenseTypeOption } from "./types";

export type TypeState = "ai" | "needs_choice" | "chosen";

type TypeFields = Pick<
  Receipt,
  "aiConfidence" | "aiCostType" | "costType" | "typeState"
>;

/** Maps the OCR answer onto a receipt's type state. */
export function typeFromOcr(
  data: {
    costType?: string | null;
    costTypeConfidence?: number;
    documentType?: string | null;
  },
  options: ExpenseTypeOption[],
  ocrEnabled: boolean
): TypeFields {
  if (data.documentType === "bank-statement") {
    return { typeState: undefined };
  }

  if (!ocrEnabled) {
    return { costType: undefined, typeState: "needs_choice" };
  }

  const slug = data.costType ?? null;
  const confidence = data.costTypeConfidence ?? 0;
  const known = slug !== null && options.some((option) => option.slug === slug);

  if (known && confidence >= AI_TYPE_CONFIDENCE_THRESHOLD) {
    return {
      costType: slug,
      typeState: "ai",
      aiCostType: slug,
      aiConfidence: confidence,
    };
  }

  return {
    costType: undefined,
    typeState: "needs_choice",
    aiCostType: slug,
    aiConfidence: confidence,
  };
}

/** Restores the type of a saved draft attachment: anything stored was chosen. */
export function typeFromAttachment(
  att: { cost_type?: string | null; cost_type_text?: string | null },
  // Kept for symmetry: a deactivated slug is kept as chosen, the server
  // resolves inactive slugs.
  _options: ExpenseTypeOption[]
): Pick<Receipt, "costType" | "costTypeText" | "typeState"> {
  const text = att.cost_type_text?.trim();
  if (text) {
    return { costType: undefined, costTypeText: text, typeState: "chosen" };
  }

  if (att.cost_type) {
    return { costType: att.cost_type, typeState: "chosen" };
  }

  return { costType: undefined, typeState: "needs_choice" };
}

export function needsType(receipt: Receipt): boolean {
  return (
    receipt.amount > 0 &&
    !receipt.parentId &&
    receipt.documentType !== "bank-statement"
  );
}

export function missingTypes(receipts: Receipt[]): Receipt[] {
  return receipts.filter(
    (receipt) =>
      needsType(receipt) && !(receipt.costType || receipt.costTypeText?.trim())
  );
}

export function occasionRequired(
  receipts: Receipt[],
  options: ExpenseTypeOption[]
): boolean {
  return receipts.some(
    (receipt) =>
      needsType(receipt) &&
      receipt.costType !== undefined &&
      options.some(
        (option) => option.slug === receipt.costType && option.askOccasion
      )
  );
}

export function attachmentTypeFields(receipt: Receipt): {
  cost_type: string;
  cost_type_chosen: true;
  cost_type_text: string | null;
} {
  const text = receipt.costTypeText?.trim();
  return {
    cost_type: text ? "" : (receipt.costType ?? ""),
    cost_type_text: text || null,
    cost_type_chosen: true,
  };
}

/** Tells a submit rejected for a missing occasion from every other failure. */
export function submitErrorKind(error: unknown): "occasion" | "other" {
  return error instanceof ApiError && error.body?.field === "occasion"
    ? "occasion"
    : "other";
}
