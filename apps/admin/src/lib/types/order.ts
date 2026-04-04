export type OrderStatus =
  | "pending"
  | "authorized"
  | "paid"
  | "cancelled"
  | "failed"
  | "refunded";

export interface OrderItem {
  custom_field_responses?: Record<string, string>;
  custom_fields?: { id: string; label: string; value: string }[];
  product_id: string;
  product_slug?: string;
  quantity: number;
  title?: string;
  unit_price: number;
  variation_id?: string;
  variation_name?: string;
  variation_price?: number;
}
