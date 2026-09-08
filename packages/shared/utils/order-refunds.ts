/**
 * Order refund orchestration.
 *
 * Owns the sequence that turns an admin's refund request into money returned,
 * a durable audit record, restored stock and a reversed ledger entry — in an
 * order chosen so that a crash at any step leaves the system recoverable and
 * never double-refunds.
 *
 * The arithmetic and the rules live in `order-refunds-pure.ts`; this module is
 * the impure half (Appwrite reads/writes, provider calls, ledger posting).
 */

import { ID, Query } from "@repo/api";
import type { Orders as BaseOrders } from "@repo/api/types/appwrite";
import { getOrderItems } from "./order-parsing";
import {
  allocateAmountAcrossAccounts,
  type BuiltRefundLine,
  buildRefundLines,
  computeRefundable,
  type RecordedRefund,
  type RefundableOrderItem,
  type RefundLineRequest,
  type RefundValidationError,
  statusAfterRefund,
  toMajor,
  toMinor,
  validateRefundRequest,
} from "./order-refunds-pure";
import type { DbClient } from "./vipps-order-ops";

/**
 * The generated `Orders` row, with `refunds` re-typed to the tolerant shape
 * this module actually reads.
 *
 * The generated type declares `refunds: OrderRefunds[]` with every
 * relationship fully expanded, but what Appwrite returns depends on the
 * projection: a relationship comes back as an id string unless it was
 * selected. `OrderRefundRow` models both, so the mappers below cannot be
 * broken by a caller that reads the order with a narrower select.
 */
export type RefundableOrder = Omit<BaseOrders, "refunds"> & {
  refunds?: OrderRefundRow[] | null;
};

/**
 * One `order_refunds` row as this module reads it — deliberately looser than
 * the generated `OrderRefunds`: `order_item` may arrive as an id string rather
 * than an expanded row, and `status` may be absent on a partially-selected read.
 */
export interface OrderRefundRow {
  $createdAt?: string;
  $id: string;
  amount: number;
  created_by?: string | null;
  created_by_name?: string | null;
  currency?: string | null;
  error?: string | null;
  finago_transaction_id?: string | null;
  idempotency_key?: string | null;
  lines?: OrderRefundLineRow[] | null;
  /** Parent order: an id string, or the expanded row when selected. */
  order?: string | { $id?: string } | null;
  provider?: string | null;
  provider_refund_id?: string | null;
  reason?: string | null;
  restock?: boolean | null;
  status?: "pending" | "succeeded" | "failed" | null;
}

/** One `order_refund_lines` row. */
export interface OrderRefundLineRow {
  $id?: string;
  amount?: number | null;
  name?: string | null;
  order_item?: string | { $id?: string } | null;
  quantity?: number | null;
}

/** Key prefix for a line from a pre-relationship order — see `toRefundableItems`. */
export const LEGACY_ITEM_PREFIX = "legacy-";

const REFUNDS_TABLE = "order_refunds";
const REFUND_LINES_TABLE = "order_refund_lines";

/**
 * Loads the order with its line items. Must be a `Query.select(...)` string,
 * not a bare column list: `getRow`'s fourth argument is a query array.
 *
 * Refunds are deliberately NOT selected here. The `orders → order_refunds`
 * relationship exists only on the child (`order_refunds.order`); there is no
 * `orders.refunds` back-reference, so selecting `refunds.*` asks Appwrite for
 * an attribute that does not exist and fails the whole read. `loadOrderRefunds`
 * queries the child table instead, which works regardless of which side of the
 * relationship is materialized.
 */
export const ORDER_WITH_REFUNDS_SELECT = Query.select([
  "*",
  "order_items.*",
  "order_items.product.*",
  "order_items.variation.*",
  "order_items.field_answers.*",
]);

const MAX_REFUNDS_PER_ORDER = 200;

/**
 * The refunds recorded against one order, newest first, with their lines.
 *
 * Queried from the child table by parent id (the `<relationship>.$id` idiom
 * used elsewhere in the repo) rather than read off a back-reference on the
 * order.
 *
 * Never swallows a failure: an empty list and "the query broke" are the same
 * value to `computeRefundable`, and treating the second as the first would let
 * a refund spend the order's full total again.
 */
export async function loadOrderRefunds(
  orderId: string,
  db: DbClient
): Promise<OrderRefundRow[]> {
  const { dbId } = tableIds();
  const response = await db.listRows(dbId, REFUNDS_TABLE, [
    Query.equal("order.$id", orderId),
    Query.select(["*", "lines.*"]),
    Query.orderDesc("$createdAt"),
    Query.limit(MAX_REFUNDS_PER_ORDER),
  ]);
  return response.rows as unknown as OrderRefundRow[];
}

function tableIds() {
  return {
    dbId: process.env.APPWRITE_DATABASE_ID ?? "app",
    ordersId: process.env.APPWRITE_ORDERS_COLLECTION_ID ?? "orders",
    productsId:
      process.env.APPWRITE_WEBSHOP_PRODUCTS_COLLECTION_ID ?? "webshop_products",
  };
}

/**
 * The order's lines in the shape the pure helpers work with. Typed off
 * `getOrderItems` rather than off `Orders` so it also accepts the relationship
 * shape Appwrite actually returns (and test fixtures), not just fully-hydrated
 * generated rows.
 */
export function toRefundableItems(
  order: Parameters<typeof getOrderItems>[0]
): RefundableOrderItem[] {
  return getOrderItems(order)
    .map((item, index) => ({
      // Legacy `items_json` orders have no line rows; index-key them so the UI
      // can still address them, and so a refund against one records a name and
      // an amount even though it cannot link to a row.
      finagoAccountNumber:
        typeof item.finago_account_number === "number"
          ? item.finago_account_number
          : null,
      id: item.order_item_id ?? `${LEGACY_ITEM_PREFIX}${index}`,
      name: item.name ?? item.title ?? item.product_name ?? "—",
      productId: item.product_id ?? null,
      quantity: typeof item.quantity === "number" ? item.quantity : 0,
      unitPrice: Number(item.unit_price ?? item.price ?? 0),
    }))
    .filter((item) => item.quantity > 0);
}

/**
 * Quantity already refunded per line, used to weight a free-amount refund's
 * ledger allocation against what is still unreversed.
 */
export function refundedQuantityByItem(
  order: RefundableOrder
): Record<string, number> {
  const byItem: Record<string, number> = {};
  for (const refund of toRecordedRefunds(order)) {
    if (refund.status === "failed") {
      continue;
    }
    for (const line of refund.lines ?? []) {
      if (line.orderItemId) {
        byItem[line.orderItemId] =
          (byItem[line.orderItemId] ?? 0) + line.quantity;
      }
    }
  }
  return byItem;
}

/** The order's existing refunds in the shape the pure helpers work with. */
export function toRecordedRefunds(order: RefundableOrder): RecordedRefund[] {
  return (order.refunds ?? []).map((refund) => ({
    amount: Number(refund.amount ?? 0),
    status: refund.status ?? "pending",
    lines: (refund.lines ?? []).map((line) => ({
      orderItemId:
        typeof line.order_item === "string"
          ? line.order_item
          : (line.order_item?.$id ?? null),
      quantity: Number(line.quantity ?? 0),
    })),
  }));
}

export interface RefundExecutor {
  /**
   * Performs the provider-side refund and returns the provider's authoritative
   * running total in minor units. Injected so this module stays free of the
   * payment SDKs (and so tests need no network).
   */
  refund: (input: {
    amountMinor: number;
    currency: string;
    idempotencyKey: string;
    reason?: string;
  }) => Promise<{
    providerRefundId?: string;
    refundedTotalMinor: number;
    /** False when the provider accepted but has not moved the money yet. */
    settled: boolean;
  }>;
}

export interface LedgerReverser {
  /**
   * Posts the compensating ledger transaction. Returns the transaction id, or
   * `null` when there is nothing to reverse (no revenue accounts resolved).
   */
  reverse: (input: {
    allocation: Array<{ accountNumber: number; amountMinor: number }>;
    amount: number;
    orderId: string;
  }) => Promise<string | null>;
}

export interface RefundOrderInput {
  actor?: { id?: string | null; name?: string | null };
  /** Free-amount refund in NOK. Ignored when `lines` are supplied. */
  amount?: number;
  db: DbClient;
  executor: RefundExecutor;
  ledger?: LedgerReverser;
  lines?: RefundLineRequest[];
  orderId: string;
  reason?: string;
  /** Return the refunded quantities to product stock. */
  restock?: boolean;
}

export type RefundFailureReason =
  | RefundValidationError
  | "claimed_elsewhere"
  | "lines_not_recorded"
  | "legacy_line_not_refundable"
  | "not_found"
  | "provider_failed"
  /** The provider may or may not have refunded; the attempt is left pending. */
  | "provider_uncertain";

export type RefundOrderResult =
  | {
      ok: true;
      amount: number;
      refundId: string;
      refundedTotal: number;
      /** False when the provider accepted the refund but has not settled it. */
      settled: boolean;
      status: "paid" | "refunded";
    }
  | { ok: false; reason: RefundFailureReason; message?: string };

/**
 * Refunds (part of) an order.
 *
 * Ordering matters and is deliberate:
 *  1. Validate against the order's own refund history — never against a number
 *     the caller supplied.
 *  2. Claim `refund_lock` atomically. This is the real double-refund guard for
 *     BOTH providers: the Vipps SDK mints a fresh `Idempotency-Key` per
 *     request, so two concurrent calls would otherwise refund twice.
 *  3. Write the refund row as `pending` BEFORE calling the provider, so a
 *     crash mid-call leaves evidence that money may have moved.
 *  4. Call the provider. On failure the row is marked `failed`, which releases
 *     its hold on the balance.
 *  5. Persist the provider's authoritative running total and the resulting
 *     order status.
 *  6. Restock and reverse the ledger — both best-effort, neither may fail a
 *     refund that has already succeeded at the provider.
 */
export async function refundOrder(
  input: RefundOrderInput
): Promise<RefundOrderResult> {
  const { db, orderId } = input;
  const { dbId, ordersId } = tableIds();

  const order = (await db
    .getRow(dbId, ordersId, orderId, [ORDER_WITH_REFUNDS_SELECT])
    .catch(() => null)) as RefundableOrder | null;
  if (!order) {
    return { ok: false, reason: "not_found" };
  }

  // Deliberately unguarded: if this read fails, the refund history is unknown,
  // and proceeding as though the order had never been refunded would let this
  // refund spend its full total a second time.
  order.refunds = await loadOrderRefunds(orderId, db);

  const items = toRefundableItems(order);
  const summary = computeRefundable(
    {
      refundedTotal: Number(order.refunded_total ?? 0),
      total: Number(order.total ?? 0),
    },
    items,
    toRecordedRefunds(order)
  );

  const lines = buildRefundLines(input.lines ?? [], items);
  // A pre-relationship order (lines only in the removed `items_json` column)
  // has no `order_items` rows to point a refund line at, so a per-line refund
  // could not be read back and would offer the same quantity again. Refund
  // those by amount instead.
  if (lines.some((line) => line.orderItemId.startsWith(LEGACY_ITEM_PREFIX))) {
    return { ok: false, reason: "legacy_line_not_refundable" };
  }
  const amountMinor =
    lines.length > 0
      ? lines.reduce((sum, line) => sum + toMinor(line.amount), 0)
      : toMinor(Number(input.amount ?? 0));

  const validation = validateRefundRequest({
    amountMinor,
    lines,
    status: order.status ?? "",
    summary,
  });
  if (!validation.ok) {
    return { ok: false, reason: validation.error };
  }

  // A lock stranded by a crashed process would otherwise block this order's
  // refunds forever — every later attempt increments to 2, loses, and
  // decrements back to 1. Release an aged claim first, exactly as the Finago
  // and membership claims do.
  await releaseStaleRefundLock(order, db);

  const claimed = await claimRefundLock(orderId, db);
  if (!claimed) {
    return { ok: false, reason: "claimed_elsewhere" };
  }

  const refundId = ID.unique();
  const idempotencyKey = `refund_${orderId}_${refundId}`;

  try {
    return await executeRefund({
      amountMinor,
      idempotencyKey,
      input,
      items,
      lines,
      order,
      refundId,
      summary,
    });
  } finally {
    await releaseRefundLock(orderId, db);
  }
}

const STALE_REFUND_LOCK_MS = 15 * 60 * 1000;

/**
 * Clears a refund lock left behind by a process that died mid-refund.
 *
 * A held lock plus an untouched row for longer than any refund could take
 * means nobody is working on it. The window is generous because the row's
 * `$updatedAt` is refreshed by every write a live refund makes, so an
 * in-flight refund can never look stale.
 *
 * @returns true when a stale claim was released.
 */
export async function releaseStaleRefundLock(
  order: RefundableOrder,
  db: DbClient,
  now: number = Date.now()
): Promise<boolean> {
  const lockValue = order.refund_lock ?? 0;
  if (lockValue <= 0) {
    return false;
  }

  const updatedAt = Date.parse(order.$updatedAt);
  if (Number.isNaN(updatedAt) || now - updatedAt < STALE_REFUND_LOCK_MS) {
    return false;
  }

  const { dbId, ordersId } = tableIds();
  console.warn(
    `[Refund] Releasing stale refund lock on order ${order.$id} (lock: ${lockValue})`
  );
  await db
    .updateRow(dbId, ordersId, order.$id, { refund_lock: 0 })
    .catch(() => undefined);
  return true;
}

/**
 * Atomic single-holder claim, matching the `transition_lock` /
 * `finago_posting_lock` pattern. A client without atomic column ops proceeds
 * unguarded rather than blocking the refund outright — the admin surface is
 * single-operator and the pre-write below still records the attempt.
 */
async function claimRefundLock(
  orderId: string,
  db: DbClient
): Promise<boolean> {
  const { dbId, ordersId } = tableIds();
  if (!db.incrementRowColumn) {
    // Same reasoning as the catch below: without the atomic claim there is no
    // concurrency guard at all, so refuse rather than refund unguarded.
    console.error(
      "[Refund] Client has no atomic column ops; refusing to refund unguarded."
    );
    return false;
  }

  try {
    const claimed = await db.incrementRowColumn<Record<string, unknown>>({
      databaseId: dbId,
      tableId: ordersId,
      rowId: orderId,
      column: "refund_lock",
      value: 1,
    });
    const lockValue =
      typeof claimed?.refund_lock === "number" ? claimed.refund_lock : 0;
    if (lockValue !== 1) {
      // Lost the race. Undo our own increment so the lock reflects only the
      // in-flight winner instead of drifting upward with every loser.
      await releaseRefundLock(orderId, db);
      return false;
    }
    return true;
  } catch (error) {
    // Fail closed. The lock is the ONLY thing preventing two concurrent
    // requests from both calling the provider: the pending-row prewrite does
    // not deduplicate, and Vipps mints a fresh idempotency key per request. An
    // unrefunded order an operator can retry beats a double refund.
    console.error(
      `[Refund] Could not acquire the refund lock on order ${orderId}; refusing to proceed:`,
      error
    );
    return false;
  }
}

async function releaseRefundLock(orderId: string, db: DbClient): Promise<void> {
  const { dbId, ordersId } = tableIds();
  if (!db.decrementRowColumn) {
    return;
  }
  await db
    .decrementRowColumn({
      databaseId: dbId,
      tableId: ordersId,
      rowId: orderId,
      column: "refund_lock",
      value: 1,
      min: 0,
    })
    .catch(() => {
      // Best effort: a stranded lock blocks only further refunds on this one
      // order, and an admin can clear it. Never fail a completed refund here.
    });
}

interface ExecuteRefundArgs {
  amountMinor: number;
  idempotencyKey: string;
  input: RefundOrderInput;
  items: RefundableOrderItem[];
  lines: BuiltRefundLine[];
  order: RefundableOrder;
  refundId: string;
  summary: ReturnType<typeof computeRefundable>;
}

async function executeRefund(
  args: ExecuteRefundArgs
): Promise<RefundOrderResult> {
  const { amountMinor, idempotencyKey, input, lines, order, refundId } = args;
  const { db, orderId } = input;
  const { dbId } = tableIds();
  const amount = toMajor(amountMinor);
  const currency = order.currency ?? "NOK";

  await db.createRow(dbId, REFUNDS_TABLE, refundId, {
    amount,
    created_by: input.actor?.id ?? null,
    created_by_name: input.actor?.name ?? null,
    currency,
    idempotency_key: idempotencyKey,
    order: orderId,
    provider: order.payment_provider ?? null,
    reason: input.reason?.slice(0, 500) ?? null,
    restock: input.restock ?? false,
    status: "pending",
  });

  // Line rows are written BEFORE the provider call, not after. They are not
  // just audit detail: `computeRefundable` derives `refundableQuantityByItem`
  // from them, so a line row lost after the money moved would offer the same
  // quantity again and restock the product a second time. Written first, a
  // failure here costs nothing — no funds have moved yet.
  try {
    await writeRefundLines(refundId, lines, db);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markRefund(refundId, db, {
      status: "failed",
      error: `Could not record refund lines: ${message}`.slice(0, 1000),
    });
    console.error(`[Refund] Failed to record lines for ${orderId}:`, error);
    return { ok: false, reason: "lines_not_recorded", message };
  }

  let outcome: Awaited<ReturnType<RefundExecutor["refund"]>>;
  try {
    outcome = await input.executor.refund({
      amountMinor,
      currency,
      idempotencyKey,
      reason: input.reason,
    });
  } catch (error) {
    return await handleProviderFailure({ db, error, orderId, refundId });
  }

  // The provider's running total is authoritative — it also accounts for a
  // refund issued outside this system (e.g. from the Stripe dashboard).
  const refundedTotalMinor = Math.max(
    outcome.refundedTotalMinor,
    args.summary.refundedMinor + amountMinor
  );

  // Accepted but not yet settled (Stripe's `pending`). The attempt stays
  // `pending`, which keeps holding its share of the balance, and none of the
  // downstream side effects fire: restocking inventory and reversing the
  // ledger for money still in flight would be wrong if it never lands.
  if (!outcome.settled) {
    await markRefund(refundId, db, {
      provider_refund_id: outcome.providerRefundId ?? null,
    });
    return {
      ok: true,
      amount,
      refundId,
      refundedTotal: toMajor(refundedTotalMinor),
      settled: false,
      status: order.status === "refunded" ? "refunded" : "paid",
    };
  }

  const status = await finalizeSettledRefund({
    amount,
    db,
    ledger: input.ledger,
    ledgerContext: { items: args.items, lines, order },
    orderId,
    providerRefundId: outcome.providerRefundId,
    refundId,
    refundedTotalMinor,
    restock: Boolean(input.restock),
    totalMinor: args.summary.totalMinor,
  });

  return {
    ok: true,
    amount,
    refundId,
    refundedTotal: toMajor(refundedTotalMinor),
    settled: true,
    status,
  };
}

export interface FinalizeSettledRefundInput {
  amount: number;
  db: DbClient;
  ledger?: LedgerReverser;
  ledgerContext: {
    items: RefundableOrderItem[];
    lines: BuiltRefundLine[];
    order: RefundableOrder;
  };
  orderId: string;
  providerRefundId?: string;
  refundedTotalMinor: number;
  refundId: string;
  restock: boolean;
  totalMinor: number;
}

/**
 * Everything that must happen once — and only once — after money has actually
 * been returned: mark the attempt succeeded, move the order's totals and
 * status, restore stock, and reverse the ledger.
 *
 * Shared by the immediate path and by `settlePendingRefund`, so a refund that
 * settles later goes through exactly the same effects as one that settled at
 * once. Every step is guarded independently: the funds are already gone, so a
 * transient failure in any of them must not skip the rest.
 */
export async function finalizeSettledRefund(
  input: FinalizeSettledRefundInput
): Promise<"paid" | "refunded"> {
  const { db, orderId, refundId, refundedTotalMinor } = input;
  const { dbId, ordersId } = tableIds();
  const status = statusAfterRefund(input.totalMinor, refundedTotalMinor);

  await markRefund(refundId, db, {
    status: "succeeded",
    provider_refund_id: input.providerRefundId ?? null,
  });

  await db
    .updateRow(dbId, ordersId, orderId, {
      refunded_total: toMajor(refundedTotalMinor),
      refunded_at: new Date().toISOString(),
      status,
    })
    .catch(async (error) => {
      console.error(
        `[Refund] Refund ${refundId} succeeded but the order totals could not be updated:`,
        error
      );
      await markRefund(refundId, db, {
        error: `Order totals not updated: ${String(error)}`.slice(0, 1000),
      });
    });

  if (input.restock) {
    await restockRefundedLines(input.ledgerContext.lines, db);
  }

  await reverseLedger({
    amount: input.amount,
    db,
    items: input.ledgerContext.items,
    ledger: input.ledger,
    lines: input.ledgerContext.lines,
    order: input.ledgerContext.order,
    orderId,
    refundId,
  });

  return status;
}

/** Best-effort write onto the refund row; never throws over a bookkeeping edit. */
async function markRefund(
  refundId: string,
  db: DbClient,
  data: Record<string, unknown>
): Promise<void> {
  const { dbId } = tableIds();
  await db.updateRow(dbId, REFUNDS_TABLE, refundId, data).catch((error) => {
    console.error(`[Refund] Failed to update refund row ${refundId}:`, error);
  });
}

/**
 * Classifies a thrown provider error.
 *
 * A definitive rejection (the provider answered and refused) marks the attempt
 * `failed`, releasing its hold on the balance so an operator can retry.
 *
 * Anything else — a timeout, a dropped connection, an unrecognised error — is
 * ambiguous: the provider may have accepted the refund before the response was
 * lost. Those stay `pending`, which keeps holding the balance, because a retry
 * would mint a fresh idempotency key (Vipps generates one per request) and
 * refund the same money twice. Resolving a pending attempt is a deliberate
 * human step against the provider's own records.
 */
async function handleProviderFailure({
  db,
  error,
  orderId,
  refundId,
}: {
  db: DbClient;
  error: unknown;
  orderId: string;
  refundId: string;
}): Promise<RefundOrderResult> {
  const message = error instanceof Error ? error.message : String(error);
  const rejected =
    error instanceof Error && error.name === "PaymentRefundRejectedError";

  if (rejected) {
    await markRefund(refundId, db, {
      status: "failed",
      error: message.slice(0, 1000),
    });
    console.error(`[Refund] Provider rejected refund for ${orderId}:`, error);
    return { ok: false, reason: "provider_failed", message };
  }

  await markRefund(refundId, db, {
    error: `Outcome unknown: ${message}`.slice(0, 1000),
  });
  console.error(
    `[Refund] Refund outcome UNKNOWN for ${orderId} (refund ${refundId} left pending; reconcile against the provider before retrying):`,
    error
  );
  return { ok: false, reason: "provider_uncertain", message };
}

async function writeRefundLines(
  refundId: string,
  lines: BuiltRefundLine[],
  db: DbClient
): Promise<void> {
  const { dbId } = tableIds();
  for (const line of lines) {
    await db.createRow(dbId, REFUND_LINES_TABLE, ID.unique(), {
      amount: line.amount,
      name: line.name,
      order_item: line.orderItemId,
      quantity: line.quantity,
      refund: refundId,
    });
  }
}

/**
 * Returns refunded quantities to stock. Only line-item refunds can restock —
 * a free-amount refund names no product, so there is nothing to return.
 */
async function restockRefundedLines(
  lines: BuiltRefundLine[],
  db: DbClient
): Promise<void> {
  const { dbId, productsId } = tableIds();
  if (!db.incrementRowColumn) {
    return;
  }

  for (const line of lines) {
    if (!line.productId || line.quantity <= 0) {
      continue;
    }
    try {
      // Untracked products carry a null stock; incrementing one would turn it
      // into a tracked product with a bogus level, so check before writing.
      const product = (await db.getRow(dbId, productsId, line.productId)) as {
        stock?: unknown;
      };
      if (typeof product?.stock !== "number") {
        continue;
      }
      await db.incrementRowColumn({
        databaseId: dbId,
        tableId: productsId,
        rowId: line.productId,
        column: "stock",
        value: line.quantity,
      });
    } catch (error) {
      console.error(
        `[Refund] Failed to restock product ${line.productId}:`,
        error
      );
    }
  }
}

async function reverseLedger({
  amount,
  db,
  items,
  ledger,
  lines,
  order,
  orderId,
  refundId,
}: {
  amount: number;
  db: DbClient;
  items: RefundableOrderItem[];
  ledger?: LedgerReverser;
  lines: BuiltRefundLine[];
  order: RefundableOrder;
  orderId: string;
  refundId: string;
}): Promise<void> {
  const { dbId, productsId } = tableIds();
  if (!ledger) {
    return;
  }

  // A membership order is booked as a 24SO invoice, not a ledger transaction,
  // so there is no shop transaction to reverse — that needs a credit note,
  // which is handled manually. Anything never posted has nothing to reverse.
  if (
    !order.finago_transaction_id ||
    order.finago_transaction_id === "membership" ||
    order.finago_transaction_id === "posting"
  ) {
    return;
  }

  try {
    const accountByItemId = await resolveRevenueAccounts(
      items,
      db,
      dbId,
      productsId
    );
    const allocation = allocateAmountAcrossAccounts({
      accountByItemId,
      alreadyRefundedByItem: refundedQuantityByItem(order),
      amountMinor: toMinor(amount),
      items,
      lines,
    });
    const transactionId = await ledger.reverse({
      allocation,
      amount,
      orderId,
    });
    if (transactionId) {
      await db.updateRow(dbId, REFUNDS_TABLE, refundId, {
        finago_transaction_id: transactionId,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[Refund] Ledger reversal failed for refund ${refundId}:`,
      error
    );
    await db
      .updateRow(dbId, REFUNDS_TABLE, refundId, {
        error: `Ledger reversal failed: ${message}`.slice(0, 1000),
      })
      .catch(() => undefined);
  }
}

/**
 * The ledger account to reverse per line.
 *
 * Prefers the account snapshotted on the order line at sale time: a product's
 * `finago_account_number` is editable, so reading the current product row can
 * debit an account the original sale never credited. Orders placed before that
 * snapshot existed fall back to the product.
 */
async function resolveRevenueAccounts(
  items: RefundableOrderItem[],
  db: DbClient,
  dbId: string,
  productsId: string
): Promise<Record<string, number | null>> {
  const accountByItemId: Record<string, number | null> = {};
  const cache = new Map<string, number | null>();

  for (const item of items) {
    if (typeof item.finagoAccountNumber === "number") {
      accountByItemId[item.id] = item.finagoAccountNumber;
      continue;
    }
    if (!item.productId) {
      accountByItemId[item.id] = null;
      continue;
    }
    if (!cache.has(item.productId)) {
      const product = (await db
        .getRow(dbId, productsId, item.productId)
        .catch(() => null)) as { finago_account_number?: number | null } | null;
      cache.set(item.productId, product?.finago_account_number ?? null);
    }
    accountByItemId[item.id] = cache.get(item.productId) ?? null;
  }

  return accountByItemId;
}

/** Current provider-side state of a refund we already submitted. */
export interface RefundStateResolver {
  state: (input: {
    orderId: string;
    providerRefundId?: string | null;
  }) => Promise<{
    /** The provider says this refund will not happen. */
    failed: boolean;
    refundedTotalMinor: number;
    /** The money has actually been returned. */
    settled: boolean;
  }>;
}

export type PendingRefundOutcome =
  | "failed"
  | "settled"
  | "still_pending"
  | "unresolved";

/**
 * Resolves one refund left in `pending` — either because the provider accepted
 * it without settling (Stripe's `pending`), or because our request's outcome
 * was never confirmed.
 *
 * Without this, a pending row is a trap: it holds its share of the refundable
 * balance forever, and a refund that later succeeds never runs its inventory
 * or ledger effects. Settlement goes through `finalizeSettledRefund`, the same
 * path the immediate case uses, so the effects happen exactly once either way.
 */
export async function settlePendingRefund({
  db,
  ledger,
  order,
  refund,
  resolver,
}: {
  db: DbClient;
  ledger?: LedgerReverser;
  order: RefundableOrder;
  refund: OrderRefundRow;
  resolver: RefundStateResolver;
}): Promise<PendingRefundOutcome> {
  let state: Awaited<ReturnType<RefundStateResolver["state"]>>;
  try {
    state = await resolver.state({
      orderId: order.$id,
      providerRefundId: refund.provider_refund_id,
    });
  } catch (error) {
    // Still unknown. Leave it pending — releasing the balance on a failed
    // lookup is how the same money gets refunded twice.
    console.error(
      `[Refund] Could not resolve pending refund ${refund.$id}:`,
      error
    );
    return "unresolved";
  }

  if (state.failed) {
    await markRefund(refund.$id, db, {
      status: "failed",
      error: "Provider reported the refund did not complete.",
    });
    return "failed";
  }

  if (!state.settled) {
    return "still_pending";
  }

  const items = toRefundableItems(order);
  const lines = (refund.lines ?? [])
    .map((line): BuiltRefundLine | null => {
      const orderItemId =
        typeof line.order_item === "string"
          ? line.order_item
          : (line.order_item?.$id ?? null);
      if (!orderItemId) {
        return null;
      }
      return {
        amount: Number(line.amount ?? 0),
        name: line.name ?? "—",
        orderItemId,
        productId:
          items.find((item) => item.id === orderItemId)?.productId ?? null,
        quantity: Number(line.quantity ?? 0),
      };
    })
    .filter((line): line is BuiltRefundLine => line !== null);

  await finalizeSettledRefund({
    amount: Number(refund.amount ?? 0),
    db,
    ledger,
    ledgerContext: { items, lines, order },
    orderId: order.$id,
    providerRefundId: refund.provider_refund_id ?? undefined,
    refundId: refund.$id,
    refundedTotalMinor: Math.max(
      state.refundedTotalMinor,
      toMinor(Number(order.refunded_total ?? 0)) +
        toMinor(Number(refund.amount ?? 0))
    ),
    restock: Boolean(refund.restock),
    totalMinor: toMinor(Number(order.total ?? 0)),
  });

  return "settled";
}

/** Refunds still awaiting resolution, oldest first. */
export async function listPendingRefunds(
  db: DbClient,
  olderThanIso: string,
  limit = 50
): Promise<OrderRefundRow[]> {
  const { dbId } = tableIds();
  const response = await db.listRows(dbId, REFUNDS_TABLE, [
    Query.equal("status", "pending"),
    Query.lessThan("$createdAt", olderThanIso),
    Query.select(["*", "lines.*", "order.$id"]),
    Query.orderAsc("$createdAt"),
    Query.limit(limit),
  ]);
  return response.rows as unknown as OrderRefundRow[];
}
