import type { Locale } from "@repo/i18n/config";
import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { getFundingProgramBySlug } from "@/app/actions/funding";
import { getLocale } from "@/app/actions/locale";
import { PageHeader } from "@/components/ui/page-header";
import { Pill } from "@/components/ui/pill";
import { Prose } from "@/components/ui/prose";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";

const FINANCE_EMAIL = "finance@biso.no";

const linkClass =
  "inline-flex items-center gap-2 text-ink-accent underline underline-offset-4 hover:no-underline focus-visible:rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

const pickByLocale = <T,>(
  nbValue?: T,
  enValue?: T,
  locale: Locale = "no"
): T | undefined =>
  locale === "en" ? (enValue ?? nbValue) : (nbValue ?? enValue);

interface ProgramContent {
  applicationUrl?: string | null;
  contact: string;
  contactEmail?: string | null;
  contactName?: string | null;
  documents: Array<{ label: string; url: string }>;
  eligibility: string[];
  faqs: Array<{ answer: string; question: string }>;
  grantPoints: string[];
  heroImage?: string | null;
  intro: string;
  status?: string | null;
  steps: string[];
  templateUrl?: string | null;
  title: string;
}

const buildProgramContent = (
  program: Awaited<ReturnType<typeof getFundingProgramBySlug>>,
  locale: Locale,
  t: Awaited<ReturnType<typeof getTranslations>>
): ProgramContent => {
  const metadata = program?.parsedMetadata;
  const documents =
    metadata?.documents?.map(
      (doc: { label_en: string; label_nb: string; url: string }) => ({
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
        email: program?.contact_email ?? FINANCE_EMAIL,
      }),
    documents,
    faqs: pickByLocale(metadata?.faqs_nb, metadata?.faqs_en, locale) ?? [],
    // Was `application_url || contact_email`, which put a bare address in an
    // `href` — the browser resolves that as a relative path, not a mailto.
    // A missing application URL now falls through to the contact block below.
    applicationUrl: program?.application_url ?? null,
    heroImage: program?.hero_image_url,
    status: program?.status ?? null,
    templateUrl: program?.document_url ?? null,
    contactName: program?.contact_name ?? null,
    contactEmail: program?.contact_email ?? null,
  };
};

export async function generateMetadata(): Promise<Metadata> {
  const [locale, t] = await Promise.all([
    getLocale() as Promise<Locale>,
    getTranslations("fundingProgram"),
  ]);
  const content = buildProgramContent(
    await getFundingProgramBySlug("bi-fondet"),
    locale,
    t
  );
  return { title: `${content.title} | BISO`, description: content.intro };
}

/**
 * BI-fondet — the student fund.
 *
 * **PLACEHOLDER-013: `funding_programs` holds zero rows.** Everything on this
 * page except the title and intro comes from a `bi-fondet` row's `metadata`
 * JSON, so today the page publishes two fallback sentences and two "will be
 * published soon" notices. The page is correct; the data is missing. Nothing
 * was invented to fill it — who may apply, how to apply, and what the fund
 * grants are BISO's to state.
 *
 * The empty branches below are therefore the *live* rendering, not an edge
 * case, which is why each says plainly that the information is not published
 * yet instead of rendering an empty card.
 */
export default async function BIFundPage() {
  const [locale, t, tCommon] = await Promise.all([
    getLocale() as Promise<Locale>,
    getTranslations("fundingProgram"),
    getTranslations("common"),
  ]);

  const program = await getFundingProgramBySlug("bi-fondet");
  const content = buildProgramContent(program, locale, t);
  const isOpen = content.status === "active";

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: tCommon("breadcrumbs.home"), href: "/" },
          { label: content.title },
        ]}
        eyebrow={t("hero.badge")}
        lede={content.intro}
        media={
          content.heroImage ? (
            <Image
              alt=""
              className="h-full w-full object-cover"
              height={480}
              src={content.heroImage}
              width={640}
            />
          ) : null
        }
        // No `funding_programs` row means no status to report. The pill said
        // "Ikke publisert" / "Not published" to every visitor, which reads as
        // a statement about the fund rather than about a missing row.
        meta={
          program ? (
            <Pill tone={isOpen ? "success" : "neutral"}>
              {isOpen ? t("overview.active") : t("overview.draft")}
            </Pill>
          ) : null
        }
        title={content.title}
      />

      {content.grantPoints.length > 0 ? (
        <Section rhythm="base" tone="paper">
          <ul className="flex flex-wrap gap-2">
            {content.grantPoints.map((point) => (
              <li key={point}>
                <Pill tone="accent">{point}</Pill>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section className="border-edge border-t" tone="paper" width="prose">
        <SectionHeading>{t("eligibility.title")}</SectionHeading>
        {content.eligibility.length > 0 ? (
          <Prose>
            <ul>
              {content.eligibility.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Prose>
        ) : (
          <p className="type-body text-ink-muted">{t("eligibility.empty")}</p>
        )}
      </Section>

      <Section className="border-edge border-t" tone="paper" width="prose">
        <SectionHeading>{t("steps.title")}</SectionHeading>
        {content.steps.length > 0 ? (
          <Prose>
            <ol>
              {content.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </Prose>
        ) : (
          <p className="type-body text-ink-muted">{t("steps.empty")}</p>
        )}
        <ul className="mt-8 flex flex-col gap-3">
          {content.applicationUrl ? (
            <li>
              <a
                className={`type-body ${linkClass}`}
                href={content.applicationUrl}
                rel="noreferrer noopener"
                target={
                  content.applicationUrl.startsWith("http")
                    ? "_blank"
                    : undefined
                }
              >
                <span className="min-w-0 break-words">{t("hero.apply")}</span>
                {content.applicationUrl.startsWith("http") ? (
                  <ExternalLink
                    aria-hidden="true"
                    className="size-4 shrink-0"
                  />
                ) : null}
              </a>
            </li>
          ) : null}
          {content.templateUrl ? (
            <li>
              <a
                className={`type-body ${linkClass}`}
                href={content.templateUrl}
                rel="noreferrer noopener"
                target="_blank"
              >
                <span className="min-w-0 break-words">
                  {t("overview.template")}
                </span>
                <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
              </a>
            </li>
          ) : null}
        </ul>
      </Section>

      {content.documents.length > 0 ? (
        <Section className="border-edge border-t" tone="paper" width="prose">
          {/* The previous page asked for `overview.rows`, which is not a key in
              either bundle — it would have rendered the key path itself. The
              key is `overview.documents`; unreachable until now only because
              this list has always been empty. */}
          <SectionHeading>{t("overview.documents")}</SectionHeading>
          <ul className="flex flex-col gap-3">
            {content.documents.map((doc) => (
              <li key={doc.url}>
                <a
                  className={`type-body ${linkClass}`}
                  href={doc.url}
                  rel="noreferrer noopener"
                  target="_blank"
                >
                  <span className="min-w-0 break-words">{doc.label}</span>
                  <ExternalLink
                    aria-hidden="true"
                    className="size-4 shrink-0"
                  />
                </a>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {content.faqs.length > 0 ? (
        <Section className="border-edge border-t" tone="paper" width="prose">
          <SectionHeading>{t("faq.title")}</SectionHeading>
          <Prose>
            {content.faqs.map((faq) => (
              <section key={faq.question}>
                <h3>{faq.question}</h3>
                <p>{faq.answer}</p>
              </section>
            ))}
          </Prose>
        </Section>
      ) : null}

      <Section className="border-edge border-t" tone="paper" width="prose">
        <SectionHeading>{t("contact.title")}</SectionHeading>
        <p className="type-body text-ink-muted">{content.contact}</p>
        <p className="type-body mt-4">
          <span className="text-ink">
            {content.contactName ?? t("overview.contactFallback")}
          </span>
        </p>
        <a
          className={`type-body mt-2 ${linkClass}`}
          href={`mailto:${content.contactEmail ?? FINANCE_EMAIL}`}
        >
          <span className="min-w-0 break-words">
            {content.contactEmail ?? FINANCE_EMAIL}
          </span>
        </a>
      </Section>
    </>
  );
}
