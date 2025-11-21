"use client";

import { initiateVippsCheckout } from "@repo/payment/actions";
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { CreditCard, LinkIcon, Lock } from "lucide-react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";

type LockedContentOverlayProps = {
  hasBIIdentity: boolean;
  children: React.ReactNode;
};

const MEMBERSHIP_PRICES = {
  semester: 350,
  year: 550,
  "three-year": 1400,
};

export function LockedContentOverlay({
  hasBIIdentity,
  children,
}: LockedContentOverlayProps) {
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
      <div className="pointer-events-none select-none blur-sm filter">
        {children}
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-white/80 p-4 backdrop-blur-sm dark:bg-gray-900/80">
        <motion.div
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-2xl"
          initial={{ opacity: 0, scale: 0.95 }}
        >
          <Card className="border-2 border-[#3DA9E0]/20 p-8 shadow-xl dark:border-[#3DA9E0]/30 dark:bg-gray-900/90 dark:backdrop-blur-sm">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-[#3DA9E0] to-[#001731]">
              <Lock className="h-8 w-8 text-white" />
            </div>

            {hasBIIdentity ? (
              // Need to purchase membership
              <>
                <h3 className="mb-4 text-center font-bold text-2xl text-gray-900 dark:text-gray-100">
                  {t("states.notMember.title")}
                </h3>
                <p className="mb-6 text-center text-gray-600 dark:text-gray-400">
                  Unlock this content and all member benefits
                </p>

                <div className="mb-6 grid gap-4 sm:grid-cols-3">
                  {Object.entries(MEMBERSHIP_PRICES).map(([type, price]) => (
                    <Card
                      className="cursor-pointer border-2 border-gray-200 p-4 transition-colors hover:border-[#3DA9E0] dark:border-gray-700 dark:bg-gray-800/50 dark:hover:border-[#3DA9E0]"
                      key={type}
                      onClick={() => handlePurchase(type as any)}
                    >
                      <div className="text-center">
                        <h4 className="mb-1 font-semibold text-gray-900 dark:text-gray-100">
                          {t(`states.notMember.pricing.${type}`)}
                        </h4>
                        <div className="font-bold text-gray-900 text-xl dark:text-gray-100">
                          {price} NOK
                        </div>
                        {type === "three-year" && (
                          <Badge
                            className="mt-2 border-[#3DA9E0]/20 text-[#3DA9E0] text-xs dark:border-[#3DA9E0]/30"
                            variant="outline"
                          >
                            {t("states.notMember.pricing.bestValue")}
                          </Badge>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>

                <Button
                  className="w-full bg-linear-to-r from-[#3DA9E0] to-[#001731] text-white hover:from-[#3DA9E0]/90 hover:to-[#001731]/90"
                  disabled={isPending}
                  onClick={() => handlePurchase("year")}
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  {isPending
                    ? "Processing..."
                    : t("states.notMember.purchaseMembership")}
                </Button>
              </>
            ) : (
              // Need to link BI email first
              <>
                <h3 className="mb-4 text-center font-bold text-2xl text-gray-900 dark:text-gray-100">
                  {t("states.noBIEmail.title")}
                </h3>
                <p className="mb-6 text-center text-gray-600 dark:text-gray-400">
                  {t("states.noBIEmail.description")}
                </p>
                <Alert className="mb-6 border-[#3DA9E0]/20 bg-[#3DA9E0]/5 dark:border-[#3DA9E0]/30 dark:bg-[#3DA9E0]/10">
                  <AlertDescription className="text-center text-gray-700 dark:text-gray-300">
                    {t("states.noBIEmail.securityNote")}
                  </AlertDescription>
                </Alert>
                <Button
                  className="w-full bg-linear-to-r from-[#3DA9E0] to-[#001731] text-white hover:from-[#3DA9E0]/90 hover:to-[#001731]/90"
                  onClick={handleLinkBIEmail}
                >
                  <LinkIcon className="mr-2 h-4 w-4" />
                  {t("states.noBIEmail.linkEmail")}
                </Button>
              </>
            )}
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
