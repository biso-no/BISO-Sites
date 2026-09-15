import type { Orders } from "@repo/api/types/appwrite";
import {
  buildShopTransactionInput,
  postLedgerTransaction,
  type ShopTransactionInput,
} from "@repo/connectors/24sevenoffice";
import { isFeatureEnabled } from "./feature-flags-server";
import {
  ledgerDate,
  type RevenueTarget,
  resolveShopPosting,
  snapshotTarget,
} from "./finago-shop-accounting";
import {
  hasFinagoRestCredentials,
  loadShopAccountingSettings,
  resolveItemTargets,
} from "./finago-shop-accounting-server";
import { isMembershipOrder } from "./membership-fulfilment";
import { getOrderItems, type ParsedOrderItem } from "./order-parsing";
import { ORDER_ITEMS_SELECT } from "./order-queries";
import { loadOrderRefunds } from "./order-refunds";
import type { DbClient } from "./vipps-order-ops";

export type FinagoOrder = Orders;

export interface FinagoPostingResult {
  /** Why the order cannot be posted yet; set with `not_configured`. */
  detail?: string;
  posted: boolean;
  reason?:
    | "already_posted"
    | "claimed_elsewhere"
    | "disabled"
    | "membership_order"
    /** Refunded before it was posted; book it by hand (see `refundBeforePosting`). */
    | "needs_manual"
    | "not_configured"
    | "not_found"
    | "not_paid"
    | "post_failed"
    | "zero_total";
  transactionId?: string;
}

const POSTABLE_STATUSES = new Set(["authorized", "paid"]);
const MINOR_UNITS_PER_MAJOR = 100;

// Written to `finago_transaction_id` right before the Finago post and
// overwritten with the real id on success. While it is set the order is
// excluded from the reconcile query (`finago_transaction_id IS NULL`) and from
// releaseStaleFinagoClaim, so no automatic path can post a second voucher
// after a crash or failure mid-post. Such an order is left for manual recovery.
const FINAGO_POSTING_MARKER = "posting";

// Stamped for a membership order: memberships are booked as a 24SO invoice by
// fulfilMembershipOrder, so without a value here the order would match the
// reconcile sweep's `IS NULL` query forever.
const MEMBERSHIP_LEDGER_EXCLUSION = "membership";

// Stamped for a paid order with nothing to book (a free product), for the same
// reason as the membership sentinel.
const ZERO_TOTAL_EXCLUSION = "zero-total";

function ordersTable() {
  return {
    dbId: process.env.APPWRITE_DATABASE_ID ?? "app",
    collId: process.env.APPWRITE_ORDERS_COLLECTION_ID ?? "orders",
  };
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

/** Best-effort: a failed stamp only means a later sweep stamps it again. */
async function stampExclusion(
  orderId: string,
  db: DbClient,
  sentinel: string
): Promise<void> {
  const { dbId, collId } = ordersTable();
  await db
    .updateRow(dbId, collId, orderId, { finago_transaction_id: sentinel })
    .catch((error) => {
      console.error(
        `[Finago] Failed to stamp "${sentinel}" on order ${orderId}:`,
        error
      );
    });
}

/**
 * Best-effort: copies the target a line was posted with onto its
 * `order_items` row when checkout made no copy, so a later refund reverses
 * against the same account, VAT code and department even if the product's
 * sales type changes. Legacy `items_json` lines have no row and are skipped.
 * A failure is logged and never changes the posting result.
 */
async function writeBackFallbackTargets(
  orderId: string,
  items: ParsedOrderItem[],
  targets: Array<RevenueTarget | null>,
  db: DbClient
): Promise<void> {
  const dbId = process.env.APPWRITE_DATABASE_ID ?? "app";
  const itemsId =
    process.env.APPWRITE_ORDER_ITEMS_COLLECTION_ID ?? "order_items";
  for (const [index, item] of items.entries()) {
    const target = targets[index];
    if (!(target && item.order_item_id) || snapshotTarget(item)) {
      continue;
    }
    try {
      await db.updateRow(dbId, itemsId, item.order_item_id, {
        finago_account_number: target.accountNumber,
        finago_department: target.departmentId,
        finago_vat_code: target.vatCode,
      });
    } catch (error) {
      console.error(
        `[Finago] Order ${orderId} posted, but the ledger copy for line ${item.order_item_id} could not be saved:`,
        error
      );
    }
  }
}

/**
 * Why the order must not be posted automatically because of refunds, or
 * `null` when it has none.
 *
 * A refund recorded before the order is posted has no voucher to reverse, so
 * `reverseLedger` skips it and nothing revisits it. Posting the full total
 * afterwards would book revenue that was already given back. Nothing records
 * which refunds still need a reversal, so rather than guess, any refund that
 * has not failed — settled or still pending at the provider — or a non-zero
 * `refunded_total` keeps the order out of automatic posting.
 *
 * Reads the refund history fresh (after the claim) and lets a read failure
 * throw: an unknown history must not be treated as "no refunds".
 */
async function refundBeforePosting(
  order: FinagoOrder,
  db: DbClient
): Promise<string | null> {
  const refunds = await loadOrderRefunds(order.$id, db);
  const live = refunds.filter((refund) => refund.status !== "failed");
  const refundedMinor = Math.round(
    Number(order.refunded_total ?? 0) * MINOR_UNITS_PER_MAJOR
  );
  if (live.length === 0 && refundedMinor <= 0) {
    return null;
  }
  const detail = `Order has ${live.length} refund(s) (${refundedMinor / MINOR_UNITS_PER_MAJOR} kr refunded) recorded before it was posted; post the net sale to 24SO manually and record its transaction id`;
  // `refunded_total` only moves when a refund settles, so a pending one is
  // not in the amount above yet.
  const pending = live.filter((refund) => refund.status === "pending").length;
  return pending > 0
    ? `${detail}; ${pending} refund(s) still pending — wait for them to settle before booking the net sale by hand`
    : detail;
}

/**
 * Undoes the "posting" marker when the Finago call was never made, and
 * releases the claim so the sweep can look at the order again. If clearing the
 * marker fails, the marker AND the claim stay: the order is stranded and
 * visible for manual recovery, which is safe, whereas releasing without the
 * reset would change nothing and a guess could double-book.
 */
async function abandonMarker(orderId: string, db: DbClient): Promise<void> {
  const { dbId, collId } = ordersTable();
  try {
    await db.updateRow(dbId, collId, orderId, { finago_transaction_id: null });
  } catch (error) {
    console.error(
      `[Finago] Could not clear the posting marker on order ${orderId}; leaving it for manual recovery:`,
      error
    );
    return;
  }
  await releaseClaim(orderId, db);
}

type PreparedTransaction =
  | {
      input: ShopTransactionInput;
      items: ParsedOrderItem[];
      ok: true;
      targets: Array<RevenueTarget | null>;
    }
  | { ok: false; reason: string };

/**
 * Everything that can be checked without touching Finago: credentials,
 * settings, a sales type for every priced line, and a balanced voucher. A
 * refusal here is a configuration gap, never a possible side effect.
 */
async function prepareTransaction(
  order: FinagoOrder,
  db: DbClient
): Promise<PreparedTransaction> {
  if (!hasFinagoRestCredentials()) {
    return {
      ok: false,
      reason: "Finago REST credentials are not set on this app",
    };
  }

  const settings = await loadShopAccountingSettings(db);
  const items = getOrderItems(order);
  const targets = await resolveItemTargets(db, items);

  const resolution = resolveShopPosting({
    campusId: order.campus_id ?? null,
    items: items.map((item, index) => ({
      name: item.name ?? item.title ?? "Vare",
      quantity: Number(item.quantity ?? 0),
      target: targets[index] ?? null,
      unitPrice: Number(item.unit_price ?? item.price ?? 0),
    })),
    provider: order.payment_provider ?? null,
    settings,
    total: order.total ?? 0,
  });
  if (!resolution.ok) {
    return resolution;
  }

  const { posting } = resolution;
  try {
    return {
      input: buildShopTransactionInput({
        campusId: posting.campusId,
        clearingAccount: posting.clearingAccount,
        comment: `Nettbutikk ${order.$id}`,
        date: ledgerDate(),
        lines: posting.lines,
        total: posting.total,
        transactionTypeNumber: posting.transactionTypeNumber,
      }),
      items,
      ok: true,
      targets,
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Checks refunds again with the marker in place, immediately before the
 * Finago call. A refund that started before the first check reads the order
 * before its row exists; if its row has appeared since, booking the full total
 * now would leave that refund unreversed. The marker makes any refund from
 * here on record a manual note instead of skipping silently.
 *
 * @returns the result to return instead of posting, or null to post.
 */
async function holdForLateRefund(
  order: FinagoOrder,
  db: DbClient
): Promise<FinagoPostingResult | null> {
  const orderId = order.$id;
  let lateRefund: string | null;
  try {
    lateRefund = await refundBeforePosting(order, db);
  } catch (error) {
    console.error(
      `[Finago] Could not re-read refunds for order ${orderId} before posting; not posting:`,
      error
    );
    await abandonMarker(orderId, db);
    return { posted: false, reason: "post_failed" };
  }
  if (!lateRefund) {
    return null;
  }
  await abandonMarker(orderId, db);
  console.warn(`[Finago] Order ${orderId} needs manual posting: ${lateRefund}`);
  return { detail: lateRefund, posted: false, reason: "needs_manual" };
}

/**
 * Posts a paid/authorized shop order to Finago exactly once.
 *
 * Idempotency: an atomic `finago_posting_lock` claim guarantees only one
 * concurrent caller — webhook, return route, or reconcile cron — posts. All
 * validation runs before the "posting" marker, so a configuration gap
 * releases the claim and the sweep retries once it is fixed. Only a failure
 * of the Finago call itself leaves the marker for manual recovery.
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
    return { posted: false, reason: "already_posted" };
  }
  if (isMembershipOrder(order)) {
    await stampExclusion(orderId, db, MEMBERSHIP_LEDGER_EXCLUSION);
    return { posted: false, reason: "membership_order" };
  }
  if (Math.round((order.total ?? 0) * MINOR_UNITS_PER_MAJOR) <= 0) {
    await stampExclusion(orderId, db, ZERO_TOTAL_EXCLUSION);
    return { posted: false, reason: "zero_total" };
  }
  if (!(await isFeatureEnabled("shop_ledger_posting"))) {
    return { posted: false, reason: "disabled" };
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
        // in-flight winner and a crashed claim can still age out.
        await releaseClaim(orderId, db);
        return { posted: false, reason: "claimed_elsewhere" };
      }
    } catch (error) {
      console.warn(
        `[Finago] Atomic claim failed for order ${orderId}; proceeding with best-effort guard:`,
        error
      );
    }
  }

  let prepared: PreparedTransaction;
  try {
    const refunded = await refundBeforePosting(order, db);
    if (refunded) {
      await releaseClaim(orderId, db);
      console.warn(
        `[Finago] Order ${orderId} needs manual posting: ${refunded}`
      );
      return { detail: refunded, posted: false, reason: "needs_manual" };
    }
    prepared = await prepareTransaction(order, db);
    if (!prepared.ok) {
      await releaseClaim(orderId, db);
      console.warn(
        `[Finago] Order ${orderId} not posted yet: ${prepared.reason}`
      );
      return {
        detail: prepared.reason,
        posted: false,
        reason: "not_configured",
      };
    }
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

  const held = await holdForLateRefund(order, db);
  if (held) {
    return held;
  }

  let transactionId: string;
  try {
    transactionId = await postLedgerTransaction(prepared.input);
    await db.updateRow(dbId, collId, orderId, {
      finago_transaction_id: transactionId,
    });
    console.log(
      `[Finago] Posted order ${orderId} as transaction ${transactionId}`
    );
  } catch (error) {
    // The Finago post has been attempted and may have landed. Keep the marker
    // and the claim so no automatic path posts a second voucher.
    console.error(
      `[Finago] Post attempted for order ${orderId}; leaving marker for manual recovery:`,
      error
    );
    return { posted: false, reason: "post_failed" };
  }

  await writeBackFallbackTargets(orderId, prepared.items, prepared.targets, db);
  return { posted: true, transactionId };
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
