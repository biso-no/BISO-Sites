import {
  ArrowRight,
  ExternalLink,
  Gavel,
  GraduationCap,
  Landmark,
  PiggyBank,
  ShieldAlert,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CardGrid } from "@/components/ui/card-grid";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";

const INTERNAL_LINKS = [
  { key: "biFond", href: "/bi-fondet", Icon: PiggyBank },
  { key: "studyQuality", href: "/about/study-quality", Icon: GraduationCap },
  { key: "politics", href: "/about/politics", Icon: Landmark },
  { key: "safety", href: "/safety", Icon: ShieldAlert },
  { key: "bylaws", href: "/about/bylaws", Icon: Gavel },
  { key: "alumni", href: "/about/alumni", Icon: Users },
] as const;

// Keys under `external.*`, NOT `links.*` — the two blocks are separate in the
// bundle and only the internal one lives under `links`. Normalising both to one
// prefix during RD-026 rendered three raw key paths on this page.
const EXTERNAL_LINKS = [
  { key: "bi", href: "https://www.bi.no" },
  { key: "velferdstinget", href: "https://velferdstinget.no" },
  { key: "nso", href: "https://www.student.no" },
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("resources");
  return {
    title: `${t("hero.title")} | BISO`,
    description: t("hero.subtitle"),
  };
}

const cardClass =
  "group flex h-full flex-col rounded-biso-md border border-edge p-6 transition-colors hover:border-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

export default async function ResourcesPage() {
  const [t, tCommon] = await Promise.all([
    getTranslations("resources"),
    getTranslations("common"),
  ]);

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: tCommon("breadcrumbs.home"), href: "/" },
          { label: t("hero.title") },
        ]}
        lede={t("hero.subtitle")}
        title={t("hero.title")}
      />

      <Section tone="paper">
        <SectionHeading>{t("sections.internal")}</SectionHeading>
        <CardGrid>
          {INTERNAL_LINKS.map(({ key, href, Icon }) => (
            <li key={key}>
              <Link className={cardClass} href={href}>
                <Icon aria-hidden="true" className="size-6 text-ink-accent" />
                <span className="type-heading-card mt-4 text-ink group-hover:text-ink-accent">
                  {t(`links.${key}.title`)}
                </span>
                <span className="type-body-sm mt-2 text-ink-muted">
                  {t(`links.${key}.description`)}
                </span>
                <ArrowRight
                  aria-hidden="true"
                  className="mt-auto size-4 pt-4 text-ink-muted opacity-0 transition-opacity group-hover:opacity-100"
                />
              </Link>
            </li>
          ))}
        </CardGrid>
      </Section>

      <Section className="border-edge border-t" tone="paper">
        <SectionHeading>{t("sections.external")}</SectionHeading>
        <CardGrid columns={3}>
          {EXTERNAL_LINKS.map(({ key, href }) => (
            <li key={key}>
              <a
                className={cardClass}
                href={href}
                rel="noreferrer noopener"
                target="_blank"
              >
                {/* `flex-wrap` and `break-words`: a long Norwegian title with
                    the icon pinned after it pushed the row 9px past a 320px
                    viewport. */}
                <span className="type-heading-card flex flex-wrap items-center gap-2 text-ink group-hover:text-ink-accent">
                  <span className="min-w-0 break-words">
                    {t(`external.${key}.title`)}
                  </span>
                  <ExternalLink
                    aria-hidden="true"
                    className="size-4 shrink-0"
                  />
                </span>
                <span className="type-body-sm mt-2 text-ink-muted">
                  {t(`external.${key}.description`)}
                </span>
              </a>
            </li>
          ))}
        </CardGrid>
      </Section>
    </>
  );
}
