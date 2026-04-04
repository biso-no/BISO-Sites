"use client";

import type { CampusBenefit } from "@repo/api/types/appwrite";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Progress } from "@repo/ui/components/ui/progress";
import { TabsContent } from "@repo/ui/components/ui/tabs";
import {
  ArrowRight,
  Check,
  Clock,
  Gift,
  Shield,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { BenefitCard } from "../shared/benefit-card";
import { BenefitsShowcase } from "../shared/benefits-showcase";
import { MembershipCtaSection } from "../shared/membership-cta-section";

type HomeTabProps = {
  membershipType: string;
  benefitsCount: number;
  daysRemaining: number;
  estimatedSavings: number;
  startDate: string;
  expiryDate: string;
  benefits: CampusBenefit[];
  revealedBenefits: Set<string>;
  isMember: boolean;
  hasBIIdentity: boolean;
  onTabChange: (tab: string) => void;
};

type AnimatedCounterProps = {
  value: number;
  suffix?: string;
  prefix?: string;
};

function AnimatedCounter({
  value,
  suffix = "",
  prefix = "",
}: AnimatedCounterProps) {
  return (
    <motion.span animate={{ opacity: 1 }} initial={{ opacity: 0 }} key={value}>
      {prefix}
      <motion.span
        animate={{ scale: [1.2, 1] }}
        initial={{ scale: 1 }}
        key={value}
        transition={{ duration: 0.3 }}
      >
        {value}
      </motion.span>
      {suffix}
    </motion.span>
  );
}

function MemberOverview({
  membershipType,
  benefitsCount,
  daysRemaining,
  estimatedSavings,
  startDate,
  expiryDate,
  benefits,
  revealedBenefits,
  onTabChange,
}: Omit<HomeTabProps, "isMember" | "hasBIIdentity">) {
  const t = useTranslations("memberPortal.overview");
  const tCommon = useTranslations("memberPortal.common");

  const featuredBenefits = benefits.slice(0, 3);
  const progressPercentage = Math.min(100, (daysRemaining / 365) * 100);

  return (
    <>
      {/* Hero Stats Grid */}
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        initial={{ opacity: 0, y: 20 }}
      >
        {/* Membership Status */}
        <Card className="group relative overflow-hidden border-0 p-6 shadow-lg transition-all duration-300 hover:shadow-xl dark:bg-inverted/50">
          <div className="absolute inset-0 bg-linear-to-br from-brand-muted to-transparent opacity-50" />
          <div className="relative">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-brand-gradient-from to-brand-gradient-to shadow-lg">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <p className="mb-1 text-muted-foreground text-sm dark:text-muted-foreground">
              {t("stats.membershipType")}
            </p>
            <p className="font-bold text-foreground text-xl dark:text-foreground">
              {membershipType}
            </p>
            <Badge className="mt-2 border-green-200 bg-green-100 text-green-700 dark:border-green-900 dark:bg-green-900/30 dark:text-green-400">
              <Check className="mr-1 h-3 w-3" />
              {tCommon("status.active")}
            </Badge>
          </div>
        </Card>

        {/* Benefits Available */}
        <Card className="group relative overflow-hidden border-0 p-6 shadow-lg transition-all duration-300 hover:shadow-xl dark:bg-inverted/50">
          <div className="absolute inset-0 bg-linear-to-br from-brand-muted/50 to-transparent opacity-50 dark:from-brand-muted-strong/20" />
          <div className="relative">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-brand-gradient-from to-brand-gradient-to shadow-lg">
              <Gift className="h-6 w-6 text-white" />
            </div>
            <p className="mb-1 text-muted-foreground text-sm dark:text-muted-foreground">
              {t("stats.benefitsAvailable")}
            </p>
            <p className="font-bold text-3xl text-foreground dark:text-foreground">
              <AnimatedCounter value={benefitsCount} />
            </p>
            <p className="mt-1 text-muted-foreground text-sm">
              {t("stats.exclusiveDeals")}
            </p>
          </div>
        </Card>

        {/* Days Remaining */}
        <Card className="group relative overflow-hidden border-0 p-6 shadow-lg transition-all duration-300 hover:shadow-xl dark:bg-inverted/50">
          <div className="absolute inset-0 bg-linear-to-br from-brand-muted/50 to-transparent opacity-50 dark:from-brand-muted-strong/20" />
          <div className="relative">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-brand-gradient-from to-brand-gradient-to shadow-lg">
              <Clock className="h-6 w-6 text-white" />
            </div>
            <p className="mb-1 text-muted-foreground text-sm dark:text-muted-foreground">
              {t("stats.daysUntilRenewal")}
            </p>
            <p className="font-bold text-3xl text-foreground dark:text-foreground">
              <AnimatedCounter suffix=" days" value={daysRemaining} />
            </p>
            <Progress className="mt-3 h-2" value={progressPercentage} />
          </div>
        </Card>

        {/* Estimated Savings */}
        <Card className="group relative overflow-hidden border-0 p-6 shadow-lg transition-all duration-300 hover:shadow-xl dark:bg-inverted/50">
          <div className="absolute inset-0 bg-linear-to-br from-brand-muted/50 to-transparent opacity-50 dark:from-brand-muted-strong/20" />
          <div className="relative">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-brand-gradient-from to-brand-gradient-to shadow-lg">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <p className="mb-1 text-muted-foreground text-sm dark:text-muted-foreground">
              {t("stats.estimatedSavings")}
            </p>
            <p className="font-bold text-3xl text-foreground dark:text-foreground">
              <AnimatedCounter
                prefix="~"
                suffix=" NOK"
                value={estimatedSavings}
              />
            </p>
            <p className="mt-1 text-green-600 text-sm dark:text-green-400">
              <TrendingUp className="mr-1 inline h-3 w-3" />
              {t("stats.potential")}
            </p>
          </div>
        </Card>
      </motion.div>

      {/* Featured Benefits */}
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        initial={{ opacity: 0, y: 20 }}
        transition={{ delay: 0.2 }}
      >
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-2xl text-foreground dark:text-foreground">
              {t("featuredBenefits")}
            </h2>
            <p className="text-muted-foreground">{t("featuredDescription")}</p>
          </div>
          <Button
            className="group"
            onClick={() => onTabChange("benefits")}
            variant="outline"
          >
            {t("viewAll")}
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {featuredBenefits.map((benefit, index) => (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              initial={{ opacity: 0, y: 20 }}
              key={benefit.$id}
              transition={{ delay: 0.1 * index }}
            >
              <BenefitCard
                benefit={benefit}
                isRevealed={revealedBenefits.has(benefit.$id)}
              />
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        initial={{ opacity: 0, y: 20 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="overflow-hidden border-0 bg-linear-to-r from-brand-gradient-from to-brand-gradient-to p-8 shadow-xl">
          <div className="flex flex-col items-center justify-between gap-6 text-center md:flex-row md:text-left">
            <div className="text-white">
              <h3 className="mb-2 font-bold text-2xl">
                {t("quickActions.title")}
              </h3>
              <p className="max-w-md text-white/80">
                {t("quickActions.description")}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                className="bg-white text-brand-gradient-to hover:bg-white/90"
                onClick={() => onTabChange("benefits")}
              >
                <Gift className="mr-2 h-4 w-4" />
                {t("quickActions.viewBenefits")}
              </Button>
              <Button
                className="border-white/30 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20"
                onClick={() => onTabChange("membership")}
                variant="outline"
              >
                <Zap className="mr-2 h-4 w-4" />
                {t("quickActions.manageMembership")}
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Membership Status Card */}
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        initial={{ opacity: 0, y: 20 }}
        transition={{ delay: 0.5 }}
      >
        <Card className="border-0 bg-section p-8 shadow-lg dark:bg-inverted">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="mb-2 font-bold text-foreground text-xl dark:text-foreground">
                {t("membershipStatus")}
              </h3>
              <p className="text-muted-foreground dark:text-muted-foreground">
                {t("statusActive")}
              </p>
            </div>
            <Badge className="border-green-200 bg-green-100 px-4 py-2 text-green-700 dark:border-green-900 dark:bg-green-900/30 dark:text-green-400">
              <Check className="mr-2 h-4 w-4" />
              {tCommon("status.active")}
            </Badge>
          </div>

          <div className="space-y-4">
            <div>
              <div className="mb-2 flex justify-between text-sm">
                <span className="text-muted-foreground dark:text-muted-foreground">
                  {t("timeRemaining")}
                </span>
                <span className="font-medium text-foreground dark:text-foreground">
                  {daysRemaining} days
                </span>
              </div>
              <Progress className="h-3" value={progressPercentage} />
            </div>

            <div className="grid gap-4 pt-4 text-sm sm:grid-cols-2">
              <div className="rounded-lg bg-background p-4 dark:bg-card">
                <span className="text-muted-foreground dark:text-muted-foreground">
                  {t("started")}
                </span>
                <span className="ml-2 font-medium text-foreground dark:text-foreground">
                  {new Date(startDate).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="rounded-lg bg-background p-4 dark:bg-card">
                <span className="text-muted-foreground dark:text-muted-foreground">
                  {t("expires")}
                </span>
                <span className="ml-2 font-medium text-foreground dark:text-foreground">
                  {new Date(expiryDate).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>
    </>
  );
}

function NonMemberOverview({ benefits }: { benefits: CampusBenefit[] }) {
  return (
    <>
      {/* Welcome section for non-members */}
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
        initial={{ opacity: 0, y: 20 }}
      >
        <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-brand-muted px-4 py-2">
          <Sparkles className="h-4 w-4 text-brand" />
          <span className="text-brand-dark dark:text-brand">
            Discover BISO Benefits
          </span>
        </div>
        <h2 className="mb-4 font-bold text-3xl text-foreground dark:text-foreground">
          See What You&apos;re Missing
        </h2>
        <p className="mx-auto max-w-2xl text-muted-foreground dark:text-muted-foreground">
          As a BISO member, you unlock exclusive discounts and benefits from our
          50+ partner companies. Browse what&apos;s available and join today!
        </p>
      </motion.div>

      {/* Benefits Showcase */}
      <BenefitsShowcase benefits={benefits} />

      {/* CTA Section */}
      <MembershipCtaSection />
    </>
  );
}

export function HomeTab({
  membershipType,
  benefitsCount,
  daysRemaining,
  estimatedSavings,
  startDate,
  expiryDate,
  benefits,
  revealedBenefits,
  isMember,
  hasBIIdentity: _hasBIIdentity,
  onTabChange,
}: HomeTabProps) {
  return (
    <TabsContent className="space-y-8" value="home">
      {isMember ? (
        <MemberOverview
          benefits={benefits}
          benefitsCount={benefitsCount}
          daysRemaining={daysRemaining}
          estimatedSavings={estimatedSavings}
          expiryDate={expiryDate}
          membershipType={membershipType}
          onTabChange={onTabChange}
          revealedBenefits={revealedBenefits}
          startDate={startDate}
        />
      ) : (
        <NonMemberOverview benefits={benefits} />
      )}
    </TabsContent>
  );
}
