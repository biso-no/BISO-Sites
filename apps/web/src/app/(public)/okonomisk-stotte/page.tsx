import type { Locale } from "@repo/i18n/config";
import {
  ArrowUpRight,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  Mail,
} from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { getFundingProgramBySlug } from "@/app/actions/funding";
import { getLocale } from "@/app/actions/locale";
import { CardGrid } from "@/components/ui/card-grid";
import { PageHeader } from "@/components/ui/page-header";
import { Pill } from "@/components/ui/pill";
import { Prose } from "@/components/ui/prose";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";
import {
  statusPanelPrimaryAction,
  statusPanelSecondaryAction,
} from "@/components/ui/status-panel";
import {
  DEFAULT_PROGRAM_LINKS,
  type FundingSupportDocument,
  type FundingSupportLinks,
} from "./_content/program-links";

/** Matches a spreadsheet: an `.xls*` extension, or SharePoint's `/:x:/` type segment. */
const SPREADSHEET_URL = /\.xls|\/:x:\//i;

// The parent `(public)` layout's opt-out does not cascade, and this page reads
// the locale cookie plus the `funding_programs` row before its first byte. Both
// are cheap and the page is uncacheable per-visitor anyway, so block rather than
// thread Suspense boundaries through three separate link-dependent sections.
// Same rationale as `(public)/[...slug]` and `(public)/units/[...segments]`.
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("fundingProgram");

  return {
    title: t("meta.title"),
    description: t("meta.description"),
  };
}

/**
 * The prose on this page lives in `packages/i18n/messages/{no,en}/fundingProgram.json`,
 * not in Appwrite. The `funding_programs` row is consulted only for the volatile
 * links — application form, documents, contact address, open/closed state — so the
 * Finance Committee can swap an expired MS Forms or SharePoint URL without a
 * deploy. There is no admin UI for that table, so the row is frequently absent;
 * every field below falls back to {@link DEFAULT_PROGRAM_LINKS}.
 */
async function resolveLinks(locale: Locale): Promise<FundingSupportLinks> {
  // Cache Components still runs a prerender pass over this route, and the
  // Appwrite lookup below issues an HTTP request whose Bun-internal fetch path
  // reads `Date.now()` — an unstable value the prerender rejects
  // (`blocking-prerender-current-time`). `connection()` marks the render as
  // request-time before that happens. `instant = false` alone does not: it
  // permits a blocking route but does not exempt unstable values.
  await connection();

  const program = await getFundingProgramBySlug("bi-fondet");

  if (!program) {
    return DEFAULT_PROGRAM_LINKS;
  }

  // A non-empty `metadata.documents` array replaces the three built-in cards
  // wholesale — there is no per-slot merge, so a partial list hides the rest.
  const overrideDocuments = program.parsedMetadata.documents
    ?.filter((doc) => Boolean(doc.url))
    .map((doc) => ({
      href: doc.url,
      kind: SPREADSHEET_URL.test(doc.url)
        ? ("sheet" as const)
        : ("doc" as const),
      label: (locale === "en" ? doc.label_en : doc.label_nb) || doc.url,
    }));

  return {
    applicationUrl:
      program.application_url || DEFAULT_PROGRAM_LINKS.applicationUrl,
    boardEmail: DEFAULT_PROGRAM_LINKS.boardEmail,
    // `document_url` is the schema's single "template" slot — it maps to the
    // activity budget template, the only template applicants must fill in.
    budgetUrl: program.document_url || DEFAULT_PROGRAM_LINKS.budgetUrl,
    financeEmail: program.contact_email || DEFAULT_PROGRAM_LINKS.financeEmail,
    guidelinesUrl: DEFAULT_PROGRAM_LINKS.guidelinesUrl,
    // `status` is optional on the row, so only an explicit "closed" pulls the
    // apply CTA — a missing or draft status still shows the form as open.
    isOpen: program.status !== "closed",
    overrideDocuments: overrideDocuments?.length ? overrideDocuments : null,
    termsUrl: DEFAULT_PROGRAM_LINKS.termsUrl,
  };
}

const textLink =
  "rounded-biso-sm text-ink-accent underline underline-offset-4 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

/** One section of the page: its eyebrow, its heading, an optional lede. */
function FundingSection({
  children,
  label,
  lead,
  title,
  width = "default",
}: {
  children?: ReactNode;
  label: string;
  lead?: string;
  title: string;
  width?: "default" | "prose";
}) {
  return (
    <Section className="border-edge border-t" tone="paper" width={width}>
      <p className="type-label mb-3 text-ink-accent">{label}</p>
      <SectionHeading className="mb-4">{title}</SectionHeading>
      {lead ? (
        <p className="type-body mb-8 max-w-(--measure) text-ink-muted">
          {lead}
        </p>
      ) : null}
      {children}
    </Section>
  );
}

interface DocumentCard extends FundingSupportDocument {
  action: string;
  description?: string;
}

/**
 * Økonomisk støtte (BI-fondet). Replaced `/bi-fondet`, which — like the legacy
 * WordPress `/sok-okonomisk-stotte` — 308s here from `next.config.ts`.
 */
export default async function FundingSupportPage() {
  const locale = (await getLocale()) as Locale;
  const [t, links] = await Promise.all([
    getTranslations("fundingProgram"),
    resolveLinks(locale),
  ]);

  const bisoItems = t.raw("eligibility.groups.biso.items") as string[];
  const otherItems = t.raw("eligibility.groups.others.items") as string[];
  const uses = t.raw("uses.items") as string[];
  const specifically = t.raw("uses.specifically") as string[];
  const steps = t.raw("process.steps") as { body: string; title: string }[];
  const tips = t.raw("tips.items") as string[];
  const faq = t.raw("faq.items") as { answer: string; question: string }[];

  const documents: DocumentCard[] = links.overrideDocuments
    ? links.overrideDocuments.map((doc) => ({
        ...doc,
        action: t("documents.open"),
      }))
    : [
        {
          action: t("documents.terms.action"),
          description: t("documents.terms.description"),
          href: links.termsUrl,
          kind: "doc",
          label: t("documents.terms.title"),
        },
        {
          action: t("documents.budget.action"),
          description: t("documents.budget.description"),
          href: links.budgetUrl,
          kind: "sheet",
          label: t("documents.budget.title"),
        },
        {
          action: t("documents.guidelines.action"),
          description: t("documents.guidelines.description"),
          href: links.guidelinesUrl,
          kind: "doc",
          label: t("documents.guidelines.title"),
        },
      ];

  // The apply link opens Microsoft Forms in a new window. Its accessible name
  // keeps the visible words and adds where it leads, rather than replacing
  // them (WCAG 2.5.3).
  const applyLink = links.isOpen ? (
    <a
      className={statusPanelPrimaryAction}
      href={links.applicationUrl}
      rel="noopener noreferrer"
      target="_blank"
    >
      {t("cta.apply")}
      <span className="sr-only">{` — ${t("cta.applyAria")}`}</span>
      <ArrowUpRight aria-hidden="true" className="size-4 shrink-0" />
    </a>
  ) : null;

  return (
    <>
      <PageHeader
        actions={
          <>
            {applyLink}
            <a
              className={statusPanelSecondaryAction}
              href={`mailto:${links.financeEmail}`}
            >
              <Mail aria-hidden="true" className="size-4 shrink-0" />
              {t("cta.contact")}
            </a>
          </>
        }
        breadcrumbs={[
          { label: t("hero.breadcrumbHome"), href: "/" },
          { label: t("hero.breadcrumbStudents"), href: "/students" },
          { label: t("hero.title") },
        ]}
        eyebrow={t("hero.eyebrow")}
        lede={t("hero.subtitle")}
        meta={
          <Pill tone={links.isOpen ? "success" : "neutral"}>
            {links.isOpen ? t("status.open") : t("status.closed")}
          </Pill>
        }
        title={t("hero.title")}
      />

      <Section tone="paper" width="prose">
        <p className="type-label mb-3 text-ink-accent">{t("intro.label")}</p>
        <SectionHeading className="mb-4">{t("intro.title")}</SectionHeading>
        <Prose>
          <p className="text-ink-muted">{t("intro.lead")}</p>
          <p>{t("intro.body")}</p>
        </Prose>
      </Section>

      <FundingSection
        label={t("eligibility.label")}
        lead={t("eligibility.lead")}
        title={t("eligibility.title")}
      >
        <CardGrid as="div" columns={2}>
          {[
            { items: bisoItems, title: t("eligibility.groups.biso.title") },
            { items: otherItems, title: t("eligibility.groups.others.title") },
          ].map((group) => (
            <div
              className="rounded-biso-md border border-edge p-6"
              key={group.title}
            >
              <h3 className="type-heading-card text-ink">{group.title}</h3>
              <ul className="type-body mt-4 list-disc space-y-2 ps-5 text-ink-muted">
                {group.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </CardGrid>
      </FundingSection>

      <FundingSection
        label={t("uses.label")}
        lead={t("uses.lead")}
        title={t("uses.title")}
      >
        <ul className="type-body grid list-disc gap-x-10 gap-y-2 ps-5 text-ink sm:grid-cols-2">
          {uses.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <h3 className="type-heading-card mt-10 text-ink">
          {t("uses.specificallyTitle")}
        </h3>
        <ul className="mt-4 flex flex-wrap gap-2">
          {specifically.map((item) => (
            <li key={item}>
              <Pill tone="accent">{item}</Pill>
            </li>
          ))}
        </ul>
      </FundingSection>

      <FundingSection
        label={t("process.label")}
        lead={t("process.lead")}
        title={t("process.title")}
      >
        <ol className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <li
              className="flex h-full flex-col rounded-biso-md border border-edge p-6"
              key={step.title}
            >
              <span className="type-data text-ink-accent">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="type-heading-card mt-3 text-ink">{step.title}</h3>
              <p className="type-body-sm mt-2 text-ink-muted">{step.body}</p>
            </li>
          ))}
        </ol>
        <p className="type-body-sm mt-8 max-w-(--measure) rounded-biso-md bg-surface-sunken p-5 text-ink">
          {t("process.note")}
        </p>
      </FundingSection>

      <FundingSection
        label={t("tips.label")}
        lead={t("tips.lead")}
        title={t("tips.title")}
        width="prose"
      >
        <Prose>
          <ul>
            {tips.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Prose>
      </FundingSection>

      <FundingSection
        label={t("documents.label")}
        lead={t("documents.lead")}
        title={t("documents.title")}
      >
        <CardGrid>
          {documents.map((doc) => {
            const Icon = doc.kind === "sheet" ? FileSpreadsheet : FileText;
            return (
              <li key={doc.href}>
                <a
                  className="group flex h-full flex-col rounded-biso-md border border-edge p-6 transition-colors hover:border-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                  href={doc.href}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <span className="type-heading-card flex items-start gap-3 text-ink group-hover:text-ink-accent">
                    <Icon
                      aria-hidden="true"
                      className="mt-0.5 size-5 shrink-0 text-ink-accent"
                    />
                    <span className="min-w-0 break-words">{doc.label}</span>
                  </span>
                  {doc.description ? (
                    <span className="type-body-sm mt-2 text-ink-muted">
                      {doc.description}
                    </span>
                  ) : null}
                  <span className="type-label mt-auto inline-flex items-center gap-2 pt-4 text-ink-accent">
                    {doc.action}
                    <ArrowUpRight
                      aria-hidden="true"
                      className="size-4 shrink-0"
                    />
                  </span>
                </a>
              </li>
            );
          })}
        </CardGrid>
      </FundingSection>

      <FundingSection
        label={t("faq.label")}
        title={t("faq.title")}
        width="prose"
      >
        {/* An accessible disclosure list: each question is the `<summary>` of
            its own `<details>`, so keyboard, screen-reader and find-in-page
            support come with the element and nothing depends on script. */}
        <ul className="border-edge border-t">
          {faq.map((item) => (
            <li className="border-edge border-b" key={item.question}>
              <details className="group/faq">
                <summary className="type-heading-card flex cursor-pointer list-none items-start justify-between gap-4 rounded-biso-sm py-4 text-ink hover:text-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0 break-words">{item.question}</span>
                  <ChevronDown
                    aria-hidden="true"
                    className="mt-1 size-4 shrink-0 text-ink-muted transition-transform group-open/faq:rotate-180"
                  />
                </summary>
                <p className="type-body whitespace-pre-line pb-5 text-ink-muted">
                  {item.answer}
                </p>
              </details>
            </li>
          ))}
        </ul>
      </FundingSection>

      <FundingSection
        label={t("contact.label")}
        lead={t("contact.lead")}
        title={t("contact.title")}
        width="prose"
      >
        <dl className="grid gap-6 sm:grid-cols-2">
          <div>
            <dt className="type-label text-ink-muted">
              {t("contact.financeLabel")}
            </dt>
            <dd className="type-body mt-1">
              <a className={textLink} href={`mailto:${links.financeEmail}`}>
                {links.financeEmail}
              </a>
            </dd>
          </div>
          <div>
            <dt className="type-label text-ink-muted">
              {t("contact.boardLabel")}
            </dt>
            <dd className="type-body mt-1">
              <a className={textLink} href={`mailto:${links.boardEmail}`}>
                {links.boardEmail}
              </a>
            </dd>
          </div>
        </dl>
        {applyLink ? <p className="mt-8">{applyLink}</p> : null}
      </FundingSection>
    </>
  );
}
