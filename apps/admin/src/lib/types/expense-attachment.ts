import type { Models } from "@repo/api";

export interface ExpenseAttachment extends Models.Row {
  amount: number;
  date: Date;
  description: string;
  type: string;
  url: string;
}
