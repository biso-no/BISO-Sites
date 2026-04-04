import type { Models } from "@repo/api";

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

interface Order extends Models.Row {
  buyer_email?: string;
  buyer_name?: string;
  buyer_phone?: string;
  campus_id?: string;
  currency: "NOK";
  discount_total?: number;
  items?: OrderItem[];
  items_json?: string;
  member_discount_percent?: number;
  membership_applied?: boolean;
  payment_intent_id?: string;
  payment_link?: string;
  payment_provider?: string;
  payment_receipt_url?: string;
  payment_session_id?: string;
  status: OrderStatus;
  subtotal: number;
  total: number;
  userId?: string;
}
