export type ActionResult<T> = { data: T } | { error: string };

/** Why an expense edit was refused. Each code has a message under `adminPortal.expenses.errors`. */
export type ExpenseActionError =
  | "forbidden"
  | "not_found"
  | "invalid_amount"
  | "invalid_date"
  | "invalid_description"
  | "invalid_type"
  | "invalid_account"
  | "invalid_bank_account"
  | "supporting_receipt"
  | "failed";

/** The result of an expense edit action. */
export type ExpenseActionResult<T> =
  | { data: T }
  | { error: ExpenseActionError };
