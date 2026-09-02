import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { Prose } from "@/components/ui/prose";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";
import { PRIVACY_SECTIONS } from "./_content/privacy-sections";
import { PrivacyContent } from "./_content/render-privacy-content";

/**
 * Verbatim from the source document. Not derived from the build date: writing
 * "today" onto a legal page would assert a review that has not happened.
 */
const LAST_UPDATED = "Last updated: December 2024";
const ORG_NUMBER = "Organization number: 987713380";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("privacy");
  return { title: `${t("title")} | BISO`, description: t("intro") };
}

/**
 * The privacy statement.
 *
 * Two structural changes, both because this is a legal document rather than a
 * marketing page:
 *
 * 1. **The twenty sections are no longer inside an accordion.** Nineteen of
 *    them were collapsed on load, which meant the browser's own find-in-page
 *    could not reach them, printing produced a page of headings, and a
 *    deep link such as `/privacy#cookies` scrolled to a closed panel. The
 *    document is open; the contents list below is how you skip within it.
 * 2. **The three decorative summary cards are gone** ("GDPR Compliant",
 *    "Secure Storage", "Your Rights"). Each restated, in marketing voice and in
 *    English only, a claim the document itself makes precisely.
 *
 * See `_content/privacy-sections.ts` for PLACEHOLDER-012 — the body is English
 * in both locales, and why nothing was substituted for it.
 */
export default async function PrivacyPage() {
  const [t, tCommon] = await Promise.all([
    getTranslations("privacy"),
    getTranslations("common"),
  ]);

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: tCommon("breadcrumbs.home"), href: "/" },
          { label: t("title") },
        ]}
        lede={t("intro")}
        title={t("title")}
      />

      <Section tone="paper" width="prose">
        <nav aria-labelledby="privacy-contents">
          <SectionHeading id="privacy-contents">
            {tCommon("labels.onThisPage")}
          </SectionHeading>
          <ol className="type-body-sm grid gap-x-8 gap-y-2 text-ink-muted sm:grid-cols-2">
            {PRIVACY_SECTIONS.map((section) => (
              <li className="min-w-0" key={section.id}>
                <a
                  className="break-words text-ink-accent underline underline-offset-4 hover:no-underline focus-visible:rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                  href={`#${section.id}`}
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </Section>

      <Section className="border-edge border-t" tone="paper" width="prose">
        <Prose>
          {PRIVACY_SECTIONS.map((section) => (
            <section key={section.id}>
              {/* `scroll-mt` keeps the heading clear of the fixed 80px nav when
                  a contents link jumps to it. */}
              <h2 className="scroll-mt-28" id={section.id}>
                {section.title}
              </h2>
              <PrivacyContent content={section.content} id={section.id} />
            </section>
          ))}
          <hr />
          <p className="type-body-sm text-ink-muted">
            {LAST_UPDATED} · {ORG_NUMBER}
          </p>
        </Prose>
      </Section>
    </>
  );
}
