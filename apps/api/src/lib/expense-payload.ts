import { ExpensesStatus } from "@repo/api/types/appwrite";
import { DEFAULT_COST_TYPE_SLUG } from "@repo/shared/utils/expense-cost-types";
import { z } from "zod";

const ExpenseAttachmentInputSchema = z.object({
  amount: z.coerce.number().finite().default(0),
  // Default to a valid slug (never ""), so an omitted cost type resolves to the
  // "Other" GL account at posting time instead of failing the ledger post.
  cost_type: z
    .string()
    .optional()
    .transform((value) => value || DEFAULT_COST_TYPE_SLUG),
  date: z.string().optional().default(""),
  description: z.string().optional().default(""),
  sort_order: z.coerce.number().int().nonnegative().optional().default(0),
  type: z.string().optional().default("application/octet-stream"),
  url: z.string().optional().default(""),
});

const ExpensePayloadSchema = z.object({
  bank_account: z.string().min(1),
  campus: z.string().min(1),
  department: z.string().min(1),
  description: z.string().nullable().optional(),
  eventName: z.string().nullable().optional(),
  expenseAttachments: z.array(ExpenseAttachmentInputSchema).optional(),
  expenseId: z.string().min(1).optional(),
  prepayment_amount: z.coerce.number().finite().nullable().optional(),
  submitter_is_financial_manager: z.boolean().optional().default(false),
  total: z.coerce.number().finite().default(0),
});

export type ExpenseAttachmentInput = z.infer<
  typeof ExpenseAttachmentInputSchema
>;

export type ExpensePayload = z.infer<typeof ExpensePayloadSchema>;

export interface ExpenseRowInput {
  bank_account: string;
  campus: string;
  campusRel: string;
  department: string;
  departmentRel: string;
  description: string | null;
  eventName: string | null;
  expenseAttachments: ExpenseAttachmentInput[];
  prepayment_amount: number | null;
  status: ExpensesStatus;
  submitter_is_financial_manager: boolean;
  total: number;
  user: string;
  userId: string;
}

export function parseExpensePayload(body: unknown): ExpensePayload | null {
  const parsed = ExpensePayloadSchema.safeParse(body);
  return parsed.success ? parsed.data : null;
}

export function buildExpenseRowInput(
  data: ExpensePayload,
  userId: string,
  status: ExpensesStatus = ExpensesStatus.DRAFT
): ExpenseRowInput {
  return {
    bank_account: data.bank_account,
    campus: data.campus,
    campusRel: data.campus,
    department: data.department,
    departmentRel: data.department,
    description: data.description || null,
    eventName: data.eventName || null,
    expenseAttachments: data.expenseAttachments ?? [],
    prepayment_amount: data.prepayment_amount ?? 0,
    status,
    submitter_is_financial_manager:
      data.submitter_is_financial_manager ?? false,
    total: data.total,
    user: userId,
    userId,
  };
}
