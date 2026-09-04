/**
 * Pure CSV rendering for the orders export.
 *
 * Like `./list-params`, this module must NEVER import `@repo/api` (or anything
 * else that reaches `node-appwrite`) as a VALUE: it is shared between the
 * server action that streams the full filtered export and the client component
 * that triggers the download, and a value import would drag the server SDK
 * (`undici` -> `node:net`) into the browser bundle and break every page on the
 * route. `import type` is erased at compile time and is fine.
 */
import type { Orders } from "@repo/api/types/appwrite";
import { getOrderItems } from "@repo/shared/utils/order-parsing";

const QUOTE_PATTERN = /"/g;

/**
 * One CSV cell. Quotes only when the value would otherwise break the row —
 * a comma, an embedded quote, or a newline — and doubles embedded quotes,
 * which is what RFC 4180 (and Excel) expects.
 */
export function escapeCsvValue(
  value: string | number | null | undefined
): string {
  if (value == null) {
    return "";
  }
  const text = String(value);
  return text.includes(",") || text.includes('"') || text.includes("\n")
    ? `"${text.replace(QUOTE_PATTERN, '""')}"`
    : text;
}

/** "Genser x2; Skjerf x1" — the single items cell the export has always had. */
function formatOrderItems(order: Orders): string {
  return getOrderItems(order)
    .map(
      (item) =>
        `${item.name ?? item.product_name ?? "?"}${item.quantity ? ` x${item.quantity}` : ""}`
    )
    .join("; ");
}

function orderToRow(order: Orders): string {
  return [
    escapeCsvValue(order.$id),
    escapeCsvValue(new Date(order.$createdAt).toISOString().slice(0, 10)),
    escapeCsvValue(order.buyer_name),
    escapeCsvValue(order.buyer_email),
    escapeCsvValue(order.buyer_phone),
    escapeCsvValue(formatOrderItems(order)),
    escapeCsvValue(order.subtotal),
    escapeCsvValue(order.discount_total ?? 0),
    escapeCsvValue(order.total),
    escapeCsvValue(order.currency),
    escapeCsvValue(order.status),
    escapeCsvValue(order.payment_provider),
    escapeCsvValue(order.member_discount_percent),
    escapeCsvValue(order.payment_receipt_url ?? order.receipt_link),
  ].join(",");
}

/**
 * The export document: the localised `headers` row followed by one row per
 * order, in the fixed column order above. Callers own the download itself, so
 * this stays usable from both the server action and the browser.
 */
export function ordersToCsv(orders: Orders[], headers: string[]): string {
  const headerRow = headers.map(escapeCsvValue).join(",");
  return [headerRow, ...orders.map(orderToRow)].join("\n");
}
