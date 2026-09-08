import type { Locale } from "@repo/i18n/config";
import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { getFundingProgramBySlug } from "@/app/actions/funding";
import { getLocale } from "@/app/actions/locale";
import {
  DEFAULT_PROGRAM_LINKS,
  type FundingSupportLinks,
  FundingSupportPageClient,
} from "./funding-support-page-client";

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

export default async function FundingSupportPage() {
  const locale = (await getLocale()) as Locale;
  const links = await resolveLinks(locale);

  return <FundingSupportPageClient links={links} />;
}
