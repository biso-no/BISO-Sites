"use client";

/**
 * One row of the orders tab's table: reference, buyer, items, total, status
 * and the payment provider's receipt link.
 */

import type { Orders } from "@repo/api/types/appwrite";
import { getOrderItems } from "@repo/shared/utils/order-parsing";
import { ExternalLink } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { OrderStatusPill } from "./shop-studio-pills";
import {
  BRAND,
  fmtDate,
  fmtNOK,
  MONO_STACK,
  normalizeLocale,
} from "./shop-studio-theme";

export function OrderRow({ order }: { order: Orders }) {
  const locale = normalizeLocale(useLocale());
  const t = useTranslations("adminPortal.shop.studio");
  const orderDetails = useTranslations("adminShop.orders.details");
  const items = getOrderItems(order);
  const firstItemName = items[0]?.name ?? items[0]?.product_name ?? "—";
  const extraCount = items.length > 1 ? items.length - 1 : 0;
  const showDiscount = order.discount_total != null && order.discount_total > 0;

  return (
    <div
      style={{
        alignItems: "center",
        borderTop: `0.5px solid ${BRAND.rule}`,
        color: BRAND.ink,
        display: "grid",
        gap: 12,
        gridTemplateColumns: "0.8fr 1.2fr 1fr 0.7fr 0.65fr 0.5fr",
        padding: "12px 14px",
      }}
    >
      {/* Col 1: id + date */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span
          style={{
            color: BRAND.ink3,
            fontFamily: MONO_STACK,
            fontSize: 11.5,
          }}
        >
          #{order.$id.slice(-8)}
        </span>
        <span style={{ color: BRAND.ink4, fontSize: 11 }}>
          {fmtDate(order.$createdAt, locale)}
        </span>
      </div>

      {/* Col 2: buyer */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          minWidth: 0,
        }}
      >
        <div style={{ alignItems: "center", display: "flex", gap: 6 }}>
          <span
            style={{
              color: BRAND.ink,
              fontSize: 13,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {order.buyer_name ?? "—"}
          </span>
          {order.membership_applied && (
            <span
              style={{
                background: "rgba(47,93,58,0.12)",
                borderRadius: 999,
                color: BRAND.leaf,
                fontSize: 10,
                padding: "1px 6px",
                whiteSpace: "nowrap",
              }}
            >
              {t("member")}
            </span>
          )}
        </div>
        <span
          style={{
            color: BRAND.ink3,
            fontSize: 11.5,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {order.buyer_email ?? "—"}
        </span>
      </div>

      {/* Col 3: items */}
      <div
        style={{ alignItems: "center", display: "flex", gap: 6, minWidth: 0 }}
      >
        <span
          style={{
            color: BRAND.ink2,
            fontSize: 12.5,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {firstItemName}
        </span>
        {extraCount > 0 && (
          <span
            style={{
              background: BRAND.paper3,
              borderRadius: 999,
              color: BRAND.ink3,
              flexShrink: 0,
              fontFamily: MONO_STACK,
              fontSize: 10.5,
              padding: "1px 6px",
            }}
          >
            +{extraCount}
          </span>
        )}
      </div>

      {/* Col 4: total */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span
          style={{
            color: BRAND.ink2,
            fontFamily: MONO_STACK,
            fontSize: 12.5,
            fontFeatureSettings: '"tnum" 1',
          }}
        >
          {fmtNOK(order.total)}
        </span>
        {showDiscount && (
          <span
            style={{
              color: BRAND.leaf,
              fontFamily: MONO_STACK,
              fontSize: 10.5,
            }}
          >
            −{fmtNOK(order.discount_total as number)}
          </span>
        )}
      </div>

      {/* Col 5: status */}
      <OrderStatusPill status={order.status} />

      {/* Col 6: receipt link */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        {order.payment_receipt_url ? (
          <a
            aria-label={orderDetails("openReceipt")}
            href={order.payment_receipt_url}
            rel="noopener noreferrer"
            style={{
              alignItems: "center",
              background: "rgba(255,255,255,.5)",
              border: `0.5px solid ${BRAND.rule2}`,
              borderRadius: 7,
              color: BRAND.ink3,
              display: "grid",
              height: 26,
              justifyItems: "center",
              width: 26,
            }}
            target="_blank"
          >
            <ExternalLink size={12} />
          </a>
        ) : null}
      </div>
    </div>
  );
}
