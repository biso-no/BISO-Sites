"use client";

import { initiateVippsCheckout } from "@repo/payment/actions";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Check, CreditCard, Sparkles, Users, Zap } from "lucide-react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

type MembershipDuration = "semester" | "year" | "three-year";

const MEMBERSHIP_OPTIONS: {
  type: MembershipDuration;
  price: number;
  monthlyPrice: number;
  popular: boolean;
  gradient: string;
}[] = [
  {
    type: "semester",
    price: 350,
    monthlyPrice: 58,
    popular: false,
    gradient: "from-slate-600 to-slate-700",
  },
  {
    type: "year",
    price: 550,
    monthlyPrice: 46,
    popular: true,
    gradient: "from-brand-gradient-from to-brand-gradient-to",
  },
  {
    type: "three-year",
    price: 1350,
    monthlyPrice: 37,
    popular: false,
    gradient: "from-emerald-500 to-teal-500",
  },
];

const MEMBERSHIP_BENEFITS = [
  "Exclusive discounts at 50+ partners",
  "Member-only events access",
  "Career resources and networking",
  "Digital membership card",
  "Priority access to sold-out events",
];

export function MembershipCtaSection() {
  const t = useTranslations("memberPortal");
  const [selectedPlan, setSelectedPlan] = useState<MembershipDuration>("year");
  const [isPending, startTransition] = useTransition();

  const handlePurchase = () => {
    const option = MEMBERSHIP_OPTIONS.find((o) => o.type === selectedPlan);
    if (!option) {
      return;
    }

    startTransition(async () => {
      try {
        await initiateVippsCheckout({
          reference: `membership-${Date.now()}`,
          amount: option.price * 100,
          description: `BISO Membership - ${t(`cta.plans.${selectedPlan}`)}`,
          returnUrl: `${window.location.origin}/member?purchase=success`,
          customerInfo: {},
        });
      } catch (error) {
        console.error("Failed to initiate checkout:", error);
      }
    });
  };

  return (
    <section className="relative overflow-hidden py-16">
      {/* Background decorations */}
      <div className="pointer-events-none absolute inset-0">
        <div className="-left-20 absolute top-20 h-72 w-72 rounded-full bg-brand opacity-10 blur-3xl" />
        <div className="-right-20 absolute bottom-20 h-96 w-96 rounded-full bg-cyan-300 opacity-10 blur-3xl" />
      </div>

      <div className="relative z-10">
        {/* Section Header */}
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="mb-12 text-center"
          initial={{ opacity: 0, y: 20 }}
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-brand-muted px-4 py-2">
            <Sparkles className="h-4 w-4 text-brand" />
            <span className="text-brand-dark dark:text-brand">
              {t("cta.badge")}
            </span>
          </div>
          <h2 className="mb-4 font-bold text-4xl text-foreground dark:text-foreground">
            {t("cta.title")}
          </h2>
          <p className="mx-auto max-w-2xl text-muted-foreground dark:text-muted-foreground">
            {t("cta.description")}
          </p>
        </motion.div>

        {/* Pricing Cards */}
        <div className="mx-auto mb-12 grid max-w-4xl gap-6 md:grid-cols-3">
          {MEMBERSHIP_OPTIONS.map((option, index) => (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="relative"
              initial={{ opacity: 0, y: 20 }}
              key={option.type}
              transition={{ delay: index * 0.1 }}
            >
              {option.popular && (
                <div className="-top-4 -translate-x-1/2 absolute left-1/2 z-10">
                  <Badge className="border-0 bg-gradient-to-r from-brand-gradient-from to-brand-gradient-to px-4 py-1.5 text-white shadow-lg">
                    <Zap className="mr-1.5 h-3.5 w-3.5" />
                    {t("cta.popular")}
                  </Badge>
                </div>
              )}

              <Card
                className={`cursor-pointer border-2 p-6 transition-all duration-300 ${
                  selectedPlan === option.type
                    ? "scale-[1.02] border-brand bg-brand-muted shadow-xl dark:bg-brand-muted"
                    : "border-border hover:border-brand-border-strong hover:shadow-lg dark:border-border"
                } ${option.popular ? "ring-2 ring-brand ring-offset-2 dark:ring-offset-background" : ""}`}
                onClick={() => setSelectedPlan(option.type)}
              >
                <div className="text-center">
                  <h3 className="mb-3 font-semibold text-foreground text-lg dark:text-foreground">
                    {t(`cta.plans.${option.type}`)}
                  </h3>

                  <div className="mb-1">
                    <span className="font-bold text-4xl text-foreground dark:text-foreground">
                      {option.price}
                    </span>
                    <span className="ml-1 text-muted-foreground">NOK</span>
                  </div>

                  <p className="mb-4 text-muted-foreground text-sm dark:text-muted-foreground">
                    {t("cta.monthly", { price: option.monthlyPrice })}
                  </p>

                  {option.type === "three-year" && (
                    <Badge className="border-green-200 bg-green-100 text-green-700 dark:border-green-900 dark:bg-green-900/30 dark:text-green-400">
                      {t("cta.save", { percent: 33 })}
                    </Badge>
                  )}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Benefits List */}
        <motion.div
          animate={{ opacity: 1 }}
          className="mx-auto mb-10 max-w-2xl"
          initial={{ opacity: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {MEMBERSHIP_BENEFITS.map((benefit, index) => (
              <div className="flex items-center gap-3" key={index}>
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-gradient-from to-brand-gradient-to">
                  <Check className="h-3.5 w-3.5 text-white" />
                </div>
                <span className="text-muted-foreground text-sm dark:text-muted-foreground">
                  {benefit}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* CTA Button */}
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          transition={{ delay: 0.5 }}
        >
          <Button
            className="h-14 bg-gradient-to-r from-brand-gradient-from to-brand-gradient-to px-10 text-lg text-white shadow-brand/30 shadow-xl hover:from-brand-gradient-from/90 hover:to-brand-gradient-to/90"
            disabled={isPending}
            onClick={handlePurchase}
            size="lg"
          >
            <CreditCard className="mr-2 h-5 w-5" />
            {isPending ? t("cta.processing") : t("cta.joinNow")}
          </Button>

          <p className="mt-4 flex items-center justify-center gap-2 text-muted-foreground text-sm">
            <Users className="h-4 w-4" />
            {t("cta.socialProof")}
          </p>
        </motion.div>
      </div>
    </section>
  );
}
