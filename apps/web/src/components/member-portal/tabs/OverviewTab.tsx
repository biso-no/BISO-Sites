import type { MemberBenefit } from "@repo/api/types/appwrite";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Progress } from "@repo/ui/components/ui/progress";
import { Separator } from "@repo/ui/components/ui/separator";
import { TabsContent } from "@repo/ui/components/ui/tabs";
import { Check, Clock, Gift, Shield, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { BenefitCard } from "../shared/BenefitCard";
import { LockedContentOverlay } from "../shared/LockedContentOverlay";
import { QuickStatsCard } from "../shared/QuickStatsCard";

type OverviewTabProps = {
  membershipType: string;
  benefitsCount: number;
  daysRemaining: number;
  estimatedSavings: number;
  startDate: string;
  expiryDate: string;
  benefits: MemberBenefit[];
  revealedBenefits: Set<string>;
  isMember: boolean;
  hasBIIdentity: boolean;
  onTabChange: (tab: string) => void;
};

export function OverviewTab({
  membershipType,
  benefitsCount,
  daysRemaining,
  estimatedSavings,
  startDate,
  expiryDate,
  benefits,
  revealedBenefits,
  isMember,
  hasBIIdentity,
  onTabChange,
}: OverviewTabProps) {
  const t = useTranslations("memberPortal.overview");
  const tCommon = useTranslations("memberPortal.common");

  const featuredBenefits = benefits.slice(0, 3);
  const progressPercentage = (daysRemaining / 365) * 100;

  const content = (
    <>
      {/* Quick Stats */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <QuickStatsCard
          badge={{
            text: tCommon("status.active"),
            className: "bg-green-100 text-green-700 border-green-200",
          }}
          icon={Shield}
          iconColor="bg-linear-to-br from-[#3DA9E0] to-[#001731]"
          label={t("stats.membershipType")}
          value={membershipType}
        />

        <QuickStatsCard
          icon={Gift}
          iconColor="bg-linear-to-br from-purple-500 to-purple-700"
          label={t("stats.benefitsAvailable")}
          value={t("stats.benefitsCount", { count: benefitsCount })}
        />

        <QuickStatsCard
          icon={Clock}
          iconColor="bg-linear-to-br from-orange-500 to-orange-700"
          label={t("stats.daysUntilRenewal")}
          value={t("daysRemaining", { days: daysRemaining })}
        />

        <QuickStatsCard
          icon={TrendingUp}
          iconColor="bg-linear-to-br from-green-500 to-green-700"
          label={t("stats.estimatedSavings")}
          value={`~${estimatedSavings} NOK`}
        />
      </div>

      {/* Featured Benefits */}
      <div>
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-bold text-2xl text-gray-900 dark:text-gray-100">
            {t("featuredBenefits")}
          </h2>
          <Button
            className="border-[#3DA9E0]/20 text-[#3DA9E0] hover:bg-[#3DA9E0]/10"
            onClick={() => onTabChange("benefits")}
            size="sm"
            variant="outline"
          >
            {t("viewAll")}
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {featuredBenefits.map((benefit) => (
            <BenefitCard
              benefit={benefit}
              isRevealed={revealedBenefits.has(benefit.id)}
              key={benefit.id}
            />
          ))}
        </div>
      </div>

      {/* Membership Status */}
      <Card className="border-0 bg-linear-to-br from-[#3DA9E0]/10 to-[#001731]/10 p-8 shadow-lg">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="mb-2 font-bold text-gray-900 text-xl dark:text-gray-100">
              {t("membershipStatus")}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {t("statusActive")}
            </p>
          </div>
          <Badge className="border-green-200 bg-green-100 px-4 py-2 text-green-700">
            <Check className="mr-2 h-4 w-4" />
            {tCommon("status.active")}
          </Badge>
        </div>

        <div className="space-y-4">
          <div>
            <div className="mb-2 flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                {t("timeRemaining")}
              </span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {t("daysRemaining", { days: daysRemaining })}
              </span>
            </div>
            <Progress className="h-2" value={progressPercentage} />
          </div>

          <Separator />

          <div className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <span className="text-gray-600 dark:text-gray-400">
                {t("started")}
              </span>
              <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                {new Date(startDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">
                {t("expires")}
              </span>
              <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                {new Date(expiryDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>

          <Button className="w-full bg-linear-to-r from-[#3DA9E0] to-[#001731] text-white hover:from-[#3DA9E0]/90 hover:to-[#001731]/90">
            {t("renewMembership")}
          </Button>
        </div>
      </Card>
    </>
  );

  return (
    <TabsContent className="space-y-8" value="overview">
      {isMember ? (
        content
      ) : (
        <LockedContentOverlay hasBIIdentity={hasBIIdentity}>
          {content}
        </LockedContentOverlay>
      )}
    </TabsContent>
  );
}
