import type { Orders as BaseOrders } from "@repo/api/types/appwrite";
import { postShopTransaction } from "@repo/connectors/24sevenoffice";
import { parseOrderItems } from "./order-parsing";
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
    | "not_found"
    | "not_paid"
    | "post_failed";
  transactionId?: string;
}

const POSTABLE_STATUSES = new Set(["authorized", "paid"]);

function ordersTable() {
  return {
    dbId: process.env.APPWRITE_DATABASE_ID!,
    collId: process.env.APPWRITE_ORDERS_COLLECTION_ID!,
  };
}

async function buildFinagoItems(order: FinagoOrder, db: DbClient) {
  const items = parseOrderItems(order.items_json ?? null);
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
    .getRow(dbId, collId, orderId)
    .catch(() => null)) as FinagoOrder | null;
  if (!order) {
    return { posted: false, reason: "not_found" };
  }
  if (!POSTABLE_STATUSES.has(order.status ?? "")) {
    return { posted: false, reason: "not_paid" };
  }
  if (order.finago_transaction_id) {
    return { posted: false, reason: "already_posted" };
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

  try {
    const transactionItems = await buildFinagoItems(order, db);
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
    await releaseClaim(orderId, db);
    console.error(
      `[Finago] Failed to post transaction for order ${orderId}:`,
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
