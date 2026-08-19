export interface ParsedOrderItem {
  category?: string | null;
  custom_fields?: Array<{ id: string; label: string; value: string }>;
  name?: string | null;
  price?: number | null;
  product_id?: string | null;
  product_name?: string | null;
  product_type?: string | null;
  quantity?: number | null;
  title?: string | null;
  unit_price?: number | null;
  [key: string]: unknown;
}

interface RelationalOrderItem {
  $id?: string;
  accrual_months?: number | null;
  category_id?: string | null;
  custom_fields_json?: string | null;
  duration?: string | null;
  line_total?: number | null;
  membership_id?: string | null;
  name?: string | null;
  product?: string | { $id?: string } | null;
  product_type?: string | null;
  quantity?: number | null;
  start_date?: string | null;
  unit_price?: number | null;
  variation?: string | { $id?: string; name?: string | null } | null;
}

interface OrderWithItems {
  items_json?: string | null;
  order_items?: RelationalOrderItem[] | null;
}

function relationshipId(
  value: string | { $id?: string } | null | undefined
): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  return value?.$id;
}

function parseCustomFields(value?: string | null) {
  if (!value) {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? (parsed as Array<{ id: string; label: string; value: string }>)
      : undefined;
  } catch {
    return undefined;
  }
}

function normalizeRelationalOrderItem(
  item: RelationalOrderItem
): ParsedOrderItem {
  const variation =
    typeof item.variation === "object" ? item.variation : undefined;

  return {
    accrual_months: item.accrual_months,
    category_id: item.category_id,
    custom_fields: parseCustomFields(item.custom_fields_json),
    duration: item.duration,
    line_total: item.line_total,
    membership_id: item.membership_id,
    name: item.name,
    product_id: relationshipId(item.product),
    product_type: item.product_type,
    quantity: item.quantity,
    start_date: item.start_date,
    title: item.name,
    unit_price: item.unit_price,
    variation_id: relationshipId(item.variation),
    variation_name: variation?.name ?? undefined,
  };
}

function normalizeOrderItem(item: ParsedOrderItem): ParsedOrderItem {
  if (item.product_id || typeof item.productId !== "string") {
    return item;
  }

  return {
    ...item,
    product_id: item.productId,
  };
}

export function parseOrderItems(
  input?: string | null | RelationalOrderItem[]
): ParsedOrderItem[] {
  if (!input) {
    return [];
  }

  if (Array.isArray(input)) {
    return input.map(normalizeRelationalOrderItem);
  }

  try {
    const parsed: unknown = JSON.parse(input);
    return Array.isArray(parsed)
      ? (parsed as ParsedOrderItem[]).map(normalizeOrderItem)
      : [];
  } catch (error) {
    console.error("Error parsing order items:", error);
    return [];
  }
}

/**
 * Reads the current Appwrite relationship shape and falls back to the removed
 * JSON column for already-materialized legacy records and migration fixtures.
 */
export function getOrderItems(order: OrderWithItems): ParsedOrderItem[] {
  if (Array.isArray(order.order_items)) {
    return parseOrderItems(order.order_items);
  }
  return parseOrderItems(order.items_json);
}
