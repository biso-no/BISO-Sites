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
 */
export async function settleOrderIfPaid(
  orderId: string,
  db: DbClient
): Promise<void> {
  try {
    const order = (await db.getRow("app", "orders", orderId, [
      ORDER_ITEMS_SELECT,
    ])) as FinagoOrder | null;
    if (
      !(order && (order.status === "paid" || order.status === "authorized"))
    ) {
      return;
    }
    if (isMembershipOrder(order)) {
      await fulfilMembershipOrder(orderId, db);
      return;
    }
    await postFinagoTransactionForOrder(orderId, db);
  } catch (error) {
    console.error(`[order-settlement] failed for ${orderId}:`, error);
  }
}
