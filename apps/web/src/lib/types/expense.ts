import { Models } from "@repo/api";
import { ExpenseStatus } from "@repo/api/types/appwrite";

type CreateAttachmentData = Models.Row & {
  date: string;
  url: string;
  amount: number;
  description: string;
  type: string;
}

export type CreateExpenseData = Models.Row & {
    campus: string;
    department: string;
    bank_account: string;
    description: string;
    total: number;
    prepayment_amount: number;
    eventName: string;
    expenseAttachments: CreateAttachmentData[];
    campusRel: string;
    departmentRel: string;
    status: ExpenseStatus;
    userId: string;
    user: string;
    $sequence: number;
}