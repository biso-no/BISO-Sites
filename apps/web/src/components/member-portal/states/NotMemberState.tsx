"use client";

import { initiateVippsCheckout } from "@repo/payment/actions";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { ArrowLeft, Award, CheckCircle, CreditCard } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

type MembershipDuration = "semester" | "year" | "three-year";

const MEMBERSHIP_PRICES = {
  semester: 350,
  year: 550,
  "three-year": 1400,
};

interface NotMemberStateProps {
  benefitsCount?: number;
}

export function NotMemberState({ benefitsCount = 6 }: NotMemberStateProps) {
  const t = useTranslations("memberPortal");
  const [selectedPlan, setSelectedPlan] = useState<MembershipDuration>("year");
  const [isPending, startTransition] = useTransition();

  const handlePurchase = () => {
    startTransition(async () => {
      try {
        await initiateVippsCheckout({
          reference: `membership-${Date.now()}`,
          amount: MEMBERSHIP_PRICES[selectedPlan] * 100, // Convert to øre
          description: `BISO Membership - ${t(`states.notMember.pricing.${selectedPlan}`)}`,
          returnUrl: `${window.location.origin}/member?purchase=success`,
          customerInfo: {
            // Will be filled by Vipps from session
          },
        });
      } catch (error) {
        console.error("Failed to initiate checkout:", error);
      }
    });
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl w-full"
      >
        <Card className="p-8 border-0 shadow-xl dark:bg-gray-900/50 dark:backdrop-blur-sm">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-linear-to-br from-[#3DA9E0] to-[#001731] flex items-center justify-center">
            <Award className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4 text-center">
            {t("states.notMember.title")}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8 text-center max-w-xl mx-auto">
            {t("states.notMember.description")}
          </p>

          {/* Membership Options */}
          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            {Object.entries(MEMBERSHIP_PRICES).map(([type, price]) => (
              <Card
                key={type}
                className={`p-6 border-2 cursor-pointer transition-colors ${
                  selectedPlan === type
                    ? "border-[#3DA9E0] bg-[#3DA9E0]/5 dark:bg-[#3DA9E0]/10"
                    : "border-gray-200 dark:border-gray-700 hover:border-[#3DA9E0]/50 dark:hover:border-[#3DA9E0]/50"
                }`}
                onClick={() => setSelectedPlan(type as MembershipDuration)}
              >
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    {t(`states.notMember.pricing.${type}`)}
                  </h3>
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                    {price} NOK
                  </div>
                  <Badge
                    variant="outline"
                    className="border-[#3DA9E0]/20 text-[#3DA9E0] dark:border-[#3DA9E0]/30"
                  >
                    {type === "three-year"
                      ? t("states.notMember.pricing.bestValue")
                      : t("states.notMember.pricing.popular")}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>

          {/* Benefits Preview */}
          <div className="bg-linear-to-br from-[#3DA9E0]/10 to-[#001731]/10 dark:from-[#3DA9E0]/20 dark:to-[#001731]/20 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {t("states.notMember.whatYouGet")}
            </h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-[#3DA9E0] mt-0.5 shrink-0" />
                <span className="text-gray-700 dark:text-gray-300">
                  {t("states.notMember.benefits.discounts", { count: benefitsCount })}
                </span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-[#3DA9E0] mt-0.5 shrink-0" />
                <span className="text-gray-700 dark:text-gray-300">
                  {t("states.notMember.benefits.memberPricing")}
                </span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-[#3DA9E0] mt-0.5 shrink-0" />
                <span className="text-gray-700 dark:text-gray-300">
                  {t("states.notMember.benefits.priorityAccess")}
                </span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-[#3DA9E0] mt-0.5 shrink-0" />
                <span className="text-gray-700 dark:text-gray-300">
                  {t("states.notMember.benefits.community")}
                </span>
              </li>
            </ul>
          </div>

          <Button
            className="w-full bg-linear-to-r from-[#3DA9E0] to-[#001731] hover:from-[#3DA9E0]/90 hover:to-[#001731]/90 text-white mb-4"
            onClick={handlePurchase}
            disabled={isPending}
          >
            <CreditCard className="w-4 h-4 mr-2" />
            {isPending ? "Processing..." : t("states.notMember.purchaseMembership")}
          </Button>
          <Link href="/">
            <Button variant="outline" className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t("backToHome")}
            </Button>
          </Link>
        </Card>
      </motion.div>
    </div>
  );
}
