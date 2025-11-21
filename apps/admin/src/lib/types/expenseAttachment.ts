import type { Models } from "@repo/api";

export interface ExpenseAttachment extends Models.Row {
  date: Date;
  url: string;
  amount: number;
  description: string;
  type: string;
}
