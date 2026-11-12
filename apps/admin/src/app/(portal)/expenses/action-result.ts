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
  | "in_progress"
  | "self_approver"
  | "same_approver"
  | "retry_in_progress"
  | "booking_failed"
  | "status_write_failed"
  | "api_failed"
  | "failed";

/** The result of an expense edit action. */
export type ExpenseActionResult<T> =
  | { data: T }
  | { error: ExpenseActionError; message?: string };

const API_CODES: Record<string, ExpenseActionError> = {
  already_booked: "already_booked",
  booking_failed: "booking_failed",
  in_progress: "in_progress",
  invalid_email: "invalid_email",
  not_current_step: "not_current_step",
  not_failed: "not_failed",
  not_found: "not_found",
  posting_disabled: "posting_disabled",
  retry_in_progress: "retry_in_progress",
  same_approver: "same_approver",
  self_approver: "self_approver",
  status_write_failed: "status_write_failed",
};

/** The action error for a stable `code` from the expenses api. */
export function apiErrorCode(code: string | undefined): ExpenseActionError {
  return (code && API_CODES[code]) || "api_failed";
}
