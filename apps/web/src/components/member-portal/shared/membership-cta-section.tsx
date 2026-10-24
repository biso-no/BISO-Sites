"use client";

import {
  type MembershipPlan,
  POPULAR_MEMBERSHIP_DURATION,
} from "@repo/shared/utils/membership-plans";
import type { MembershipTextItem } from "@repo/shared/utils/membership-texts";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { getMembershipPlansForPurchase } from "@/app/actions/membership";
import { MembershipPlanCard } from "@/components/membership/plan-card";
import { statusPanelPrimaryAction } from "@/components/ui/status-panel";

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

/**
 * "Become a member" for the portal: the plans on sale now, one card per
 * duration, priced from the catalog, and one way in — the join flow, which
 * owns the season choice, the campus and the payment.
 */
interface MembershipCtaSectionProps {
  /** Saved text from admin; null or missing keeps the built-in i18n text. */
  items?: MembershipTextItem[] | null;
}

export function MembershipCtaSection({ items }: MembershipCtaSectionProps) {
  const t = useTranslations("memberPortal.cta");
  const [plans, setPlans] = useState<MembershipPlan[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMembershipPlans()
      .then((result) => {
        if (!cancelled) {
          setPlans(result);
        }
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

  const benefits = items?.length
    ? items.map((item) => item.title)
    : BENEFIT_KEYS.map((key) => t(`benefits.${key}`));

  return (
    <section className="rounded-biso-lg border border-edge p-6 sm:p-10">
      <p className="type-label text-ink-accent">{t("badge")}</p>
      <h2 className="type-display-sm mt-3 break-words text-ink">
        {t("title")}
      </h2>
      <p className="type-body mt-3 max-w-(--measure) text-ink-muted">
        {t("description")}
      </p>

      <ul className="mt-8 grid gap-5 md:grid-cols-3">
        {plans === null
          ? SKELETON_PLAN_KEYS.map((key) => (
              <li
                className="h-64 rounded-biso-md bg-surface-sunken"
                key={key}
              />
            ))
          : plans.map((plan) => (
              <li key={plan.id}>
                <MembershipPlanCard
                  benefits={benefits}
                  name={t(`plans.${plan.duration}`)}
                  popular={plan.duration === POPULAR_MEMBERSHIP_DURATION}
                  popularLabel={t("popular")}
                  price={plan.price}
                />
              </li>
            ))}
      </ul>

      {plans === null ? null : (
        <Link
          className={`mt-8 ${statusPanelPrimaryAction}`}
          href="/membership/join"
        >
          {t("joinNow")}
          <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
        </Link>
      )}
    </section>
  );
}
