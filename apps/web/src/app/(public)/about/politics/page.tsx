import { ArrowLeft, FileText, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CardGrid } from "@/components/ui/card-grid";
import { PageHeader } from "@/components/ui/page-header";
import { Prose } from "@/components/ui/prose";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";

interface CardItem {
  description: string;
  id: string;
  title: string;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("about.pages.politics");
  return { title: `${t("title")} | BISO`, description: t("intro") };
}

export default async function PoliticsPage() {
  const [t, tCommon, tAbout] = await Promise.all([
    getTranslations("about.pages.politics"),
    getTranslations("common"),
    getTranslations("about"),
  ]);

  const policyDemands = t.raw("policyDemands") as CardItem[];
  const forums = t.raw("forums") as CardItem[];

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: tCommon("breadcrumbs.home"), href: "/" },
          { label: tAbout("hub.title"), href: "/about" },
          { label: t("title") },
        ]}
        lede={t("intro")}
        title={t("title")}
      />

      <Section id="about-content" tone="paper" width="prose">
        <Prose>
          <p className="whitespace-pre-line">{t("content")}</p>
        </Prose>
      </Section>

      {/* `<PolicyCards>` and `<ForumList>` were Client Components whose only
          job was to fade their items in on scroll. Both are lists of a title
          and a description, which is what they are here. */}
      <Section className="border-edge border-t" tone="paper">
        <SectionHeading>{t("policyDemandsTitle")}</SectionHeading>
        <CardGrid>
          {policyDemands.map((item) => (
            <li key={item.id}>
              <div className="flex h-full flex-col rounded-biso-md border border-edge p-6">
                <h3 className="type-heading-card text-ink">{item.title}</h3>
                <p className="type-body-sm mt-2 text-ink-muted">
                  {item.description}
                </p>
              </div>
            </li>
          ))}
        </CardGrid>
      </Section>

      <Section className="border-edge border-t" tone="paper" width="prose">
        <SectionHeading>{t("forumsTitle")}</SectionHeading>
        <dl>
          {forums.map((item) => (
            <div
              className="border-edge border-b py-4 last:border-b-0"
              key={item.id}
            >
              <dt className="type-heading-card text-ink">{item.title}</dt>
              <dd className="type-body mt-1 text-ink-muted">
                {item.description}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-biso-md border border-edge p-6">
          <span className="flex items-start gap-3">
            <Users
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-ink-accent"
            />
            <span>
              <span className="type-heading-card block text-ink">
                {t("spu.title")}
              </span>
              <span className="type-body-sm mt-1 block text-ink-muted">
                {t("spu.description")}
              </span>
            </span>
          </span>
          <Link
            className="type-label shrink-0 rounded-biso-pill bg-action px-5 py-2.5 text-action-ink transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            href="/contact"
          >
            {t("spu.cta")}
          </Link>
        </div>

        <a
          className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-biso-md border border-edge p-6 transition-colors hover:border-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          href={t("policyPdf.href")}
          rel="noreferrer noopener"
          target="_blank"
        >
          <span className="flex items-start gap-3">
            <FileText
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-ink-accent"
            />
            <span>
              <span className="type-heading-card block text-ink">
                {t("policyPdf.title")}
              </span>
              <span className="type-body-sm mt-1 block text-ink-muted">
                {t("policyPdf.description")}
              </span>
            </span>
          </span>
        </a>

        <Link
          className="mt-12 inline-flex items-center gap-2 text-ink-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          href="/about"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          <span className="type-label">{tAbout("hub.title")}</span>
        </Link>
      </Section>
    </>
  );
}
