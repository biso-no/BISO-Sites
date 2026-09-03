import type { WcOrder } from "../extract/index";
import type { RejectRow } from "../types";
import { buildTimestampOverrides } from "./timestamps";

const STATUS_MAP: Record<string, string> = {
  cancelled: "cancelled",
  completed: "paid",
  failed: "failed",
  "on-hold": "pending",
  pending: "pending",
  processing: "paid",
  refunded: "refunded",
};

/**
 * Stamped into `finago_transaction_id` for every imported order, reusing the
 * "non-transaction sentinel in this column" convention documented next to
 * FINAGO_POSTING_MARKER / MEMBERSHIP_LEDGER_EXCLUSION in
 * packages/shared/utils/finago-order-posting.ts. The reconcile cron
 * (apps/web/src/app/api/cron/reconcile-orders/route.ts) sweeps every
 * paid/authorized order with `finago_transaction_id IS NULL` and posts it to
 * the live 24SevenOffice ledger — with the column left unset, every imported
 * historical WooCommerce order would be swept and posted as fabricated
 * revenue within ~10 minutes of `load --orders --apply`. Stamping this
 * sentinel keeps the row permanently out of that query, the same way the
 * membership sentinel keeps membership orders out of it.
 */
export const WORDPRESS_IMPORT_LEDGER_EXCLUSION = "wordpress-import";

export function mapOrderStatus(wooStatus: string): string | null {
  return STATUS_MAP[wooStatus] ?? null;
}

/**
 * One `order_items` row. `rowId` is derived from the WooCommerce line-item id
 * so a re-run updates the same child rather than appending a duplicate — per
 * Appwrite's nested-write rules, a nested child whose `$id` already exists is
 * updated, and one without an id gets a fresh unique id every time.
 *
 * `productRowId` / `variationRowId` are **join keys, not columns**: the
 * `order_items` table has no flat `product_id`, only the `product` and
 * `variation` relationships, and buildOrderItemRows decides whether either
 * can be attached. They are named unlike any column on purpose — the previous
 * shape carried a `product_id` field that looked writable and was spread
 * straight into the payload, which Appwrite rejected.
 */
export interface TransformedOrderItem {
  line_total: number;
  name: string;
  /** Join key for the `product` relationship; never written as a column. */
  productRowId: string;
  quantity: number;
  rowId: string;
  unit_price: number;
  /** Join key for the `variation` relationship; null when not a variation. */
  variationRowId: string | null;
}

export function transformOrder(
  order: WcOrder,
  userIdByEmail: Map<string, string>
):
  | {
      items: TransformedOrderItem[];
      row: Record<string, unknown>;
      rowId: string;
    }
  | { reject: RejectRow } {
  const label = `Order #${order.id}`;

  if (order.currency !== "NOK") {
    return {
      reject: {
        label,
        reason: `Currency ${order.currency} is not NOK; the column is a NOK-only enum`,
        sourceId: order.id,
      },
    };
  }

  const status = mapOrderStatus(order.status);
  if (!status) {
    return {
      reject: {
        label,
        reason: `Unmappable WooCommerce status "${order.status}"`,
        sourceId: order.id,
      },
    };
  }

  const total = Number.parseFloat(order.total);
  const discountTotal = Number.parseFloat(order.discount_total || "0");
  if (Number.isNaN(total)) {
    return {
      reject: {
        label,
        reason: "Order total is not a number; orders.total is required",
        sourceId: order.id,
      },
    };
  }

  const items = order.line_items.map((item) => {
    const lineTotal = Number.parseFloat(item.total || "0");
    return {
      line_total: Number.isNaN(lineTotal) ? 0 : lineTotal,
      // The only human-readable record of what was bought once the `product`
      // relationship cannot be attached — most of the archive predates the
      // current catalogue, so this carries the weight there.
      name: item.name,
      productRowId: `wpprod${item.product_id}`,
      quantity: item.quantity,
      rowId: `wpitem${item.id}`,
      unit_price: item.price,
      variationRowId: item.variation_id ? `wpvar${item.variation_id}` : null,
    };
  });

  const subtotal = order.line_items.reduce(
    (sum, item) => sum + Number.parseFloat(item.total || "0"),
    0
  );

  const email = order.billing.email?.trim().toLowerCase() ?? "";
  const buyerName =
    `${order.billing.first_name} ${order.billing.last_name}`.trim();

  return {
    items,
    row: {
      // `orders` has no date column, so these overrides are the only record
      // of when the purchase actually happened.
      ...buildTimestampOverrides(
        order.date_created_gmt,
        order.date_modified_gmt
      ),
      buyer_email: order.billing.email || null,
      buyer_name: buyerName || null,
      buyer_phone: order.billing.phone || null,
      currency: "NOK",
      discount_total: Number.isNaN(discountTotal) ? 0 : discountTotal,
      finago_transaction_id: WORDPRESS_IMPORT_LEDGER_EXCLUSION,
      payment_provider: order.payment_method_title || null,
      status,
      subtotal: Number.isNaN(subtotal) ? total : subtotal,
      total,
      userId: userIdByEmail.get(email) ?? null,
    },
    rowId: `wporder${order.id}`,
  };
}
