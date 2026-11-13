import { isFeatureEnabled } from "@repo/shared/utils/feature-flags-server";
import { after } from "next/server";
import type { DecisionResult } from "./expense-approval";
import { postApprovedExpense } from "./expense-posting";

/** Whether a decision approved the last step, so the expense can be booked. */
export function approvedLastStep(result: DecisionResult): boolean {
  return result.ok && result.decision === "approved" && result.finalized;
}

/**
 * Books an expense as soon as its last approver approves, instead of waiting
 * for the scheduled `post-pending` run. It runs after the response is sent,
 * because the booking (PDF upload included) can outlast what Teams waits for
 * an answer.
 *
 * Safe to call for any decision: a repeat or a lost race is a no-op, because
 * `postApprovedExpense` books only an `approved` expense it claims itself. A
 * failed booking marks the expense `failed` there, and the scheduled run still
 * picks up anything left `approved`, such as after a restart.
 */
export function bookAfterFinalApproval(result: DecisionResult): void {
  if (!(result.ok && approvedLastStep(result))) {
    return;
  }
  const { expenseId } = result;
  after(async () => {
    try {
      if (!(await isFeatureEnabled("expenses_ledger_posting"))) {
        return;
      }
      await postApprovedExpense(expenseId);
    } catch (error) {
      console.error(
        `[expense-booking] booking after the final approval failed for ${expenseId}:`,
        error
      );
    }
  });
}
