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
import { LockedContentOverlay } from "../shared/LockedContentOverlay";
import { MembershipCard } from "../shared/MembershipCard";

type MembershipDuration = "semester" | "year" | "three-year";

const MEMBERSHIP_PRICES = {
  semester: 350,
  year: 550,
  "three-year": 1400,
};

interface MembershipTabProps {
  userName: string;
  studentId: string;
  currentPlan: MembershipDuration;
  expiryDate: string;
  daysRemaining: number;
  autoRenew: boolean;
  isMember: boolean;
  hasBIIdentity: boolean;
}

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
      <Card className="p-8 border-0 shadow-lg dark:bg-gray-900/50 dark:backdrop-blur-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {t("title")}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">{t("description")}</p>
          </div>
          <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 px-4 py-2">
            <Check className="w-4 h-4 mr-2" />
            {t("active")}
          </Badge>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="p-6 bg-linear-to-br from-[#3DA9E0]/10 to-[#001731]/10 rounded-lg">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t("currentPlan")}</div>
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {tPricing(currentPlan)}
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {MEMBERSHIP_PRICES[currentPlan]} NOK
            </div>
          </div>

          <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              {t("nextBillingDate")}
            </div>
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {new Date(expiryDate).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {daysRemaining} days remaining
            </div>
          </div>

          <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t("autoRenewal")}</div>
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {isAutoRenewEnabled ? t("enabled") : t("disabled")}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => setIsAutoRenewEnabled(!isAutoRenewEnabled)}
            >
              {isAutoRenewEnabled ? t("disable") : t("enable")}
            </Button>
          </div>
        </div>

        <Separator className="my-8" />

        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          {t("upgradeMembership")}
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">{t("upgradeDescription")}</p>

        <div className="grid sm:grid-cols-3 gap-6 mb-6">
          {Object.entries(MEMBERSHIP_PRICES).map(([type, price]) => (
            <Card
              key={type}
              className={`p-6 border-2 cursor-pointer transition-all ${
                type === currentPlan
                  ? "border-[#3DA9E0] bg-[#3DA9E0]/5"
                  : "border-gray-200 hover:border-[#3DA9E0]/50"
              }`}
            >
              <div className="text-center">
                {type === currentPlan && (
                  <Badge className="mb-3 bg-[#3DA9E0] text-white">{t("currentPlanBadge")}</Badge>
                )}
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  {tPricing(type as MembershipDuration)}
                </h3>
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                  {price} NOK
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {type === "semester" && t("monthlyPrice", { price: 58 })}
                  {type === "year" && t("monthlyPrice", { price: 46 })}
                  {type === "three-year" && t("monthlyPrice", { price: 39 })}
                </div>
                {type === "three-year" && (
                  <Badge variant="outline" className="border-green-200 text-green-700 bg-green-50">
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

        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          {t("digitalCard")}
        </h3>
        <div className="grid md:grid-cols-2 gap-6">
          <MembershipCard
            userName={userName}
            studentId={studentId}
            membershipType={tPricing(currentPlan)}
            expiryDate={expiryDate}
          />

          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">{t("useCard")}</p>
            <div className="space-y-3">
              <Button variant="outline" className="w-full justify-start">
                <Download className="w-4 h-4 mr-2" />
                {t("addToAppleWallet")}
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Smartphone className="w-4 h-4 mr-2" />
                {t("addToGooglePay")}
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Share2 className="w-4 h-4 mr-2" />
                {t("shareCard")}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </>
  );

  return (
    <TabsContent value="membership" className="space-y-8">
      {!isMember ? (
        <LockedContentOverlay hasBIIdentity={hasBIIdentity}>{content}</LockedContentOverlay>
      ) : (
        content
      )}
    </TabsContent>
  );
}
