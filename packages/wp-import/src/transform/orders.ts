import type { WcOrder } from "../extract/index";
import type { RejectRow } from "../types";

const STATUS_MAP: Record<string, string> = {
  cancelled: "cancelled",
  completed: "paid",
  failed: "failed",
  "on-hold": "pending",
  pending: "pending",
  processing: "paid",
  refunded: "refunded",
};

export function mapOrderStatus(wooStatus: string): string | null {
  return STATUS_MAP[wooStatus] ?? null;
}

export function transformOrder(
  order: WcOrder,
  userIdByEmail: Map<string, string>
): { row: Record<string, unknown>; rowId: string } | { reject: RejectRow } {
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

  const items = order.line_items.map((item) => ({
    name: item.name,
    product_id: `wpprod${item.product_id}`,
    quantity: item.quantity,
    title: item.name,
    unit_price: item.price,
  }));

  const subtotal = order.line_items.reduce(
    (sum, item) => sum + Number.parseFloat(item.total || "0"),
    0
  );

  const email = order.billing.email?.trim().toLowerCase() ?? "";
  const buyerName =
    `${order.billing.first_name} ${order.billing.last_name}`.trim();

  return {
    row: {
      buyer_email: order.billing.email || null,
      buyer_name: buyerName || null,
      buyer_phone: order.billing.phone || null,
      currency: "NOK",
      discount_total: Number.isNaN(discountTotal) ? 0 : discountTotal,
      items_json: JSON.stringify(items),
      payment_provider: order.payment_method_title || null,
      status,
      subtotal: Number.isNaN(subtotal) ? total : subtotal,
      total,
      userId: userIdByEmail.get(email) ?? null,
    },
    rowId: `wporder${order.id}`,
  };
}
