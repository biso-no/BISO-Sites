"use client";

import type { PublicBenefit } from "@repo/shared/utils/benefit-public";
import type { MembershipTextItem } from "@repo/shared/utils/membership-texts";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { TabsContent } from "@repo/ui/components/ui/tabs";
import { type LucideIcon, Search, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import {
  benefitCategoryLabel,
  localizedPublicBenefitText,
} from "@/lib/benefit-text";
import { BenefitCard } from "../shared/benefit-card";
import { BENEFIT_CATEGORY_ICONS } from "../shared/benefit-category-icons";
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

const NON_MEMBER_CHIP_LIMIT = 4;

interface CategoryChip {
  count: number;
  icon: LucideIcon;
  id: string;
  label: string;
}

/** "All" plus one chip per studio category that at least one benefit uses. */
function useCategoryChips(benefits: PublicBenefit[]): CategoryChip[] {
  const t = useTranslations("memberPortal.benefits");
  const locale = useLocale();
  return [
    {
      count: benefits.length,
      icon: Sparkles,
      id: "all",
      label: t("allCategories"),
    },
    ...presentBenefitCategories(benefits).map((key) => ({
      count: benefits.filter((b) => b.category === key).length,
      icon: BENEFIT_CATEGORY_ICONS[key],
      id: key,
      label: benefitCategoryLabel(key, locale),
    })),
  ];
}

function MemberBenefitsView({ benefits }: { benefits: PublicBenefit[] }) {
  const t = useTranslations("memberPortal.benefits");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const chips = useCategoryChips(benefits);
  const filteredBenefits = filterBenefits(
    benefits,
    selectedCategory,
    searchQuery
  );

  return (
    <>
      {/* Header */}
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        initial={{ opacity: 0, y: 20 }}
      >
        <div>
          <h2 className="mb-2 font-bold text-2xl text-foreground dark:text-foreground">
            {t("title")}
          </h2>
          <p className="text-muted-foreground dark:text-muted-foreground">
            {t("description")}
          </p>
        </div>
        <Badge className="w-fit border-brand-border-strong bg-brand-muted px-4 py-2 text-brand dark:border-brand-border-strong dark:bg-brand-muted-strong">
          <Sparkles className="mr-2 h-4 w-4" />
          {t("available", { count: benefits.length })}
        </Badge>
      </motion.div>

      {/* Search and Filter */}
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
        initial={{ opacity: 0, y: 20 }}
        transition={{ delay: 0.1 }}
      >
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-12 pl-12 text-base"
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            value={searchQuery}
          />
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap gap-2">
          {chips.map((category) => {
            const count = category.count;
            const isActive = selectedCategory === category.id;

            return (
              <Button
                className={`h-auto rounded-full px-4 py-2 transition-all ${
                  isActive
                    ? "bg-linear-to-r from-brand-gradient-from to-brand-gradient-to text-white shadow-md"
                    : "bg-section text-muted-foreground hover:bg-brand-muted hover:text-brand dark:bg-inverted"
                }`}
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                variant="ghost"
              >
                <category.icon className="mr-2 h-4 w-4" />
                {category.label}
                <Badge
                  className={`ml-2 h-5 min-w-5 rounded-full px-1.5 text-xs ${
                    isActive
                      ? "border-white/30 bg-white/20 text-white"
                      : "border-transparent bg-muted text-muted-foreground"
                  }`}
                  variant="outline"
                >
                  {count}
                </Badge>
              </Button>
            );
          })}
        </div>
      </motion.div>

      {/* Benefits Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        <AnimatePresence mode="popLayout">
          {filteredBenefits.map((benefit, index) => (
            <motion.div
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              initial={{ opacity: 0, scale: 0.95 }}
              key={benefit.id}
              layout
              transition={{ duration: 0.2, delay: index * 0.05 }}
            >
              <BenefitCard benefit={benefit} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Empty state */}
      {filteredBenefits.length === 0 && (
        <motion.div
          animate={{ opacity: 1 }}
          className="py-16 text-center"
          initial={{ opacity: 0 }}
        >
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-muted">
            <Search className="h-8 w-8 text-brand" />
          </div>
          <h3 className="mb-2 font-semibold text-foreground text-lg dark:text-foreground">
            {t("noResults")}
          </h3>
          <p className="text-muted-foreground dark:text-muted-foreground">
            {t("noResultsDescription")}
          </p>
          <Button
            className="mt-4"
            onClick={() => {
              setSelectedCategory("all");
              setSearchQuery("");
            }}
            variant="outline"
          >
            {t("clearFilters")}
          </Button>
        </motion.div>
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
  const locale = useLocale();
  const [selectedCategory, setSelectedCategory] = useState("all");
  const chips = useCategoryChips(benefits);

  const filteredBenefits = filterBenefits(benefits, selectedCategory, "").slice(
    0,
    8
  );

  return (
    <>
      {/* Header */}
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
        initial={{ opacity: 0, y: 20 }}
      >
        <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-brand-muted px-4 py-2">
          <Sparkles className="h-4 w-4 text-brand" />
          <span className="text-brand-dark dark:text-brand">
            {t("previewBadge")}
          </span>
        </div>
        <h2 className="mb-4 font-bold text-3xl text-foreground dark:text-foreground">
          {t("previewTitle")}
        </h2>
        <p className="mx-auto max-w-2xl text-muted-foreground dark:text-muted-foreground">
          {t("previewDescription")}
        </p>
      </motion.div>

      {/* Category filter */}
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap justify-center gap-2"
        initial={{ opacity: 0, y: 20 }}
        transition={{ delay: 0.1 }}
      >
        {chips.slice(0, NON_MEMBER_CHIP_LIMIT + 1).map((category) => {
          const isActive = selectedCategory === category.id;

          return (
            <Button
              className={`h-auto rounded-full px-4 py-2 transition-all ${
                isActive
                  ? "bg-linear-to-r from-brand-gradient-from to-brand-gradient-to text-white shadow-md"
                  : "bg-section text-muted-foreground hover:bg-brand-muted hover:text-brand dark:bg-inverted"
              }`}
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              variant="ghost"
            >
              <category.icon className="mr-2 h-4 w-4" />
              {category.label}
            </Button>
          );
        })}
      </motion.div>

      {/* Benefits Preview Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <AnimatePresence mode="popLayout">
          {filteredBenefits.map((benefit, index) => (
            <motion.div
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              initial={{ opacity: 0, scale: 0.95 }}
              key={benefit.id}
              layout
              transition={{ duration: 0.2, delay: index * 0.05 }}
            >
              <BenefitPreviewCard
                category={benefit.category ?? ""}
                discountText={localizedPublicBenefitText(benefit, locale).title}
                index={index}
                partnerLogo={benefit.partner?.logoUrl}
                partnerName={benefit.partner?.name ?? null}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* CTA Section */}
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
    <TabsContent className="space-y-8" value="benefits">
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
