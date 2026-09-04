"use client";

/**
 * Small inline status indicators used inside the studio's table rows:
 * stock meter, product status, order status, and free-form tags.
 */

import { useTranslations } from "next-intl";
import { BRAND, MONO_STACK } from "./shop-studio-theme";

export function StockBar({
  inventoryMode,
  stock,
}: {
  inventoryMode: string | null;
  stock: number | null;
}) {
  const t = useTranslations("adminPortal.shop.studio");
  if (inventoryMode === "unlimited" || stock === null) {
    return (
      <span
        style={{
          color: BRAND.ink4,
          fontFamily: MONO_STACK,
          fontSize: 11.5,
        }}
      >
        {t("stock.unlimited")}
      </span>
    );
  }

  let fillColor: string;
  let numColor: string;
  if (stock < 5) {
    fillColor = BRAND.claret;
    numColor = BRAND.claret;
  } else if (stock < 20) {
    fillColor = BRAND.gold;
    numColor = BRAND.gold;
  } else {
    fillColor = BRAND.leaf;
    numColor = BRAND.ink2;
  }
  const ratio = Math.min(Math.max(stock / 100, 0), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span
        style={{
          color: numColor,
          fontFamily: MONO_STACK,
          fontSize: 12,
          fontFeatureSettings: '"tnum" 1',
        }}
      >
        {stock}
      </span>
      <div
        style={{
          background: BRAND.rule2,
          borderRadius: 999,
          height: 3,
          overflow: "hidden",
          width: 80,
        }}
      >
        <span
          style={{
            background: fillColor,
            borderRadius: 999,
            display: "block",
            height: "100%",
            width: `${ratio * 100}%`,
          }}
        />
      </div>
    </div>
  );
}

export function ProductStatusPill({ status }: { status: string }) {
  const statusLabels = useTranslations("adminPortal.common.status");
  let bg: string;
  let color: string;
  let dotColor: string;
  let label: string;
  let pulse = false;

  switch (status) {
    case "published":
      bg = "rgba(47,93,58,0.12)";
      color = BRAND.leaf;
      dotColor = BRAND.leaf;
      label = statusLabels("published");
      pulse = true;
      break;
    case "pending_approval":
      bg = "rgba(42,74,122,0.12)";
      color = BRAND.sky;
      dotColor = BRAND.sky;
      label = statusLabels("pending_approval");
      break;
    case "archived":
      bg = BRAND.paper3;
      color = BRAND.ink4;
      dotColor = BRAND.ink4;
      label = statusLabels("archived");
      break;
    default:
      // draft
      bg = "rgba(176,138,62,0.12)";
      color = "#6a5118";
      dotColor = BRAND.gold;
      label = statusLabels("draft");
  }

  return (
    <span
      style={{
        alignItems: "center",
        background: bg,
        borderRadius: 999,
        color,
        display: "inline-flex",
        fontSize: 11.5,
        gap: 6,
        padding: "3px 10px",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={
          pulse
            ? {
                animation: "shopPulseDot 1.5s ease-in-out infinite",
                background: dotColor,
                borderRadius: "50%",
                height: 6,
                width: 6,
              }
            : {
                background: dotColor,
                borderRadius: "50%",
                height: 6,
                width: 6,
              }
        }
      />
      {label}
      {pulse && (
        <style>{`
          @keyframes shopPulseDot {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}</style>
      )}
    </span>
  );
}

export function OrderStatusPill({ status }: { status: string | null }) {
  const t = useTranslations("adminShop.orders.status");
  const s = status ?? "pending";
  let color: string;
  let bg: string;
  let label: string;

  switch (s) {
    case "paid":
      color = BRAND.leaf;
      bg = "rgba(47,93,58,0.12)";
      label = t("paid");
      break;
    case "authorized":
      color = BRAND.sky;
      bg = "rgba(42,74,122,0.12)";
      label = t("authorized");
      break;
    case "pending":
      color = "#6a5118";
      bg = "rgba(176,138,62,0.12)";
      label = t("pending");
      break;
    case "cancelled":
      color = BRAND.claret;
      bg = "rgba(107,30,30,0.12)";
      label = t("cancelled");
      break;
    case "failed":
      color = BRAND.claret;
      bg = "rgba(107,30,30,0.12)";
      label = t("failed");
      break;
    case "refunded":
      color = BRAND.claret;
      bg = "rgba(107,30,30,0.12)";
      label = t("refunded");
      break;
    default:
      color = BRAND.ink3;
      bg = BRAND.paper2;
      label = s;
  }

  return (
    <span
      style={{
        alignItems: "center",
        background: bg,
        borderRadius: 999,
        color,
        display: "inline-flex",
        fontSize: 11.5,
        gap: 6,
        padding: "3px 10px",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          background: color,
          borderRadius: "50%",
          height: 6,
          width: 6,
        }}
      />
      {label}
    </span>
  );
}

export function TagPill({ label }: { label: string }) {
  return (
    <span
      style={{
        background: BRAND.paper2,
        border: `0.5px solid ${BRAND.rule2}`,
        borderRadius: 999,
        color: BRAND.ink3,
        fontSize: 10.5,
        padding: "2px 8px",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}
