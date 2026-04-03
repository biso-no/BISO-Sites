import type { Models } from "@repo/api";

type OrderStatus =
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
  status: OrderStatus;
  subtotal: number;
  total: number;
  userId?: string;
  vipps_order_id?: string;
  vipps_payment_link?: string;
  vipps_receipt_url?: string;
  vipps_session_id?: string;
}
