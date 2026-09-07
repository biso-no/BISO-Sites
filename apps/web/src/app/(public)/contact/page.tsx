import { Mail, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getCampuses } from "@/app/actions/campus";
import { CardGrid } from "@/components/ui/card-grid";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";

const NATIONAL_EMAIL = "contact@biso.no";

const linkClass =
  "inline-flex items-center gap-2 text-ink-accent underline underline-offset-4 hover:no-underline focus-visible:rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("contact");
  return { title: `${t("title")} | BISO`, description: t("intro") };
}

export default async function ContactPage() {
  const [t, tCommon, campuses] = await Promise.all([
    getTranslations("contact"),
    getTranslations("common"),
    getCampuses(),
  ]);

  // "National" is the organisation itself, addressed by the section above; the
  // grid below is the four physical campuses.
  const campusRows = campuses.filter(
    (c) => c.name?.toLowerCase() !== "national"
  );

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

      <Section tone="paper">
        <SectionHeading>{t("national.title")}</SectionHeading>
        <p className="type-body max-w-(--measure) text-ink-muted">
          {t("national.body")}
        </p>
        <ul className="mt-6 flex flex-col gap-3">
          <li>
            <a
              className={`type-body ${linkClass}`}
              href={`mailto:${NATIONAL_EMAIL}`}
            >
              <Mail aria-hidden="true" className="size-4 shrink-0" />
              <span className="min-w-0 break-words">{NATIONAL_EMAIL}</span>
            </a>
          </li>
          <li>
            <Link className={`type-body ${linkClass}`} href="/about">
              <span className="min-w-0 break-words">
                {t("national.aboutCta")}
              </span>
            </Link>
          </li>
        </ul>
      </Section>

      <Section className="border-edge border-t" tone="paper">
        <SectionHeading>{t("campuses.title")}</SectionHeading>
        <p className="type-body mb-6 max-w-(--measure) text-ink-muted">
          {t("campuses.subtitle")}
        </p>
        {campusRows.length > 0 ? (
          <CardGrid columns={4}>
            {campusRows.map((campus) => (
              <li
                className="flex h-full flex-col rounded-biso-md border border-edge p-6"
                key={campus.$id}
              >
                <MapPin aria-hidden="true" className="size-5 text-ink-accent" />
                <h3 className="type-heading-card mt-4 text-ink">
                  {campus.name}
                </h3>
                {/* All five campus rows carry an email today. The previous
                    design fell back to a hardcoded `business.<city>@biso.no`
                    map that no longer matches the real addresses
                    (`president.<city>@biso.no`), so a missing row would have
                    published a wrong address rather than none. Dropped. */}
                {campus.email ? (
                  <a
                    className={`type-body-sm mt-3 ${linkClass}`}
                    href={`mailto:${campus.email}`}
                  >
                    <Mail aria-hidden="true" className="size-4 shrink-0" />
                    <span className="min-w-0 break-words">{campus.email}</span>
                  </a>
                ) : null}
              </li>
            ))}
          </CardGrid>
        ) : (
          <p className="type-body text-ink-muted">{t("campuses.empty")}</p>
        )}
      </Section>

      <Section className="border-edge border-t" tone="paper" width="prose">
        <SectionHeading>{t("help.title")}</SectionHeading>
        <p className="type-body text-ink-muted">{t("help.body")}</p>
        <ul className="mt-6 flex flex-col gap-3">
          <li>
            <Link className={`type-body ${linkClass}`} href="/membership">
              {t("help.membershipFaq")}
            </Link>
          </li>
          <li>
            <Link className={`type-body ${linkClass}`} href="/about">
              {t("help.about")}
            </Link>
          </li>
        </ul>
      </Section>
    </>
  );
}
