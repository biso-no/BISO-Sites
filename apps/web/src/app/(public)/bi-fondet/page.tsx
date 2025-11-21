"use server";

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
import type { Locale } from "@/i18n/config";

const pickByLocale = <T,>(
  nbValue?: T,
  enValue?: T,
  locale: Locale = "no"
): T | undefined =>
  locale === "en" ? (enValue ?? nbValue) : (nbValue ?? enValue);

export default async function BIFundPage() {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("fundingProgram");

  const program = await getFundingProgramBySlug("bi-fondet");
  const metadata = program?.parsedMetadata;

  const title =
    pickByLocale(metadata?.title_nb, metadata?.title_en, locale) ??
    t("fallback.title");
  const intro =
    pickByLocale(metadata?.intro_nb, metadata?.intro_en, locale) ??
    t("fallback.intro");
  const grantPoints = pickByLocale(
    metadata?.grant_nb,
    metadata?.grant_en,
    locale
  );
  const eligibility = pickByLocale(
    metadata?.eligibility_nb,
    metadata?.eligibility_en,
    locale
  );
  const steps = pickByLocale(metadata?.steps_nb, metadata?.steps_en, locale);
  const contact =
    pickByLocale(metadata?.contact_nb, metadata?.contact_en, locale) ??
    t("fallback.contact", {
      email: program?.contact_email ?? "au.finance@biso.no",
    });

  const documents = metadata?.documents ?? [];
  const faqs = pickByLocale(metadata?.faqs_nb, metadata?.faqs_en, locale) ?? [];

  const applicationUrl = program?.application_url || program?.contact_email;
  const heroImage = program?.hero_image_url;

  return (
    <div className="space-y-12">
      <section className="grid gap-8 rounded-3xl border border-primary/10 bg-white/90 p-8 shadow-lg md:grid-cols-[3fr_2fr]">
        <div className="space-y-4">
          <Badge
            className="border-primary/20 text-primary-70 text-xs uppercase tracking-wide"
            variant="outline"
          >
            {t("hero.badge")}
          </Badge>
          <h1 className="font-semibold text-3xl text-primary-100 md:text-4xl">
            {title}
          </h1>
          <p className="text-base text-primary-70">{intro}</p>
          <div className="flex flex-wrap gap-3">
            {grantPoints?.map((point) => (
              <span
                className="rounded-full border border-primary/15 bg-primary/5 px-4 py-2 text-primary-70 text-sm"
                key={point}
              >
                {point}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            {applicationUrl && (
              <Button asChild size="lg">
                <a
                  href={applicationUrl}
                  rel="noreferrer"
                  target={
                    applicationUrl.startsWith("http") ? "_blank" : undefined
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
                {program?.status === "active"
                  ? t("overview.active")
                  : t("overview.draft")}
              </span>
            </div>
            {program?.document_url && (
              <div className="flex items-start justify-between gap-3">
                <span className="font-medium text-primary-90">
                  {t("overview.template")}
                </span>
                <a
                  className="text-primary-40 underline-offset-2 hover:underline"
                  href={program.document_url}
                  rel="noreferrer"
                  target="_blank"
                >
                  {t("overview.download")}
                </a>
              </div>
            )}
            {documents.length > 0 && (
              <div className="space-y-2">
                <span className="font-medium text-primary-90">
                  {t("overview.rows")}
                </span>
                <ul className="space-y-1">
                  {documents.map(
                    (doc: {
                      label_nb: string;
                      label_en: string;
                      url: string;
                    }) => (
                      <li key={doc.url}>
                        <a
                          className="text-primary-40 underline-offset-2 hover:underline"
                          href={doc.url}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {pickByLocale(doc.label_nb, doc.label_en, locale)}
                        </a>
                      </li>
                    )
                  )}
                </ul>
              </div>
            )}
            <div className="space-y-1">
              <span className="font-medium text-primary-90">
                {t("overview.contact")}
              </span>
              <p>{program?.contact_name ?? t("overview.contactFallback")}</p>
              {program?.contact_email ? (
                <a
                  className="text-primary-40 underline-offset-2 hover:underline"
                  href={`mailto:${program.contact_email}`}
                >
                  {program.contact_email}
                </a>
              ) : null}
            </div>
          </CardContent>
        </Card>
        {heroImage && (
          <div className="md:col-span-2">
            <Image
              alt={title}
              className="h-64 w-full rounded-2xl object-cover"
              src={heroImage}
            />
          </div>
        )}
      </section>

      <section className="grid gap-8 md:grid-cols-2">
        <Card className="border-primary/10 bg-white">
          <CardHeader>
            <CardTitle className="text-primary-100">
              {t("eligibility.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-primary-70 text-sm">
              {eligibility?.map((item) => (
                <li className="flex gap-2" key={item}>
                  <span className="mt-1 h-2 w-2 rounded-full bg-primary-40" />
                  <span>{item}</span>
                </li>
              )) ?? (
                <li className="text-muted-foreground text-sm">
                  {t("eligibility.empty")}
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
        <Card className="border-primary/10 bg-white">
          <CardHeader>
            <CardTitle className="text-primary-100">
              {t("steps.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 text-primary-70 text-sm">
              {steps?.map((step, index) => (
                <li className="flex gap-3" key={step}>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary-50 text-xs">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              )) ?? (
                <li className="text-muted-foreground text-sm">
                  {t("steps.empty")}
                </li>
              )}
            </ol>
          </CardContent>
        </Card>
      </section>

      {faqs.length > 0 && (
        <section className="space-y-6">
          <h2 className="font-semibold text-2xl text-primary-100">
            {t("faq.title")}
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {faqs.map((faq) => (
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
      )}

      <section className="rounded-2xl border border-primary/10 bg-primary/5 p-6 text-primary-80">
        <h2 className="font-semibold text-primary-90 text-xl">
          {t("contact.title")}
        </h2>
        <p className="mt-2 text-sm leading-6">{contact}</p>
      </section>
    </div>
  );
}
