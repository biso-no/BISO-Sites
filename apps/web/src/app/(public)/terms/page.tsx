import { Mail, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { Pill } from "@/components/ui/pill";
import { Prose } from "@/components/ui/prose";
import { Section } from "@/components/ui/section";

const SUPPORT_EMAIL = "contact@biso.no";

/** Order is the reading order of the terms; it is not alphabetical. */
const SECTIONS = [
  "payment",
  "delivery",
  "returns",
  "withdrawal",
  "contact",
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("terms");
  return { title: `${t("title")} | BISO`, description: t("intro") };
}

export default async function TermsPage() {
  const [t, tCommon] = await Promise.all([
    getTranslations("terms"),
    getTranslations("common"),
  ]);

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: tCommon("breadcrumbs.home"), href: "/" },
          { label: t("title") },
        ]}
        eyebrow={t("badge")}
        lede={t("intro")}
        meta={
          <>
            <Pill>{t("lastUpdated")}</Pill>
            <Pill>{t("version")}</Pill>
          </>
        }
        title={t("title")}
      />

      <Section tone="paper" width="prose">
        <Prose>
          {SECTIONS.map((key) => {
            // `contact.highlight` is deliberately an empty string in both
            // bundles. Rendering it would leave an empty callout box, so the
            // truthiness check the previous design relied on is kept.
            const highlight = t(`sections.${key}.highlight`);
            return (
              <section key={key}>
                <h2 id={key}>{t(`sections.${key}.title`)}</h2>
                {/* A <span>, not a <p>: `<Prose>` styles descendant `p` with
                    `[&_p]:type-body`, whose specificity beats a `type-label`
                    class set on the element itself, so a paragraph here would
                    silently render as body text. */}
                <Pill className="mb-4">{t(`sections.${key}.badge`)}</Pill>
                <p>{t(`sections.${key}.body`)}</p>
                {highlight ? (
                  <p className="rounded-biso-md border-ink-accent border-s-4 bg-surface-sunken p-4">
                    {highlight}
                  </p>
                ) : null}
              </section>
            );
          })}
        </Prose>
      </Section>

      <Section className="border-edge border-t" tone="paper" width="prose">
        <h2 className="type-display-sm break-words text-ink">
          {t("footer.title")}
        </h2>
        <p className="type-body mt-3 max-w-(--measure) text-ink-muted">
          {t("footer.description")}
        </p>
        <ul className="mt-6 flex flex-col gap-3">
          <li>
            <a
              className="type-body inline-flex items-center gap-2 text-ink-accent underline underline-offset-4 hover:no-underline focus-visible:rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              href={`mailto:${SUPPORT_EMAIL}`}
            >
              <Mail aria-hidden="true" className="size-4 shrink-0" />
              <span className="min-w-0 break-words">{SUPPORT_EMAIL}</span>
            </a>
          </li>
          <li>
            <Link
              className="type-body inline-flex items-center gap-2 text-ink-accent underline underline-offset-4 hover:no-underline focus-visible:rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              href="/privacy"
            >
              <ShieldCheck aria-hidden="true" className="size-4 shrink-0" />
              <span className="min-w-0 break-words">
                {t("footer.privacyPolicy")}
              </span>
            </Link>
          </li>
        </ul>
      </Section>
    </>
  );
}
