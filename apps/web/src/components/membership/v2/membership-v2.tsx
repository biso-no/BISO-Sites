import type { CampusBenefits } from "@repo/api/types/appwrite";
import type { MembershipPlan } from "@repo/shared/utils/membership-plans";
import { membershipPriceFormatter } from "@repo/shared/utils/membership-plans";
import { PlateContentRenderer } from "@repo/ui/components/plate-content-renderer";
import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CardGrid } from "@/components/ui/card-grid";
import { PageHeader } from "@/components/ui/page-header";
import { Pill } from "@/components/ui/pill";
import { Prose } from "@/components/ui/prose";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";

/**
 * The public membership page, rebuilt on real data.
 *
 * **Two things it was not reading.**
 *
 * 1. **Prices were hardcoded in the message bundle.** `membership.durations`
 *    carries "350 kr" / "550 kr" / "1350 kr" as translated strings, in two
 *    locales, while the `memberships` table holds the same three plans with
 *    administrator-controlled prices that `syncMembershipsFrom24SO` keeps in
 *    step with 24SevenOffice. A price change needed a code deploy — and needed
 *    it in both bundles, or the two locales would quote different numbers. The
 *    plans come from the table here.
 * 2. **The benefits table was unused.** The page described member benefits from
 *    five hardcoded category blurbs in the bundle, while `campus_benefits`
 *    holds **18 published rows**, fully bilingual, categorised and
 *    campus-scoped, which only the signed-in member portal ever read. They are
 *    the reason to join, so they are on the page you join from.
 *
 * The purchase flow is untouched: this page links to `/membership/join`, which
 * owns the gate and the wizard.
 */
export interface MembershipV2Props {
  benefits: CampusBenefits[];
  campusName: string | null;
  locale: "en" | "no";
  plans: MembershipPlan[];
}

function benefitText(benefit: CampusBenefits, locale: "en" | "no") {
  const title = locale === "no" ? benefit.title_nb : benefit.title_en;
  const description =
    locale === "no" ? benefit.description_nb : benefit.description_en;
  return {
    // Every row carries both locales today, but a fallback costs one `??` and
    // means a half-translated row still reads rather than rendering blank.
    title: title || benefit.title_en || benefit.title_nb || "",
    description:
      description || benefit.description_en || benefit.description_nb,
  };
}

function BenefitCard({
  benefit,
  locale,
  offerLabel,
}: {
  benefit: CampusBenefits;
  locale: "en" | "no";
  offerLabel: string;
}) {
  const { title, description } = benefitText(benefit, locale);
  return (
    <li className="flex h-full flex-col rounded-biso-md border border-edge p-5">
      <span className="flex flex-wrap items-center gap-2">
        {/* `kind` separates a standing perk from a partner offer, and only the
            offers carry a partner name. Both are real columns. */}
        {benefit.kind === "offer" ? (
          <Pill tone="success" uppercase>
            {offerLabel}
          </Pill>
        ) : null}
        {benefit.partner_name ? (
          <Pill tone="neutral">{benefit.partner_name}</Pill>
        ) : null}
      </span>

      <h3 className="type-heading-card mt-3 text-ink">{title}</h3>

      {description ? (
        <Prose className="type-body-sm [&_p]:type-body-sm mt-2 text-ink-muted [&_p]:mb-2">
          <PlateContentRenderer value={description} />
        </Prose>
      ) : null}
    </li>
  );
}

export async function MembershipV2({
  benefits,
  campusName,
  locale,
  plans,
}: MembershipV2Props) {
  const [t, tCommon, tNav] = await Promise.all([
    getTranslations("membership"),
    getTranslations("common"),
    getTranslations("common.navigation"),
  ]);

  // Grouped by the `category` column rather than by five hardcoded blurbs.
  const categories = [...new Set(benefits.map((b) => b.category))].filter(
    Boolean
  ) as string[];

  const faqKeys = ["cost", "discounts", "switchCampus", "engagement"] as const;

  return (
    <>
      <PageHeader
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
                  <span className="type-label text-ink-muted">{plan.name}</span>
                  <span className="type-display-sm mt-2 text-ink">
                    {membershipPriceFormatter.format(plan.price)}
                  </span>
                  <span className="type-body-sm mt-2 text-ink-muted">
                    {t("plans.months", { count: plan.accrualMonths })}
                  </span>
                  <Link
                    className="type-label mt-auto inline-flex items-center gap-2 pt-6 text-ink-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                    href="/membership/join"
                  >
                    {t("ctaCard.primary")}
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </Link>
                </div>
              </li>
            ))}
          </CardGrid>
        </Section>
      ) : null}

      {benefits.length > 0 ? (
        // `#fordeler` is what the "Member benefits" nav item points at
        // (`nav-config.ts`). **No element carried that id anywhere in the app**,
        // so the link has been scrolling nowhere. It anchors here.
        <Section className="border-edge border-t" id="fordeler" tone="paper">
          <SectionHeading>
            {campusName
              ? t("local.title", { campus: campusName })
              : t("global.title")}
          </SectionHeading>
          <p className="type-body-sm mb-8 max-w-(--measure) text-ink-muted">
            {t("plans.benefitsLede", { count: benefits.length })}
          </p>

          {categories.map((category) => {
            const inCategory = benefits.filter((b) => b.category === category);
            return (
              <div className="mb-12 last:mb-0" key={category}>
                <SectionHeading as="h3">{category}</SectionHeading>
                <CardGrid>
                  {inCategory.map((benefit) => (
                    <BenefitCard
                      benefit={benefit}
                      key={benefit.$id}
                      locale={locale}
                      offerLabel={t("plans.offer")}
                    />
                  ))}
                </CardGrid>
              </div>
            );
          })}
        </Section>
      ) : null}

      <Section className="border-edge border-t" tone="paper">
        <SectionHeading>{t("faq.title")}</SectionHeading>
        <dl className="max-w-(--measure)">
          {faqKeys.map((key) => (
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

        <Link
          className="type-label mt-10 inline-flex items-center gap-2 rounded-biso-pill bg-action px-5 py-3 text-action-ink transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          href="/membership/join"
        >
          <Check aria-hidden="true" className="size-4" />
          {t("ctaCard.primary")}
        </Link>
      </Section>
    </>
  );
}
