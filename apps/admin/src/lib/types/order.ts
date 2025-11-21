import type { Models } from "@repo/api";

export type OrderStatus =
  | "pending"
  | "authorized"
  | "paid"
  | "cancelled"
  | "failed"
  | "refunded";

export type OrderItem = {
  product_id: string;
  product_slug?: string;
  title?: string;
  unit_price: number;
  quantity: number;
  variation_id?: string;
  variation_name?: string;
  variation_price?: number;
  custom_field_responses?: Record<string, string>;
  custom_fields?: { id: string; label: string; value: string }[];
};

export interface Order extends Models.Row {
  status: OrderStatus;
  userId?: string;
  buyer_name?: string;
  buyer_email?: string;
  buyer_phone?: string;
  currency: "NOK";
  subtotal: number;
  discount_total?: number;
  total: number;
  items?: OrderItem[];
  items_json?: string;
  campus_id?: string;
  membership_applied?: boolean;
  member_discount_percent?: number;
  vipps_session_id?: string;
  vipps_order_id?: string;
  vipps_payment_link?: string;
  vipps_receipt_url?: string;
}
