import { ArrowRight, Mail } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CardGrid } from "@/components/ui/card-grid";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";

const OSLO_BUSINESS_EMAIL = "business.oslo@biso.no";

/** Three feature keys, matching `features.N` / `featureDescriptions.N`. */
const FEATURES = ["0", "1", "2"] as const;

const BENEFITS = [
  "access",
  "recruitment",
  "booking",
  "engage",
  "partnership",
  "visibility",
] as const;

const linkClass =
  "inline-flex items-center gap-2 text-ink-accent underline underline-offset-4 hover:no-underline focus-visible:rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("businessHotspot.meta");
  return { title: t("title"), description: t("description") };
}

export default async function BusinessHotspotPage() {
  const [t, tCommon, tPartner] = await Promise.all([
    getTranslations("businessHotspot"),
    getTranslations("common"),
    getTranslations("partner"),
  ]);

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: tCommon("breadcrumbs.home"), href: "/" },
          { label: tPartner("hero.title"), href: "/business" },
          { label: t("title") },
        ]}
        eyebrow={t("badge")}
        lede={t("intro")}
        media={
          <Image
            alt=""
            className="h-full w-full object-cover"
            height={400}
            src="/images/business-hotspot.png"
            width={600}
          />
        }
        title={t("title")}
      />

      <Section tone="paper">
        <SectionHeading>{t("whatIs.title")}</SectionHeading>
        <p className="type-body max-w-(--measure) text-ink-muted">
          {t("whatIs.description")}
        </p>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {BENEFITS.map((key) => (
            <li className="type-body flex gap-3 text-ink" key={key}>
              <span aria-hidden="true" className="text-ink-accent">
                —
              </span>
              <span className="min-w-0 break-words">
                {t(`benefits.${key}`)}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section className="border-edge border-t" tone="paper">
        <SectionHeading>{t("whatYouCanDo.title")}</SectionHeading>
        <p className="type-body mb-8 max-w-(--measure) text-ink-muted">
          {t("whatYouCanDo.description")}
        </p>
        <CardGrid columns={3}>
          {FEATURES.map((key) => (
            <li
              className="flex h-full flex-col rounded-biso-md border border-edge p-6"
              key={key}
            >
              <h3 className="type-heading-card text-ink">
                {t(`features.${key}`)}
              </h3>
              <p className="type-body-sm mt-3 text-ink-muted">
                {t(`featureDescriptions.${key}`)}
              </p>
            </li>
          ))}
        </CardGrid>
      </Section>

      <Section className="border-edge border-t" tone="paper" width="prose">
        <SectionHeading>{t("ctaSection.title")}</SectionHeading>
        <p className="type-body text-ink-muted">
          {t("ctaSection.description")}
        </p>
        <ul className="mt-6 flex flex-col gap-3">
          <li>
            <Link className={`type-body ${linkClass}`} href="/business">
              <span className="min-w-0 break-words">{t("cta")}</span>
              <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
            </Link>
          </li>
          <li>
            <a
              className={`type-body ${linkClass}`}
              href={`mailto:${OSLO_BUSINESS_EMAIL}`}
            >
              <Mail aria-hidden="true" className="size-4 shrink-0" />
              <span className="min-w-0 break-words">
                {t("ctaSection.contactTeam")}
              </span>
            </a>
          </li>
        </ul>
      </Section>
    </>
  );
}
