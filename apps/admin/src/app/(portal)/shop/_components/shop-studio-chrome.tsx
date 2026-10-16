"use client";

/**
 * Chrome shared by both studio tabs: the KPI strip that sits above the table
 * and the filter row (status chips + search box) directly below it. Both tabs
 * render the same strip and the same row shell; only the chips inside the row
 * differ, so each tab supplies its own.
 */

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { OrderStats, ProductStats } from "../../_actions/shop";
import { BRAND, fmtNOK, MONO_STACK, SERIF_STACK } from "./shop-studio-theme";
import { formatCappedTotal } from "./shop-studio-types";

function KpiCard({
  alert,
  currency,
  label,
  note,
  value,
}: {
  alert?: boolean;
  currency?: string;
  label: string;
  /** Caveat under the figure — e.g. that a capped tally is a floor. */
  note?: string;
  value: number | string;
}) {
  const displayValue =
    currency === "NOK" && typeof value === "number"
      ? fmtNOK(value)
      : String(value);
  return (
    <div
      style={{
        borderRight: `0.5px solid ${BRAND.rule}`,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: "18px 22px",
        position: "relative",
      }}
    >
      <div
        style={{
          alignItems: "center",
          color: BRAND.ink3,
          display: "flex",
          fontSize: 11.5,
          gap: 6,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          color: alert ? BRAND.claret : BRAND.ink,
          fontFamily: SERIF_STACK,
          fontSize: 42,
          letterSpacing: "-0.02em",
          lineHeight: 1,
        }}
      >
        {displayValue}
      </div>
      {note && (
        <div
          style={{
            color: BRAND.ink3,
            fontFamily: MONO_STACK,
            fontSize: 11.5,
          }}
        >
          {note}
        </div>
      )}
    </div>
  );
}

/**
 * Catalog headline numbers. They come from `countProductStats` rather than
 * from the rendered rows: the table is paginated now, so counting what is on
 * screen would report one page's worth and change as the user paged.
 */
export function CatalogKpiStrip({ stats }: { stats: ProductStats }) {
  const t = useTranslations("adminPortal.shop");
  const ts = useTranslations("adminPortal.shop.studio");

  return (
    <KpiStripShell columns={3}>
      <KpiCard label={ts("kpi.liveProducts")} value={stats.published} />
      <KpiCard
        alert={stats.lowStock > 0}
        label={t("fields.lowStock")}
        value={stats.lowStock}
      />
      <KpiCard
        alert={stats.pending > 0}
        label={t("filters.pending")}
        value={stats.pending}
      />
    </KpiStripShell>
  );
}

/**
 * Order headline numbers for the current filter set, from `countOrderStats`.
 *
 * When `capped` is set the numbers describe only the newest 5000 matching
 * orders, so the total renders as "5000+" and the revenue tile carries a
 * caveat — stating either as an exact figure would be a lie.
 */
export function OrdersKpiStrip({ stats }: { stats: OrderStats }) {
  const shop = useTranslations("adminShop");
  const ts = useTranslations("adminPortal.shop.studio");

  return (
    <KpiStripShell columns={4}>
      <KpiCard
        label={ts("kpi.totalOrders")}
        note={stats.capped ? ts("notice.cappedTotal") : undefined}
        value={formatCappedTotal(stats.all, stats.capped)}
      />
      <KpiCard
        currency="NOK"
        label={ts("kpi.revenue")}
        note={stats.capped ? ts("notice.cappedRevenue") : undefined}
        value={stats.paidRevenue}
      />
      <KpiCard label={shop("orders.status.paid")} value={stats.paid} />
      <KpiCard
        alert={stats.pending > 0}
        label={shop("orders.status.pending")}
        value={stats.pending}
      />
    </KpiStripShell>
  );
}

function KpiStripShell({
  children,
  columns,
}: {
  children: ReactNode;
  columns: number;
}) {
  return (
    <section
      style={{
        background: "rgba(255,255,255,.45)",
        border: `0.5px solid ${BRAND.rule}`,
        borderRadius: 14,
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        margin: "22px 0 28px",
        overflow: "hidden",
      }}
    >
      {children}
    </section>
  );
}

// ─── FilterChip ───────────────────────────────────────────────────────────────

export function FilterChip({
  active,
  count,
  label,
  onClick,
}: {
  active: boolean;
  /** Pre-formatted, so a capped tally can read "5000+" rather than "5000". */
  count: number | string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        alignItems: "center",
        background: active ? "white" : "transparent",
        border: 0,
        borderRadius: 7,
        boxShadow: active ? "0 1px 2px rgba(0,0,0,.06)" : "none",
        color: active ? BRAND.ink : BRAND.ink3,
        cursor: "pointer",
        display: "flex",
        fontSize: 12.5,
        gap: 6,
        padding: "6px 12px",
      }}
      type="button"
    >
      {label}
      <span
        style={{
          color: active ? BRAND.ink3 : BRAND.ink4,
          fontFamily: MONO_STACK,
          fontSize: 10.5,
        }}
      >
        {count}
      </span>
    </button>
  );
}

// ─── ShopFilterRow ────────────────────────────────────────────────────────────

export function ShopFilterRow({
  children,
  onSearchChange,
  searchPlaceholder,
  searchValue,
}: {
  children: ReactNode;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  searchValue: string;
}) {
  return (
    <div
      style={{
        alignItems: "center",
        display: "flex",
        gap: 8,
        margin: "0 0 16px",
      }}
    >
      {/* Segmented control */}
      <div
        style={{
          alignItems: "center",
          background: BRAND.paper2,
          border: `0.5px solid ${BRAND.rule2}`,
          borderRadius: 10,
          display: "flex",
          padding: 3,
        }}
      >
        {children}
      </div>

      {/* Search */}
      <div style={{ flex: 1, position: "relative" }}>
        <Search
          size={14}
          style={{
            color: BRAND.ink4,
            left: 12,
            pointerEvents: "none",
            position: "absolute",
            top: "50%",
            transform: "translateY(-50%)",
          }}
        />
        <input
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          style={{
            background: "rgba(255,255,255,.85)",
            border: `0.5px solid ${BRAND.rule2}`,
            borderRadius: 8,
            color: BRAND.ink,
            fontSize: 12.5,
            height: 32,
            maxWidth: 320,
            outline: "none",
            padding: "0 12px 0 32px",
            width: "100%",
          }}
          type="search"
          value={searchValue}
        />
      </div>
    </div>
  );
}
