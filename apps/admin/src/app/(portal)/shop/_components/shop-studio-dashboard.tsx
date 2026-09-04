"use client";

/**
 * Shell for the shop studio. Owns the page chrome (title bar + tab strip) and
 * renders exactly one tab.
 *
 * Filter state lives in the URL rather than in `useState`: the tabs are server
 * paginated now, so a filter change has to reach the RSC that fetches the rows.
 * That also makes every view linkable, survivable across a reload, and
 * navigable with the browser's own Back button.
 */

import { Plus } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteProduct } from "../../_actions/shop";
import { useUrlSearch } from "../../_components/use-list-params";
import { CATALOG_KEYS, ORDER_KEYS, type ShopTab } from "../shop-view-params";
import { CatalogTab } from "./catalog-tab";
import { OrdersTab } from "./orders-tab";
import { BRAND, MONO_STACK, SERIF_STACK } from "./shop-studio-theme";
import {
  formatCappedTotal,
  type ShopStudioDashboardProps,
} from "./shop-studio-types";
import { useShopParams } from "./use-shop-params";

export function ShopStudioDashboard({
  activeTab,
  catalog,
  orders,
  showOrders,
}: ShopStudioDashboardProps) {
  const t = useTranslations("adminPortal.shop");
  const ts = useTranslations("adminPortal.shop.studio");
  const shop = useTranslations("adminShop");
  const {
    clearOrderFilters,
    setCatalogStatus,
    setDateFrom,
    setDateTo,
    setOrderStatus,
    setProduct,
    setTab,
  } = useShopParams();
  // Each tab searches through its own URL key, so a catalog search can never
  // reset the orders offset or vice versa.
  const [catalogSearch, setCatalogSearch] = useUrlSearch(CATALOG_KEYS.qKey);
  const [orderSearch, setOrderSearch] = useUrlSearch(ORDER_KEYS.qKey, 300, {
    pageKey: ORDER_KEYS.pageKey,
  });
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Only the active tab's data is fetched, so a badge is shown only for the
  // tab that has real numbers behind it — a stale count is worse than none.
  const catalogBadge = catalog ? String(catalog.stats.all) : null;
  const openOrderCount = orders
    ? orders.stats.pending + orders.stats.authorized
    : 0;
  const orderBadge = orders
    ? formatCappedTotal(orders.stats.all, orders.stats.capped)
    : null;

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteProduct(id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setPendingDeleteId(null);
      toast.success(t("deleteSuccess"));
    });
  }

  const tabs: { badge: string | null; key: ShopTab; label: string }[] =
    showOrders
      ? [
          { badge: catalogBadge, key: "catalog", label: ts("tabs.catalog") },
          {
            badge: openOrderCount > 0 ? String(openOrderCount) : orderBadge,
            key: "orders",
            label: shop("orders.title"),
          },
        ]
      : [{ badge: catalogBadge, key: "catalog", label: ts("tabs.catalog") }];

  return (
    <div
      style={{
        color: BRAND.ink,
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        padding: "28px 36px 56px",
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header
        style={{
          alignItems: "flex-end",
          borderBottom: `0.5px solid ${BRAND.rule}`,
          display: "flex",
          gap: 24,
          justifyContent: "space-between",
          paddingBottom: 22,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: SERIF_STACK,
              fontSize: 56,
              fontWeight: 400,
              letterSpacing: "-0.015em",
              lineHeight: 0.95,
              margin: 0,
            }}
          >
            {t("title")} /{" "}
            <em style={{ color: BRAND.claret, fontStyle: "italic" }}>
              {ts("titleAccent")}
            </em>
          </h1>
          <p
            style={{
              color: BRAND.ink3,
              fontSize: 14.5,
              margin: "8px 0 0",
            }}
          >
            {ts("description")}
          </p>
        </div>
        <Link
          href="/shop/new"
          style={{
            alignItems: "center",
            background: BRAND.ink,
            borderRadius: 999,
            boxShadow:
              "0 4px 20px rgba(26,24,20,.25), 0 1px 0 rgba(255,255,255,.1) inset",
            color: BRAND.paper,
            cursor: "pointer",
            display: "inline-flex",
            fontSize: 14,
            fontWeight: 500,
            gap: 10,
            letterSpacing: "-0.005em",
            padding: "12px 18px",
            textDecoration: "none",
          }}
        >
          <span
            style={{
              alignItems: "center",
              background: BRAND.paper,
              borderRadius: "50%",
              color: BRAND.ink,
              display: "grid",
              height: 22,
              justifyItems: "center",
              width: 22,
            }}
          >
            <Plus size={12} />
          </span>
          {t("create")}
        </Link>
      </header>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div
        style={{
          borderBottom: `0.5px solid ${BRAND.rule}`,
          display: "flex",
          gap: 0,
          margin: "20px 0 0",
        }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const hasBadge = tab.key === "orders" && openOrderCount > 0;
          return (
            <button
              key={tab.key}
              onClick={() => setTab(tab.key)}
              style={{
                alignItems: "center",
                background: "none",
                border: 0,
                borderBottom: isActive
                  ? `1.5px solid ${BRAND.ink}`
                  : "1.5px solid transparent",
                color: isActive ? BRAND.ink : BRAND.ink3,
                cursor: "pointer",
                display: "flex",
                fontSize: 13.5,
                fontWeight: isActive ? 500 : 400,
                gap: 8,
                marginBottom: -1,
                padding: "10px 16px",
              }}
              type="button"
            >
              {tab.label}
              {tab.badge !== null && (
                <span
                  style={{
                    background: hasBadge
                      ? "rgba(107,30,30,0.10)"
                      : BRAND.paper2,
                    border: `0.5px solid ${hasBadge ? "rgba(107,30,30,0.2)" : BRAND.rule2}`,
                    borderRadius: 999,
                    color: hasBadge ? BRAND.claret : BRAND.ink4,
                    fontFamily: MONO_STACK,
                    fontSize: 10.5,
                    padding: "1px 7px",
                  }}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {catalog && (
        <CatalogTab
          data={catalog}
          onCancelDelete={() => setPendingDeleteId(null)}
          onCatalogFilterChange={setCatalogStatus}
          onDelete={handleDelete}
          onRequestDelete={setPendingDeleteId}
          onSearchChange={setCatalogSearch}
          pendingDeleteId={pendingDeleteId}
          searchQuery={catalogSearch}
        />
      )}

      {orders && (
        <OrdersTab
          data={orders}
          onClearFilters={clearOrderFilters}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          onOrderFilterChange={setOrderStatus}
          onProductFilterChange={setProduct}
          onSearchChange={setOrderSearch}
          searchQuery={orderSearch}
        />
      )}

      {/* ── Pending deletion overlay hint ───────────────────────────────────── */}
      {isPending && (
        <div
          aria-live="polite"
          style={{
            bottom: 24,
            color: BRAND.ink3,
            fontFamily: MONO_STACK,
            fontSize: 11.5,
            position: "fixed",
            right: 24,
          }}
        >
          {ts("deleting")}
        </div>
      )}
    </div>
  );
}
