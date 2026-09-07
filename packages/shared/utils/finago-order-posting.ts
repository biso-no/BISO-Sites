import type { Orders as BaseOrders } from "@repo/api/types/appwrite";
import { postShopTransaction } from "@repo/connectors/24sevenoffice";
import { isMembershipOrder } from "./membership-fulfilment";
import { getOrderItems } from "./order-parsing";
import { ORDER_ITEMS_SELECT } from "./order-queries";
import type { DbClient } from "./vipps-order-ops";

// finago_transaction_id / finago_posting_lock live on the Appwrite "orders"
// table but predate the current generated types. Extend locally until
// packages/api/types/appwrite.ts is regenerated after the schema push.
export type FinagoOrder = BaseOrders & {
  finago_posting_lock?: number | null;
  finago_transaction_id?: string | null;
};

export interface FinagoPostingResult {
  posted: boolean;
  reason?:
    | "already_posted"
    | "claimed_elsewhere"
    | "membership_order"
    | "not_found"
    | "not_paid"
    | "post_failed";
  transactionId?: string;
}

const POSTABLE_STATUSES = new Set(["authorized", "paid"]);

// Written to `finago_transaction_id` right before the 24SO post and overwritten
// with the real transaction id on success. Its purpose is to survive a crash or
// failure *after* the external ledger side effect has been attempted: while it
// is set the order is excluded from the reconcile query (`finago_transaction_id
// IS NULL`) and from releaseStaleFinagoClaim, so no automatic path can post a
// second 24SO transaction. Such an order is left for manual recovery. Mirrors
// the expense-posting claim marker.
const FINAGO_POSTING_MARKER = "posting";

// Stamped into `finago_transaction_id` for a membership order in place of a
// real transaction id — reusing the same "non-transaction sentinel in this
// column" convention as FINAGO_POSTING_MARKER above, not a new abuse of the
// field. Without this, a membership order would satisfy the reconciliation
// cron's `finago_transaction_id IS NULL` sweep query forever (it never gets a
// real transaction id posted), re-entering that capped window on every cron
// run for the order's entire lifetime and eventually crowding out genuinely
// unposted shop orders.
const MEMBERSHIP_LEDGER_EXCLUSION = "membership";

function ordersTable() {
  return {
    dbId: process.env.APPWRITE_DATABASE_ID ?? "app",
    collId: process.env.APPWRITE_ORDERS_COLLECTION_ID ?? "orders",
  };
}

async function buildFinagoItems(order: FinagoOrder, db: DbClient) {
  const items = getOrderItems(order);
  const dbId = process.env.APPWRITE_DATABASE_ID;
  const colId = process.env.APPWRITE_WEBSHOP_PRODUCTS_COLLECTION_ID;

  if (!(dbId && colId)) {
    throw new Error(
      "Missing APPWRITE_DATABASE_ID or APPWRITE_WEBSHOP_PRODUCTS_COLLECTION_ID"
    );
  }

  const enrichedItems = await Promise.all(
    items.map(async (item) => {
      if (!item.product_id) {
        return null;
      }
      const product = (await db
        .getRow(dbId, colId, item.product_id)
        .catch(() => null)) as { finago_account_number?: number | null } | null;
      return {
        unit_price: Number(item.unit_price ?? item.price ?? 0),
        quantity: Number(item.quantity ?? 0),
        finago_account_number: product?.finago_account_number ?? null,
      };
    })
  );

  return enrichedItems.filter(
    (
      item
    ): item is {
      unit_price: number;
      quantity: number;
      finago_account_number: number | null;
    } => item !== null && item.unit_price > 0 && item.quantity > 0
  );
}

async function releaseClaim(orderId: string, db: DbClient): Promise<void> {
  const { dbId, collId } = ordersTable();
  if (db.decrementRowColumn) {
    await db
      .decrementRowColumn({
        databaseId: dbId,
        tableId: collId,
        rowId: orderId,
        column: "finago_posting_lock",
        value: 1,
        min: 0,
      })
      .catch(() => {
        // Already in trouble — the stale-claim sweep will recover the lock.
      });
  }
}

/**
 * Posts a paid/authorized order to Finago (24SevenOffice) exactly once.
 *
 * Idempotency: an atomic `finago_posting_lock` claim (incrementRowColumn)
 * guarantees only one concurrent caller — webhook callback, return route, or
 * reconciliation cron — performs the post. The winner writes the real
 * `finago_transaction_id`; on failure it releases the claim so a later sweep
 * retries. This is the same claim-lock pattern as expense ledger posting.
 */
export async function postFinagoTransactionForOrder(
  orderId: string,
  db: DbClient
): Promise<FinagoPostingResult> {
  const { dbId, collId } = ordersTable();

  const order = (await db
    .getRow(dbId, collId, orderId, [ORDER_ITEMS_SELECT])
    .catch(() => null)) as FinagoOrder | null;
  if (!order) {
    return { posted: false, reason: "not_found" };
  }
  if (!POSTABLE_STATUSES.has(order.status ?? "")) {
    return { posted: false, reason: "not_paid" };
  }
  if (order.finago_transaction_id) {
    // Either a real transaction id (already posted), the in-flight/manual-
    // recovery marker, or the membership-exclusion sentinel stamped below —
    // all three mean no automatic path may post this order again. Checking
    // this before the membership check means a membership order that has
    // already been stamped short-circuits here on any later call instead of
    // attempting (and skipping) a redundant stamp write every time.
    return { posted: false, reason: "already_posted" };
  }
  // Memberships are booked as a 24SO invoice by fulfilMembershipOrder, not as a
  // shop ledger transaction. Posting both would record the same revenue twice.
  // Stamp the exclusion sentinel (see MEMBERSHIP_LEDGER_EXCLUSION) so this row
  // permanently drops out of the reconciliation cron's sweep instead of
  // re-entering it forever. Best-effort: a failed write must not change the
  // outcome for the caller — a later call (this sweep or the next) will
  // simply try to stamp it again, which is harmless.
  if (isMembershipOrder(order)) {
    await db
      .updateRow(dbId, collId, orderId, {
        finago_transaction_id: MEMBERSHIP_LEDGER_EXCLUSION,
      })
      .catch((error) => {
        console.error(
          `[Finago] Failed to stamp membership exclusion for order ${orderId}:`,
          error
        );
      });
    return { posted: false, reason: "membership_order" };
  }

  if (db.incrementRowColumn) {
    try {
      const claimed = await db.incrementRowColumn<Record<string, unknown>>({
        databaseId: dbId,
        tableId: collId,
        rowId: orderId,
        column: "finago_posting_lock",
        value: 1,
      });
      const lockValue =
        typeof claimed?.finago_posting_lock === "number"
          ? claimed.finago_posting_lock
          : 0;
      if (lockValue !== 1) {
        // Lost the race. Undo our own increment so the lock reflects only the
        // in-flight winner (0/1) instead of drifting upward with every loser —
        // an inflated lock combined with each attempt refreshing $updatedAt
        // would keep releaseStaleFinagoClaim from ever aging out a crashed
        // claim, stranding the paid order unposted.
        await releaseClaim(orderId, db);
        console.log(
          `[Finago] Posting for order ${orderId} already claimed (lock: ${lockValue}), skipping.`
        );
        return { posted: false, reason: "claimed_elsewhere" };
      }
    } catch (error) {
      console.warn(
        `[Finago] Atomic claim failed for order ${orderId}; proceeding with best-effort guard:`,
        error
      );
    }
  }

  // Build the ledger lines and stamp the in-flight marker BEFORE any 24SO call.
  // A failure here happens before the external side effect, so it is safe to
  // release the claim and let a later sweep retry.
  let transactionItems: Awaited<ReturnType<typeof buildFinagoItems>>;
  try {
    transactionItems = await buildFinagoItems(order, db);
    await db.updateRow(dbId, collId, orderId, {
      finago_transaction_id: FINAGO_POSTING_MARKER,
    });
  } catch (error) {
    await releaseClaim(orderId, db);
    console.error(
      `[Finago] Failed to prepare posting for order ${orderId}:`,
      error
    );
    return { posted: false, reason: "post_failed" };
  }

  try {
    const transactionId = await postShopTransaction({
      orderId,
      date: new Date().toISOString().slice(0, 10),
      total: order.total ?? 0,
      items: transactionItems,
      campusId: order.campus_id ?? null,
    });

    await db.updateRow(dbId, collId, orderId, {
      finago_transaction_id: transactionId,
    });
    console.log(
      `[Finago] Posted order ${orderId} as transaction ${transactionId}`
    );
    return { posted: true, transactionId };
  } catch (error) {
    // The 24SO post has been attempted — it may have created the transaction
    // even though recording its id failed. Do NOT release the claim or clear
    // the marker: leaving the marker in place keeps every automatic path
    // (webhook/return/cron + releaseStaleFinagoClaim) from posting a second
    // transaction. The order is surfaced for manual recovery instead.
    console.error(
      `[Finago] Post attempted for order ${orderId}; leaving marker for manual recovery:`,
      error
    );
    return { posted: false, reason: "post_failed" };
  }
}

const STALE_CLAIM_MS = 30 * 60 * 1000;

/**
 * Recovers a posting claim that was taken but never completed (process died
 * between claim and post). Only call from the reconciliation sweep: if the
 * lock is held, no transaction id was written, and the order row hasn't been
 * touched for STALE_CLAIM_MS, reset the lock so the next sweep can retry.
 *
 * @returns true when a stale claim was released.
 */
export async function releaseStaleFinagoClaim(
  order: FinagoOrder,
  db: DbClient,
  now: number = Date.now()
): Promise<boolean> {
  const lockValue = order.finago_posting_lock ?? 0;
  if (lockValue <= 0 || order.finago_transaction_id) {
    return false;
  }

  const updatedAt = Date.parse(order.$updatedAt);
  if (Number.isNaN(updatedAt) || now - updatedAt < STALE_CLAIM_MS) {
    return false;
  }

  const { dbId, collId } = ordersTable();
  console.warn(
    `[Finago] Releasing stale posting claim on order ${order.$id} (lock: ${lockValue})`
  );
  await db.updateRow(dbId, collId, order.$id, { finago_posting_lock: 0 });
  return true;
}
