import "server-only";
import { settleOrderIfPaid } from "@repo/shared/utils/order-settlement";
import type { DbClient } from "@repo/shared/utils/vipps-order-ops";
import { invalidateMembershipStatus } from "@/lib/membership-status-cache";

/**
 * `settleOrderIfPaid`, plus: when this call fulfilled a membership, drop the
 * buyer's cached status so the website and the student app see it on their
 * next read instead of after the cache TTL.
 *
 * Never throws, like `settleOrderIfPaid` — it runs inside webhook and return
 * paths that must answer regardless.
 */
export async function settleOrder(
  orderId: string,
  db: DbClient
): Promise<void> {
  const { membershipStudentNumber } = await settleOrderIfPaid(orderId, db);
  if (membershipStudentNumber === undefined) {
    return;
  }
  try {
    invalidateMembershipStatus(membershipStudentNumber);
  } catch (error) {
    console.error(
      `[settle-order] Could not invalidate membership status for order ${orderId}:`,
      error
    );
  }
}
