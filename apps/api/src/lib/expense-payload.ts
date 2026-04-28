import { ExpenseStatus } from "@repo/api/types/appwrite";
import { z } from "zod";

const ExpenseAttachmentInputSchema = z.object({
  amount: z.coerce.number().finite().default(0),
  date: z.string().optional().default(""),
  description: z.string().optional().default(""),
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
  status: ExpenseStatus;
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
  status: ExpenseStatus = ExpenseStatus.DRAFT
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
    total: data.total,
    user: userId,
    userId,
  };
}
