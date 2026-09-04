"use client";

/**
 * The shop studio's catalog tab: KPI strip, featured-draft hero, status chips,
 * search, the product table with its inline delete confirmation, and the
 * pagination bar.
 *
 * The rows are one server page — `listProducts` has already applied the status
 * filter, the search and the offset — so nothing here re-filters them. The
 * tiles and the chip counts come from `countProductStats`, which counts the
 * whole scoped set rather than the visible page.
 */

import { Plus, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { PaginationBar } from "../../_components/pagination-bar";
import { CATALOG_KEYS } from "../shop-view-params";
import { FeaturedDraftCard } from "./featured-draft-card";
import { ProductRow } from "./product-row";
import {
  CatalogKpiStrip,
  FilterChip,
  ShopFilterRow,
} from "./shop-studio-chrome";
import { BRAND, SERIF_STACK } from "./shop-studio-theme";
import type { CatalogFilter, CatalogTabData } from "./shop-studio-types";

export function CatalogTab({
  data,
  onCancelDelete,
  onCatalogFilterChange,
  onDelete,
  onRequestDelete,
  onSearchChange,
  pendingDeleteId,
  searchQuery,
}: {
  data: CatalogTabData;
  onCancelDelete: () => void;
  onCatalogFilterChange: (filter: CatalogFilter) => void;
  onDelete: (id: string) => void;
  onRequestDelete: (id: string) => void;
  onSearchChange: (value: string) => void;
  pendingDeleteId: string | null;
  searchQuery: string;
}) {
  const t = useTranslations("adminPortal.shop");
  const ts = useTranslations("adminPortal.shop.studio");
  const tc = useTranslations("adminPortal.common");
  const shop = useTranslations("adminShop");

  const { params, rows, stats, total } = data;
  const isFiltered = Boolean(params.q) || params.status !== "all";

  const catalogFilterTabs: {
    count: number;
    key: CatalogFilter;
    label: string;
  }[] = [
    { count: stats.all, key: "all", label: t("filters.all") },
    { count: stats.published, key: "published", label: t("filters.published") },
    { count: stats.drafts, key: "draft", label: t("filters.draft") },
    {
      count: stats.pending,
      key: "pending_approval",
      label: t("filters.pending"),
    },
    { count: stats.archived, key: "archived", label: t("filters.archived") },
  ];

  return (
    <>
      <CatalogKpiStrip stats={stats} />

      <FeaturedDraftCard products={rows} />

      <ShopFilterRow
        onSearchChange={onSearchChange}
        searchPlaceholder={shop("products.search")}
        searchValue={searchQuery}
      >
        {catalogFilterTabs.map((tab) => (
          <FilterChip
            active={params.status === tab.key}
            count={tab.count}
            key={tab.key}
            label={tab.label}
            onClick={() => onCatalogFilterChange(tab.key)}
          />
        ))}
      </ShopFilterRow>

      <section style={{ display: "flex", flexDirection: "column" }}>
        {/* Header row */}
        <div
          style={{
            borderBottom: `0.5px solid ${BRAND.rule}`,
            color: BRAND.ink4,
            display: "grid",
            fontSize: 11,
            gap: 12,
            gridTemplateColumns: "48px 1.6fr 0.6fr 0.7fr 0.8fr 0.65fr 0.7fr",
            letterSpacing: "0.05em",
            padding: "10px 14px",
            textTransform: "uppercase",
          }}
        >
          <div />
          <div>{shop("products.table.product")}</div>
          <div>{tc("category")}</div>
          <div>{t("fields.status")}</div>
          <div>{tc("price")}</div>
          <div>{tc("stock")}</div>
          <div style={{ textAlign: "right" }}>{tc("actions")}</div>
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
              <ShoppingBag size={22} />
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
              {shop("messages.noProducts")}
            </h2>
            <p
              style={{
                color: BRAND.ink3,
                fontSize: 13,
                margin: 0,
                maxWidth: "44ch",
              }}
            >
              {isFiltered
                ? ts("empty.adjustProductFilters")
                : t("emptyDescription")}
            </p>
            {!isFiltered && (
              <Link
                href="/shop/new"
                style={{
                  alignItems: "center",
                  background: BRAND.ink,
                  borderRadius: 999,
                  color: BRAND.paper,
                  display: "inline-flex",
                  fontSize: 13,
                  gap: 8,
                  marginTop: 12,
                  padding: "10px 16px",
                  textDecoration: "none",
                }}
              >
                <Plus size={13} />
                {t("create")}
              </Link>
            )}
          </div>
        ) : (
          <>
            {rows.map((product) => (
              <ProductRow
                key={product.$id}
                onCancelDelete={onCancelDelete}
                onDelete={onDelete}
                onRequestDelete={onRequestDelete}
                pendingDeleteId={pendingDeleteId}
                product={product}
              />
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
        pageKey={CATALOG_KEYS.pageKey}
        size={params.size}
        sizeKey={CATALOG_KEYS.sizeKey}
        sizeSelectable
        total={total}
      />
    </>
  );
}
