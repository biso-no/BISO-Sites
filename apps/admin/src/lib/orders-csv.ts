/**
 * Pure CSV rendering for the orders export.
 *
 * The shape is fixed by the "CSV shape" section of
 * `docs/superpowers/specs/2026-09-03-admin-pagination-design.md`: ONE ROW PER
 * ORDER ITEM, always. An order holding three products writes three rows and
 * repeats its order-level columns on each of them, so a spreadsheet pivot over
 * products needs no lookup back to an order sheet. The previous shape collapsed
 * every line into a single `"name xN; name xN"` cell, which threw away product
 * ids, variations, per-line money and the `custom_fields_json` answers that
 * carry garment sizes and event questions — the data fulfilment actually needs.
 *
 * Like `./list-params`, this module must NEVER import `@repo/api` (or anything
 * else that reaches `node-appwrite`) as a VALUE: it is shared between the
 * server action that streams the full filtered export and the client component
 * that triggers the download, and a value import would drag the server SDK
 * (`undici` -> `node:net`) into the browser bundle and break every page on the
 * route. `import type` is erased at compile time and is fine.
 */
import type { Orders } from "@repo/api/types/appwrite";
import {
  getOrderItems,
  type ParsedOrderItem,
} from "@repo/shared/utils/order-parsing";

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

/** The label the buyer saw, falling back to the raw field id checkout stored. */
function customFieldKey(field: { id?: unknown; label?: unknown }): string {
  if (typeof field.label === "string" && field.label) {
    return field.label;
  }
  return typeof field.id === "string" ? field.id : "";
}

function customFieldPair(entry: unknown): string | null {
  if (!entry || typeof entry !== "object") {
    return null;
  }
  const field = entry as { id?: unknown; label?: unknown; value?: unknown };
  const key = customFieldKey(field);
  if (!key) {
    return null;
  }
  return `${key}=${field.value == null ? "" : String(field.value)}`;
}

/**
 * `custom_fields_json` flattened to `label=value; label=value`, the one cell
 * the spec gives these answers.
 *
 * Checkout writes a `[{ id, label, value }]` list (see `vipps-order-ops`) and
 * `getOrderItems` has already parsed it — returning `undefined` for malformed
 * JSON, which lands here as an empty cell rather than a lost line. A bare
 * `{ key: value }` map is accepted too, because legacy `items_json` orders were
 * never normalised and may still hold one.
 */
function formatCustomFields(fields: unknown): string {
  if (Array.isArray(fields)) {
    return fields
      .map(customFieldPair)
      .filter((pair): pair is string => pair !== null)
      .join("; ");
  }
  if (fields && typeof fields === "object") {
    return Object.entries(fields as Record<string, unknown>)
      .map(([key, value]) => `${key}=${value == null ? "" : String(value)}`)
      .join("; ");
  }
  return "";
}

/**
 * The per-line money. `line_total` is a real column that checkout always writes,
 * but legacy `items_json` lines predate it, so it is reconstructed from the
 * parts when both are there rather than left blank.
 */
function lineTotalOf(item: ParsedOrderItem, unitPrice: number | null): string {
  if (item.line_total != null) {
    return String(item.line_total);
  }
  if (unitPrice != null && item.quantity != null) {
    return String(unitPrice * item.quantity);
  }
  return "";
}

function unitPriceOf(item: ParsedOrderItem): number | null {
  // Legacy `items_json` lines called it `price`.
  return item.unit_price ?? item.price ?? null;
}

/**
 * The variation the buyer picked — its NAME, which needs the
 * `order_items.variation` relationship expanded by the caller's projection.
 * When only the relationship id came back, the id is written instead: a raw id
 * is poor fulfilment copy, but it is recoverable, and an empty cell is not.
 */
function variationOf(item: ParsedOrderItem): string {
  const name = item.variation_name;
  if (typeof name === "string" && name) {
    return name;
  }
  const id = item.variation_id;
  return typeof id === "string" ? id : "";
}

/**
 * One row: the order columns, then the item columns.
 *
 * `item` is null for an order with no line rows — the order still gets exactly
 * one row, with the product half blank. Dropping it would quietly remove a paid
 * order from a finance export, which is a worse failure than a sparse row.
 */
function orderItemRow(order: Orders, item: ParsedOrderItem | null): string {
  const unitPrice = item ? unitPriceOf(item) : null;

  return [
    escapeCsvValue(order.$id),
    escapeCsvValue(new Date(order.$createdAt).toISOString().slice(0, 10)),
    escapeCsvValue(order.status),
    escapeCsvValue(order.buyer_name),
    escapeCsvValue(order.buyer_email),
    escapeCsvValue(order.buyer_phone),
    // `orders` carries the campus id only — there is no campus relationship on
    // the table, so the export cannot name it without a second lookup.
    escapeCsvValue(order.campus_id),
    escapeCsvValue(
      item ? (item.name ?? item.product_name ?? item.title) : null
    ),
    escapeCsvValue(item?.product_id),
    escapeCsvValue(item ? variationOf(item) : ""),
    escapeCsvValue(item?.quantity),
    escapeCsvValue(unitPrice),
    escapeCsvValue(item ? lineTotalOf(item, unitPrice) : ""),
    escapeCsvValue(order.currency),
    escapeCsvValue(order.subtotal),
    escapeCsvValue(order.discount_total ?? 0),
    escapeCsvValue(order.total),
    escapeCsvValue(order.member_discount_percent),
    escapeCsvValue(order.payment_provider),
    escapeCsvValue(order.payment_receipt_url ?? order.receipt_link),
    escapeCsvValue(item ? formatCustomFields(item.custom_fields) : ""),
  ].join(",");
}

function orderRows(order: Orders): string[] {
  const items = getOrderItems(order);
  if (items.length === 0) {
    return [orderItemRow(order, null)];
  }
  return items.map((item) => orderItemRow(order, item));
}

/**
 * How many DATA rows `ordersToCsv` will write for the same input — never
 * `csv.split("\n").length`, which a newline inside a quoted answer would break.
 * Rows and orders diverge under the one-row-per-item shape, so the caller has
 * to report both.
 */
export function orderCsvRowCount(orders: Orders[]): number {
  let count = 0;
  for (const order of orders) {
    count += Math.max(1, getOrderItems(order).length);
  }
  return count;
}

/**
 * The export document: the localised `headers` row followed by one row per
 * ORDER ITEM, in the fixed column order above. Callers own the download itself,
 * so this stays usable from both the server action and the browser.
 */
export function ordersToCsv(orders: Orders[], headers: string[]): string {
  const headerRow = headers.map(escapeCsvValue).join(",");
  return [headerRow, ...orders.flatMap(orderRows)].join("\n");
}
