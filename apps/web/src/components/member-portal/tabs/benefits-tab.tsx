"use client";

import type { PublicBenefit } from "@repo/shared/utils/benefit-public";
import type { MembershipTextItem } from "@repo/shared/utils/membership-texts";
import { TabsContent } from "@repo/ui/components/ui/tabs";
import { cn } from "@repo/ui/lib/utils";
import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Pill } from "@/components/ui/pill";
import { statusPanelSecondaryAction } from "@/components/ui/status-panel";
import { benefitCategoryLabel } from "@/lib/benefit-text";
import { BenefitCard } from "../shared/benefit-card";
import { BenefitPreviewCard } from "../shared/benefit-preview-card";
import { MembershipCtaSection } from "../shared/membership-cta-section";
import { filterBenefits, presentBenefitCategories } from "./benefit-search";

interface BenefitsTabProps {
  benefits: PublicBenefit[];
  featuredBenefits?: PublicBenefit[];
  hasBIIdentity: boolean;
  isMember: boolean;
  /** Saved plan card lines; null or missing keeps the i18n text. */
  planCardItems?: MembershipTextItem[] | null;
}

const ALL = "all";
const PREVIEW_LIMIT = 8;
const PREVIEW_CATEGORY_LIMIT = 4;

function CategoryChips({
  active,
  allLabel,
  categories,
  counts,
  label,
  onSelect,
}: {
  active: string;
  allLabel: string;
  categories: string[];
  counts?: Record<string, number>;
  label: string;
  onSelect: (category: string) => void;
}) {
  const locale = useLocale();
  if (categories.length < 2) {
    return null;
  }
  return (
    <ul aria-label={label} className="flex flex-wrap gap-2">
      {[ALL, ...categories].map((category) => {
        const isActive = category === active;
        return (
          <li key={category}>
            <button
              aria-pressed={isActive}
              className={cn(
                "type-body-sm inline-flex items-center gap-1.5 rounded-biso-pill border px-3 py-1.5 transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                isActive
                  ? "border-transparent bg-action font-semibold text-action-ink"
                  : "border-edge text-ink-muted hover:border-ink-accent hover:text-ink"
              )}
              onClick={() => onSelect(category)}
              type="button"
            >
              {category === ALL
                ? allLabel
                : benefitCategoryLabel(category, locale)}
              {counts ? (
                <span className="type-data opacity-70">{counts[category]}</span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function MemberBenefitsView({ benefits }: { benefits: PublicBenefit[] }) {
  const t = useTranslations("memberPortal.benefits");
  const searchId = useId();
  const [selectedCategory, setSelectedCategory] = useState(ALL);
  const [searchQuery, setSearchQuery] = useState("");

  const categories = presentBenefitCategories(benefits);
  const filteredBenefits = filterBenefits(
    benefits,
    selectedCategory,
    searchQuery
  );

  const counts: Record<string, number> = { [ALL]: benefits.length };
  for (const category of categories) {
    counts[category] = benefits.filter((b) => b.category === category).length;
  }

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="type-display-sm text-ink">{t("title")}</h2>
          <p className="type-body mt-2 text-ink-muted">{t("description")}</p>
        </div>
        <Pill tone="accent">{t("available", { count: benefits.length })}</Pill>
      </div>

      <div className="flex flex-col gap-4">
        <label
          className="relative flex w-full max-w-md items-center"
          htmlFor={searchId}
        >
          <span className="sr-only">{t("searchPlaceholder")}</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute start-3 size-4 text-ink-muted"
          />
          <input
            className="type-body-sm w-full rounded-biso-pill border border-edge bg-surface py-2 ps-9 pe-3 text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            id={searchId}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            type="search"
            value={searchQuery}
          />
        </label>

        <CategoryChips
          active={selectedCategory}
          allLabel={t("allCategories")}
          categories={categories}
          counts={counts}
          label={t("categoriesLabel")}
          onSelect={setSelectedCategory}
        />
      </div>

      {filteredBenefits.length > 0 ? (
        <ul className="grid gap-5 md:grid-cols-2">
          {filteredBenefits.map((benefit) => (
            <li key={benefit.id}>
              <BenefitCard benefit={benefit} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-start gap-3 rounded-biso-md border border-edge p-8">
          <h3 className="type-heading-card text-ink">{t("noResults")}</h3>
          <p className="type-body-sm text-ink-muted">
            {t("noResultsDescription")}
          </p>
          <button
            className={statusPanelSecondaryAction}
            onClick={() => {
              setSelectedCategory(ALL);
              setSearchQuery("");
            }}
            type="button"
          >
            {t("clearFilters")}
          </button>
        </div>
      )}
    </>
  );
}

function NonMemberBenefitsView({
  benefits,
  planCardItems,
}: {
  benefits: PublicBenefit[];
  planCardItems?: MembershipTextItem[] | null;
}) {
  const t = useTranslations("memberPortal.benefits");
  const [selectedCategory, setSelectedCategory] = useState(ALL);

  const categories = presentBenefitCategories(benefits).slice(
    0,
    PREVIEW_CATEGORY_LIMIT
  );
  const filteredBenefits = filterBenefits(benefits, selectedCategory, "").slice(
    0,
    PREVIEW_LIMIT
  );

  return (
    <>
      <section>
        <p className="type-label text-ink-accent">{t("previewBadge")}</p>
        <h2 className="type-display-sm mt-3 break-words text-ink">
          {t("previewTitle")}
        </h2>
        <p className="type-body mt-3 max-w-(--measure) text-ink-muted">
          {t("previewDescription")}
        </p>
      </section>

      <CategoryChips
        active={selectedCategory}
        allLabel={t("allCategories")}
        categories={categories}
        label={t("categoriesLabel")}
        onSelect={setSelectedCategory}
      />

      {filteredBenefits.length > 0 ? (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredBenefits.map((benefit) => (
            <li key={benefit.id}>
              <BenefitPreviewCard benefit={benefit} />
            </li>
          ))}
        </ul>
      ) : null}

      <MembershipCtaSection items={planCardItems} />
    </>
  );
}

export function BenefitsTab({
  benefits,
  featuredBenefits: _featuredBenefits = [],
  isMember,
  hasBIIdentity: _hasBIIdentity,
  planCardItems,
}: BenefitsTabProps) {
  return (
    <TabsContent className="flex flex-col gap-10" value="benefits">
      {isMember ? (
        <MemberBenefitsView benefits={benefits} />
      ) : (
        <NonMemberBenefitsView
          benefits={benefits}
          planCardItems={planCardItems}
        />
      )}
    </TabsContent>
  );
}
