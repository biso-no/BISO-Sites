"use client";

import { POPULAR_MEMBERSHIP_DURATION } from "@repo/shared/utils/membership-plans";
import { TabsContent } from "@repo/ui/components/ui/tabs";
import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { MemberPass } from "@/components/member-pass/member-pass";
import { MembershipPlanCard } from "@/components/membership/plan-card";
import { Pill } from "@/components/ui/pill";
import type {
  CurrentMembershipView,
  PlanView,
} from "@/lib/member-portal-membership";
import { LockedMembershipPanel } from "../shared/locked-membership-panel";

interface MembershipTabProps {
  current: CurrentMembershipView | null;
  hasBIIdentity: boolean;
  isMember: boolean;
  plans: PlanView[];
}

const textLinkClass =
  "type-label inline-flex items-center gap-2 text-ink-accent underline-offset-4 hover:underline focus-visible:rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

function useDate() {
  const format = useFormatter();
  return (date: string) =>
    format.dateTime(new Date(`${date}T12:00:00Z`), {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Europe/Oslo",
    });
}

function Fact({
  label,
  value,
  hint,
}: {
  hint?: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-biso-md border border-edge p-5">
      <dt className="type-label text-ink-muted">{label}</dt>
      <dd className="type-heading-card mt-2 text-ink">{value}</dd>
      {hint ? (
        <dd className="type-body-sm mt-1 text-ink-muted">{hint}</dd>
      ) : null}
    </div>
  );
}

/**
 * The live membership, read from the Finago result: plan, start, expiry and
 * days left, the member pass, and the longer plans on sale. Nothing here is
 * invented — the previous tab always said "Year" and showed an auto-renew
 * toggle that did not exist.
 */
export function MembershipTab({
  current,
  hasBIIdentity,
  isMember,
  plans,
}: MembershipTabProps) {
  const t = useTranslations("memberPortal.membership");
  const tPass = useTranslations("memberPass");
  const formatDate = useDate();

  if (!isMember) {
    return (
      <TabsContent value="membership">
        <LockedMembershipPanel hasBIIdentity={hasBIIdentity} plans={plans} />
      </TabsContent>
    );
  }

  return (
    <TabsContent className="flex flex-col gap-12" value="membership">
      <section>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="type-display-sm text-ink">{t("title")}</h2>
            <p className="type-body mt-2 text-ink-muted">{t("description")}</p>
          </div>
          {current ? (
            <Pill tone="success">
              <Check aria-hidden="true" className="size-3.5 shrink-0" />
              {t("active")}
            </Pill>
          ) : null}
        </div>

        {current ? (
          <dl className="mt-6 grid gap-5 md:grid-cols-3">
            <Fact
              label={t("currentPlan")}
              value={
                current.duration
                  ? tPass(`duration.${current.duration}`)
                  : current.name
              }
            />
            <Fact
              label={t("startDate")}
              value={formatDate(current.startDate)}
            />
            <Fact
              hint={t("daysRemaining", { days: current.daysRemaining })}
              label={t("validUntil")}
              value={formatDate(current.expiryDate)}
            />
          </dl>
        ) : null}
      </section>

      <section>
        <h3 className="type-heading-section mb-4 text-ink">{t("yourPass")}</h3>
        <div className="max-w-md">
          <MemberPass />
        </div>
      </section>

      <section className="border-edge border-t pt-10">
        <h3 className="type-heading-section text-ink">{t("extendTitle")}</h3>
        <p className="type-body mt-2 mb-6 text-ink-muted">
          {t("extendDescription")}
        </p>
        {plans.length === 0 ? (
          <p className="type-body-sm text-ink-muted">{t("noUpgrades")}</p>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-3">
            {plans.map((plan) => (
              <li key={plan.id}>
                <MembershipPlanCard
                  footer={
                    <>
                      <p className="type-body-sm text-ink-muted">
                        {t("validUntilDate", {
                          date: formatDate(plan.expiryDate),
                        })}
                      </p>
                      <Link
                        className={`mt-auto pt-2 ${textLinkClass}`}
                        href="/membership/join"
                      >
                        {t("choosePlan")}
                        <ArrowRight aria-hidden="true" className="size-4" />
                      </Link>
                    </>
                  }
                  name={tPass(`duration.${plan.duration}`)}
                  popular={plan.duration === POPULAR_MEMBERSHIP_DURATION}
                  popularLabel={t("popular")}
                  price={plan.price}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </TabsContent>
  );
}
