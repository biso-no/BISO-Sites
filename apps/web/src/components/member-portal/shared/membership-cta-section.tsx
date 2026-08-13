"use client";

import {
  type MembershipPlan,
  POPULAR_MEMBERSHIP_DURATION,
} from "@repo/shared/utils/membership-plans";
import { Button } from "@repo/ui/components/ui/button";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { CreditCard, Sparkles, Users } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { getMembershipPlansForPurchase } from "@/app/actions/membership";
import { MembershipPlanCard } from "@/components/membership/plan-card";

const BENEFIT_KEYS = [
  "discounts",
  "events",
  "career",
  "card",
  "priority",
] as const;
const SKELETON_PLAN_KEYS = [
  "plan-skeleton-1",
  "plan-skeleton-2",
  "plan-skeleton-3",
] as const;

// This section mounts twice at once — the member portal's tab content stays
// mounted for all tabs simultaneously, and both the home and benefits tabs
// render it — so a module-scoped cache dedupes the two mounts down to one
// underlying request instead of two independent Appwrite round trips.
let plansRequest: Promise<MembershipPlan[]> | null = null;
function fetchMembershipPlans() {
  plansRequest ??= getMembershipPlansForPurchase().catch((error) => {
    plansRequest = null;
    throw error;
  });
  return plansRequest;
}

export function MembershipCtaSection() {
  const t = useTranslations("memberPortal");
  const [plans, setPlans] = useState<MembershipPlan[] | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    fetchMembershipPlans()
      .then((result) => {
        if (cancelled) {
          return;
        }
        setPlans(result);
        setSelectedPlanId(
          result.find((plan) => plan.duration === POPULAR_MEMBERSHIP_DURATION)
            ?.id ?? result[0]?.id
        );
      })
      .catch(() => {
        // Same fallback as an empty catalog: skip the section rather than
        // spin a skeleton forever or throw an unhandled rejection.
        if (!cancelled) {
          setPlans([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // No plans currently on offer — same as the purchase flow's own
  // no_plans_available gate, this section simply doesn't render rather than
  // showing a dead-end CTA.
  if (plans !== null && plans.length === 0) {
    return null;
  }

  const benefits = BENEFIT_KEYS.map((key) => t(`cta.benefits.${key}`));

  return (
    <section className="relative overflow-hidden py-16">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-20 -left-20 h-72 w-72 rounded-full bg-brand opacity-10 blur-3xl" />
        <div className="absolute -right-20 bottom-20 h-96 w-96 rounded-full bg-cyan-300 opacity-10 blur-3xl" />
      </div>

      <div className="relative z-10">
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

        <div className="mx-auto mb-12 grid max-w-4xl gap-6 md:grid-cols-3">
          {plans === null
            ? SKELETON_PLAN_KEYS.map((key) => (
                <Skeleton className="h-64 rounded-2xl" key={key} />
              ))
            : plans.map((plan, index) => (
                <motion.button
                  animate={{ opacity: 1, y: 0 }}
                  className="block h-full text-left"
                  initial={{ opacity: 0, y: 20 }}
                  key={plan.id}
                  onClick={() => setSelectedPlanId(plan.id)}
                  transition={{ delay: index * 0.1 }}
                  type="button"
                >
                  <MembershipPlanCard
                    benefits={benefits}
                    name={t(`cta.plans.${plan.duration}`)}
                    popular={plan.duration === POPULAR_MEMBERSHIP_DURATION}
                    popularLabel={t("cta.popular")}
                    price={plan.price}
                    selected={selectedPlanId === plan.id}
                  />
                </motion.button>
              ))}
        </div>

        {plans === null ? null : (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
            initial={{ opacity: 0, y: 20 }}
            transition={{ delay: 0.5 }}
          >
            <Button
              asChild
              className="h-14 bg-linear-to-r from-brand-gradient-from to-brand-gradient-to px-10 text-lg text-white shadow-brand/30 shadow-xl hover:from-brand-gradient-from/90 hover:to-brand-gradient-to/90"
              size="lg"
            >
              <Link href="/membership/join">
                <CreditCard className="mr-2 h-5 w-5" />
                {t("cta.joinNow")}
              </Link>
            </Button>

            <p className="mt-4 flex items-center justify-center gap-2 text-muted-foreground text-sm">
              <Users className="h-4 w-4" />
              {t("cta.socialProof")}
            </p>
          </motion.div>
        )}
      </div>
    </section>
  );
}
