import type { BenefitSection } from "@repo/shared/utils/benefit-catalog";
import type { PublicBenefit } from "@repo/shared/utils/benefit-public";
import type { MembershipPlan } from "@repo/shared/utils/membership-plans";
import { membershipPriceFormatter } from "@repo/shared/utils/membership-plans";
import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BenefitSummaryCard } from "@/components/benefits/v2/benefit-summary-card";
import { CardGrid } from "@/components/ui/card-grid";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";
import { statusPanelPrimaryAction } from "@/components/ui/status-panel";
import {
  benefitCategoryLabel,
  localizedPublicBenefitText,
} from "@/lib/benefit-text";
import { MembershipJoinLink } from "./membership-join-link";

/**
 * The public membership page, rebuilt on real data.
 *
 * **Two things it was not reading.**
 *
 * 1. **Prices were hardcoded in the message bundle.** `membership.durations`
 *    carries "350 kr" / "550 kr" / "1350 kr" as translated strings, in two
 *    locales, while the `memberships` table holds the same plans with
 *    administrator-controlled prices that `syncMembershipsFrom24SO` keeps in
 *    step with 24SevenOffice. A price change needed a code deploy — and needed
 *    it in both bundles, or the two locales would quote different numbers. The
 *    plans come from the catalog here, one card per duration; the join wizard
 *    offers the this/next-season choice in June and December.
 * 2. **The benefits table was unused.** The page described member benefits from
 *    five hardcoded category blurbs in the bundle, while `campus_benefits`
 *    holds published rows, fully bilingual, categorised and campus-scoped,
 *    which only the signed-in member portal ever read. They are the reason to
 *    join, so they are on the page you join from. Since the benefits studio,
 *    the same table also carries the one-line career, social, safety and
 *    business lists, which follow the member benefits here.
 *
 * The purchase flow is untouched: this page links to `/membership/join`, which
 * owns the gate and the wizard.
 */
export interface MembershipV2Props {
  /** Visible benefits for the campus plus national, campus rows first. */
  benefits: PublicBenefit[];
  campusName: string | null;
  locale: "en" | "no";
  plans: MembershipPlan[];
}

/** The three flagship projects, each a hub at `/projects/<slug>`. */
const HIGHLIGHTS = [
  { key: "fadderullan", href: "/projects/fadderullan" },
  { key: "careerDays", href: "/projects/karrieredagene" },
  { key: "winterGames", href: "/projects/winter-games" },
] as const;

const FAQ_KEYS = ["cost", "discounts", "switchCampus", "engagement"] as const;

/** The one-line studio sections, with the bundle copy that introduces each. */
const LINE_SECTIONS: {
  copyKey: string;
  section: Exclude<BenefitSection, "member">;
}[] = [
  { copyKey: "career", section: "career" },
  { copyKey: "social", section: "social" },
  { copyKey: "safety", section: "safety" },
  { copyKey: "business", section: "business" },
];

/** A member benefit without a category is filed under the studio's "other". */
const UNCATEGORISED = "other";

const textLinkClass =
  "type-label inline-flex items-center gap-2 text-ink-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

export async function MembershipV2({
  benefits,
  campusName,
  locale,
  plans,
}: MembershipV2Props) {
  const [t, tCommon, tNav, tBenefits] = await Promise.all([
    getTranslations("membership"),
    getTranslations("common"),
    getTranslations("common.navigation"),
    getTranslations("common.benefits"),
  ]);

  const memberBenefits = benefits.filter((b) => b.section === "member");
  const categoryOf = (b: PublicBenefit) => b.category || UNCATEGORISED;
  // Grouped by the `category` column rather than by five hardcoded blurbs.
  const categories = [...new Set(memberBenefits.map(categoryOf))];
  // One category ("Annet" for every migrated row) is no grouping at all.
  const groupsByCategory = categories.length > 1;
  const lineSections = LINE_SECTIONS.map((config) => ({
    ...config,
    items: benefits
      .filter((b) => b.section === config.section)
      .map((b) => ({
        id: b.id,
        title: localizedPublicBenefitText(b, locale).title,
      })),
  })).filter((config) => config.items.length > 0);

  return (
    <>
      <PageHeader
        actions={
          <MembershipJoinLink
            campus={campusName}
            className={statusPanelPrimaryAction}
          >
            {t("hero.ctas.join")}
            <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
          </MembershipJoinLink>
        }
        breadcrumbs={[
          { label: tCommon("breadcrumbs.home"), href: "/" },
          { label: tNav("becomeMember") },
        ]}
        eyebrow={t("hero.badge")}
        lede={t("hero.subtitle")}
        title={
          campusName
            ? t("hero.title", { campus: campusName })
            : t("hero.titleFallback")
        }
      />

      {plans.length > 0 ? (
        <Section tone="paper">
          <SectionHeading>{t("onboarding.title")}</SectionHeading>
          <CardGrid columns={3}>
            {plans.map((plan) => (
              <li key={plan.id}>
                <div className="flex h-full flex-col rounded-biso-md border border-edge p-6">
                  <span className="type-label text-ink-muted">
                    {t(`join.plan.${plan.duration}`)}
                  </span>
                  <span className="type-display-sm mt-2 text-ink">
                    {membershipPriceFormatter.format(plan.price)}
                  </span>
                  <span className="type-body-sm mt-2 text-ink-muted">
                    {t("plans.months", { count: plan.accrualMonths })}
                  </span>
                  <MembershipJoinLink
                    campus={campusName}
                    className={`mt-auto pt-6 ${textLinkClass}`}
                  >
                    {t("ctaCard.primary")}
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </MembershipJoinLink>
                </div>
              </li>
            ))}
          </CardGrid>
        </Section>
      ) : null}

      {memberBenefits.length > 0 || lineSections.length > 0 ? (
        // `#fordeler` is what the "Member benefits" nav item points at
        // (`nav-config.ts`). **No element carried that id anywhere in the app**,
        // so the link has been scrolling nowhere. It anchors here.
        <Section className="border-edge border-t" id="fordeler" tone="paper">
          <SectionHeading>
            {campusName
              ? t("local.title", { campus: campusName })
              : t("global.title")}
          </SectionHeading>
          {/* No count beats "0 member benefits" while benefits fail to load. */}
          {memberBenefits.length > 0 ? (
            <p className="type-body-sm mb-8 max-w-(--measure) text-ink-muted">
              {t("plans.benefitsLede", { count: memberBenefits.length })}
            </p>
          ) : null}

          {categories.map((category) => {
            const inCategory = memberBenefits.filter(
              (b) => categoryOf(b) === category
            );
            return (
              <div className="mb-12 last:mb-0" key={category}>
                {groupsByCategory ? (
                  <SectionHeading as="h3">
                    {benefitCategoryLabel(category, locale)}
                  </SectionHeading>
                ) : null}
                <CardGrid>
                  {inCategory.map((benefit) => (
                    <BenefitSummaryCard
                      benefit={benefit}
                      formatValidUntil={(date) =>
                        tBenefits("validUntil", { date })
                      }
                      // Each card sits under its category's `h3`, if any.
                      headingLevel={groupsByCategory ? "h4" : "h3"}
                      key={benefit.id}
                      locale={locale}
                      variant="full"
                    />
                  ))}
                </CardGrid>
              </div>
            );
          })}

          {lineSections.length > 0 ? (
            <CardGrid>
              {lineSections.map((config) => (
                <li
                  className="min-w-0 rounded-biso-md border border-edge p-6"
                  key={config.section}
                >
                  <h3 className="type-heading-card break-words text-ink">
                    {t(`benefits.categories.${config.copyKey}.title`)}
                  </h3>
                  <p className="type-body-sm mt-1 text-ink-muted">
                    {t(`benefits.categories.${config.copyKey}.global`)}
                  </p>
                  <ul className="mt-4 space-y-2">
                    {config.items.map((item) => (
                      <li
                        className="type-body-sm border-ink-accent border-l-2 pl-3 text-ink"
                        key={item.id}
                      >
                        {item.title}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </CardGrid>
          ) : null}
        </Section>
      ) : null}

      {/* The three flagship projects. Each card leads to that project's hub,
          which collects the campus units that run it; the heading's link is
          the full events calendar. */}
      <Section className="border-edge border-t" tone="paper">
        <SectionHeading
          seeAllHref="/events?campus=all"
          seeAllLabel={t("highlights.ctaAll")}
        >
          {t("highlights.title")}
        </SectionHeading>
        <p className="type-body-sm mb-8 max-w-(--measure) text-ink-muted">
          {t("highlights.subtitle")}
        </p>
        <CardGrid columns={3}>
          {HIGHLIGHTS.map((highlight) => (
            <li
              className="flex h-full flex-col rounded-biso-md border border-edge p-6"
              key={highlight.key}
            >
              <h3 className="type-heading-card text-ink">
                {t(`highlights.items.${highlight.key}.title`)}
              </h3>
              <p className="type-body-sm mt-2 text-ink-muted">
                {t(`highlights.items.${highlight.key}.description`)}
              </p>
              <Link
                className={`mt-auto pt-6 ${textLinkClass}`}
                href={highlight.href}
              >
                {t(`highlights.items.${highlight.key}.cta`)}
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </li>
          ))}
        </CardGrid>
      </Section>

      <Section className="border-edge border-t" tone="paper">
        <SectionHeading>{t("faq.title")}</SectionHeading>
        <dl className="max-w-(--measure)">
          {FAQ_KEYS.map((key) => (
            <div
              className="border-edge border-b py-5 last:border-b-0"
              key={key}
            >
              <dt className="type-heading-card text-ink">
                {t(`faq.items.${key}.question`)}
              </dt>
              <dd className="type-body mt-2 text-ink-muted">
                {t(`faq.items.${key}.answer`)}
              </dd>
            </div>
          ))}
        </dl>

        <MembershipJoinLink
          campus={campusName}
          className={`mt-10 ${statusPanelPrimaryAction}`}
        >
          <Check aria-hidden="true" className="size-4" />
          {t("ctaCard.primary")}
        </MembershipJoinLink>
      </Section>
    </>
  );
}
