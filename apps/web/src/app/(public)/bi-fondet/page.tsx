"use server";

import type { Locale } from "@repo/i18n/config";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { getFundingProgramBySlug } from "@/app/actions/funding";
import { getLocale } from "@/app/actions/locale";

const pickByLocale = <T,>(
  nbValue?: T,
  enValue?: T,
  locale: Locale = "no"
): T | undefined =>
  locale === "en" ? (enValue ?? nbValue) : (nbValue ?? enValue);

type ProgramContent = {
  title: string;
  intro: string;
  grantPoints: string[];
  eligibility: string[];
  steps: string[];
  contact: string;
  documents: Array<{ label: string; url: string }>;
  faqs: Array<{ question: string; answer: string }>;
  applicationUrl?: string | null;
  heroImage?: string | null;
  status?: string | null;
  templateUrl?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
};

const buildProgramContent = (
  program: Awaited<ReturnType<typeof getFundingProgramBySlug>>,
  locale: Locale,
  t: Awaited<ReturnType<typeof getTranslations>>
): ProgramContent => {
  const metadata = program?.parsedMetadata;
  const documents =
    metadata?.documents?.map(
      (doc: { label_nb: string; label_en: string; url: string }) => ({
        label: pickByLocale(doc.label_nb, doc.label_en, locale) ?? doc.url,
        url: doc.url,
      })
    ) ?? [];

  return {
    title:
      pickByLocale(metadata?.title_nb, metadata?.title_en, locale) ??
      t("fallback.title"),
    intro:
      pickByLocale(metadata?.intro_nb, metadata?.intro_en, locale) ??
      t("fallback.intro"),
    grantPoints:
      pickByLocale(metadata?.grant_nb, metadata?.grant_en, locale) ?? [],
    eligibility:
      pickByLocale(
        metadata?.eligibility_nb,
        metadata?.eligibility_en,
        locale
      ) ?? [],
    steps: pickByLocale(metadata?.steps_nb, metadata?.steps_en, locale) ?? [],
    contact:
      pickByLocale(metadata?.contact_nb, metadata?.contact_en, locale) ??
      t("fallback.contact", {
        email: program?.contact_email ?? "au.finance@biso.no",
      }),
    documents,
    faqs: pickByLocale(metadata?.faqs_nb, metadata?.faqs_en, locale) ?? [],
    applicationUrl: program?.application_url || program?.contact_email,
    heroImage: program?.hero_image_url,
    status: program?.status ?? null,
    templateUrl: program?.document_url ?? null,
    contactName: program?.contact_name ?? null,
    contactEmail: program?.contact_email ?? null,
  };
};

export default async function BIFundPage() {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("fundingProgram");

  const program = await getFundingProgramBySlug("bi-fondet");
  const content = buildProgramContent(program, locale, t);

  return (
    <div className="space-y-12">
      <HeroSection content={content} locale={locale} t={t} />
      <EligibilityAndSteps content={content} t={t} />
      {content.faqs.length > 0 ? <FaqSection content={content} t={t} /> : null}
      <ContactSection contact={content.contact} t={t} />
    </div>
  );
}

function HeroSection({
  content,
  t,
}: {
  content: ProgramContent;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  return (
    <section className="grid gap-8 rounded-3xl border border-primary/10 bg-white/90 p-8 shadow-lg md:grid-cols-[3fr_2fr]">
      <div className="space-y-4">
        <Badge
          className="border-primary/20 text-primary-70 text-xs uppercase tracking-wide"
          variant="outline"
        >
          {t("hero.badge")}
        </Badge>
        <h1 className="font-semibold text-3xl text-primary-100 md:text-4xl">
          {content.title}
        </h1>
        <p className="text-base text-primary-70">{content.intro}</p>
        <div className="flex flex-wrap gap-3">
          {content.grantPoints.map((point) => (
            <span
              className="rounded-full border border-primary/15 bg-primary/5 px-4 py-2 text-primary-70 text-sm"
              key={point}
            >
              {point}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          {content.applicationUrl && (
            <Button asChild size="lg">
              <a
                href={content.applicationUrl}
                rel="noreferrer"
                target={
                  content.applicationUrl.startsWith("http")
                    ? "_blank"
                    : undefined
                }
              >
                {t("hero.apply")}
              </a>
            </Button>
          )}
          <Button asChild size="lg" variant="outline">
            <a href="mailto:au.finance@biso.no">{t("hero.contact")}</a>
          </Button>
        </div>
      </div>
      <Card className="border-primary/10 bg-primary-10/40 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-primary-100">
            {t("overview.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-primary-70 text-sm">
          <div className="flex items-start justify-between gap-3">
            <span className="font-medium text-primary-90">
              {t("overview.status")}
            </span>
            <span>
              {content.status === "active"
                ? t("overview.active")
                : t("overview.draft")}
            </span>
          </div>
          {content.templateUrl ? (
            <div className="flex items-start justify-between gap-3">
              <span className="font-medium text-primary-90">
                {t("overview.template")}
              </span>
              <a
                className="text-primary-40 underline-offset-2 hover:underline"
                href={content.templateUrl}
                rel="noreferrer"
                target="_blank"
              >
                {t("overview.download")}
              </a>
            </div>
          ) : null}
          {content.documents.length > 0 ? (
            <div className="space-y-2">
              <span className="font-medium text-primary-90">
                {t("overview.rows")}
              </span>
              <ul className="space-y-1">
                {content.documents.map((doc) => (
                  <li key={doc.url}>
                    <a
                      className="text-primary-40 underline-offset-2 hover:underline"
                      href={doc.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {doc.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="space-y-1">
            <span className="font-medium text-primary-90">
              {t("overview.contact")}
            </span>
            <p>{content.contactName ?? t("overview.contactFallback")}</p>
            {content.contactEmail ? (
              <a
                className="text-primary-40 underline-offset-2 hover:underline"
                href={`mailto:${content.contactEmail}`}
              >
                {content.contactEmail}
              </a>
            ) : null}
          </div>
        </CardContent>
      </Card>
      {content.heroImage ? (
        <div className="md:col-span-2">
          <Image
            alt={content.title}
            className="h-64 w-full rounded-2xl object-cover"
            src={content.heroImage}
          />
        </div>
      ) : null}
    </section>
  );
}

function EligibilityAndSteps({
  content,
  t,
}: {
  content: ProgramContent;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  return (
    <section className="grid gap-8 md:grid-cols-2">
      <Card className="border-primary/10 bg-white">
        <CardHeader>
          <CardTitle className="text-primary-100">
            {t("eligibility.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-primary-70 text-sm">
            {content.eligibility.length > 0 ? (
              content.eligibility.map((item) => (
                <li className="flex gap-2" key={item}>
                  <span className="mt-1 h-2 w-2 rounded-full bg-primary-40" />
                  <span>{item}</span>
                </li>
              ))
            ) : (
              <li className="text-muted-foreground text-sm">
                {t("eligibility.empty")}
              </li>
            )}
          </ul>
        </CardContent>
      </Card>
      <Card className="border-primary/10 bg-white">
        <CardHeader>
          <CardTitle className="text-primary-100">{t("steps.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 text-primary-70 text-sm">
            {content.steps.length > 0 ? (
              content.steps.map((step, index) => (
                <li className="flex gap-3" key={step}>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary-50 text-xs">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))
            ) : (
              <li className="text-muted-foreground text-sm">
                {t("steps.empty")}
              </li>
            )}
          </ol>
        </CardContent>
      </Card>
    </section>
  );
}

function FaqSection({
  content,
  t,
}: {
  content: ProgramContent;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  return (
    <section className="space-y-6">
      <h2 className="font-semibold text-2xl text-primary-100">
        {t("faq.title")}
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        {content.faqs.map((faq) => (
          <Card className="border-primary/10 bg-white" key={faq.question}>
            <CardHeader>
              <CardTitle className="text-base text-primary-100">
                {faq.question}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-primary-70 text-sm">{faq.answer}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function ContactSection({
  contact,
  t,
}: {
  contact: string;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  return (
    <section className="rounded-2xl border border-primary/10 bg-primary/5 p-6 text-primary-80">
      <h2 className="font-semibold text-primary-90 text-xl">
        {t("contact.title")}
      </h2>
      <p className="mt-2 text-sm leading-6">{contact}</p>
    </section>
  );
}
