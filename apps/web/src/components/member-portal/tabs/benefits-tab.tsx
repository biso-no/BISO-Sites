"use client";

import type { CampusBenefit } from "@repo/api/types/appwrite";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { TabsContent } from "@repo/ui/components/ui/tabs";
import {
  Briefcase,
  Coffee,
  Dumbbell,
  Film,
  GraduationCap,
  Laptop,
  Plane,
  Search,
  Sparkles,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { BenefitCard } from "../shared/benefit-card";
import { BenefitPreviewCard } from "../shared/benefit-preview-card";
import { MembershipCtaSection } from "../shared/membership-cta-section";

interface BenefitsTabProps {
  benefits: CampusBenefit[];
  featuredBenefits?: CampusBenefit[];
  hasBIIdentity: boolean;
  isMember: boolean;
  revealedBenefits: Set<string>;
}

const categories = [
  { id: "all", icon: Sparkles, label: "All" },
  { id: "Food & Drink", icon: Coffee, label: "Food & Drink" },
  { id: "Entertainment", icon: Film, label: "Entertainment" },
  { id: "Career", icon: Briefcase, label: "Career" },
  { id: "Health & Fitness", icon: Dumbbell, label: "Health" },
  { id: "Software", icon: Laptop, label: "Software" },
  { id: "Travel", icon: Plane, label: "Travel" },
  { id: "Education", icon: GraduationCap, label: "Education" },
];

function MemberBenefitsView({
  benefits,
  revealedBenefits,
}: {
  benefits: CampusBenefit[];
  revealedBenefits: Set<string>;
}) {
  const t = useTranslations("memberPortal.benefits");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredBenefits = benefits.filter((benefit) => {
    const matchesCategory =
      selectedCategory === "all" || benefit.category === selectedCategory;
    const matchesSearch =
      benefit.title_en.toLowerCase().includes(searchQuery.toLowerCase()) ||
      benefit.title_nb.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (benefit.partner_name ?? "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      benefit.description_en.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const categoryCounts = categories.reduce(
    (acc, cat) => {
      if (cat.id === "all") {
        acc[cat.id] = benefits.length;
      } else {
        acc[cat.id] = benefits.filter((b) => b.category === cat.id).length;
      }
      return acc;
    },
    {} as Record<string, number>
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
          {categories.map((category) => {
            const count = categoryCounts[category.id] || 0;
            const isActive = selectedCategory === category.id;

            return (
              <Button
                className={`h-auto rounded-full px-4 py-2 transition-all ${
                  isActive
                    ? "bg-gradient-to-r from-brand-gradient-from to-brand-gradient-to text-white shadow-md"
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
              key={benefit.$id}
              layout
              transition={{ duration: 0.2, delay: index * 0.05 }}
            >
              <BenefitCard
                benefit={benefit}
                isRevealed={revealedBenefits.has(benefit.$id)}
              />
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

function NonMemberBenefitsView({ benefits }: { benefits: CampusBenefit[] }) {
  const t = useTranslations("memberPortal.benefits");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const filteredBenefits =
    selectedCategory === "all"
      ? benefits.slice(0, 8)
      : benefits.filter((b) => b.category === selectedCategory).slice(0, 8);

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
        {categories.slice(0, 5).map((category) => {
          const isActive = selectedCategory === category.id;

          return (
            <Button
              className={`h-auto rounded-full px-4 py-2 transition-all ${
                isActive
                  ? "bg-gradient-to-r from-brand-gradient-from to-brand-gradient-to text-white shadow-md"
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
              key={`${benefit.category}-${index}`}
              layout
              transition={{ duration: 0.2, delay: index * 0.05 }}
            >
              <BenefitPreviewCard
                category={benefit.category}
                discountText={benefit.teaser_en || "Unlock to see"}
                index={index}
                partnerName={benefit.partner_name || "Partner"}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* CTA Section */}
      <MembershipCtaSection />
    </>
  );
}

export function BenefitsTab({
  benefits,
  featuredBenefits: _featuredBenefits = [],
  revealedBenefits,
  isMember,
  hasBIIdentity: _hasBIIdentity,
}: BenefitsTabProps) {
  return (
    <TabsContent className="space-y-8" value="benefits">
      {isMember ? (
        <MemberBenefitsView
          benefits={benefits}
          revealedBenefits={revealedBenefits}
        />
      ) : (
        <NonMemberBenefitsView benefits={benefits} />
      )}
    </TabsContent>
  );
}
