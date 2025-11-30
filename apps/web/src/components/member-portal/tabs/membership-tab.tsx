"use client";

import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Separator } from "@repo/ui/components/ui/separator";
import { TabsContent } from "@repo/ui/components/ui/tabs";
import { Check, Download, Share2, Smartphone, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { LockedContentOverlay } from "../shared/locked-content-overlay";
import { MembershipCard } from "../shared/membership-card";

type MembershipDuration = "semester" | "year" | "three-year";

const MEMBERSHIP_PRICES = {
  semester: 350,
  year: 550,
  "three-year": 1400,
};

type MembershipTabProps = {
  userName: string;
  studentId: string;
  currentPlan: MembershipDuration;
  expiryDate: string;
  daysRemaining: number;
  autoRenew: boolean;
  isMember: boolean;
  hasBIIdentity: boolean;
};

export function MembershipTab({
  userName,
  studentId,
  currentPlan,
  expiryDate,
  daysRemaining,
  autoRenew,
  isMember,
  hasBIIdentity,
}: MembershipTabProps) {
  const t = useTranslations("memberPortal.membership");
  const tPricing = useTranslations("memberPortal.states.notMember.pricing");
  const [isAutoRenewEnabled, setIsAutoRenewEnabled] = useState(autoRenew);

  const content = (
    <>
      <Card className="border-0 p-8 shadow-lg dark:bg-gray-900/50 dark:backdrop-blur-sm">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="mb-2 font-bold text-gray-900 text-xl dark:text-gray-100">
              {t("title")}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {t("description")}
            </p>
          </div>
          <Badge className="border-green-200 bg-green-100 px-4 py-2 text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-400">
            <Check className="mr-2 h-4 w-4" />
            {t("active")}
          </Badge>
        </div>

        <div className="mb-8 grid gap-6 md:grid-cols-3">
          <div className="rounded-lg bg-linear-to-br from-[#3DA9E0]/10 to-[#001731]/10 p-6">
            <div className="mb-1 text-gray-600 text-sm dark:text-gray-400">
              {t("currentPlan")}
            </div>
            <div className="mb-2 font-semibold text-gray-900 text-lg dark:text-gray-100">
              {tPricing(currentPlan)}
            </div>
            <div className="font-bold text-2xl text-gray-900 dark:text-gray-100">
              {MEMBERSHIP_PRICES[currentPlan]} NOK
            </div>
          </div>

          <div className="rounded-lg bg-gray-50 p-6 dark:bg-gray-800">
            <div className="mb-1 text-gray-600 text-sm dark:text-gray-400">
              {t("nextBillingDate")}
            </div>
            <div className="mb-2 font-semibold text-gray-900 text-lg dark:text-gray-100">
              {new Date(expiryDate).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </div>
            <div className="text-gray-600 text-sm dark:text-gray-400">
              {daysRemaining} days remaining
            </div>
          </div>

          <div className="rounded-lg bg-gray-50 p-6 dark:bg-gray-800">
            <div className="mb-1 text-gray-600 text-sm dark:text-gray-400">
              {t("autoRenewal")}
            </div>
            <div className="mb-2 font-semibold text-gray-900 text-lg dark:text-gray-100">
              {isAutoRenewEnabled ? t("enabled") : t("disabled")}
            </div>
            <Button
              className="mt-2"
              onClick={() => setIsAutoRenewEnabled(!isAutoRenewEnabled)}
              size="sm"
              variant="outline"
            >
              {isAutoRenewEnabled ? t("disable") : t("enable")}
            </Button>
          </div>
        </div>

        <Separator className="my-8" />

        <h3 className="mb-4 font-semibold text-gray-900 text-lg dark:text-gray-100">
          {t("upgradeMembership")}
        </h3>
        <p className="mb-6 text-gray-600 dark:text-gray-400">
          {t("upgradeDescription")}
        </p>

        <div className="mb-6 grid gap-6 sm:grid-cols-3">
          {Object.entries(MEMBERSHIP_PRICES).map(([type, price]) => (
            <Card
              className={`cursor-pointer border-2 p-6 transition-all ${
                type === currentPlan
                  ? "border-[#3DA9E0] bg-[#3DA9E0]/5"
                  : "border-gray-200 hover:border-[#3DA9E0]/50"
              }`}
              key={type}
            >
              <div className="text-center">
                {type === currentPlan && (
                  <Badge className="mb-3 bg-[#3DA9E0] text-white">
                    {t("currentPlanBadge")}
                  </Badge>
                )}
                <h3 className="mb-2 font-semibold text-gray-900 text-lg dark:text-gray-100">
                  {tPricing(type as MembershipDuration)}
                </h3>
                <div className="mb-1 font-bold text-2xl text-gray-900 dark:text-gray-100">
                  {price} NOK
                </div>
                <div className="mb-4 text-gray-600 text-sm dark:text-gray-400">
                  {type === "semester" && t("monthlyPrice", { price: 58 })}
                  {type === "year" && t("monthlyPrice", { price: 46 })}
                  {type === "three-year" && t("monthlyPrice", { price: 39 })}
                </div>
                {type === "three-year" && (
                  <Badge
                    className="border-green-200 bg-green-50 text-green-700"
                    variant="outline"
                  >
                    {t("savePercent", { percent: 33 })}
                  </Badge>
                )}
              </div>
            </Card>
          ))}
        </div>

        <Alert className="border-[#3DA9E0]/20 bg-[#3DA9E0]/5">
          <Sparkles className="h-4 w-4 text-[#3DA9E0]" />
          <AlertDescription className="text-gray-700">
            <strong>{t("proTip")}</strong> {t("proTipDescription")}
          </AlertDescription>
        </Alert>

        <Separator className="my-8" />

        <h3 className="mb-4 font-semibold text-gray-900 text-lg dark:text-gray-100">
          {t("digitalCard")}
        </h3>
        <div className="grid gap-6 md:grid-cols-2">
          <MembershipCard
            expiryDate={expiryDate}
            membershipType={tPricing(currentPlan)}
            studentId={studentId}
            userName={userName}
          />

          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">{t("useCard")}</p>
            <div className="space-y-3">
              <Button className="w-full justify-start" variant="outline">
                <Download className="mr-2 h-4 w-4" />
                {t("addToAppleWallet")}
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <Smartphone className="mr-2 h-4 w-4" />
                {t("addToGooglePay")}
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <Share2 className="mr-2 h-4 w-4" />
                {t("shareCard")}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </>
  );

  return (
    <TabsContent className="space-y-8" value="membership">
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
