"use client";

import type {
  ContentTranslations,
  Orders,
  WebshopProducts,
} from "@repo/api/types/appwrite";
import {
  ChevronRight,
  Download,
  ExternalLink,
  Lock,
  Package,
  Pencil,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteProduct } from "../../_actions/shop";

type ProductWithTranslations = WebshopProducts & {
  translation_refs: ContentTranslations[];
};

interface ShopStudioDashboardProps {
  initialOrders: Orders[];
  initialProducts: ProductWithTranslations[];
}

type CatalogFilter = "all" | "published" | "drafts" | "pending" | "archived";
type OrderFilter =
  | "all"
  | "paid"
  | "authorized"
  | "pending"
  | "failed"
  | "refunded";

const BRAND = {
  claret: "#6b1e1e",
  gold: "#b08a3e",
  ink: "#1a1814",
  ink2: "#3a342a",
  ink3: "#6b6357",
  ink4: "#9c9385",
  leaf: "#2f5d3a",
  paper: "#faf7f2",
  paper2: "#f3eee5",
  paper3: "#ede6d8",
  rule: "#e5dcca",
  rule2: "#d8cdb6",
  sky: "#2a4a7a",
} as const;

const SERIF_STACK =
  '"Cormorant Garamond", "EB Garamond", "Times New Roman", Georgia, serif';
const MONO_STACK =
  '"IBM Plex Mono", "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

const NOK_FORMATTER = new Intl.NumberFormat("nb-NO", {
  currency: "NOK",
  maximumFractionDigits: 0,
  style: "currency",
});

const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
});

function fmtNOK(amount: number): string {
  return NOK_FORMATTER.format(amount);
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return "—";
  }
  return DATE_FORMATTER.format(d);
}

function getProductTitle(
  product: ProductWithTranslations,
  locale: "no" | "en" = "no"
): string {
  return (
    product.translation_refs.find((t) => t.locale === locale)?.title ??
    product.translation_refs[0]?.title ??
    product.slug
  );
}

// ─── KpiCard ─────────────────────────────────────────────────────────────────

function KpiCard({
  alert,
  currency,
  delta,
  label,
  value,
}: {
  alert?: boolean;
  currency?: string;
  delta?: string;
  label: string;
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
      {delta && (
        <div
          style={{
            color: alert ? BRAND.claret : BRAND.leaf,
            fontFamily: MONO_STACK,
            fontSize: 11.5,
          }}
        >
          {delta}
        </div>
      )}
    </div>
  );
}

// ─── CoverPatternThumbnail ────────────────────────────────────────────────────

const PATTERN_GRADIENTS: Record<string, string> = {
  dotted: "linear-gradient(135deg, #6b1e1e 0%, #2a1010 100%)",
  linear: "linear-gradient(135deg, #2a4a7a 0%, #15263c 100%)",
  concentric: "linear-gradient(135deg, #2f5d3a 0%, #1a3422 100%)",
  wave: "linear-gradient(135deg, #b08a3e 0%, #6a5118 100%)",
  grid: "linear-gradient(180deg, #29261b 0%, #100e09 100%)",
};

function PatternSvg({ pattern }: { pattern: string }) {
  if (pattern === "dotted") {
    return (
      <svg
        aria-hidden="true"
        style={{
          bottom: 0,
          left: 0,
          opacity: 0.3,
          position: "absolute",
          right: 0,
          top: 0,
          height: "100%",
          width: "100%",
        }}
      >
        <defs>
          <pattern
            height="10"
            id="shop-dash-dots"
            patternUnits="userSpaceOnUse"
            width="10"
          >
            <circle cx="2" cy="2" fill="white" r="1" />
          </pattern>
        </defs>
        <rect fill="url(#shop-dash-dots)" height="100%" width="100%" />
      </svg>
    );
  }
  if (pattern === "linear") {
    return (
      <svg
        aria-hidden="true"
        style={{
          bottom: 0,
          left: 0,
          opacity: 0.3,
          position: "absolute",
          right: 0,
          top: 0,
          height: "100%",
          width: "100%",
        }}
      >
        <defs>
          <pattern
            height="8"
            id="shop-dash-linear"
            patternUnits="userSpaceOnUse"
            width="8"
          >
            <path
              d="M0 8L8 0"
              stroke="white"
              strokeLinecap="round"
              strokeWidth="0.8"
            />
          </pattern>
        </defs>
        <rect fill="url(#shop-dash-linear)" height="100%" width="100%" />
      </svg>
    );
  }
  if (pattern === "concentric") {
    return (
      <svg
        aria-hidden="true"
        style={{
          bottom: 0,
          left: 0,
          opacity: 0.3,
          position: "absolute",
          right: 0,
          top: 0,
          height: "100%",
          width: "100%",
        }}
        viewBox="0 0 48 56"
      >
        <circle
          cx="24"
          cy="28"
          fill="none"
          r="8"
          stroke="white"
          strokeWidth="0.8"
        />
        <circle
          cx="24"
          cy="28"
          fill="none"
          r="16"
          stroke="white"
          strokeWidth="0.8"
        />
        <circle
          cx="24"
          cy="28"
          fill="none"
          r="24"
          stroke="white"
          strokeWidth="0.8"
        />
      </svg>
    );
  }
  if (pattern === "wave") {
    return (
      <svg
        aria-hidden="true"
        style={{
          bottom: 0,
          left: 0,
          opacity: 0.3,
          position: "absolute",
          right: 0,
          top: 0,
          height: "100%",
          width: "100%",
        }}
        viewBox="0 0 48 56"
      >
        <path
          d="M0 14 C12 8, 24 20, 36 14 S48 8, 60 14"
          fill="none"
          stroke="white"
          strokeWidth="0.8"
        />
        <path
          d="M0 28 C12 22, 24 34, 36 28 S48 22, 60 28"
          fill="none"
          stroke="white"
          strokeWidth="0.8"
        />
        <path
          d="M0 42 C12 36, 24 48, 36 42 S48 36, 60 42"
          fill="none"
          stroke="white"
          strokeWidth="0.8"
        />
      </svg>
    );
  }
  // grid
  return (
    <svg
      aria-hidden="true"
      style={{
        bottom: 0,
        left: 0,
        opacity: 0.3,
        position: "absolute",
        right: 0,
        top: 0,
        height: "100%",
        width: "100%",
      }}
    >
      <defs>
        <pattern
          height="10"
          id="shop-dash-grid"
          patternUnits="userSpaceOnUse"
          width="10"
        >
          <path
            d="M10 0L0 0L0 10"
            fill="none"
            stroke="white"
            strokeWidth="0.5"
          />
        </pattern>
      </defs>
      <rect fill="url(#shop-dash-grid)" height="100%" width="100%" />
    </svg>
  );
}

function CoverPatternThumbnail({
  image,
  pattern,
  size,
}: {
  image?: string | null;
  pattern?: string | null;
  size?: number;
}) {
  const w = size ?? 48;
  const h = size ?? 56;
  const pat = pattern ?? "dotted";
  const gradient = PATTERN_GRADIENTS[pat] ?? PATTERN_GRADIENTS.dotted;

  if (image) {
    return (
      <div
        style={{
          borderRadius: 8,
          flexShrink: 0,
          height: h,
          overflow: "hidden",
          width: w,
        }}
      >
        <img
          alt=""
          height={h}
          src={image}
          style={{ height: "100%", objectFit: "cover", width: "100%" }}
          width={w}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        background: gradient,
        borderRadius: 8,
        flexShrink: 0,
        height: h,
        overflow: "hidden",
        position: "relative",
        width: w,
      }}
    >
      <PatternSvg pattern={pat} />
    </div>
  );
}

// ─── StockBar ─────────────────────────────────────────────────────────────────

function StockBar({
  inventoryMode,
  stock,
}: {
  inventoryMode: string | null;
  stock: number | null;
}) {
  if (inventoryMode === "unlimited" || stock === null) {
    return (
      <span
        style={{
          color: BRAND.ink4,
          fontFamily: MONO_STACK,
          fontSize: 11.5,
        }}
      >
        Unlimited
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

// ─── ProductStatusPill ────────────────────────────────────────────────────────

function ProductStatusPill({ status }: { status: string }) {
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
      label = "Published";
      pulse = true;
      break;
    case "pending_approval":
      bg = "rgba(42,74,122,0.12)";
      color = BRAND.sky;
      dotColor = BRAND.sky;
      label = "Pending";
      break;
    case "archived":
      bg = BRAND.paper3;
      color = BRAND.ink4;
      dotColor = BRAND.ink4;
      label = "Archived";
      break;
    default:
      // draft
      bg = "rgba(176,138,62,0.12)";
      color = "#6a5118";
      dotColor = BRAND.gold;
      label = "Draft";
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

// ─── OrderStatusPill ──────────────────────────────────────────────────────────

function OrderStatusPill({ status }: { status: string | null }) {
  const s = status ?? "pending";
  let color: string;
  let bg: string;
  let label: string;

  switch (s) {
    case "paid":
      color = BRAND.leaf;
      bg = "rgba(47,93,58,0.12)";
      label = "Paid";
      break;
    case "authorized":
      color = BRAND.sky;
      bg = "rgba(42,74,122,0.12)";
      label = "Authorized";
      break;
    case "pending":
      color = "#6a5118";
      bg = "rgba(176,138,62,0.12)";
      label = "Pending";
      break;
    case "cancelled":
      color = BRAND.claret;
      bg = "rgba(107,30,30,0.12)";
      label = "Cancelled";
      break;
    case "failed":
      color = BRAND.claret;
      bg = "rgba(107,30,30,0.12)";
      label = "Failed";
      break;
    case "refunded":
      color = BRAND.claret;
      bg = "rgba(107,30,30,0.12)";
      label = "Refunded";
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

// ─── TagPill ──────────────────────────────────────────────────────────────────

function TagPill({ label }: { label: string }) {
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

// ─── FeaturedDraftCard ────────────────────────────────────────────────────────

function pickFeaturedDraft(
  products: ProductWithTranslations[]
): ProductWithTranslations | null {
  const drafts = products.filter((p) => p.status === "draft");
  if (drafts.length === 0) {
    return null;
  }
  return drafts.reduce((best, p) =>
    new Date(p.$updatedAt) > new Date(best.$updatedAt) ? p : best
  );
}

function FeaturedDraftCard({
  products,
}: {
  products: ProductWithTranslations[];
}) {
  const draft = useMemo(() => pickFeaturedDraft(products), [products]);
  if (!draft) {
    return null;
  }

  const title = getProductTitle(draft, "no");

  const noDesc =
    draft.translation_refs.find((t) => t.locale === "no")?.description ?? "";
  const checks = [
    Boolean(title && title !== draft.slug && draft.category),
    Boolean(noDesc && noDesc.length > 10),
    Boolean(draft.regular_price > 0),
    Boolean(draft.image),
    Boolean(draft.campus_id),
  ];
  const filledCount = checks.filter(Boolean).length;
  const percent = Math.round((filledCount / 5) * 100);

  const checklistItems = [
    { done: checks[0], label: "Title & category", now: !checks[0] },
    {
      done: checks[1],
      label: "Description (NO)",
      now: Boolean(checks[0]) && !checks[1],
    },
    {
      done: checks[2],
      label: "Price set",
      now: Boolean(checks[0] && checks[1]) && !checks[2],
    },
    {
      done: checks[3],
      label: "Photo uploaded",
      now: Boolean(checks[0] && checks[1] && checks[2]) && !checks[3],
    },
    {
      done: checks[4],
      label: "Campus assigned",
      now:
        Boolean(checks[0] && checks[1] && checks[2] && checks[3]) && !checks[4],
    },
  ];

  return (
    <section
      style={{
        border: `0.5px solid ${BRAND.rule}`,
        borderRadius: 16,
        color: BRAND.ink,
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        margin: "0 0 18px",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Left — light */}
      <div
        style={{
          background: BRAND.paper2,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          padding: 24,
        }}
      >
        <div
          style={{
            alignItems: "center",
            color: BRAND.claret,
            display: "flex",
            fontSize: 11,
            fontWeight: 500,
            gap: 8,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          <ChevronRight size={12} />
          Pick up where you left off
        </div>

        {/* Progress bar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div
            style={{
              alignItems: "baseline",
              display: "flex",
              gap: 8,
              justifyContent: "space-between",
            }}
          >
            <span
              style={{
                color: BRAND.ink3,
                fontSize: 11,
                letterSpacing: "0.03em",
                textTransform: "uppercase",
              }}
            >
              Completion
            </span>
            <span
              style={{
                fontFamily: SERIF_STACK,
                fontSize: 24,
                letterSpacing: "-0.015em",
                lineHeight: 1,
              }}
            >
              {percent}%
            </span>
          </div>
          <div
            style={{
              background: BRAND.rule2,
              borderRadius: 999,
              height: 4,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                background: BRAND.claret,
                borderRadius: 999,
                height: "100%",
                transition: "width 0.6s cubic-bezier(.4,0,.2,1)",
                width: `${percent}%`,
              }}
            />
          </div>
        </div>

        {/* Category crest */}
        <div style={{ alignItems: "center", display: "flex", gap: 10 }}>
          <div
            style={{
              alignItems: "center",
              background: BRAND.paper3,
              border: `0.5px solid ${BRAND.rule2}`,
              borderRadius: "50%",
              color: BRAND.ink3,
              display: "grid",
              fontSize: 11,
              fontFamily: MONO_STACK,
              height: 36,
              justifyItems: "center",
              width: 36,
            }}
          >
            {draft.category ? draft.category.charAt(0).toUpperCase() : "?"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ color: BRAND.ink2, fontSize: 13, fontWeight: 500 }}>
              {draft.category ?? "No category"}
            </span>
            <span
              style={{
                color: BRAND.ink4,
                fontFamily: MONO_STACK,
                fontSize: 10.5,
              }}
            >
              /{draft.slug}
            </span>
          </div>
        </div>
      </div>

      {/* Right — dark */}
      <div
        style={{
          background: BRAND.ink,
          color: BRAND.paper,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 24,
          position: "relative",
        }}
      >
        <div>
          <div
            style={{
              color: "rgba(250,247,242,.55)",
              fontSize: 11,
              letterSpacing: "0.06em",
              marginBottom: 8,
              textTransform: "uppercase",
            }}
          >
            Publishing checklist
          </div>
          <h2
            style={{
              fontFamily: SERIF_STACK,
              fontSize: 24,
              fontWeight: 400,
              lineHeight: 1.15,
              margin: "0 0 16px",
              maxWidth: "22ch",
            }}
          >
            {title}
          </h2>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            margin: "0 0 20px",
          }}
        >
          {checklistItems.map((item) => {
            const dotBg = item.done ? BRAND.paper : "transparent";
            const dotBorder = item.now ? BRAND.paper : "rgba(250,247,242,0.4)";
            const dotShadow = item.now
              ? "0 0 0 4px rgba(250,247,242,.12)"
              : "none";
            let statusText: string;
            if (item.done) {
              statusText = "done";
            } else if (item.now) {
              statusText = "now";
            } else {
              statusText = "—";
            }
            return (
              <div
                key={item.label}
                style={{
                  alignItems: "center",
                  display: "flex",
                  fontSize: 12.5,
                  gap: 10,
                }}
              >
                <span
                  style={{
                    background: dotBg,
                    border: `1px solid ${dotBorder}`,
                    borderRadius: "50%",
                    boxShadow: dotShadow,
                    flexShrink: 0,
                    height: 14,
                    width: 14,
                  }}
                />
                <span>{item.label}</span>
                <span
                  style={{
                    color: "rgba(250,247,242,.55)",
                    fontFamily: MONO_STACK,
                    fontSize: 11,
                    marginLeft: "auto",
                  }}
                >
                  {statusText}
                </span>
              </div>
            );
          })}
        </div>

        <Link
          href={`/shop/${draft.$id}`}
          style={{
            alignItems: "center",
            alignSelf: "flex-start",
            background: "rgba(250,247,242,.08)",
            border: "0.5px solid rgba(250,247,242,.25)",
            borderRadius: 8,
            color: BRAND.paper,
            cursor: "pointer",
            display: "inline-flex",
            fontSize: 13,
            gap: 10,
            padding: "10px 16px",
            textDecoration: "none",
          }}
        >
          Resume editor
          <TrendingUp size={14} />
        </Link>
      </div>
    </section>
  );
}

// ─── ProductRow ───────────────────────────────────────────────────────────────

function ProductRow({
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
  const isConfirming = pendingDeleteId === product.$id;
  const title = getProductTitle(product);
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
        image={product.image}
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
            <span title="Member only">
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
            <span style={{ color: BRAND.ink4 }}>Member</span>
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
          aria-label="Edit product"
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
          aria-label={isConfirming ? "Confirm delete" : "Delete product"}
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
          title={isConfirming ? "Confirm delete" : "Delete product"}
          type="button"
        >
          {isConfirming ? "Confirm" : <Trash2 size={13} />}
        </button>
      </div>
    </div>
  );
}

// ─── OrderRow ─────────────────────────────────────────────────────────────────

interface OrderLineItem {
  name?: string;
  product_name?: string;
  quantity?: number;
}

function parseOrderItems(json: string | null): OrderLineItem[] {
  if (!json) {
    return [];
  }
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as OrderLineItem[]) : [];
  } catch {
    return [];
  }
}

function exportOrdersCSV(orders: Orders[]) {
  function esc(val: string | number | null | undefined): string {
    if (val == null) return "";
    const s = String(val);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  }

  const headers = [
    "Order ID",
    "Date",
    "Buyer Name",
    "Buyer Email",
    "Buyer Phone",
    "Items",
    "Subtotal",
    "Discount",
    "Total",
    "Currency",
    "Status",
    "Payment Provider",
    "Member Discount %",
    "Receipt URL",
  ].join(",");

  const rows = orders.map((o) => {
    const items = parseOrderItems(o.items_json);
    const itemsStr = items
      .map(
        (i) =>
          `${i.name ?? i.product_name ?? "?"}${i.quantity ? ` x${i.quantity}` : ""}`
      )
      .join("; ");
    return [
      esc(o.$id),
      esc(new Date(o.$createdAt).toISOString().slice(0, 10)),
      esc(o.buyer_name),
      esc(o.buyer_email),
      esc(o.buyer_phone),
      esc(itemsStr),
      esc(o.subtotal),
      esc(o.discount_total ?? 0),
      esc(o.total),
      esc(o.currency),
      esc(o.status),
      esc(o.payment_provider),
      esc(o.member_discount_percent),
      esc(o.payment_receipt_url ?? o.receipt_link),
    ].join(",");
  });

  const csv = [headers, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function OrderRow({ order }: { order: Orders }) {
  const items = parseOrderItems(order.items_json);
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
          {fmtDate(order.$createdAt)}
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
              Member
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
            aria-label="View receipt"
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

// ─── Main component ───────────────────────────────────────────────────────────

export function ShopStudioDashboard({
  initialOrders,
  initialProducts,
}: ShopStudioDashboardProps) {
  const [activeTab, setActiveTab] = useState<"catalog" | "orders">("catalog");
  const [catalogFilter, setCatalogFilter] = useState<CatalogFilter>("all");
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [productFilter, setProductFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // ── KPI computations ────────────────────────────────────────────────────────

  const liveCount = useMemo(
    () => initialProducts.filter((p) => p.status === "published").length,
    [initialProducts]
  );

  const pendingCount = useMemo(
    () => initialProducts.filter((p) => p.status === "pending_approval").length,
    [initialProducts]
  );

  const lowStockCount = useMemo(
    () =>
      initialProducts.filter(
        (p) => p.inventory_mode === "tracked" && p.stock !== null && p.stock < 5
      ).length,
    [initialProducts]
  );

  const paidRevenue = useMemo(
    () =>
      initialOrders
        .filter((o) => o.status === "paid")
        .reduce((sum, o) => sum + o.total, 0),
    [initialOrders]
  );

  const pendingOrderCount = useMemo(
    () =>
      initialOrders.filter(
        (o) => o.status === "pending" || o.status === "authorized"
      ).length,
    [initialOrders]
  );

  const allProductNames = useMemo(() => {
    const names = new Set<string>();
    for (const order of initialOrders) {
      const items = parseOrderItems(order.items_json);
      for (const item of items) {
        const name = item.name ?? item.product_name;
        if (name) names.add(name);
      }
    }
    return Array.from(names).sort();
  }, [initialOrders]);

  // ── Filtered lists ──────────────────────────────────────────────────────────

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return initialProducts.filter((p) => {
      const statusMatch =
        catalogFilter === "all" ||
        (catalogFilter === "published" && p.status === "published") ||
        (catalogFilter === "drafts" && p.status === "draft") ||
        (catalogFilter === "pending" && p.status === "pending_approval") ||
        (catalogFilter === "archived" && p.status === "archived");
      if (!statusMatch) {
        return false;
      }
      if (!q) {
        return true;
      }
      const titleNo = getProductTitle(p, "no").toLowerCase();
      const titleEn = getProductTitle(p, "en").toLowerCase();
      const slug = p.slug.toLowerCase();
      return titleNo.includes(q) || titleEn.includes(q) || slug.includes(q);
    });
  }, [catalogFilter, initialProducts, searchQuery]);

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const fromMs = dateFrom ? new Date(dateFrom).getTime() : null;
    const toMs = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null;
    return initialOrders.filter((o) => {
      if (orderFilter !== "all" && o.status !== orderFilter) return false;
      if (productFilter !== "all") {
        const items = parseOrderItems(o.items_json);
        const has = items.some(
          (i) => (i.name ?? i.product_name) === productFilter
        );
        if (!has) return false;
      }
      if (fromMs !== null || toMs !== null) {
        const ts = new Date(o.$createdAt).getTime();
        if (fromMs !== null && ts < fromMs) return false;
        if (toMs !== null && ts > toMs) return false;
      }
      if (!q) return true;
      return (
        (o.buyer_name?.toLowerCase().includes(q) ?? false) ||
        (o.buyer_email?.toLowerCase().includes(q) ?? false) ||
        o.$id.toLowerCase().includes(q)
      );
    });
  }, [orderFilter, productFilter, dateFrom, dateTo, initialOrders, searchQuery]);

  // ── Delete handler ──────────────────────────────────────────────────────────

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteProduct(id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setPendingDeleteId(null);
      toast.success("Product deleted");
    });
  }

  // ── Tab / filter counts ─────────────────────────────────────────────────────

  const catalogCounts: Record<CatalogFilter, number> = useMemo(
    () => ({
      all: initialProducts.length,
      published: initialProducts.filter((p) => p.status === "published").length,
      drafts: initialProducts.filter((p) => p.status === "draft").length,
      pending: initialProducts.filter((p) => p.status === "pending_approval")
        .length,
      archived: initialProducts.filter((p) => p.status === "archived").length,
    }),
    [initialProducts]
  );

  const orderCounts: Record<OrderFilter, number> = useMemo(
    () => ({
      all: initialOrders.length,
      paid: initialOrders.filter((o) => o.status === "paid").length,
      authorized: initialOrders.filter((o) => o.status === "authorized").length,
      pending: initialOrders.filter((o) => o.status === "pending").length,
      failed: initialOrders.filter((o) => o.status === "failed").length,
      refunded: initialOrders.filter((o) => o.status === "refunded").length,
    }),
    [initialOrders]
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  const catalogFilterTabs: { key: CatalogFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "published", label: "Published" },
    { key: "drafts", label: "Drafts" },
    { key: "pending", label: "Pending" },
    { key: "archived", label: "Archived" },
  ];

  const orderFilterTabs: { key: OrderFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "paid", label: "Paid" },
    { key: "authorized", label: "Authorized" },
    { key: "pending", label: "Pending" },
    { key: "failed", label: "Failed" },
    { key: "refunded", label: "Refunded" },
  ];

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
            Products /{" "}
            <em style={{ color: BRAND.claret, fontStyle: "italic" }}>
              the catalogue.
            </em>
          </h1>
          <p
            style={{
              color: BRAND.ink3,
              fontSize: 14.5,
              margin: "8px 0 0",
            }}
          >
            Manage your webshop products and incoming orders.
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
          Compose product
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
        {(
          [
            { key: "catalog", label: "Catalogue" },
            { key: "orders", label: "Orders" },
          ] as const
        ).map((tab) => {
          const isActive = activeTab === tab.key;
          const hasBadge = tab.key === "orders" && pendingOrderCount > 0;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                setSearchQuery("");
              }}
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
              {tab.key === "orders" && (
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
                  {pendingOrderCount > 0
                    ? pendingOrderCount
                    : initialOrders.length}
                </span>
              )}
              {tab.key === "catalog" && (
                <span
                  style={{
                    background: BRAND.paper2,
                    border: `0.5px solid ${BRAND.rule2}`,
                    borderRadius: 999,
                    color: BRAND.ink4,
                    fontFamily: MONO_STACK,
                    fontSize: 10.5,
                    padding: "1px 7px",
                  }}
                >
                  {initialProducts.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── KPI strip ──────────────────────────────────────────────────────── */}
      <section
        style={{
          background: "rgba(255,255,255,.45)",
          border: `0.5px solid ${BRAND.rule}`,
          borderRadius: 14,
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          margin: "22px 0 28px",
          overflow: "hidden",
        }}
      >
        <KpiCard label="Live products" value={liveCount} />
        <KpiCard currency="NOK" label="Revenue (30d)" value={paidRevenue} />
        <KpiCard
          alert={lowStockCount > 0}
          label="Low stock"
          value={lowStockCount}
        />
        <KpiCard
          alert={pendingCount > 0}
          label="Pending approval"
          value={pendingCount}
        />
      </section>

      {/* ── Featured draft (catalog tab only) ──────────────────────────────── */}
      {activeTab === "catalog" && (
        <FeaturedDraftCard products={initialProducts} />
      )}

      {/* ── Filter row ─────────────────────────────────────────────────────── */}
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
          {activeTab === "catalog"
            ? catalogFilterTabs.map((tab) => {
                const active = catalogFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setCatalogFilter(tab.key)}
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
                    {tab.label}
                    <span
                      style={{
                        color: active ? BRAND.ink3 : BRAND.ink4,
                        fontFamily: MONO_STACK,
                        fontSize: 10.5,
                      }}
                    >
                      {catalogCounts[tab.key]}
                    </span>
                  </button>
                );
              })
            : orderFilterTabs.map((tab) => {
                const active = orderFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setOrderFilter(tab.key)}
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
                    {tab.label}
                    <span
                      style={{
                        color: active ? BRAND.ink3 : BRAND.ink4,
                        fontFamily: MONO_STACK,
                        fontSize: 10.5,
                      }}
                    >
                      {orderCounts[tab.key]}
                    </span>
                  </button>
                );
              })}
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
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeTab === "catalog" ? "Search products…" : "Search orders…"
            }
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
            value={searchQuery}
          />
        </div>
      </div>

      {/* ── Orders advanced filters ─────────────────────────────────────────── */}
      {activeTab === "orders" && (
        <div
          style={{
            alignItems: "center",
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 16,
          }}
        >
          {/* Product filter */}
          <select
            onChange={(e) => setProductFilter(e.target.value)}
            style={{
              background: "rgba(255,255,255,.85)",
              border: `0.5px solid ${BRAND.rule2}`,
              borderRadius: 8,
              color: productFilter === "all" ? BRAND.ink3 : BRAND.ink,
              cursor: "pointer",
              fontSize: 12.5,
              height: 32,
              outline: "none",
              padding: "0 28px 0 10px",
            }}
            value={productFilter}
          >
            <option value="all">All products</option>
            {allProductNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          {/* Date from */}
          <input
            onChange={(e) => setDateFrom(e.target.value)}
            style={{
              background: "rgba(255,255,255,.85)",
              border: `0.5px solid ${BRAND.rule2}`,
              borderRadius: 8,
              color: dateFrom ? BRAND.ink : BRAND.ink3,
              fontSize: 12.5,
              height: 32,
              outline: "none",
              padding: "0 10px",
            }}
            title="From date"
            type="date"
            value={dateFrom}
          />

          <span style={{ color: BRAND.ink4, fontSize: 11.5 }}>→</span>

          {/* Date to */}
          <input
            onChange={(e) => setDateTo(e.target.value)}
            style={{
              background: "rgba(255,255,255,.85)",
              border: `0.5px solid ${BRAND.rule2}`,
              borderRadius: 8,
              color: dateTo ? BRAND.ink : BRAND.ink3,
              fontSize: 12.5,
              height: 32,
              outline: "none",
              padding: "0 10px",
            }}
            title="To date"
            type="date"
            value={dateTo}
          />

          {/* Clear filters link */}
          {(productFilter !== "all" || dateFrom || dateTo) && (
            <button
              onClick={() => {
                setProductFilter("all");
                setDateFrom("");
                setDateTo("");
              }}
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
              Clear
            </button>
          )}

          <div style={{ flex: 1 }} />

          {/* Export CSV */}
          <button
            onClick={() => exportOrdersCSV(filteredOrders)}
            style={{
              alignItems: "center",
              background: BRAND.paper2,
              border: `0.5px solid ${BRAND.rule2}`,
              borderRadius: 8,
              color: BRAND.ink2,
              cursor: "pointer",
              display: "flex",
              fontSize: 12.5,
              fontWeight: 500,
              gap: 6,
              height: 32,
              padding: "0 14px",
            }}
            type="button"
          >
            <Download size={13} />
            Export CSV
          </button>
        </div>
      )}

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      {activeTab === "catalog" ? (
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
            <div>Product</div>
            <div>Cat.</div>
            <div>Status</div>
            <div>Price</div>
            <div>Stock</div>
            <div style={{ textAlign: "right" }}>Actions</div>
          </div>

          {filteredProducts.length === 0 ? (
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
                No products found
              </h2>
              <p
                style={{
                  color: BRAND.ink3,
                  fontSize: 13,
                  margin: 0,
                  maxWidth: "44ch",
                }}
              >
                {searchQuery
                  ? "Try adjusting your search or filter."
                  : "Create your first product to get started."}
              </p>
              {!searchQuery && (
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
                  Compose product
                </Link>
              )}
            </div>
          ) : (
            <>
              {filteredProducts.map((product) => (
                <ProductRow
                  key={product.$id}
                  onCancelDelete={() => setPendingDeleteId(null)}
                  onDelete={handleDelete}
                  onRequestDelete={setPendingDeleteId}
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
      ) : (
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
            <div>Ref / Date</div>
            <div>Buyer</div>
            <div>Items</div>
            <div>Total</div>
            <div>Status</div>
            <div />
          </div>

          {filteredOrders.length === 0 ? (
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
                No orders yet
              </h2>
              <p
                style={{
                  color: BRAND.ink3,
                  fontSize: 13,
                  margin: 0,
                  maxWidth: "44ch",
                }}
              >
                {searchQuery || productFilter !== "all" || dateFrom || dateTo
                  ? "Try adjusting your search or filters."
                  : "Orders will appear here once customers start purchasing."}
              </p>
            </div>
          ) : (
            <>
              {filteredOrders.map((order) => (
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
          Deleting…
        </div>
      )}
    </div>
  );
}
