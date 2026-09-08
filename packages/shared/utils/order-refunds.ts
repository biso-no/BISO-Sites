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
 * `refunded_total` / `refunded_at` / `refund_lock` and the `refunds`
 * relationship live on the Appwrite `orders` table but postdate the current
 * generated types. Extend locally until `packages/api/types/appwrite.ts` is
 * regenerated after the schema push — the same convention `FinagoOrder` in
 * `finago-order-posting.ts` already uses.
 */
export type RefundableOrder = BaseOrders & {
  refund_lock?: number | null;
  refunded_at?: string | null;
  refunded_total?: number | null;
  refunds?: OrderRefundRow[] | null;
};

/** One `order_refunds` row. Hand-written for the same reason as above. */
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

const REFUNDS_TABLE = "order_refunds";
const REFUND_LINES_TABLE = "order_refund_lines";

/**
 * Loads the order with its lines AND its refund history in one read. Must be a
 * `Query.select(...)` string, not a bare column list: `getRow`'s fourth
 * argument is a query array, so a raw list of column names is not a projection
 * — the `refunds` relationship would come back empty, `computeRefundable`
 * would see no prior refunds, and every refund would be allowed to spend the
 * order's full total again.
 */
export const ORDER_WITH_REFUNDS_SELECT = Query.select([
  "*",
  "order_items.*",
  "order_items.product.*",
  "order_items.variation.*",
  "order_items.field_answers.*",
  "refunds.*",
  "refunds.lines.*",
]);

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
      id: item.order_item_id ?? `legacy-${index}`,
      name: item.name ?? item.title ?? item.product_name ?? "—",
      productId: item.product_id ?? null,
      quantity: typeof item.quantity === "number" ? item.quantity : 0,
      unitPrice: Number(item.unit_price ?? item.price ?? 0),
    }))
    .filter((item) => item.quantity > 0);
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
  }) => Promise<{ providerRefundId?: string; refundedTotalMinor: number }>;
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
  | "not_found"
  | "provider_failed";

export type RefundOrderResult =
  | {
      ok: true;
      amount: number;
      refundId: string;
      refundedTotal: number;
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

  const items = toRefundableItems(order);
  const summary = computeRefundable(
    { total: Number(order.total ?? 0) },
    items,
    toRecordedRefunds(order)
  );

  const lines = buildRefundLines(input.lines ?? [], items);
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
    return true;
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
    console.warn(
      `[Refund] Atomic claim failed on order ${orderId}; proceeding unguarded:`,
      error
    );
    return true;
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

  let outcome: { providerRefundId?: string; refundedTotalMinor: number };
  try {
    outcome = await input.executor.refund({
      amountMinor,
      currency,
      idempotencyKey,
      reason: input.reason,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db
      .updateRow(dbId, REFUNDS_TABLE, refundId, {
        status: "failed",
        error: message.slice(0, 1000),
      })
      .catch(() => undefined);
    console.error(`[Refund] Provider refund failed for ${orderId}:`, error);
    return { ok: false, reason: "provider_failed", message };
  }

  await writeRefundLines(refundId, lines, db);

  // The provider's running total is authoritative — it also accounts for a
  // refund issued outside this system (e.g. from the Stripe dashboard).
  const refundedTotalMinor = Math.max(
    outcome.refundedTotalMinor,
    args.summary.refundedMinor + amountMinor
  );
  const status = statusAfterRefund(args.summary.totalMinor, refundedTotalMinor);

  await db.updateRow(dbId, REFUNDS_TABLE, refundId, {
    status: "succeeded",
    provider_refund_id: outcome.providerRefundId ?? null,
  });

  await db.updateRow(dbId, tableIds().ordersId, orderId, {
    refunded_total: toMajor(refundedTotalMinor),
    refunded_at: new Date().toISOString(),
    status,
  });

  if (input.restock) {
    await restockRefundedLines(lines, db);
  }

  await reverseLedger({ args, amount, refundId });

  return {
    ok: true,
    amount,
    refundId,
    refundedTotal: toMajor(refundedTotalMinor),
    status,
  };
}

async function writeRefundLines(
  refundId: string,
  lines: BuiltRefundLine[],
  db: DbClient
): Promise<void> {
  const { dbId } = tableIds();
  for (const line of lines) {
    try {
      await db.createRow(dbId, REFUND_LINES_TABLE, ID.unique(), {
        amount: line.amount,
        name: line.name,
        // Legacy `items_json` orders have no line row to point at.
        order_item: line.orderItemId.startsWith("legacy-")
          ? null
          : line.orderItemId,
        quantity: line.quantity,
        refund: refundId,
      });
    } catch (error) {
      // The money is already returned; a missing line row degrades the audit
      // detail but must not fail the refund.
      console.error(
        `[Refund] Failed to record refund line for ${refundId}:`,
        error
      );
    }
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
  args,
  amount,
  refundId,
}: {
  args: ExecuteRefundArgs;
  amount: number;
  refundId: string;
}): Promise<void> {
  const { input, items, lines, order } = args;
  const { dbId, productsId } = tableIds();
  if (!input.ledger) {
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
      input.db,
      dbId,
      productsId
    );
    const allocation = allocateAmountAcrossAccounts({
      accountByItemId,
      amountMinor: toMinor(amount),
      items,
      lines,
    });
    const transactionId = await input.ledger.reverse({
      allocation,
      amount,
      orderId: input.orderId,
    });
    if (transactionId) {
      await input.db.updateRow(dbId, REFUNDS_TABLE, refundId, {
        finago_transaction_id: transactionId,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[Refund] Ledger reversal failed for refund ${refundId}:`,
      error
    );
    await input.db
      .updateRow(dbId, REFUNDS_TABLE, refundId, {
        error: `Ledger reversal failed: ${message}`.slice(0, 1000),
      })
      .catch(() => undefined);
  }
}

async function resolveRevenueAccounts(
  items: RefundableOrderItem[],
  db: DbClient,
  dbId: string,
  productsId: string
): Promise<Record<string, number | null>> {
  const accountByItemId: Record<string, number | null> = {};
  const cache = new Map<string, number | null>();

  for (const item of items) {
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
