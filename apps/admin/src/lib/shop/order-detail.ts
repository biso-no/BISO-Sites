/**
 * Shapes and pure helpers for the admin order-detail surface.
 *
 * Kept out of the `"use server"` action file on purpose: a `"use server"`
 * module may export only async functions, so the types and the sync mappers
 * that both the page and the client components need have to live here.
 */

import type { ParsedOrderItem } from "@repo/shared/utils/order-parsing";
import type {
  OrderRefundRow,
  RefundableOrder,
} from "@repo/shared/utils/order-refunds";
import type {
  computeRefundable,
  RefundableOrderItem,
} from "@repo/shared/utils/order-refunds-pure";

/** The stored order row this module maps from. */
export type OrderDetailRow = RefundableOrder;

/** A buyer's answer to one product checkout question. */
export interface OrderDetailAnswer {
  label: string;
  value: string;
}

/** One order line, with everything the detail view renders. */
export interface OrderDetailLine {
  answers: OrderDetailAnswer[];
  id: string;
  lineTotal: number;
  name: string;
  productId: string | null;
  quantity: number;
  refundableQuantity: number;
  unitPrice: number;
  variationName: string | null;
}

/** One recorded refund, flattened for display. */
export interface OrderDetailRefund {
  amount: number;
  createdAt: string | null;
  createdByName: string | null;
  error: string | null;
  id: string;
  ledgerTransactionId: string | null;
  lines: Array<{ name: string; quantity: number }>;
  providerRefundId: string | null;
  reason: string | null;
  restock: boolean;
  status: "pending" | "succeeded" | "failed";
}

/** Everything the detail page needs, resolved server-side. */
export interface OrderDetail {
  buyerEmail: string | null;
  buyerName: string | null;
  buyerPhone: string | null;
  campusId: string | null;
  createdAt: string;
  currency: string;
  discountTotal: number | null;
  finagoTransactionId: string | null;
  id: string;
  /** True when the order is a membership purchase, not a shop order. */
  isMembership: boolean;
  lines: OrderDetailLine[];
  memberDiscountPercent: number | null;
  membershipApplied: boolean;
  membershipInvoiceId: string | null;
  paymentIntentId: string | null;
  paymentLink: string | null;
  paymentProvider: string | null;
  paymentSessionId: string | null;
  receiptUrl: string | null;
  refundable: number;
  refundedTotal: number;
  refunds: OrderDetailRefund[];
  status: string;
  subtotal: number;
  total: number;
  updatedAt: string;
  userId: string | null;
}

/**
 * The status the UI shows, which is finer-grained than the stored one:
 * `refunded_total` carries the partial-refund state so that a partially
 * refunded order stays `paid` in the database and keeps counting towards
 * per-user purchase limits. See `statusAfterRefund` for why.
 */
export type DisplayOrderStatus =
  | "authorized"
  | "cancelled"
  | "failed"
  | "paid"
  | "partially_refunded"
  | "pending"
  | "refunded";

export function displayOrderStatus(order: {
  refunded_total?: number | null;
  status?: string | null;
  total?: number | null;
}): DisplayOrderStatus {
  const status = (order.status ?? "pending") as DisplayOrderStatus;
  if (status !== "paid") {
    return status;
  }
  const refunded = Math.round((order.refunded_total ?? 0) * 100);
  const total = Math.round((order.total ?? 0) * 100);
  if (refunded > 0 && refunded < total) {
    return "partially_refunded";
  }
  return status;
}

/**
 * Why the refund panel is unavailable, or `null` when a refund can be issued.
 * Returned as a reason rather than a boolean so the UI can explain itself
 * instead of showing a silently disabled button.
 */
export type RefundBlockedReason =
  | "fully_refunded"
  | "no_payment"
  | "not_settled";

export function refundBlockedReason(
  detail: Pick<OrderDetail, "paymentProvider" | "refundable" | "status">
): RefundBlockedReason | null {
  if (!detail.paymentProvider) {
    return "no_payment";
  }
  if (detail.status !== "paid" && detail.status !== "refunded") {
    return "not_settled";
  }
  if (detail.refundable <= 0) {
    return "fully_refunded";
  }
  return null;
}

/** Refund rows flattened for display, newest first. */
export function toDetailRefunds(
  refunds: OrderRefundRow[] | null | undefined
): OrderDetailRefund[] {
  return (refunds ?? [])
    .map((refund) => ({
      amount: Number(refund.amount ?? 0),
      createdAt: refund.$createdAt ?? null,
      createdByName: refund.created_by_name ?? null,
      error: refund.error ?? null,
      id: refund.$id,
      ledgerTransactionId: refund.finago_transaction_id ?? null,
      lines: (refund.lines ?? []).map((line) => ({
        name: line.name ?? "—",
        quantity: Number(line.quantity ?? 0),
      })),
      providerRefundId: refund.provider_refund_id ?? null,
      reason: refund.reason ?? null,
      restock: Boolean(refund.restock),
      status: refund.status ?? "pending",
    }))
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

/**
 * Merges the order's lines with how much of each is still refundable, so the
 * panel's steppers cannot offer a quantity that has already been returned.
 */
export function toDetailLines(
  items: RefundableOrderItem[],
  summary: ReturnType<typeof computeRefundable>,
  extras: LineExtras
): OrderDetailLine[] {
  return items.map((item) => {
    const extra = extras.get(item.id);
    return {
      answers: extra?.answers ?? [],
      id: item.id,
      lineTotal: item.unitPrice * item.quantity,
      name: item.name,
      productId: item.productId ?? null,
      quantity: item.quantity,
      refundableQuantity: summary.refundableQuantityByItem[item.id] ?? 0,
      unitPrice: item.unitPrice,
      variationName: extra?.variationName ?? null,
    };
  });
}

/** Per-line display extras, keyed the same way `toRefundableItems` keys lines. */
export type LineExtras = Map<
  string,
  { answers: OrderDetailAnswer[]; variationName: string | null }
>;

/**
 * Variation names and the buyer's checkout answers live on the parsed items,
 * not on the refund-shaped ones, so they are zipped back in by line id. The
 * `legacy-<index>` fallback matches `toRefundableItems`, which keys pre-
 * relationship `items_json` orders by position.
 */
export function toLineExtras(parsedItems: ParsedOrderItem[]): LineExtras {
  const extras: LineExtras = new Map();
  for (const [index, parsed] of parsedItems.entries()) {
    extras.set(parsed.order_item_id ?? `legacy-${index}`, {
      answers: (parsed.custom_fields ?? []).map((field) => ({
        label: field.label,
        value: field.value,
      })),
      variationName:
        typeof parsed.variation_name === "string"
          ? parsed.variation_name
          : null,
    });
  }
  return extras;
}

/**
 * The stored order row mapped onto the detail shape. Every optional column is
 * normalized to `null` here rather than at each render site, so the page and
 * the refund panel never have to think about Appwrite's undefined-vs-null.
 */
export function toOrderDetail(input: {
  extras: LineExtras;
  isMembership: boolean;
  items: RefundableOrderItem[];
  order: OrderDetailRow;
  summary: ReturnType<typeof computeRefundable>;
}): OrderDetail {
  const { extras, isMembership, items, order, summary } = input;
  return {
    buyerEmail: order.buyer_email ?? null,
    buyerName: order.buyer_name ?? null,
    buyerPhone: order.buyer_phone ?? null,
    campusId: order.campus_id ?? null,
    createdAt: order.$createdAt,
    currency: order.currency ?? "NOK",
    discountTotal: order.discount_total ?? null,
    finagoTransactionId: order.finago_transaction_id ?? null,
    id: order.$id,
    isMembership,
    lines: toDetailLines(items, summary, extras),
    memberDiscountPercent: order.member_discount_percent ?? null,
    membershipApplied: Boolean(order.membership_applied),
    membershipInvoiceId: order.membership_invoice_id ?? null,
    paymentIntentId: order.payment_intent_id ?? null,
    paymentLink: order.payment_link ?? null,
    paymentProvider: order.payment_provider ?? null,
    paymentSessionId: order.payment_session_id ?? null,
    receiptUrl: order.payment_receipt_url ?? order.receipt_link ?? null,
    refundable: summary.refundable,
    refundedTotal: Number(order.refunded_total ?? 0),
    refunds: toDetailRefunds(order.refunds),
    status: order.status ?? "pending",
    subtotal: Number(order.subtotal ?? 0),
    total: Number(order.total ?? 0),
    updatedAt: order.$updatedAt,
    userId: order.userId ?? null,
  };
}
