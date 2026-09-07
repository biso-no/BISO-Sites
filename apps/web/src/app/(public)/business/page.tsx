import { ArrowRight, Mail, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CardGrid } from "@/components/ui/card-grid";
import { PageHeader } from "@/components/ui/page-header";
import { Pill } from "@/components/ui/pill";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";

const BENEFITS = ["colleagues", "values", "match"] as const;
const CAMPUSES = ["oslo", "bergen", "trondheim", "stavanger"] as const;
const HOTSPOT_FEATURES = [
  "present",
  "presentations",
  "talk",
  "stand",
  "relationship",
  "agreements",
] as const;

const linkClass =
  "inline-flex items-center gap-2 text-ink-accent underline underline-offset-4 hover:no-underline focus-visible:rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("partner.meta");
  return { title: t("title"), description: t("description") };
}

export default async function PartnerPage() {
  const [t, tCommon, tHotspot] = await Promise.all([
    getTranslations("partner"),
    getTranslations("common"),
    getTranslations("businessHotspot"),
  ]);

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: tCommon("breadcrumbs.home"), href: "/" },
          { label: t("hero.title") },
        ]}
        eyebrow={t("hero.subtitle")}
        lede={t("hero.description")}
        title={t("hero.title")}
      />

      <Section tone="paper">
        <SectionHeading>{t("benefits.subtitle")}</SectionHeading>
        <CardGrid columns={3}>
          {BENEFITS.map((key) => (
            <li
              className="flex h-full flex-col rounded-biso-md border border-edge p-6"
              key={key}
            >
              <h3 className="type-heading-card text-ink">
                {t(`benefits.items.${key}.title`)}
              </h3>
              <p className="type-body-sm mt-3 text-ink-muted">
                {t(`benefits.items.${key}.description`)}
              </p>
            </li>
          ))}
        </CardGrid>
      </Section>

      <Section className="border-edge border-t" tone="paper">
        <SectionHeading>{t("careerDays.title")}</SectionHeading>
        <p className="type-body mb-8 max-w-(--measure) text-ink-muted">
          {t("careerDays.description")}
        </p>
        <CardGrid columns={4}>
          {CAMPUSES.map((key) => (
            <li
              className="flex h-full flex-col rounded-biso-md border border-edge p-6"
              key={key}
            >
              <h3 className="type-heading-card min-w-0 break-words text-ink">
                {t(`careerDays.cities.${key}.title`)}
              </h3>
              {/* The previous design put a prominent "JOIN US" button on each
                  of these four cards with no `href` and no handler — four dead
                  CTAs. The destination is the campus business team, whose
                  address is in this same bundle. */}
              <a
                className={`type-body-sm mt-auto pt-4 ${linkClass}`}
                href={`mailto:${t(`contact.campuses.${key}.email`)}`}
              >
                <span className="min-w-0 break-words">
                  {t(`careerDays.cities.${key}.action`)}
                </span>
                <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
              </a>
            </li>
          ))}
        </CardGrid>
      </Section>

      <Section className="border-edge border-t" tone="paper">
        {/* Shown to everyone. It used to render only when the campus cookie
            held Oslo, so a visitor who had never picked a campus — or picked
            any other — never saw that this offer exists, and the page could
            not be cached. The pill says who it is for; the old design said the
            same thing in a hardcoded English "Oslo Only" badge. */}
        <SectionHeading>{t("opportunities.title")}</SectionHeading>
        <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-start">
          <div className="min-w-0">
            <Pill className="mb-4" tone="warning">
              {tHotspot("badge")}
            </Pill>
            <h3 className="type-display-sm min-w-0 break-words text-ink">
              {t("opportunities.businessHotspot.title")}
            </h3>
            <p className="type-body mt-4 max-w-(--measure) text-ink-muted">
              {t("opportunities.businessHotspot.description")}
            </p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {HOTSPOT_FEATURES.map((key) => (
                <li className="type-body flex gap-3 text-ink" key={key}>
                  <span aria-hidden="true" className="text-ink-accent">
                    —
                  </span>
                  <span className="min-w-0 break-words">
                    {t(`opportunities.businessHotspot.features.${key}`)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-8">
              <Link
                className={`type-body ${linkClass}`}
                href="/business-hotspot"
              >
                <span className="min-w-0 break-words">
                  {t("buttons.readMore")}
                </span>
                <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
              </Link>
            </p>
          </div>
          <div className="lg:w-[22rem]">
            <Image
              alt=""
              className="w-full rounded-biso-md object-cover"
              height={400}
              src="/images/business-hotspot.png"
              width={600}
            />
          </div>
        </div>
      </Section>

      <Section className="border-edge border-t" tone="paper">
        <SectionHeading>{t("contact.title")}</SectionHeading>
        <p className="type-body mb-8 max-w-(--measure) text-ink-muted">
          {t("contact.description")}
        </p>
        <CardGrid columns={4}>
          {CAMPUSES.map((key) => (
            <li
              className="flex h-full flex-col rounded-biso-md border border-edge p-6"
              key={key}
            >
              <MapPin aria-hidden="true" className="size-5 text-ink-accent" />
              <h3 className="type-heading-card mt-4 text-ink">
                {t(`contact.campuses.${key}.title`)}
              </h3>
              <p className="type-body-sm mt-2 text-ink-muted">
                {t(`contact.campuses.${key}.address`)}
              </p>
              {/* `contact.campuses.*.phone` is the literal string "Telefon
                  kommer snart" / "Phone coming soon" in both bundles. A
                  placeholder is not a phone number, so no phone row is drawn
                  until there is one. */}
              <a
                className={`type-body-sm mt-3 ${linkClass}`}
                href={`mailto:${t(`contact.campuses.${key}.email`)}`}
              >
                <Mail aria-hidden="true" className="size-4 shrink-0" />
                <span className="min-w-0 break-words">
                  {t(`contact.campuses.${key}.email`)}
                </span>
              </a>
            </li>
          ))}
        </CardGrid>
      </Section>
    </>
  );
}
