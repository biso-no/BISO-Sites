import {
  type FinagoOrder,
  postFinagoTransactionForOrder,
} from "./finago-order-posting";
import {
  fulfilMembershipOrder,
  isMembershipOrder,
} from "./membership-fulfilment";
import { ORDER_ITEMS_SELECT } from "./order-queries";
import type { DbClient } from "./vipps-order-ops";

export interface SettlementResult {
  /**
   * Set when this call fulfilled a membership order: the student whose
   * membership status cache the caller should now invalidate.
   */
  membershipStudentNumber?: number;
}

/**
 * Books the revenue for an order that has reached a paid state.
 *
 * A membership purchase becomes a 24SO invoice; every other order becomes a
 * shop ledger transaction — never both, or the same money is booked twice.
 *
 * Several independent triggers race to call this for the same order (the
 * provider webhook, the browser return route, the reconciliation cron, and the
 * app's own verification call), which is deliberate: any one of them can be
 * missed. The atomic claim inside each helper decides which one actually
 * settles, so calling this more than once is safe.
 *
 * Never throws. It is invoked from paths whose job is to answer a buyer or
 * acknowledge a webhook; a settlement hiccup must not fail those, and the
 * reconciliation cron will come back around.
 *
 * Returns the fulfilled student's number for a membership order settled on
 * this call, so an app with a membership cache can invalidate it.
 */
export async function settleOrderIfPaid(
  orderId: string,
  db: DbClient
): Promise<SettlementResult> {
  try {
    const order = (await db.getRow("app", "orders", orderId, [
      ORDER_ITEMS_SELECT,
    ])) as FinagoOrder | null;
    if (
      !(order && (order.status === "paid" || order.status === "authorized"))
    ) {
      return {};
    }
    if (isMembershipOrder(order)) {
      const result = await fulfilMembershipOrder(orderId, db);
      return result.fulfilled && result.studentNumber !== undefined
        ? { membershipStudentNumber: result.studentNumber }
        : {};
    }
    await postFinagoTransactionForOrder(orderId, db);
    return {};
  } catch (error) {
    console.error(`[order-settlement] failed for ${orderId}:`, error);
    return {};
  }
}
