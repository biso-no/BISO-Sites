import { postShopRefundTransaction } from "@repo/connectors/24sevenoffice";
import type { LedgerReverser } from "./order-refunds";

/**
 * The ledger reverser every refund path should use.
 *
 * Stateless — the campus comes in per call — so a single instance serves the
 * admin action and the reconciliation sweep alike. It exists as a shared
 * export precisely so a caller cannot forget to supply one: a refund finalized
 * without a reverser is marked succeeded and restocked while the original
 * Finago posting is never reversed, and nothing revisits succeeded refunds to
 * repair that.
 */
export const finagoRefundReverser: LedgerReverser = {
  reverse: async ({ allocation, amount, campusId, orderId }) => {
    if (allocation.length === 0) {
      return null;
    }
    return await postShopRefundTransaction({
      allocation,
      amount,
      campusId: campusId ?? null,
      date: new Date().toISOString().slice(0, 10),
      orderId,
    });
  },
};
