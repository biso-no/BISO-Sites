"use client";

/**
 * One row of the catalog tab's product table, including the inline
 * click-to-confirm delete affordance.
 */

import { resolveStorageFileUrl } from "@repo/api/storage";
import { Lock, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { CoverPatternThumbnail } from "./cover-pattern-thumbnail";
import { ProductStatusPill, StockBar, TagPill } from "./shop-studio-pills";
import {
  BRAND,
  fmtNOK,
  MONO_STACK,
  normalizeLocale,
  SERIF_STACK,
} from "./shop-studio-theme";
import {
  getProductTitle,
  type ProductWithTranslations,
} from "./shop-studio-types";

export function ProductRow({
  onCancelDelete,
  onDelete,
  onRequestDelete,
  pendingDeleteId,
  product,
}: {
  onCancelDelete: () => void;
  onDelete: (id: string) => void;
  onRequestDelete: (id: string) => void;
  pendingDeleteId: string | null;
  product: ProductWithTranslations;
}) {
  const t = useTranslations("adminPortal.shop");
  const ts = useTranslations("adminPortal.shop.studio");
  const locale = normalizeLocale(useLocale());
  const isConfirming = pendingDeleteId === product.$id;
  const title = getProductTitle(product, locale);
  const tags = product.tags ?? [];
  const visibleTags = tags.slice(0, 2);
  const showMemberPrice =
    product.member_price != null &&
    product.member_price > 0 &&
    product.member_price < product.regular_price;

  return (
    <div
      style={{
        alignItems: "center",
        borderTop: `0.5px solid ${BRAND.rule}`,
        color: BRAND.ink,
        display: "grid",
        gap: 12,
        gridTemplateColumns: "48px 1.6fr 0.6fr 0.7fr 0.8fr 0.65fr 0.7fr",
        padding: "12px 14px",
        position: "relative",
      }}
    >
      {/* Col 1: thumbnail */}
      <CoverPatternThumbnail
        image={resolveStorageFileUrl(product.image)}
        pattern={product.cover_pattern}
      />

      {/* Col 2: name + tags + member lock */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          minWidth: 0,
        }}
      >
        <div style={{ alignItems: "center", display: "flex", gap: 6 }}>
          <Link
            href={`/shop/${product.$id}`}
            style={{
              color: BRAND.ink,
              fontFamily: SERIF_STACK,
              fontSize: 15,
              fontWeight: 400,
              letterSpacing: "-0.005em",
              overflow: "hidden",
              textDecoration: "none",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {title}
          </Link>
          {product.member_only && (
            <span title={t("fields.memberOnly")}>
              <Lock size={12} style={{ color: BRAND.gold, flexShrink: 0 }} />
            </span>
          )}
        </div>
        {visibleTags.length > 0 && (
          <div style={{ alignItems: "center", display: "flex", gap: 4 }}>
            {visibleTags.map((tag) => (
              <TagPill key={tag} label={tag} />
            ))}
            {tags.length > 2 && (
              <span
                style={{
                  color: BRAND.ink4,
                  fontFamily: MONO_STACK,
                  fontSize: 10.5,
                }}
              >
                +{tags.length - 2}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Col 3: category crest */}
      <div
        style={{
          alignItems: "center",
          background: BRAND.paper3,
          borderRadius: "50%",
          color: BRAND.ink3,
          display: "flex",
          fontFamily: MONO_STACK,
          fontSize: 11,
          height: 26,
          justifyContent: "center",
          width: 26,
        }}
        title={product.category ?? "—"}
      >
        {product.category ? product.category.charAt(0).toUpperCase() : "—"}
      </div>

      {/* Col 4: status */}
      <ProductStatusPill status={product.status} />

      {/* Col 5: price */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span
          style={{
            color: BRAND.ink2,
            fontFamily: MONO_STACK,
            fontSize: 12.5,
            fontFeatureSettings: '"tnum" 1',
          }}
        >
          {fmtNOK(product.regular_price)}
        </span>
        {showMemberPrice && (
          <span
            style={{
              color: BRAND.leaf,
              fontFamily: MONO_STACK,
              fontSize: 10.5,
            }}
          >
            {fmtNOK(product.member_price as number)}{" "}
            <span style={{ color: BRAND.ink4 }}>{ts("member")}</span>
          </span>
        )}
      </div>

      {/* Col 6: stock */}
      <StockBar inventoryMode={product.inventory_mode} stock={product.stock} />

      {/* Col 7: actions */}
      <div
        style={{
          alignItems: "center",
          display: "flex",
          gap: 6,
          justifyContent: "flex-end",
        }}
      >
        <Link
          aria-label={t("actions.edit")}
          href={`/shop/${product.$id}`}
          style={{
            alignItems: "center",
            background: "rgba(255,255,255,.7)",
            border: `0.5px solid ${BRAND.rule2}`,
            borderRadius: 7,
            color: BRAND.ink2,
            cursor: "pointer",
            display: "grid",
            height: 28,
            justifyItems: "center",
            width: 28,
          }}
        >
          <Pencil size={13} />
        </Link>
        <button
          aria-label={isConfirming ? ts("confirmDelete") : t("actions.delete")}
          onBlur={onCancelDelete}
          onClick={() => {
            if (isConfirming) {
              onDelete(product.$id);
            } else {
              onRequestDelete(product.$id);
            }
          }}
          style={{
            alignItems: "center",
            background: isConfirming
              ? "rgba(107,30,30,.18)"
              : "rgba(107,30,30,.06)",
            border: "0.5px solid rgba(107,30,30,.2)",
            borderRadius: 7,
            color: isConfirming ? BRAND.claret : BRAND.claret,
            cursor: "pointer",
            display: "grid",
            fontSize: isConfirming ? 10 : 12,
            height: 28,
            justifyItems: "center",
            width: isConfirming ? 54 : 28,
          }}
          title={isConfirming ? ts("confirmDelete") : t("actions.delete")}
          type="button"
        >
          {isConfirming ? ts("confirm") : <Trash2 size={13} />}
        </button>
      </div>
    </div>
  );
}
