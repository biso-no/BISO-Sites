"use client";

import { initiateVippsCheckout } from "@repo/payment/actions";
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { CreditCard, LinkIcon, Lock } from "lucide-react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

interface LockedContentOverlayProps {
  hasBIIdentity: boolean;
  children: React.ReactNode;
}

const MEMBERSHIP_PRICES = {
  semester: 350,
  year: 550,
  "three-year": 1400,
};

export function LockedContentOverlay({ hasBIIdentity, children }: LockedContentOverlayProps) {
  const t = useTranslations("memberPortal");
  const [isPending, startTransition] = useTransition();

  const handleLinkBIEmail = () => {
    window.location.href = "/api/auth/oauth/bi";
  };

  const handlePurchase = (plan: "semester" | "year" | "three-year") => {
    startTransition(async () => {
      try {
        await initiateVippsCheckout({
          reference: `membership-${Date.now()}`,
          amount: MEMBERSHIP_PRICES[plan] * 100,
          description: `BISO Membership - ${plan}`,
          returnUrl: `${window.location.origin}/member?purchase=success`,
          customerInfo: {},
        });
      } catch (error) {
        console.error("Failed to initiate checkout:", error);
      }
    });
  };

  return (
    <div className="relative">
      {/* Blurred content */}
      <div className="filter blur-sm pointer-events-none select-none">{children}</div>

      {/* Overlay */}
      <div className="absolute inset-0 flex items-center justify-center p-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-2xl w-full"
        >
          <Card className="p-8 border-2 border-[#3DA9E0]/20 dark:border-[#3DA9E0]/30 shadow-xl dark:bg-gray-900/90 dark:backdrop-blur-sm">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-linear-to-br from-[#3DA9E0] to-[#001731] flex items-center justify-center">
              <Lock className="w-8 h-8 text-white" />
            </div>

            {!hasBIIdentity ? (
              // Need to link BI email first
              <>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4 text-center">
                  {t("states.noBIEmail.title")}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6 text-center">
                  {t("states.noBIEmail.description")}
                </p>
                <Alert className="mb-6 border-[#3DA9E0]/20 dark:border-[#3DA9E0]/30 bg-[#3DA9E0]/5 dark:bg-[#3DA9E0]/10">
                  <AlertDescription className="text-gray-700 dark:text-gray-300 text-center">
                    {t("states.noBIEmail.securityNote")}
                  </AlertDescription>
                </Alert>
                <Button
                  className="w-full bg-linear-to-r from-[#3DA9E0] to-[#001731] hover:from-[#3DA9E0]/90 hover:to-[#001731]/90 text-white"
                  onClick={handleLinkBIEmail}
                >
                  <LinkIcon className="w-4 h-4 mr-2" />
                  {t("states.noBIEmail.linkEmail")}
                </Button>
              </>
            ) : (
              // Need to purchase membership
              <>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4 text-center">
                  {t("states.notMember.title")}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6 text-center">
                  Unlock this content and all member benefits
                </p>

                <div className="grid sm:grid-cols-3 gap-4 mb-6">
                  {Object.entries(MEMBERSHIP_PRICES).map(([type, price]) => (
                    <Card
                      key={type}
                      className="p-4 border-2 border-gray-200 dark:border-gray-700 hover:border-[#3DA9E0] dark:hover:border-[#3DA9E0] transition-colors cursor-pointer dark:bg-gray-800/50"
                      onClick={() => handlePurchase(type as any)}
                    >
                      <div className="text-center">
                        <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                          {t(`states.notMember.pricing.${type}`)}
                        </h4>
                        <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
                          {price} NOK
                        </div>
                        {type === "three-year" && (
                          <Badge
                            variant="outline"
                            className="mt-2 border-[#3DA9E0]/20 dark:border-[#3DA9E0]/30 text-[#3DA9E0] text-xs"
                          >
                            {t("states.notMember.pricing.bestValue")}
                          </Badge>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>

                <Button
                  className="w-full bg-linear-to-r from-[#3DA9E0] to-[#001731] hover:from-[#3DA9E0]/90 hover:to-[#001731]/90 text-white"
                  onClick={() => handlePurchase("year")}
                  disabled={isPending}
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  {isPending ? "Processing..." : t("states.notMember.purchaseMembership")}
                </Button>
              </>
            )}
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
