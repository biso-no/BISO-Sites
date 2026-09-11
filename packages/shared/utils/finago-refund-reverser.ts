import {
  buildShopReversalTransactionInput,
  postLedgerTransaction,
} from "@repo/connectors/24sevenoffice";
import { clearingProvider, ledgerDate } from "./finago-shop-accounting";
import { loadShopAccountingSettings } from "./finago-shop-accounting-server";
import type { LedgerReverser } from "./order-refunds";

const MINOR_UNITS_PER_MAJOR = 100;

/**
 * The ledger reverser every refund path should use.
 *
 * Mirrors the original voucher: credits the provider's clearing account and
 * debits each revenue target with its own VAT code and department. The payout
 * voucher's refund line then clears the clearing account. A missing setting
 * throws, which records the failure on the refund row for manual posting; the
 * refund itself still stands.
 */
export const finagoRefundReverser: LedgerReverser = {
  reverse: async ({ allocation, amount, campusId, db, orderId, provider }) => {
    if (allocation.length === 0) {
      return null;
    }
    const settings = await loadShopAccountingSettings(db);
    if (!settings) {
      throw new Error("Shop accounting settings have not been saved in admin");
    }
    const clearing = clearingProvider(provider);
    if (!clearing) {
      throw new Error(
        `No clearing account for payment provider "${provider ?? "none"}"`
      );
    }

    return await postLedgerTransaction(
      buildShopReversalTransactionInput({
        campusId: campusId ?? null,
        clearingAccount: settings.clearingAccounts[clearing],
        comment: `Refusjon nettbutikk ${orderId}`,
        date: ledgerDate(),
        lines: allocation.map((entry) => ({
          accountNumber: entry.accountNumber,
          amount: entry.amountMinor / MINOR_UNITS_PER_MAJOR,
          departmentId: entry.departmentId,
          vatCode: entry.vatCode,
        })),
        total: amount,
        transactionTypeNumber: settings.transactionTypeNumber,
      })
    );
  },
};
