import { z } from "zod";

const SummaryAssignmentSchema = z.object({
  campusId: z.string().optional().default(""),
  campusName: z.string().optional().default(""),
  departmentId: z.string().optional().default(""),
  departmentName: z.string().optional().default(""),
});

const SummaryReceiptSchema = z.object({
  amount: z.number().nullable().optional(),
  category: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  currency: z.string().nullable().optional(),
  date: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  documentType: z.enum(["receipt", "bank-statement"]).nullable().optional(),
  purchaseContext: z.string().nullable().optional(),
  vendor: z.string().nullable().optional(),
});

const StructuredSummaryRequestSchema = z.object({
  assignment: SummaryAssignmentSchema.optional(),
  receipts: z.array(SummaryReceiptSchema).min(1),
});

const LegacySummaryRequestSchema = z.object({
  descriptions: z.array(z.string()).min(1),
});

export type ExpenseSummaryAssignment = z.infer<typeof SummaryAssignmentSchema>;
export type ExpenseSummaryReceipt = z.infer<typeof SummaryReceiptSchema>;

export interface NormalizedExpenseSummaryRequest {
  assignment: ExpenseSummaryAssignment;
  receipts: ExpenseSummaryReceipt[];
}

export function normalizeExpenseSummaryRequest(
  body: unknown
): NormalizedExpenseSummaryRequest | null {
  const structured = StructuredSummaryRequestSchema.safeParse(body);

  if (structured.success) {
    return {
      assignment: structured.data.assignment ?? {
        campusId: "",
        campusName: "",
        departmentId: "",
        departmentName: "",
      },
      receipts: structured.data.receipts,
    };
  }

  const legacy = LegacySummaryRequestSchema.safeParse(body);

  if (!legacy.success) {
    return null;
  }

  return {
    assignment: {
      campusId: "",
      campusName: "",
      departmentId: "",
      departmentName: "",
    },
    receipts: legacy.data.descriptions.map((description) => ({
      description,
    })),
  };
}

function formatReceipt(receipt: ExpenseSummaryReceipt, index: number): string {
  const parts = [
    `description=${receipt.description || "unknown"}`,
    receipt.purchaseContext ? `context=${receipt.purchaseContext}` : null,
    receipt.category ? `category=${receipt.category}` : null,
    receipt.vendor ? `vendor=${receipt.vendor}` : null,
    receipt.date ? `date=${receipt.date}` : null,
    typeof receipt.amount === "number" ? `amountNok=${receipt.amount}` : null,
    receipt.currency ? `currency=${receipt.currency}` : null,
    receipt.city ? `city=${receipt.city}` : null,
    receipt.country ? `country=${receipt.country}` : null,
    receipt.documentType ? `documentType=${receipt.documentType}` : null,
  ].filter(Boolean);

  return `${index + 1}. ${parts.join("; ")}`;
}

export function buildExpenseSummaryPrompt(
  request: NormalizedExpenseSummaryRequest
): string {
  const { assignment, receipts } = request;
  const campus = assignment.campusName || assignment.campusId || "Unknown";
  const department =
    assignment.departmentName || assignment.departmentId || "Unknown";

  return `You write reimbursement descriptions for the accounting team at BISO, a student union in Norway.

Goal:
Create a concise accounting-friendly purpose for the whole reimbursement.

Assignment:
- Campus: ${campus}
- Department: ${department}

Rules:
- Explain the likely purpose, not just merchant names.
- Use visible evidence such as category, location, dates, and purchase context.
- If a receipt is from another city or country, you may infer broad travel context only when the location is explicit, e.g. "Lunch during Stockholm trip".
- If receipts clearly span multiple unrelated purposes, say they are mixed expenses and group them briefly.
- Do not invent specific event names, attendees, meetings, or trips that are not supported by the receipts.
- Avoid unnecessary vendor names unless the vendor clarifies the purpose.
- Keep the answer to 1-2 sentences.
- Write in clear English for finance/accounting staff.

Receipts:
${receipts.map(formatReceipt).join("\n")}

Good examples:
- "Lunch during Stockholm trip for the Marketing department."
- "Mixed reimbursement for event refreshments in Oslo and travel costs for a Bergen department activity."
- "Supplies and food for department activity at Oslo campus."

Bad examples:
- "Meal expense at Kungsan Grill."
- "Restaurant purchase."
- "Event trip with students" when no event or trip evidence is visible.`;
}
