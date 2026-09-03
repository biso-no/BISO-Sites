import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CardGrid } from "@/components/ui/card-grid";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";
import { getUserPreferences } from "@/lib/auth-utils";
import { resolveRequestCampus } from "@/lib/campus-scope";
import { cachedShellCampuses } from "@/lib/data/public-content";

const linkClass =
  "inline-flex items-center gap-2 text-ink-accent underline underline-offset-4 hover:no-underline focus-visible:rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

/** The four shortcuts the page already published, in its own order. */
const SHORTCUTS = [
  { key: "membership", href: "/membership" },
  { key: "events", href: "/events" },
  { key: "roles", href: "/jobs" },
  { key: "safety", href: "/safety" },
] as const;

interface StudentsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("students");
  return {
    // A campus-scoped view of the same hub, not a second one.
    alternates: { canonical: "/students" },
    title: `${t("hero.title", { campus: t("hero.globalCampus") })} | BISO`,
    description: t("hero.subtitle"),
  };
}

/**
 * The student hub.
 *
 * **This is where `00-current-state.md` §1.2's `/students` ↔ `/campus`
 * duplication is resolved.** The page used to be a second campus landing: it
 * listed the campus's units, its next events and its open roles, which is what
 * `/campus/<slug>`, `/events` and `/jobs` each already are. Two of its own
 * sections were dead on arrival — the benefits block read `campus_data`, which
 * holds **zero rows**, and the unit list restated `/units`.
 *
 * It is now the index those pages hang off: one card per destination, carrying
 * that section's existing title and lede, and nothing rendered twice. Every
 * string below already existed in the `students` bundle; none was written for
 * this page. The 18 real member benefits live on `/membership#fordeler`, which
 * is where the first card points — they were never on this page.
 */
export default async function StudentsPage({
  searchParams,
}: StudentsPageProps) {
  const [sp, t, tCommon, tNav, prefs] = await Promise.all([
    searchParams,
    getTranslations("students"),
    getTranslations("common"),
    getTranslations("common.navigation"),
    getUserPreferences(),
  ]);
  // Every campus-scoped page reads the URL first, then the cookie. This one
  // read the cookie alone, so the campus named in its headings disagreed with
  // the switcher whenever the URL carried a `?campus=` — including the URLs
  // the switcher itself now writes.
  const campusId = resolveRequestCampus(sp.campus, prefs?.campusId);
  if (campusId === undefined) {
    notFound();
  }

  const campuses = campusId ? await cachedShellCampuses() : [];
  const campus =
    campuses.find((c) => c.$id === campusId)?.name ?? t("hero.globalCampus");

  const destinations = [
    {
      key: "benefits",
      href: "/membership#fordeler",
      title: t("benefits.title"),
      body: t("benefits.subtitle", { campus }),
      cta: t("benefits.cta"),
    },
    {
      key: "units",
      href: "/units",
      title: t("units.title", { campus }),
      body: t("units.subtitle"),
      cta: t("units.cta"),
    },
    {
      key: "funding",
      href: "/bi-fondet",
      title: t("funding.title"),
      body: t("funding.body"),
      cta: t("funding.cta"),
    },
    {
      key: "events",
      href: "/events",
      title: t("events.title", { campus }),
      body: t("events.subtitle"),
      cta: t("events.cta"),
    },
    {
      key: "jobs",
      href: "/jobs",
      title: t("jobs.title"),
      body: t("jobs.subtitle"),
      cta: t("jobs.cta"),
    },
  ];

  return (
    <>
      <PageHeader
        actions={
          <>
            <Link
              className="type-label inline-flex items-center gap-2 rounded-biso-pill bg-action px-5 py-3 text-action-ink transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              href="/membership"
            >
              {t("hero.ctaPrimary")}
            </Link>
            <Link
              className="type-label inline-flex items-center gap-2 rounded-biso-pill border border-edge px-5 py-3 text-ink transition-colors hover:border-ink-accent hover:text-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              href="/units"
            >
              {t("hero.ctaSecondary")}
            </Link>
            <Link
              className="type-label inline-flex items-center gap-2 rounded-biso-pill border border-edge px-5 py-3 text-ink transition-colors hover:border-ink-accent hover:text-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              href="/jobs"
            >
              {t("hero.ctaTertiary")}
            </Link>
          </>
        }
        breadcrumbs={[
          { label: tCommon("breadcrumbs.home"), href: "/" },
          // The nav's own label for this page, not one of its CTAs.
          { label: tNav("triggers.students") },
        ]}
        eyebrow={t("hero.badge", { campus })}
        lede={t("hero.subtitle")}
        title={t("hero.title", { campus })}
      />

      <Section tone="paper">
        <CardGrid>
          {destinations.map((d) => (
            <li key={d.key}>
              <Link
                className="group flex h-full flex-col rounded-biso-md border border-edge p-6 transition-colors hover:border-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                href={d.href}
              >
                <h2 className="type-heading-card min-w-0 break-words text-ink group-hover:text-ink-accent">
                  {d.title}
                </h2>
                <p className="type-body-sm mt-3 text-ink-muted">{d.body}</p>
                <span className="type-label mt-auto flex items-center gap-2 pt-6 text-ink-accent">
                  <span className="min-w-0 break-words">{d.cta}</span>
                  <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
                </span>
              </Link>
            </li>
          ))}
        </CardGrid>
      </Section>

      <Section className="border-edge border-t" tone="paper" width="prose">
        <SectionHeading>{t("resources.title")}</SectionHeading>
        <ul className="flex flex-col gap-3">
          {SHORTCUTS.map(({ key, href }) => (
            <li key={key}>
              <Link className={`type-body ${linkClass}`} href={href}>
                <span className="min-w-0 break-words">
                  {t(`resources.${key}`)}
                </span>
                <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
