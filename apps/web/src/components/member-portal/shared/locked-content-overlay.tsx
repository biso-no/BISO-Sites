"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import {
  Check,
  CreditCard,
  Gift,
  LinkIcon,
  Lock,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { createCartCheckoutSession as initiateVippsCheckout } from "@/app/actions/orders";

interface LockedContentOverlayProps {
  children: React.ReactNode;
  hasBIIdentity: boolean;
}

type MembershipDuration = "semester" | "year" | "three-year";

const MEMBERSHIP_OPTIONS: {
  type: MembershipDuration;
  price: number;
  popular: boolean;
}[] = [
  { type: "semester", price: 350, popular: false },
  { type: "year", price: 550, popular: true },
  { type: "three-year", price: 1400, popular: false },
];

const QUICK_BENEFITS = [
  "50+ exclusive discounts",
  "Digital membership card",
  "Priority event access",
  "Career resources",
];

export function LockedContentOverlay({
  hasBIIdentity,
  children,
}: LockedContentOverlayProps) {
  const t = useTranslations("memberPortal");
  const [isPending, startTransition] = useTransition();
  const [selectedPlan, setSelectedPlan] = useState<MembershipDuration>("year");

  const handleLinkBIEmail = () => {
    window.location.href = "/api/auth/oauth/bi";
  };

  const handlePurchase = () => {
    const option = MEMBERSHIP_OPTIONS.find((o) => o.type === selectedPlan);
    if (!option) {
      return;
    }

    startTransition(async () => {
      try {
        await initiateVippsCheckout({
          reference: `membership-${Date.now()}`,
          total: option.price * 100,
          description: `BISO Membership - ${selectedPlan}`,
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
      {/* Semi-visible blurred content */}
      <div className="pointer-events-none select-none opacity-40 blur-[2px] filter">
        {children}
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 flex items-start justify-center overflow-y-auto bg-linear-to-b from-background/60 via-background/80 to-background p-4 pt-12 backdrop-blur-[1px] dark:from-inverted/60 dark:via-inverted/80 dark:to-inverted">
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-2xl"
          initial={{ opacity: 0, y: 20 }}
        >
          <Card className="relative overflow-hidden border-2 border-brand/30 p-8 shadow-2xl dark:border-brand/40 dark:bg-inverted/95 dark:backdrop-blur-xl">
            {/* Background decoration */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -top-20 -left-20 h-64 w-64 rounded-full bg-brand opacity-5 blur-3xl" />
              <div className="absolute -right-20 -bottom-20 h-64 w-64 rounded-full bg-cyan-300 opacity-5 blur-3xl" />
            </div>

            <div className="relative z-10">
              {/* Lock icon with glow */}
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-linear-to-br from-brand-gradient-from to-brand-gradient-to shadow-brand/30 shadow-xl"
                transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
              >
                <Lock className="h-10 w-10 text-white" />
              </motion.div>

              {hasBIIdentity ? (
                // Need to purchase membership
                <>
                  <h3 className="mb-3 text-center font-bold text-2xl text-foreground dark:text-foreground">
                    {t("states.notMember.title")}
                  </h3>
                  <p className="mb-8 text-center text-muted-foreground dark:text-muted-foreground">
                    {t("locked.description")}
                  </p>

                  {/* Quick benefits */}
                  <div className="mb-8 grid gap-2 sm:grid-cols-2">
                    {QUICK_BENEFITS.map((benefit, index) => (
                      <div
                        className="flex items-center gap-2 text-muted-foreground text-sm dark:text-muted-foreground"
                        key={index}
                      >
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-muted dark:bg-brand-muted-strong">
                          <Check className="h-3 w-3 text-brand" />
                        </div>
                        {benefit}
                      </div>
                    ))}
                  </div>

                  {/* Pricing options */}
                  <div className="mb-6 grid gap-3 sm:grid-cols-3">
                    {MEMBERSHIP_OPTIONS.map((option) => (
                      <Card
                        className={`relative cursor-pointer border-2 p-4 transition-all ${
                          selectedPlan === option.type
                            ? "border-brand bg-brand-muted shadow-lg dark:bg-brand-muted"
                            : "border-border hover:border-brand-border-strong dark:border-border"
                        } ${option.popular ? "ring-2 ring-brand ring-offset-2 dark:ring-offset-inverted" : ""}`}
                        key={option.type}
                        onClick={() => setSelectedPlan(option.type)}
                      >
                        {option.popular && (
                          <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 border-0 bg-brand px-2 py-0.5 text-white text-xs">
                            <Zap className="mr-1 h-3 w-3" />
                            Best
                          </Badge>
                        )}
                        <div className="text-center">
                          <h4 className="mb-1 font-semibold text-foreground text-sm dark:text-foreground">
                            {t(`states.notMember.pricing.${option.type}`)}
                          </h4>
                          <div className="font-bold text-foreground text-xl dark:text-foreground">
                            {option.price}
                            <span className="ml-1 font-normal text-muted-foreground text-sm">
                              NOK
                            </span>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>

                  <Button
                    className="h-12 w-full bg-linear-to-r from-brand-gradient-from to-brand-gradient-to text-base text-white shadow-brand/30 shadow-lg hover:from-brand-gradient-from/90 hover:to-brand-gradient-to/90"
                    disabled={isPending}
                    onClick={handlePurchase}
                  >
                    <CreditCard className="mr-2 h-5 w-5" />
                    {isPending
                      ? t("locked.processing")
                      : t("states.notMember.purchaseMembership")}
                  </Button>

                  <p className="mt-4 flex items-center justify-center gap-2 text-center text-muted-foreground text-xs dark:text-muted-foreground">
                    <Shield className="h-3.5 w-3.5" />
                    {t("locked.securePayment")}
                  </p>
                </>
              ) : (
                // Need to link BI email first
                <>
                  <h3 className="mb-3 text-center font-bold text-2xl text-foreground dark:text-foreground">
                    {t("states.noBIEmail.title")}
                  </h3>
                  <p className="mb-8 text-center text-muted-foreground dark:text-muted-foreground">
                    {t("states.noBIEmail.description")}
                  </p>

                  {/* Benefits preview */}
                  <div className="mb-8 rounded-xl bg-brand-muted p-6 dark:bg-brand-muted-strong">
                    <div className="mb-4 flex items-center gap-2">
                      <Gift className="h-5 w-5 text-brand" />
                      <span className="font-semibold text-foreground dark:text-foreground">
                        {t("locked.whatYoullGet")}
                      </span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {QUICK_BENEFITS.map((benefit, index) => (
                        <div
                          className="flex items-center gap-2 text-muted-foreground text-sm dark:text-muted-foreground"
                          key={index}
                        >
                          <Sparkles className="h-3.5 w-3.5 text-brand" />
                          {benefit}
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button
                    className="h-12 w-full bg-linear-to-r from-brand-gradient-from to-brand-gradient-to text-base text-white shadow-brand/30 shadow-lg hover:from-brand-gradient-from/90 hover:to-brand-gradient-to/90"
                    onClick={handleLinkBIEmail}
                  >
                    <LinkIcon className="mr-2 h-5 w-5" />
                    {t("states.noBIEmail.linkEmail")}
                  </Button>

                  <p className="mt-4 text-center text-muted-foreground text-xs dark:text-muted-foreground">
                    {t("states.noBIEmail.securityNote")}
                  </p>
                </>
              )}
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
