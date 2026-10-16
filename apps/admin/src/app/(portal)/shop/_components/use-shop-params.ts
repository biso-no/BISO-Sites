"use client";

/**
 * Every URL write the shop studio makes, in one place.
 *
 * The studio renders two independent tables on one route, so the orders table
 * pages by `opage` rather than `page`. `setParams` resets a hardcoded `page`
 * unless told otherwise, which would leave a stale `opage=7` behind on every
 * orders filter change — dropping the user on page 7 of a freshly narrowed
 * result set, in practice an empty table. Every orders writer below therefore
 * passes `pageKey: "opage"` explicitly.
 */

import { useCallback, useMemo } from "react";
import { useListParams } from "../../_components/use-list-params";
import { ORDER_KEYS, type ShopTab } from "../shop-view-params";

/** The "no filter" sentinel the chips and the product dropdown render. It is a
 * UI value, never a URL value — an unset filter has no param at all. */
const ALL = "all";

const orderPage = { pageKey: ORDER_KEYS.pageKey } as const;

/** `""`/`"all"` become `null`, which `setParams` deletes. */
const orNull = (value: string) => (value && value !== ALL ? value : null);

export function useShopParams() {
  const { setParams } = useListParams();

  const setTab = useCallback(
    (tab: ShopTab) =>
      // A tab switch renarrows nothing, so neither table's offset is reset —
      // coming back to the catalog lands where the user left it.
      setParams({ tab: tab === "catalog" ? null : tab }, { keepPage: true }),
    [setParams]
  );

  const setCatalogStatus = useCallback(
    (status: string) => setParams({ status: orNull(status) }),
    [setParams]
  );

  const setOrderStatus = useCallback(
    (status: string) => setParams({ ostatus: orNull(status) }, orderPage),
    [setParams]
  );

  const setProduct = useCallback(
    (productId: string) => setParams({ product: orNull(productId) }, orderPage),
    [setParams]
  );

  const setDateFrom = useCallback(
    (from: string) => setParams({ from: from || null }, orderPage),
    [setParams]
  );

  const setDateTo = useCallback(
    (to: string) => setParams({ to: to || null }, orderPage),
    [setParams]
  );

  const clearOrderFilters = useCallback(
    () => setParams({ from: null, product: null, to: null }, orderPage),
    [setParams]
  );

  return useMemo(
    () => ({
      clearOrderFilters,
      setCatalogStatus,
      setDateFrom,
      setDateTo,
      setOrderStatus,
      setProduct,
      setTab,
    }),
    [
      clearOrderFilters,
      setCatalogStatus,
      setDateFrom,
      setDateTo,
      setOrderStatus,
      setProduct,
      setTab,
    ]
  );
}
