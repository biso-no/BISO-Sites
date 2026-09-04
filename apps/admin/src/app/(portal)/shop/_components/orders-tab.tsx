"use client";

/**
 * The shop studio's orders tab: KPI strip, status chips, search, the advanced
 * product/date filter bar with its CSV export, the order table and the
 * pagination bar.
 *
 * The rows are one server page — `listOrders` has already applied every filter
 * and the offset — so nothing here re-filters them. The tiles and chip counts
 * come from `countOrderStats` over the same filter set minus status.
 */

import { Download, Package } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { exportOrdersCsv } from "../../_actions/shop-export";
import { PaginationBar } from "../../_components/pagination-bar";
import { ORDER_KEYS } from "../shop-view-params";
import { OrderRow } from "./order-row";
import {
  ordersCsvFileName,
  runOrdersExport,
  saveCsvFile,
} from "./orders-export";
import {
  FilterChip,
  OrdersKpiStrip,
  ShopFilterRow,
} from "./shop-studio-chrome";
import { BRAND, SERIF_STACK } from "./shop-studio-theme";
import {
  formatCappedTotal,
  type OrderFilter,
  type OrdersTabData,
} from "./shop-studio-types";

const FILTER_CONTROL_STYLE = {
  background: "rgba(255,255,255,.85)",
  border: `0.5px solid ${BRAND.rule2}`,
  borderRadius: 8,
  fontSize: 12.5,
  height: 32,
  outline: "none",
} as const;

export function OrdersTab({
  data,
  onClearFilters,
  onDateFromChange,
  onDateToChange,
  onOrderFilterChange,
  onProductFilterChange,
  onSearchChange,
  searchQuery,
}: {
  data: OrdersTabData;
  onClearFilters: () => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onOrderFilterChange: (filter: OrderFilter) => void;
  onProductFilterChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  searchQuery: string;
}) {
  const ts = useTranslations("adminPortal.shop.studio");
  const tc = useTranslations("adminPortal.common");
  const shop = useTranslations("adminShop");
  const [isExporting, setIsExporting] = useState(false);

  const { params, productOptions, rows, stats, total, truncated } = data;
  const dateFrom = params.from ?? "";
  const dateTo = params.to ?? "";
  const productFilter = params.productId ?? "all";
  const status = params.status ?? "all";
  const hasAdvancedFilters = Boolean(
    params.productId || params.from || params.to
  );
  const isFiltered =
    hasAdvancedFilters || Boolean(params.q) || status !== "all";

  const orderFilterTabs: {
    count: number | string;
    key: OrderFilter;
    label: string;
  }[] = [
    // The "all" tally shares the 5000-row cap with the KPI tile, so it gets
    // the same "5000+" treatment rather than asserting an exact figure.
    {
      count: formatCappedTotal(stats.all, stats.capped),
      key: "all",
      label: tc("all"),
    },
    { count: stats.paid, key: "paid", label: shop("orders.status.paid") },
    {
      count: stats.authorized,
      key: "authorized",
      label: shop("orders.status.authorized"),
    },
    {
      count: stats.pending,
      key: "pending",
      label: shop("orders.status.pending"),
    },
    { count: stats.failed, key: "failed", label: shop("orders.status.failed") },
    {
      count: stats.refunded,
      key: "refunded",
      label: shop("orders.status.refunded"),
    },
  ];

  async function handleExport() {
    setIsExporting(true);
    try {
      await runOrdersExport(
        { exportCsv: exportOrdersCsv, notify: toast, save: saveCsvFile },
        {
          filters: {
            from: params.from,
            productId: params.productId,
            q: params.q || undefined,
            status: status === "all" ? undefined : status,
            to: params.to,
          },
          headers: [
            ts("csv.orderId"),
            tc("date"),
            ts("csv.buyerName"),
            ts("csv.buyerEmail"),
            ts("csv.buyerPhone"),
            shop("orders.details.items"),
            shop("orders.details.subtotal"),
            shop("orders.details.discount"),
            shop("orders.details.total"),
            ts("csv.currency"),
            shop("orders.details.status"),
            ts("csv.paymentProvider"),
            ts("csv.memberDiscount"),
            ts("csv.receiptUrl"),
          ],
        },
        {
          empty: ts("export.empty"),
          failed: ts("export.failed"),
          success: (rowCount) => ts("export.success", { rows: rowCount }),
          truncated: (rowCount) => ts("export.truncated", { rows: rowCount }),
        },
        ordersCsvFileName()
      );
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <>
      <OrdersKpiStrip stats={stats} />

      <ShopFilterRow
        onSearchChange={onSearchChange}
        searchPlaceholder={shop("orders.search")}
        searchValue={searchQuery}
      >
        {orderFilterTabs.map((tab) => (
          <FilterChip
            active={status === tab.key}
            count={tab.count}
            key={tab.key}
            label={tab.label}
            onClick={() => onOrderFilterChange(tab.key)}
          />
        ))}
      </ShopFilterRow>

      <div
        style={{
          alignItems: "center",
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 16,
        }}
      >
        {/* Product filter — valued by catalog product id, which is what
            `listOrders` resolves order ids from. A line-item name would not
            survive a product rename and could not be queried exactly. */}
        <select
          onChange={(e) => onProductFilterChange(e.target.value)}
          style={{
            ...FILTER_CONTROL_STYLE,
            color: productFilter === "all" ? BRAND.ink3 : BRAND.ink,
            cursor: "pointer",
            padding: "0 28px 0 10px",
          }}
          value={productFilter}
        >
          <option value="all">{ts("filters.allProducts")}</option>
          {productOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>

        {/* Date from */}
        <input
          onChange={(e) => onDateFromChange(e.target.value)}
          style={{
            ...FILTER_CONTROL_STYLE,
            color: dateFrom ? BRAND.ink : BRAND.ink3,
            padding: "0 10px",
          }}
          title={ts("filters.fromDate")}
          type="date"
          value={dateFrom}
        />

        <span style={{ color: BRAND.ink4, fontSize: 11.5 }}>→</span>

        {/* Date to */}
        <input
          onChange={(e) => onDateToChange(e.target.value)}
          style={{
            ...FILTER_CONTROL_STYLE,
            color: dateTo ? BRAND.ink : BRAND.ink3,
            padding: "0 10px",
          }}
          title={ts("filters.toDate")}
          type="date"
          value={dateTo}
        />

        {/* Clear filters link */}
        {hasAdvancedFilters && (
          <button
            onClick={onClearFilters}
            style={{
              background: "transparent",
              border: 0,
              color: BRAND.ink3,
              cursor: "pointer",
              fontSize: 12,
              padding: "0 4px",
              textDecoration: "underline",
            }}
            type="button"
          >
            {ts("filters.clear")}
          </button>
        )}

        <div style={{ flex: 1 }} />

        {/* Export CSV — the server builds the file over the FULL filtered set,
            not the visible page. */}
        <button
          disabled={isExporting}
          onClick={handleExport}
          style={{
            alignItems: "center",
            background: BRAND.paper2,
            border: `0.5px solid ${BRAND.rule2}`,
            borderRadius: 8,
            color: BRAND.ink2,
            cursor: isExporting ? "progress" : "pointer",
            display: "flex",
            fontSize: 12.5,
            fontWeight: 500,
            gap: 6,
            height: 32,
            opacity: isExporting ? 0.6 : 1,
            padding: "0 14px",
          }}
          type="button"
        >
          <Download size={13} />
          {isExporting ? ts("export.running") : shop("orders.export")}
        </button>
      </div>

      {truncated && (
        <p
          role="status"
          style={{
            background: "rgba(176,138,62,0.10)",
            border: `0.5px solid ${BRAND.gold}`,
            borderRadius: 10,
            color: BRAND.ink2,
            fontSize: 12.5,
            margin: "0 0 16px",
            padding: "10px 14px",
          }}
        >
          {ts("notice.truncatedOrders")}
        </p>
      )}

      <section style={{ display: "flex", flexDirection: "column" }}>
        {/* Header row */}
        <div
          style={{
            borderBottom: `0.5px solid ${BRAND.rule}`,
            color: BRAND.ink4,
            display: "grid",
            fontSize: 11,
            gap: 12,
            gridTemplateColumns: "0.8fr 1.2fr 1fr 0.7fr 0.65fr 0.5fr",
            letterSpacing: "0.05em",
            padding: "10px 14px",
            textTransform: "uppercase",
          }}
        >
          <div>{ts("table.refDate")}</div>
          <div>{shop("orders.details.buyer")}</div>
          <div>{shop("orders.details.items")}</div>
          <div>{shop("orders.details.total")}</div>
          <div>{shop("orders.details.status")}</div>
          <div />
        </div>

        {rows.length === 0 ? (
          <div
            style={{
              alignItems: "center",
              background: BRAND.paper2,
              border: `0.5px solid ${BRAND.rule}`,
              borderRadius: 12,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              margin: "16px 0",
              padding: "48px 32px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                alignItems: "center",
                background: BRAND.paper3,
                border: `0.5px solid ${BRAND.rule2}`,
                borderRadius: 16,
                color: BRAND.ink4,
                display: "grid",
                height: 56,
                justifyItems: "center",
                width: 56,
              }}
            >
              <Package size={22} />
            </div>
            <h2
              style={{
                color: BRAND.ink,
                fontFamily: SERIF_STACK,
                fontSize: 22,
                fontStyle: "italic",
                fontWeight: 400,
                margin: "8px 0 0",
              }}
            >
              {shop("messages.noOrders")}
            </h2>
            <p
              style={{
                color: BRAND.ink3,
                fontSize: 13,
                margin: 0,
                maxWidth: "44ch",
              }}
            >
              {isFiltered ? ts("empty.adjustOrderFilters") : ts("empty.orders")}
            </p>
          </div>
        ) : (
          <>
            {rows.map((order) => (
              <OrderRow key={order.$id} order={order} />
            ))}
            <div
              style={{
                borderBottom: `0.5px solid ${BRAND.rule}`,
                height: 0,
              }}
            />
          </>
        )}
      </section>

      <PaginationBar
        page={params.page}
        pageKey={ORDER_KEYS.pageKey}
        size={params.size}
        sizeKey={ORDER_KEYS.sizeKey}
        sizeSelectable
        total={total}
      />
    </>
  );
}
