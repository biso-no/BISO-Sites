import type { CampusData } from "@repo/api/types/appwrite";
import type { Locale } from "@repo/i18n/config";
import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { getCampusData } from "@/app/actions/campus";
import { listEvents } from "@/app/actions/events";
import { listJobs } from "@/app/actions/jobs";
import { getLocale } from "@/app/actions/locale";
import { getGlobalMembershipBenefits } from "@/app/actions/membership";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";
import {
  statusPanelPrimaryAction,
  statusPanelSecondaryAction,
} from "@/components/ui/status-panel";
import { getUserPreferences } from "@/lib/auth-utils";
import { campusIdToSlug, resolveRequestCampus } from "@/lib/campus-scope";
import { cachedShellCampuses } from "@/lib/data/public-content";
import { cachedPublicUnits } from "@/lib/data/units";
import {
  BenefitsSection,
  EventsSection,
  JobsSection,
  UnitsAndFundingSection,
} from "./_components/student-sections";

const linkClass =
  "inline-flex items-center gap-2 text-ink-accent underline underline-offset-4 hover:no-underline focus-visible:rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

/** Events, positions and units shown per section; each links to its feed. */
const STUDENTS_PREVIEW = 6;

/** Where the full list of member benefits lives. */
const BENEFITS_HREF = "/membership#fordeler";

// The page fetches every section up front with no Suspense boundary, so it is
// request-time by nature. `instant = false` lets it block (and lets an unknown
// `?campus=` answer with a real 404); `connection()` below additionally
// exempts it from unstable-value validation, which the upcoming-events filter
// and `openVacancyQueries` both trip via `new Date()`. Both are needed.
export const instant = false;

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

/** This campus's `campus_data` row, by id first and then by name. */
function pickCampusData(
  rows: CampusData[],
  campusId: string | null,
  campusName: string | null
): CampusData | null {
  if (campusId) {
    const byId = rows.find((row) => row.$id === campusId);
    if (byId) {
      return byId;
    }
  }
  if (campusName) {
    const wanted = campusName.toLowerCase();
    return (
      rows.find(
        (row) =>
          row.name?.toLowerCase() === wanted ||
          row.name_nb?.toLowerCase() === wanted
      ) ?? null
    );
  }
  return null;
}

/**
 * The student hub: what BISO offers a student on their campus, and where each
 * part of it lives.
 *
 * Main's sections (#63) on the redesign's primitives: member benefits, the
 * campus's units beside the economic-support offer, upcoming events (#87),
 * open positions, and the shortcuts. Campus is the site-wide filter — URL >
 * cookie > all — resolved on the server, so the first paint is already scoped
 * and a shared link shows the campus it names. Feeds are scoped by their
 * queries (the campus plus National, like every feed), not by slicing a
 * site-wide list.
 */
export default async function StudentsPage({
  searchParams,
}: StudentsPageProps) {
  // Must precede the fetches: see `instant` above.
  await connection();

  const [sp, prefs, rawLocale] = await Promise.all([
    searchParams,
    getUserPreferences(),
    getLocale(),
  ]);
  const locale = rawLocale as Locale;
  // Every campus-scoped page reads the URL first, then the cookie.
  const campusId = resolveRequestCampus(sp.campus, prefs?.campusId);
  if (campusId === undefined) {
    notFound();
  }

  // The cached readers throw rather than cache a failure; their fallbacks live
  // here and last for this render only.
  const [campuses, eventsResult, jobsResult, units, campusData, global] =
    await Promise.all([
      cachedShellCampuses(),
      listEvents({
        campus: campusId ?? undefined,
        locale,
        pageSize: STUDENTS_PREVIEW,
        status: "published",
        upcomingOnly: true,
      }),
      listJobs({ campus: campusId, locale, pageSize: STUDENTS_PREVIEW }),
      cachedPublicUnits(locale).catch(() => []),
      getCampusData().catch((): CampusData[] => []),
      getGlobalMembershipBenefits(),
    ]);

  const campusName = campusId
    ? (campuses.find((campus) => campus.$id === campusId)?.name ?? null)
    : null;
  const slug = campusIdToSlug(campusId);
  const scoped = (path: string) => (slug ? `${path}?campus=${slug}` : path);
  const campusUnits = (
    campusId ? units.filter((unit) => unit.campusId === campusId) : units
  ).slice(0, STUDENTS_PREVIEW);

  return (
    <>
      <StudentsHeader
        campusName={campusName}
        jobsHref={scoped("/jobs")}
        unitsHref={scoped("/units")}
      />
      <StudentsBody
        benefits={pickCampusData(campusData, campusId, campusName) ?? global}
        campusName={campusName}
        events={eventsResult.rows}
        jobs={jobsResult.rows}
        locale={locale}
        scopedHref={{
          events: scoped("/events"),
          jobs: scoped("/jobs"),
          units: scoped("/units"),
        }}
        showUnitCampus={campusId === null}
        units={campusUnits}
      />
    </>
  );
}

async function StudentsHeader({
  campusName,
  jobsHref,
  unitsHref,
}: {
  campusName: string | null;
  jobsHref: string;
  unitsHref: string;
}) {
  const [t, tCommon, tNav] = await Promise.all([
    getTranslations("students"),
    getTranslations("common"),
    getTranslations("common.navigation"),
  ]);
  const campus = campusName ?? t("hero.globalCampus");

  return (
    <PageHeader
      actions={
        <>
          <Link className={statusPanelPrimaryAction} href="/membership">
            {t("hero.ctaPrimary")}
          </Link>
          <Link className={statusPanelSecondaryAction} href={unitsHref}>
            {t("hero.ctaSecondary")}
          </Link>
          <Link className={statusPanelSecondaryAction} href={jobsHref}>
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
  );
}

async function StudentsBody({
  benefits,
  campusName,
  events,
  jobs,
  locale,
  scopedHref,
  showUnitCampus,
  units,
}: {
  benefits: CampusData | null;
  campusName: string | null;
  events: Awaited<ReturnType<typeof listEvents>>["rows"];
  jobs: Awaited<ReturnType<typeof listJobs>>["rows"];
  locale: Locale;
  scopedHref: { events: string; jobs: string; units: string };
  showUnitCampus: boolean;
  units: Awaited<ReturnType<typeof cachedPublicUnits>>;
}) {
  const t = await getTranslations("students");
  const campus = campusName ?? t("hero.globalCampus");
  const shortcuts = [
    { key: "membership", href: BENEFITS_HREF },
    { key: "events", href: scopedHref.events },
    { key: "roles", href: scopedHref.jobs },
    { key: "safety", href: "/safety" },
  ] as const;

  return (
    <>
      <BenefitsSection
        benefitsHref={BENEFITS_HREF}
        campusLabel={campus}
        data={benefits}
        locale={locale}
      />
      <UnitsAndFundingSection
        campusLabel={campus}
        showCampus={showUnitCampus}
        units={units}
        unitsHref={scopedHref.units}
      />
      <EventsSection
        campusLabel={campus}
        events={events}
        eventsHref={scopedHref.events}
        locale={locale}
      />
      <JobsSection jobs={jobs} jobsHref={scopedHref.jobs} locale={locale} />

      <Section className="border-edge border-t" tone="paper" width="prose">
        <SectionHeading>{t("resources.title")}</SectionHeading>
        <ul className="flex flex-col gap-3">
          {shortcuts.map(({ key, href }) => (
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
