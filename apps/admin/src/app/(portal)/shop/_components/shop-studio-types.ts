/**
 * Row shapes, filter unions and the tab payloads shared by the shop studio
 * shell and its tabs.
 */

import type {
  ContentTranslations,
  Orders,
  WebshopProducts,
} from "@repo/api/types/appwrite";
import type { OrderStats, ProductStats } from "../../_actions/shop";
import type { CatalogViewParams, OrdersViewParams } from "../shop-view-params";

export type ProductWithTranslations = WebshopProducts & {
  translation_refs: ContentTranslations[];
};

/**
 * Catalog status chips. These are the real `webshop_products.status` values
 * (plus the `all` sentinel) because the value goes straight into `?status=`
 * and from there into `Query.equal("status", …)` — a UI-only alias would have
 * to be translated back on the server for no gain.
 */
export type CatalogFilter =
  | "all"
  | "archived"
  | "draft"
  | "pending_approval"
  | "published";

export type OrderFilter =
  | "all"
  | "authorized"
  | "failed"
  | "paid"
  | "pending"
  | "refunded";

export interface CatalogTabData {
  /**
   * The newest draft in the whole scoped catalog, fetched independently of the
   * page slice — picking it from `rows` tied the hero to whichever products
   * happened to be on screen.
   */
  featuredDraft: ProductWithTranslations | null;
  params: CatalogViewParams;
  rows: ProductWithTranslations[];
  stats: ProductStats;
  total: number;
}

export interface OrdersTabData {
  params: OrdersViewParams;
  /** Catalog products the order list can be filtered by, keyed by id. */
  productOptions: { id: string; name: string }[];
  rows: Orders[];
  stats: OrderStats;
  total: number;
  /** The product filter could only resolve the first 500 matching orders. */
  truncated: boolean;
}

export interface ShopStudioDashboardProps {
  activeTab: "catalog" | "orders";
  /** Non-null exactly when `activeTab === "catalog"`. */
  catalog: CatalogTabData | null;
  /** Non-null exactly when `activeTab === "orders"` and `showOrders`. */
  orders: OrdersTabData | null;
  /** Order/customer operations are hidden from department product authors. */
  showOrders: boolean;
}

/**
 * Appwrite reports at most 5000 rows, so an order count that hit the cap is a
 * floor, not a total. Rendering the bare figure would state "5000 orders" as
 * fact when the truth is "at least 5000".
 */
export function formatCappedTotal(total: number, capped: boolean): string {
  return capped ? `${total}+` : String(total);
}

export function getProductTitle(
  product: ProductWithTranslations,
  locale: "no" | "en" = "no"
): string {
  return (
    product.translation_refs.find((t) => t.locale === locale)?.title ??
    product.translation_refs[0]?.title ??
    product.slug
  );
}
