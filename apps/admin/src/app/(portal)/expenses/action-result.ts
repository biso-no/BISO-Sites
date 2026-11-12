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
  | "not_current_step"
  | "reason_required"
  | "invalid_email"
  | "already_decided"
  | "already_booked"
  | "not_failed"
  | "posting_disabled"
  | "api_failed"
  | "failed";

/** The result of an expense edit action. */
export type ExpenseActionResult<T> =
  | { data: T }
  | { error: ExpenseActionError };

const API_MESSAGE_CODES: [prefix: string, code: ExpenseActionError][] = [
  ["This step is not waiting for a decision", "not_current_step"],
  ["This approval step does not exist", "not_found"],
  ["Already booked as", "already_booked"],
  ["Only failed bookings can be retried", "not_failed"],
  ["expenses_ledger_posting disabled", "posting_disabled"],
];

/** The action error code for a refusal message from the expenses api. */
export function apiErrorCode(message: string): ExpenseActionError {
  return (
    API_MESSAGE_CODES.find(([prefix]) => message.startsWith(prefix))?.[1] ??
    "api_failed"
  );
}
