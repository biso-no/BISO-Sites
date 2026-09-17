"use client";

import {
  membershipPriceFormatter,
  POPULAR_MEMBERSHIP_DURATION,
} from "@repo/shared/utils/membership-plans";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Separator } from "@repo/ui/components/ui/separator";
import { TabsContent } from "@repo/ui/components/ui/tabs";
import { Check } from "lucide-react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { MemberPass } from "@/components/member-pass/member-pass";
import type {
  CurrentMembershipView,
  PlanView,
} from "@/lib/member-portal-membership";
import { LockedContentOverlay } from "../shared/locked-content-overlay";

interface MembershipTabProps {
  current: CurrentMembershipView | null;
  hasBIIdentity: boolean;
  isMember: boolean;
  plans: PlanView[];
}

function useDate() {
  const format = useFormatter();
  return (date: string) =>
    format.dateTime(new Date(`${date}T12:00:00Z`), {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
}

function Stat({
  label,
  value,
  hint,
}: {
  hint?: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg bg-section p-6 dark:bg-inverted">
      <div className="mb-1 text-muted-foreground text-sm">{label}</div>
      <div className="font-semibold text-foreground text-lg">{value}</div>
      {hint ? (
        <div className="text-muted-foreground text-sm">{hint}</div>
      ) : null}
    </div>
  );
}

export function MembershipTab({
  current,
  hasBIIdentity,
  isMember,
  plans,
}: MembershipTabProps) {
  const t = useTranslations("memberPortal.membership");
  const tPass = useTranslations("memberPass");
  const formatDate = useDate();

  const content = (
    <Card className="border-0 p-8 shadow-lg dark:bg-inverted/50 dark:backdrop-blur-sm">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="mb-2 font-bold text-foreground text-xl">
            {t("title")}
          </h3>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
        {current ? (
          <Badge className="border-green-200 bg-green-100 px-4 py-2 text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-400">
            <Check className="mr-2 h-4 w-4" />
            {t("active")}
          </Badge>
        ) : null}
      </div>

      {current ? (
        <div className="mb-8 grid gap-6 md:grid-cols-3">
          <Stat
            label={t("currentPlan")}
            value={
              current.duration
                ? tPass(`duration.${current.duration}`)
                : current.name
            }
          />
          <Stat label={t("startDate")} value={formatDate(current.startDate)} />
          <Stat
            hint={t("daysRemaining", { days: current.daysRemaining })}
            label={t("validUntil")}
            value={formatDate(current.expiryDate)}
          />
        </div>
      ) : null}

      <h3 className="mb-4 font-semibold text-foreground text-lg">
        {t("yourPass")}
      </h3>
      <div className="mx-auto max-w-md">
        <MemberPass />
      </div>

      <Separator className="my-8" />

      <h3 className="mb-2 font-semibold text-foreground text-lg">
        {t("extendTitle")}
      </h3>
      <p className="mb-6 text-muted-foreground">{t("extendDescription")}</p>
      {plans.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("noUpgrades")}</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-3">
          {plans.map((plan) => (
            <Card
              className="flex flex-col items-center gap-2 border-2 p-6 text-center"
              key={plan.id}
            >
              {plan.duration === POPULAR_MEMBERSHIP_DURATION ? (
                <Badge className="bg-brand text-white">{t("popular")}</Badge>
              ) : null}
              <h4 className="font-semibold text-foreground text-lg">
                {tPass(`duration.${plan.duration}`)}
              </h4>
              <p className="font-bold text-2xl text-foreground">
                {membershipPriceFormatter.format(plan.price)}
              </p>
              <p className="text-muted-foreground text-sm">
                {t("validUntilDate", { date: formatDate(plan.expiryDate) })}
              </p>
              <Button asChild className="mt-2 w-full">
                <Link href="/membership/join">{t("choosePlan")}</Link>
              </Button>
            </Card>
          ))}
        </div>
      )}
    </Card>
  );

  return (
    <TabsContent className="space-y-8" value="membership">
      {isMember ? (
        content
      ) : (
        <LockedContentOverlay hasBIIdentity={hasBIIdentity}>
          {content}
        </LockedContentOverlay>
      )}
    </TabsContent>
  );
}
