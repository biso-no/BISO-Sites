export interface ParsedOrderItem {
  category?: string | null;
  name?: string | null;
  price?: number | null;
  product_id?: string | null;
  product_type?: string | null;
  quantity?: number | null;
  title?: string | null;
  unit_price?: number | null;
  [key: string]: unknown;
}

export function parseOrderItems(itemsJson?: string | null): ParsedOrderItem[] {
  if (!itemsJson) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(itemsJson);
    return Array.isArray(parsed) ? (parsed as ParsedOrderItem[]) : [];
  } catch (error) {
    console.error("Error parsing order items:", error);
    return [];
  }
}
