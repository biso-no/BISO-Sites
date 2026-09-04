"use client";

/**
 * Catalog-tab hero: surfaces the most recently touched draft product together
 * with a five-point completion checklist so authors can resume it in one click.
 */

import { ChevronRight, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import {
  BRAND,
  MONO_STACK,
  normalizeLocale,
  SERIF_STACK,
} from "./shop-studio-theme";
import {
  getProductTitle,
  type ProductWithTranslations,
} from "./shop-studio-types";

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

export function FeaturedDraftCard({
  products,
}: {
  products: ProductWithTranslations[];
}) {
  const locale = normalizeLocale(useLocale());
  const t = useTranslations("adminPortal.shop.studio");
  const draft = useMemo(() => pickFeaturedDraft(products), [products]);
  if (!draft) {
    return null;
  }

  const title = getProductTitle(draft, locale);

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
    { done: checks[0], label: t("checklist.titleCategory"), now: !checks[0] },
    {
      done: checks[1],
      label: t("checklist.description"),
      now: Boolean(checks[0]) && !checks[1],
    },
    {
      done: checks[2],
      label: t("checklist.priceSet"),
      now: Boolean(checks[0] && checks[1]) && !checks[2],
    },
    {
      done: checks[3],
      label: t("checklist.photoUploaded"),
      now: Boolean(checks[0] && checks[1] && checks[2]) && !checks[3],
    },
    {
      done: checks[4],
      label: t("checklist.campusAssigned"),
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
          {t("featured.eyebrow")}
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
              {t("featured.completion")}
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
              {draft.category ?? t("fallback.noCategory")}
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
            {t("featured.checklistTitle")}
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
              statusText = t("status.done");
            } else if (item.now) {
              statusText = t("status.now");
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
          {t("featured.resume")}
          <TrendingUp size={14} />
        </Link>
      </div>
    </section>
  );
}
