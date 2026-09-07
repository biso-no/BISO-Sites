import { ArrowRight, Mail } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CardGrid } from "@/components/ui/card-grid";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";

/**
 * The five campuses, each a link to its own page.
 *
 * The plan's criterion is exactly this — "`/campus` index links all five" —
 * and until now it did not: the route rendered a tabbed client bound to
 * whichever campus the cookie happened to hold, so there was no way to reach
 * Bergen's page from Oslo's. Every card here is a `/campus/<slug>` link.
 *
 * The only figure on a card is its unit count, because it is the only one that
 * is real for every campus.
 */
export interface CampusIndexEntry {
  email: string | null;
  name: string;
  slug: string;
  unitCount: number;
}

export async function CampusIndex({
  campuses,
}: {
  campuses: CampusIndexEntry[];
}) {
  const [t, tCommon, tNav] = await Promise.all([
    getTranslations("campus"),
    getTranslations("common"),
    getTranslations("common.navigation"),
  ]);

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: tCommon("breadcrumbs.home"), href: "/" },
          { label: tNav("campus") },
        ]}
        lede={t("index.lede")}
        title={t("index.title")}
      />

      <Section tone="paper">
        <CardGrid>
          {campuses.map((campus) => (
            <li key={campus.slug}>
              <Link
                className="group flex h-full flex-col rounded-biso-md border border-edge p-6 transition-colors hover:border-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                href={`/campus/${campus.slug}`}
              >
                <span className="type-heading-card flex items-center gap-2 text-ink group-hover:text-ink-accent">
                  BISO {campus.name}
                  <ArrowRight
                    aria-hidden="true"
                    className="size-4 opacity-0 transition-opacity group-hover:opacity-70"
                  />
                </span>

                {campus.unitCount > 0 ? (
                  <span className="type-data mt-3 text-ink-muted">
                    {t("index.units", { count: campus.unitCount })}
                  </span>
                ) : null}

                {campus.email ? (
                  <span className="type-body-sm mt-auto flex items-center gap-2 pt-5 text-ink-muted">
                    <Mail aria-hidden="true" className="size-4 shrink-0" />
                    <span className="min-w-0 break-words">{campus.email}</span>
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </CardGrid>
      </Section>
    </>
  );
}
