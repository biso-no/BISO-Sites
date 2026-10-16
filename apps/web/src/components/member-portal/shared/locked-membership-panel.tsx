"use client";

import { POPULAR_MEMBERSHIP_DURATION } from "@repo/shared/utils/membership-plans";
import { ArrowRight, Check, Lock, LogIn } from "lucide-react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { MembershipPlanCard } from "@/components/membership/plan-card";
import { statusPanelPrimaryAction } from "@/components/ui/status-panel";
import { clearBrowserAppwriteSession } from "@/lib/bi-sign-in-client";
import type { PlanView } from "@/lib/member-portal-membership";
import { switchToBiSignIn } from "@/lib/server";

const QUICK_BENEFIT_KEYS = ["discounts", "card", "priority", "career"] as const;

/**
 * The membership tab for someone who is not a member.
 *
 * Replaces an overlay that blurred the members' view behind a card of three
 * hardcoded prices (one of them wrong) leading to the old shop listing. The
 * plans here are the catalog's own — one card per duration, as the portal
 * shows them — and the way in is the join flow, which owns the season choice,
 * the campus and the payment.
 *
 * Without a BI identity there is nothing to buy yet: membership follows the
 * student number, so the step is "Sign in with BI". There is no linking — the
 * visitor signs out of this account and in with BI, and lands back here.
 */
export function LockedMembershipPanel({
  hasBIIdentity,
  plans,
}: {
  hasBIIdentity: boolean;
  plans: PlanView[];
}) {
  const t = useTranslations("memberPortal");
  const tDuration = useTranslations("memberPass.duration");
  const format = useFormatter();
  const [isSwitching, startSwitch] = useTransition();

  const handleSignInWithBi = () => {
    startSwitch(async () => {
      try {
        await clearBrowserAppwriteSession();
        await switchToBiSignIn("/member");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        toast.error(message);
      }
    });
  };

  const benefits = QUICK_BENEFIT_KEYS.map((key) => t(`cta.benefits.${key}`));
  const benefitList = (
    <ul className="grid gap-2 sm:grid-cols-2">
      {benefits.map((benefit) => (
        <li
          className="type-body-sm flex items-start gap-2 text-ink-muted"
          key={benefit}
        >
          <Check
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-ink-accent"
          />
          {benefit}
        </li>
      ))}
    </ul>
  );

  if (!hasBIIdentity) {
    return (
      <section className="flex flex-col gap-6 rounded-biso-lg border border-edge p-6 sm:p-10">
        <Lock aria-hidden="true" className="size-6 text-ink-muted" />
        <div>
          <h2 className="type-display-sm break-words text-ink">
            {t("states.noBIEmail.title")}
          </h2>
          <p className="type-body mt-3 max-w-(--measure) text-ink-muted">
            {t("states.noBIEmail.description")}
          </p>
        </div>
        <div>
          <h3 className="type-heading-card mb-3 text-ink">
            {t("locked.whatYoullGet")}
          </h3>
          {benefitList}
        </div>
        <div className="flex flex-col items-start gap-3">
          <button
            aria-busy={isSwitching}
            className={`${statusPanelPrimaryAction} disabled:opacity-60`}
            disabled={isSwitching}
            onClick={handleSignInWithBi}
            type="button"
          >
            <LogIn aria-hidden="true" className="size-4 shrink-0" />
            {isSwitching
              ? t("locked.processing")
              : t("states.noBIEmail.linkEmail")}
          </button>
          <p className="type-body-sm text-ink-muted">
            {t("states.noBIEmail.securityNote")}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6 rounded-biso-lg border border-edge p-6 sm:p-10">
      <Lock aria-hidden="true" className="size-6 text-ink-muted" />
      <div>
        <h2 className="type-display-sm break-words text-ink">
          {t("states.notMember.title")}
        </h2>
        <p className="type-body mt-3 max-w-(--measure) text-ink-muted">
          {t("locked.description")}
        </p>
      </div>
      {benefitList}
      {plans.length > 0 ? (
        <ul className="grid gap-5 sm:grid-cols-3">
          {plans.map((plan) => (
            <li key={plan.id}>
              <MembershipPlanCard
                footer={
                  <p className="type-body-sm text-ink-muted">
                    {t("membership.validUntilDate", {
                      date: format.dateTime(
                        new Date(`${plan.expiryDate}T12:00:00Z`),
                        { dateStyle: "long", timeZone: "Europe/Oslo" }
                      ),
                    })}
                  </p>
                }
                name={tDuration(plan.duration)}
                popular={plan.duration === POPULAR_MEMBERSHIP_DURATION}
                popularLabel={t("membership.popular")}
                price={plan.price}
              />
            </li>
          ))}
        </ul>
      ) : null}
      <Link
        className={`self-start ${statusPanelPrimaryAction}`}
        href="/membership/join"
      >
        {t("states.notMember.purchaseMembership")}
        <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
      </Link>
    </section>
  );
}
