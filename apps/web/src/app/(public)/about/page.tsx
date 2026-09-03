import { Check, Mail } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getOrgChartUrl, getPartners } from "@/app/actions/about";
import { StrategyCards } from "@/components/about/strategy-cards";
import { TopicGrid } from "@/components/about/topic-grid";
import { Partners } from "@/components/home/partners";
import { ChevronFrame } from "@/components/ui/chevron-frame";
import { PageHeader } from "@/components/ui/page-header";
import { Prose } from "@/components/ui/prose";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";

const ITEM_KEYS = ["0", "1", "2", "3", "4"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("about");
  return { title: `${t("hub.title")} | BISO`, description: t("hub.subtitle") };
}

export default async function AboutPage() {
  // v1 fetched both of these in a `useEffect` after hydration, so the page
  // shipped without them and filled in afterwards. They are awaited here.
  const [t, tCommon, partners, orgChartUrl] = await Promise.all([
    getTranslations("about"),
    getTranslations("common"),
    getPartners().catch(() => []),
    getOrgChartUrl().catch(() => null),
  ]);

  const whatWeDoItems = ITEM_KEYS.map((key) =>
    t(`general.whatWeDo.items.${key}`)
  );
  const academicItems = ITEM_KEYS.map((key) =>
    t(`general.academics.items.${key}`)
  );

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: tCommon("breadcrumbs.home"), href: "/" },
          { label: t("hub.title") },
        ]}
        lede={t("hub.subtitle")}
        title={t("hub.title")}
      />

      <Section id="about-content" tone="paper" width="prose">
        <Prose>
          <p>{t("hub.description")}</p>
        </Prose>
      </Section>

      {/* Still Client Components — they call `useTranslations` at render and
          are shared with other pages. A Server Component may render them; the
          page itself no longer needs to be one. */}
      <StrategyCards />

      <Section className="border-edge border-t" tone="paper" width="prose">
        <SectionHeading>{t("general.whatWeDo.title")}</SectionHeading>
        <ul className="space-y-3">
          {whatWeDoItems.map((item) => (
            <li className="flex items-start gap-3" key={item}>
              <Check
                aria-hidden="true"
                className="mt-1 size-4 shrink-0 text-ink-accent"
              />
              <span className="type-body text-ink-muted">{item}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section className="border-edge border-t" tone="paper" width="prose">
        <SectionHeading>{t("general.academics.subtitle")}</SectionHeading>
        <p className="type-body text-ink-muted">
          {t("general.academics.lead")}
        </p>
        <ul className="mt-5 space-y-3">
          {academicItems.map((item) => (
            <li className="flex items-start gap-3" key={item}>
              <Check
                aria-hidden="true"
                className="mt-1 size-4 shrink-0 text-ink-accent"
              />
              <span className="type-body text-ink-muted">{item}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section className="border-edge border-t" tone="paper" width="prose">
        <SectionHeading
          seeAllHref="/about/politics"
          seeAllLabel={t("general.politics.cta")}
        >
          {t("general.politics.title")}
        </SectionHeading>
        <p className="type-body text-ink-muted">{t("general.politics.lead")}</p>
      </Section>

      <TopicGrid />

      {orgChartUrl ? (
        <Section className="border-edge border-t" tone="paper">
          <SectionHeading>{t("general.orgChart.title")}</SectionHeading>
          <ChevronFrame className="bg-surface-sunken" ratio="16/9">
            <Image
              alt={t("general.orgChart.title")}
              height={720}
              sizes="(max-width: 1024px) 100vw, 1100px"
              src={orgChartUrl}
              width={1280}
            />
          </ChevronFrame>
        </Section>
      ) : null}

      <Partners partners={partners} />

      <Section className="border-edge border-t" tone="paper" width="prose">
        <SectionHeading>{t("general.contact.title")}</SectionHeading>
        <p className="type-body text-ink-muted">
          {t("general.contact.subtitle")}
        </p>
        <Link
          className="type-label mt-6 inline-flex items-center gap-2 rounded-biso-pill bg-action px-5 py-3 text-action-ink transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          href="/campus"
        >
          <Mail aria-hidden="true" className="size-4" />
          {t("general.contact.campusCta")}
        </Link>
      </Section>
    </>
  );
}
