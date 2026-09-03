import {
  AlertTriangle,
  Check,
  Eye,
  HelpCircle,
  Mail,
  Shield,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { VarslingForm } from "@/components/safety/varsling-form";
import { CardGrid } from "@/components/ui/card-grid";
import { PageHeader } from "@/components/ui/page-header";
import { Prose } from "@/components/ui/prose";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";

const INFO_CARDS = [
  { key: "harassment", Icon: AlertTriangle },
  { key: "witness", Icon: Eye },
  { key: "other", Icon: HelpCircle },
] as const;

const RULE_KEYS = [
  "rules.0",
  "rules.1",
  "rules.2",
  "rules.3",
  "rules.4",
] as const;
const CONTACT_KEYS = ["contacts.0", "contacts.1", "contacts.2"] as const;
const PRIVACY_KEYS = ["points.0", "points.1", "points.2", "points.3"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("varsling");
  return { title: `${t("title")} | BISO`, description: t("subtitle") };
}

export default async function SafetyPage() {
  const [t, tCommon, tNav] = await Promise.all([
    getTranslations("varsling"),
    getTranslations("common"),
    getTranslations("common.navigation"),
  ]);

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: tCommon("breadcrumbs.home"), href: "/" },
          { label: tNav("links.safety") },
        ]}
        lede={t("subtitle")}
        title={t("title")}
      />

      <Section id="about-content" tone="paper">
        <Prose className="mb-10">
          <p>{t("description")}</p>
        </Prose>

        <CardGrid columns={3}>
          {INFO_CARDS.map(({ key, Icon }) => (
            <li key={key}>
              <div className="flex h-full flex-col rounded-biso-md border border-edge p-6">
                <Icon aria-hidden="true" className="size-6 text-ink-accent" />
                <h2 className="type-heading-card mt-4 text-ink">
                  {t(`infoCards.${key}.title`)}
                </h2>
                <p className="type-body-sm mt-2 text-ink-muted">
                  {t(`infoCards.${key}.description`)}
                </p>
              </div>
            </li>
          ))}
        </CardGrid>
      </Section>

      {/* The form is the one interactive thing here and stays a client island;
          everything around it renders on the server. */}
      <Section className="border-edge border-t" tone="paper" width="prose">
        <SectionHeading>{t("form.title")}</SectionHeading>
        <p className="type-body mb-8 text-ink-muted">{t("form.description")}</p>
        <VarslingForm />
      </Section>

      <Section className="border-edge border-t" tone="paper" width="prose">
        <SectionHeading>{t("whatIsWhistleblowing.title")}</SectionHeading>
        <Prose>
          <p className="whitespace-pre-line">
            {t("whatIsWhistleblowing.content")}
          </p>
        </Prose>

        <SectionHeading as="h3" className="mt-12">
          {t("codeOfConduct.title")}
        </SectionHeading>
        <p className="type-body text-ink-muted">{t("codeOfConduct.purpose")}</p>
        <ul className="mt-5 space-y-3">
          {RULE_KEYS.map((key) => (
            <li className="flex items-start gap-3" key={key}>
              <Check
                aria-hidden="true"
                className="mt-1 size-4 shrink-0 text-ink-accent"
              />
              <span className="type-body text-ink-muted">
                {t(`codeOfConduct.${key}`)}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-10 rounded-biso-md bg-surface-sunken p-6">
          <h3 className="type-heading-card text-ink">
            {t("anonymousReport.title")}
          </h3>
          <p className="type-body-sm mt-2 text-ink-muted">
            {t("anonymousReport.content")}
          </p>
        </div>

        <SectionHeading as="h3" className="mt-12">
          {t("sendingReport.title")}
        </SectionHeading>
        <Prose>
          <p className="whitespace-pre-line">{t("sendingReport.content")}</p>
        </Prose>
      </Section>

      <Section className="border-edge border-t" tone="paper" width="prose">
        <SectionHeading>{t("contact.title")}</SectionHeading>
        <p className="type-body mb-8 text-ink-muted">
          {t("contact.description")}
        </p>
        <ul className="space-y-3">
          {CONTACT_KEYS.map((key) => (
            <li
              className="flex flex-wrap items-center justify-between gap-3 rounded-biso-md border border-edge p-5"
              key={key}
            >
              <span className="type-body-sm text-ink">
                {t(`contact.${key}.role`)}
              </span>
              <a
                className="inline-flex items-center gap-2 text-ink-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                href={`mailto:${t(`contact.${key}.email`)}`}
              >
                <Mail aria-hidden="true" className="size-4 shrink-0" />
                <span className="type-body-sm min-w-0 break-words">
                  {t(`contact.${key}.email`)}
                </span>
              </a>
            </li>
          ))}
        </ul>

        <div className="mt-10 rounded-biso-md border border-edge p-6">
          <h3 className="type-heading-card flex items-center gap-2 text-ink">
            <Shield aria-hidden="true" className="size-5 text-ink-accent" />
            {t("privacy.title")}
          </h3>
          <ul className="mt-4 space-y-3">
            {PRIVACY_KEYS.map((key) => (
              <li className="flex items-start gap-3" key={key}>
                <Check
                  aria-hidden="true"
                  className="mt-1 size-4 shrink-0 text-ink-accent"
                />
                <span className="type-body-sm text-ink-muted">
                  {/* The link is a tag in the message now. It used to be
                      recovered by splitting the translated sentence on the
                      literal words "personvernerklæring" or "privacy policy",
                      so a third locale — or an edit to either sentence — would
                      have silently dropped the link. */}
                  {t.rich(`privacy.${key}`, {
                    link: (chunks) => (
                      <Link
                        className="text-ink-accent underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                        href={t("privacy.privacyLink")}
                      >
                        {chunks}
                      </Link>
                    ),
                  })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Section>
    </>
  );
}
