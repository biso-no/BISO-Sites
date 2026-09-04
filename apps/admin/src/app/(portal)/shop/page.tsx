import { requireNavAccess } from "@/lib/authorization";
import type { ListSearchParams } from "@/lib/list-params";
import { canViewShopOperations } from "@/lib/roles";
import {
  countOrderStats,
  countProductStats,
  listOrderProductOptions,
  listOrders,
  listProducts,
} from "../_actions/shop";
import { ShopStudioDashboard } from "./_components/shop-studio-dashboard";
import {
  resolveCatalogParams,
  resolveOrderParams,
  resolveShopTab,
  toOrderStatsFilters,
} from "./shop-view-params";

/**
 * Data owner for the shop studio. Both tables are server paginated, so every
 * filter arrives as a search param and only the ACTIVE tab's data is fetched —
 * `countOrderStats` alone reads up to 5000 projected rows, which is not
 * something to pay for on a catalog page view.
 */
export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<ListSearchParams>;
}) {
  const ctx = await requireNavAccess("portal.shop");
  // Department product authors manage their catalog only — order data is a
  // commerce operation and is neither loaded nor rendered for them, including
  // when one of them hand-types `?tab=orders`.
  const showOrders = canViewShopOperations(ctx.roles);
  const sp = await searchParams;
  const activeTab = resolveShopTab(sp, showOrders);

  if (activeTab === "orders") {
    const params = resolveOrderParams(sp);
    const [orders, stats, productOptions] = await Promise.all([
      listOrders(params),
      // Status is deliberately omitted: the per-status tallies are what the
      // chips render, so filtering by one would collapse them.
      countOrderStats(toOrderStatsFilters(params)),
      listOrderProductOptions(),
    ]);

    return (
      <ShopStudioDashboard
        activeTab="orders"
        catalog={null}
        orders={{
          params,
          productOptions,
          rows: orders.rows,
          stats,
          total: orders.total,
          truncated: orders.truncated ?? false,
        }}
        showOrders={showOrders}
      />
    );
  }

  const params = resolveCatalogParams(sp);
  const [products, stats] = await Promise.all([
    listProducts(params),
    countProductStats({ q: params.q || undefined }),
  ]);

  return (
    <ShopStudioDashboard
      activeTab="catalog"
      catalog={{
        params,
        rows: products.rows,
        stats,
        total: products.total,
      }}
      orders={null}
      showOrders={showOrders}
    />
  );
}
