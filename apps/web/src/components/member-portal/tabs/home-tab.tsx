"use client";

import type { CampusBenefits } from "@repo/api/types/appwrite";
import { TabsContent } from "@repo/ui/components/ui/tabs";
import { ArrowRight, Check, Gift, Zap } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { MemberPass } from "@/components/member-pass/member-pass";
import { Pill } from "@/components/ui/pill";
import { type Stat, StatRow } from "@/components/ui/stat-row";
import {
  statusPanelPrimaryAction,
  statusPanelSecondaryAction,
} from "@/components/ui/status-panel";
import { shouldShowEstimatedSavings } from "@/lib/member-portal-utils";
import { BenefitCard } from "../shared/benefit-card";
import { BenefitsShowcase } from "../shared/benefits-showcase";
import { MembershipCtaSection } from "../shared/membership-cta-section";

interface HomeTabProps {
  benefits: CampusBenefits[];
  benefitsCount: number;
  daysRemaining: number;
  estimatedSavings: number | null;
  expiryDate: string;
  hasBIIdentity: boolean;
  isMember: boolean;
  membershipType: string;
  onTabChange: (tab: string) => void;
  revealedBenefits: Set<string>;
  startDate: string;
  termDays: number;
}

const FEATURED_COUNT = 3;
const PERCENT = 100;

/** Time left in the term, as a native progress bar with a label. */
function TermProgress({ label, value }: { label: string; value: number }) {
  return (
    <progress
      aria-label={label}
      className="h-2 w-full appearance-none overflow-hidden rounded-biso-pill bg-surface-sunken [&::-moz-progress-bar]:bg-action [&::-webkit-progress-bar]:bg-surface-sunken [&::-webkit-progress-value]:bg-action"
      max={PERCENT}
      value={value}
    />
  );
}

function MembershipStatus({
  daysRemaining,
  expiryDate,
  startDate,
  termDays,
}: Pick<
  HomeTabProps,
  "daysRemaining" | "expiryDate" | "startDate" | "termDays"
>) {
  const t = useTranslations("memberPortal.overview");
  const tCommon = useTranslations("memberPortal.common");
  const format = useFormatter();
  const progress = Math.min(PERCENT, (daysRemaining / termDays) * PERCENT);
  const formatDate = (date: string) =>
    format.dateTime(new Date(`${date}T12:00:00Z`), {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Europe/Oslo",
    });

  return (
    <section className="flex flex-col gap-5 rounded-biso-md border border-edge p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="type-heading-section text-ink">
            {t("membershipStatus")}
          </h2>
          <p className="type-body-sm mt-1 text-ink-muted">
            {t("statusActive")}
          </p>
        </div>
        <Pill tone="success">
          <Check aria-hidden="true" className="size-3.5 shrink-0" />
          {tCommon("status.active")}
        </Pill>
      </div>

      <div>
        <div className="type-body-sm mb-2 flex justify-between gap-3">
          <span className="text-ink-muted">{t("timeRemaining")}</span>
          <span className="type-data text-ink">
            {t("daysRemaining", { days: daysRemaining })}
          </span>
        </div>
        <TermProgress label={t("timeRemaining")} value={progress} />
      </div>

      <dl className="type-body-sm grid gap-3 sm:grid-cols-2">
        <div className="rounded-biso-sm bg-surface-sunken p-4">
          <dt className="text-ink-muted">{t("started")}</dt>
          <dd className="mt-1 font-semibold text-ink">
            {formatDate(startDate)}
          </dd>
        </div>
        <div className="rounded-biso-sm bg-surface-sunken p-4">
          <dt className="text-ink-muted">{t("expires")}</dt>
          <dd className="mt-1 font-semibold text-ink">
            {formatDate(expiryDate)}
          </dd>
        </div>
      </dl>
    </section>
  );
}

function MemberOverview({
  membershipType,
  benefitsCount,
  daysRemaining,
  estimatedSavings,
  startDate,
  expiryDate,
  benefits,
  revealedBenefits,
  onTabChange,
  termDays,
}: Omit<HomeTabProps, "isMember" | "hasBIIdentity">) {
  const t = useTranslations("memberPortal.overview");
  const featuredBenefits = benefits.slice(0, FEATURED_COUNT);

  const stats: Stat[] = [
    { label: t("stats.membershipType"), value: membershipType },
    {
      label: t("stats.benefitsAvailable"),
      value: String(benefitsCount),
    },
  ];
  if (shouldShowEstimatedSavings(estimatedSavings)) {
    stats.push({
      label: t("stats.estimatedSavings"),
      value: `~${estimatedSavings} NOK`,
    });
  }

  return (
    <>
      <div className="grid items-start gap-8 lg:grid-cols-2">
        <div className="max-w-md">
          <MemberPass />
        </div>
        <MembershipStatus
          daysRemaining={daysRemaining}
          expiryDate={expiryDate}
          startDate={startDate}
          termDays={termDays}
        />
      </div>

      <StatRow stats={stats} />

      {featuredBenefits.length > 0 ? (
        <section>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="type-heading-section text-ink">
                {t("featuredBenefits")}
              </h2>
              <p className="type-body-sm mt-1 text-ink-muted">
                {t("featuredDescription")}
              </p>
            </div>
            <button
              className={statusPanelSecondaryAction}
              onClick={() => onTabChange("benefits")}
              type="button"
            >
              {t("viewAll")}
              <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
            </button>
          </div>

          <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {featuredBenefits.map((benefit) => (
              <li key={benefit.$id}>
                <BenefitCard
                  benefit={benefit}
                  isRevealed={revealedBenefits.has(benefit.$id)}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col items-start justify-between gap-6 rounded-biso-md border border-edge bg-surface-sunken p-8 md:flex-row md:items-center">
        <div>
          <h2 className="type-heading-section text-ink">
            {t("quickActions.title")}
          </h2>
          <p className="type-body mt-2 max-w-md text-ink-muted">
            {t("quickActions.description")}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            className={statusPanelPrimaryAction}
            onClick={() => onTabChange("benefits")}
            type="button"
          >
            <Gift aria-hidden="true" className="size-4 shrink-0" />
            {t("quickActions.viewBenefits")}
          </button>
          <button
            className={statusPanelSecondaryAction}
            onClick={() => onTabChange("membership")}
            type="button"
          >
            <Zap aria-hidden="true" className="size-4 shrink-0" />
            {t("quickActions.manageMembership")}
          </button>
        </div>
      </section>
    </>
  );
}

function NonMemberOverview({ benefits }: { benefits: CampusBenefits[] }) {
  const t = useTranslations("memberPortal.overview");
  return (
    <>
      <section>
        <p className="type-label text-ink-accent">{t("discoverEyebrow")}</p>
        <h2 className="type-display-sm mt-3 break-words text-ink">
          {t("discoverTitle")}
        </h2>
        <p className="type-body mt-3 max-w-(--measure) text-ink-muted">
          {t("discoverDescription")}
        </p>
      </section>

      <BenefitsShowcase benefits={benefits} />

      <MembershipCtaSection />
    </>
  );
}

export function HomeTab({
  membershipType,
  benefitsCount,
  daysRemaining,
  estimatedSavings,
  startDate,
  expiryDate,
  benefits,
  revealedBenefits,
  isMember,
  hasBIIdentity: _hasBIIdentity,
  onTabChange,
  termDays,
}: HomeTabProps) {
  return (
    <TabsContent className="flex flex-col gap-12" value="home">
      {isMember ? (
        <MemberOverview
          benefits={benefits}
          benefitsCount={benefitsCount}
          daysRemaining={daysRemaining}
          estimatedSavings={estimatedSavings}
          expiryDate={expiryDate}
          membershipType={membershipType}
          onTabChange={onTabChange}
          revealedBenefits={revealedBenefits}
          startDate={startDate}
          termDays={termDays}
        />
      ) : (
        <NonMemberOverview benefits={benefits} />
      )}
    </TabsContent>
  );
}
