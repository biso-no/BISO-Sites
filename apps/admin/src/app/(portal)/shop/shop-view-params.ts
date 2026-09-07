/**
 * URL -> params resolution for the shop studio.
 *
 * Pure and free of `@repo/api` value imports, so the RSC page and the tests can
 * share it. The studio renders two independent tables on one route, so each
 * tab owns its own key namespace — catalog pages by `page`/`size`/`q`, orders
 * by `opage`/`osize`/`oq`. Sharing a key would make a catalog search reset the
 * orders offset and vice versa.
 */

import {
  firstParam,
  type ListParams,
  type ListSearchParams,
  parseListParams,
} from "@/lib/list-params";
import type { OrderFilters } from "../_actions/shop";

export type ShopTab = "catalog" | "orders";

/** Search-param keys the catalog table pages and searches by. */
export const CATALOG_KEYS = {
  pageKey: "page",
  qKey: "q",
  sizeKey: "size",
} as const;

/** Search-param keys the orders table pages and searches by. */
export const ORDER_KEYS = {
  pageKey: "opage",
  qKey: "oq",
  sizeKey: "osize",
} as const;

export type CatalogViewParams = ListParams & { status: string };
export type OrdersViewParams = ListParams & OrderFilters;

/** The "no filter" sentinel the chips and the product dropdown render. */
const ALL = "all";

/**
 * Which table to fetch. Order operations are hidden from department product
 * authors, so a hand-typed `?tab=orders` from one of them must resolve to the
 * catalog — the page then never asks Appwrite for order data at all.
 */
export function resolveShopTab(
  searchParams: ListSearchParams,
  showOrders: boolean
): ShopTab {
  return firstParam(searchParams, "tab") === "orders" && showOrders
    ? "orders"
    : "catalog";
}

export function resolveCatalogParams(
  searchParams: ListSearchParams
): CatalogViewParams {
  return {
    ...parseListParams(searchParams, CATALOG_KEYS),
    status: firstParam(searchParams, "status") || ALL,
  };
}

export function resolveOrderParams(
  searchParams: ListSearchParams
): OrdersViewParams {
  const product = firstParam(searchParams, "product");
  return {
    ...parseListParams(searchParams, ORDER_KEYS),
    from: firstParam(searchParams, "from") || undefined,
    productId: product && product !== ALL ? product : undefined,
    status: firstParam(searchParams, "ostatus") || ALL,
    to: firstParam(searchParams, "to") || undefined,
  };
}

/**
 * The filter set the KPI/chip counts are taken over: everything the list is
 * narrowed by EXCEPT status, because the per-status tallies are exactly what
 * the chips render — filtering by one would collapse them all to a single
 * number.
 */
export function toOrderStatsFilters(params: OrdersViewParams): OrderFilters {
  return {
    from: params.from,
    productId: params.productId,
    q: params.q || undefined,
    status: undefined,
    to: params.to,
  };
}
