/**
 * Pure refund arithmetic and validation. No Appwrite client, no provider SDK —
 * everything here is a function of the order, its lines, and the refunds
 * already recorded, so the rules that decide how much may be returned are
 * testable without a database or a payment provider.
 *
 * Amounts are NOK major units (matching `orders.total`) unless a name says
 * `Minor`. Money is compared in minor units throughout: `0.1 + 0.2 !== 0.3` in
 * binary floating point, so a "refund the rest" request built from summed
 * doubles would otherwise fail its own `<= refundable` check.
 */

const MINOR_UNITS_PER_MAJOR = 100;

/** An order line as the refund surface needs it. */
export interface RefundableOrderItem {
  /** Ledger revenue account snapshotted at sale time, when the line has one. */
  finagoAccountNumber?: number | null;
  /** `order_items.$id`. */
  id: string;
  name: string;
  productId?: string | null;
  quantity: number;
  unitPrice: number;
}

/** A refund already recorded against the order. */
export interface RecordedRefund {
  amount: number;
  lines?: Array<{ orderItemId?: string | null; quantity: number }>;
  status: "pending" | "succeeded" | "failed";
}

/** One line of a requested refund. */
export interface RefundLineRequest {
  orderItemId: string;
  quantity: number;
}

export interface RefundableSummary {
  /** Amount still refundable, in major units. */
  refundable: number;
  refundableMinor: number;
  /** Quantity still refundable per `order_items.$id`. */
  refundableQuantityByItem: Record<string, number>;
  refundedMinor: number;
  totalMinor: number;
}

export function toMinor(amount: number): number {
  return Math.round(amount * MINOR_UNITS_PER_MAJOR);
}

export function toMajor(minor: number): number {
  return minor / MINOR_UNITS_PER_MAJOR;
}

/**
 * A refund counts against the balance while it is `pending` as well as when it
 * has `succeeded`: a pending row means money may already be in flight at the
 * provider, and letting a second request spend that balance is how an order
 * gets over-refunded. Only `failed` rows release their amount.
 */
function countsAgainstBalance(refund: RecordedRefund): boolean {
  return refund.status !== "failed";
}

/**
 * What is still refundable on an order, in total and per line.
 *
 * The per-line quantities are advisory (they drive the UI steppers); the
 * monetary cap is authoritative, because a free-amount refund consumes balance
 * without naming any line.
 */
export function computeRefundable(
  order: { refundedTotal?: number | null; total: number },
  items: RefundableOrderItem[],
  refunds: RecordedRefund[]
): RefundableSummary {
  const totalMinor = toMinor(order.total);
  const localRefundedMinor = refunds
    .filter(countsAgainstBalance)
    .reduce((sum, refund) => sum + toMinor(refund.amount), 0);

  // `orders.refunded_total` holds the provider's own aggregate, which is the
  // larger figure whenever a refund was issued outside this system (straight
  // from the Stripe dashboard, say). Taking the max keeps the balance from
  // overstating what is left — computing it from local rows alone would offer
  // to refund money the provider has already returned.
  const refundedMinor = Math.max(
    localRefundedMinor,
    toMinor(order.refundedTotal ?? 0)
  );

  const refundableMinor = Math.max(0, totalMinor - refundedMinor);

  const refundedQuantityByItem = new Map<string, number>();
  for (const refund of refunds.filter(countsAgainstBalance)) {
    for (const line of refund.lines ?? []) {
      if (!line.orderItemId) {
        continue;
      }
      refundedQuantityByItem.set(
        line.orderItemId,
        (refundedQuantityByItem.get(line.orderItemId) ?? 0) + line.quantity
      );
    }
  }

  const refundableQuantityByItem: Record<string, number> = {};
  for (const item of items) {
    refundableQuantityByItem[item.id] = Math.max(
      0,
      item.quantity - (refundedQuantityByItem.get(item.id) ?? 0)
    );
  }

  return {
    refundable: toMajor(refundableMinor),
    refundableMinor,
    refundableQuantityByItem,
    refundedMinor,
    totalMinor,
  };
}

export interface BuiltRefundLine {
  amount: number;
  name: string;
  orderItemId: string;
  productId?: string | null;
  quantity: number;
}

/**
 * Expands line quantities into refund lines with their amounts. Unknown item
 * ids and non-positive quantities are dropped rather than throwing, so a stale
 * form submission degrades to refunding the lines that still exist.
 */
export function buildRefundLines(
  requested: RefundLineRequest[],
  items: RefundableOrderItem[]
): BuiltRefundLine[] {
  const byId = new Map(items.map((item) => [item.id, item]));

  // Quantities are summed per item BEFORE anything validates them. The server
  // action accepts an arbitrary array, so two entries naming the same line
  // would otherwise each be checked against the same remaining quantity, both
  // pass, and together refund (and restock) more than the line holds.
  const quantityByItem = new Map<string, number>();
  for (const line of requested) {
    const quantity = Math.floor(Number(line.quantity) || 0);
    if (quantity <= 0) {
      continue;
    }
    quantityByItem.set(
      line.orderItemId,
      (quantityByItem.get(line.orderItemId) ?? 0) + quantity
    );
  }

  const built: BuiltRefundLine[] = [];
  for (const [orderItemId, quantity] of quantityByItem) {
    const item = byId.get(orderItemId);
    if (!item) {
      continue;
    }
    built.push({
      amount: toMajor(toMinor(item.unitPrice) * quantity),
      name: item.name,
      orderItemId: item.id,
      productId: item.productId,
      quantity,
    });
  }
  return built;
}

export type RefundValidationError =
  | "amount_exceeds_refundable"
  | "amount_not_positive"
  | "line_quantity_exceeds_refundable"
  | "order_not_refundable";

export interface RefundValidationInput {
  amountMinor: number;
  lines: BuiltRefundLine[];
  /** Order status at the time of the request. */
  status: string;
  summary: RefundableSummary;
}

/**
 * Only a settled order can be refunded. An `authorized` (Vipps reserved but
 * uncaptured) payment has moved no money — that is a cancellation, offered
 * separately — and pending/failed/cancelled orders never charged the buyer.
 */
const REFUNDABLE_STATUSES = new Set(["paid", "refunded"]);

export function validateRefundRequest(
  input: RefundValidationInput
): { ok: true } | { ok: false; error: RefundValidationError } {
  if (!REFUNDABLE_STATUSES.has(input.status)) {
    return { ok: false, error: "order_not_refundable" };
  }
  if (input.amountMinor <= 0) {
    return { ok: false, error: "amount_not_positive" };
  }
  if (input.amountMinor > input.summary.refundableMinor) {
    return { ok: false, error: "amount_exceeds_refundable" };
  }

  for (const line of input.lines) {
    const remaining =
      input.summary.refundableQuantityByItem[line.orderItemId] ?? 0;
    if (line.quantity > remaining) {
      return { ok: false, error: "line_quantity_exceeds_refundable" };
    }
  }

  return { ok: true };
}

export interface RevenueAllocationInput {
  /** Ledger account per order line, keyed by `order_items.$id`. */
  accountByItemId: Record<string, number | null | undefined>;
  /**
   * Minor units already reversed per ledger account, from earlier refunds on
   * this order. Tracking it per ACCOUNT rather than per line is what makes the
   * arithmetic order-independent: a free-amount refund reverses accounts
   * without naming any line, so line quantities alone cannot describe what has
   * already been given back.
   */
  alreadyReversedByAccount?: Record<number, number>;
  amountMinor: number;
  items: RefundableOrderItem[];
  /** Empty for a free-amount refund. */
  lines: BuiltRefundLine[];
}

/** Each account's original credit on this order, in minor units. */
function originalCreditByAccount(
  items: RefundableOrderItem[],
  accountByItemId: Record<string, number | null | undefined>
): Map<number, number> {
  const credits = new Map<number, number>();
  for (const item of items) {
    const account = accountByItemId[item.id];
    if (!account) {
      continue;
    }
    const credit = toMinor(item.unitPrice) * item.quantity;
    if (credit > 0) {
      credits.set(account, (credits.get(account) ?? 0) + credit);
    }
  }
  return credits;
}

/**
 * Splits a refund across the ledger revenue accounts it should be debited
 * from, in minor units.
 *
 * A line-item refund maps exactly: each line's amount goes to its product's
 * account. A free-amount refund names no line, so it is allocated in
 * proportion to each account's share of the order — with the rounding
 * remainder pushed onto the largest share so the parts always sum back to
 * `amountMinor` and the reversal transaction balances to zero.
 */
export function allocateAmountAcrossAccounts(
  input: RevenueAllocationInput
): Array<{ accountNumber: number; amountMinor: number }> {
  const originalCredits = originalCreditByAccount(
    input.items,
    input.accountByItemId
  );

  // What each account can still give back. Every allocation is capped by this,
  // so no sequence of line and free-amount refunds can reverse more from an
  // account than the sale ever credited to it.
  const remaining = new Map<number, number>();
  for (const [account, credit] of originalCredits) {
    const already = input.alreadyReversedByAccount?.[account] ?? 0;
    remaining.set(account, Math.max(0, credit - already));
  }

  const byAccount = new Map<number, number>();
  const take = (account: number, wanted: number): number => {
    const left = remaining.get(account) ?? 0;
    const taken = Math.min(wanted, left);
    if (taken <= 0) {
      return 0;
    }
    remaining.set(account, left - taken);
    byAccount.set(account, (byAccount.get(account) ?? 0) + taken);
    return taken;
  };

  let unallocated = input.amountMinor;

  // A line refund names its accounts, so charge those first.
  for (const line of input.lines) {
    const account = input.accountByItemId[line.orderItemId];
    if (!account) {
      continue;
    }
    unallocated -= take(account, toMinor(line.amount));
  }

  // Whatever is left — the whole amount for a free refund, or a line refund's
  // spillover once an account is exhausted — is spread across the accounts
  // that still have room, in proportion to that room.
  if (unallocated > 0) {
    const openAccounts = [...remaining.entries()].filter(
      ([, left]) => left > 0
    );
    const totalRoom = openAccounts.reduce((sum, [, left]) => sum + left, 0);

    if (totalRoom > 0) {
      const share = Math.min(unallocated, totalRoom);
      let placed = 0;
      for (const [account, left] of openAccounts) {
        const wanted = Math.floor((share * left) / totalRoom);
        placed += take(account, wanted);
      }
      // Rounding remainder onto whichever account still has the most room, so
      // the parts sum exactly and the reversal balances.
      const shortfall = share - placed;
      if (shortfall > 0) {
        const largest = [...remaining.entries()]
          .filter(([, left]) => left > 0)
          .sort((a, b) => b[1] - a[1])[0];
        if (largest) {
          take(largest[0], shortfall);
        }
      }
    }
  }

  return toSortedEntries(byAccount);
}

function toSortedEntries(
  byAccount: Map<number, number>
): Array<{ accountNumber: number; amountMinor: number }> {
  return [...byAccount.entries()]
    .filter(([, amountMinor]) => amountMinor > 0)
    .sort((a, b) => a[0] - b[0])
    .map(([accountNumber, amountMinor]) => ({ accountNumber, amountMinor }));
}

/**
 * The order status after a refund settles. Stays `paid` while any balance
 * remains: `ORDER_STATUS_FILTER` and `summarizePurchases` count only
 * `authorized`/`paid` orders, so introducing a distinct partially-refunded
 * status would drop the order out of per-user purchase-limit counting and let
 * a buyer re-purchase a limited item by taking a small goodwill refund. The
 * admin surface derives "partially refunded" from `refunded_total` instead.
 */
export function statusAfterRefund(
  totalMinor: number,
  refundedTotalMinor: number
): "paid" | "refunded" {
  return refundedTotalMinor >= totalMinor && totalMinor > 0
    ? "refunded"
    : "paid";
}

/** Whether an order has been refunded in part but not in full. */
export function isPartiallyRefunded(order: {
  refunded_total?: number | null;
  total?: number | null;
}): boolean {
  const refunded = toMinor(order.refunded_total ?? 0);
  const total = toMinor(order.total ?? 0);
  return refunded > 0 && refunded < total;
}
