import type { Models } from "@repo/api";
import type { ExpenseAttachment } from "./expense-attachment";

interface Campus extends Models.Row {
  name: string;
}
interface Department extends Models.Row {
  name: string;
}
export interface User extends Models.Row {
  name: string;
}
export interface Expense extends Models.Row {
  bank_account: string;
  campus: string;
  date: string;
  department: string;
  expenseAttachments: ExpenseAttachment[];
  status: string;
  total: string;
  user: User;
}
