"use client";

import type {
  ContentTranslations,
  Events,
  Jobs,
} from "@repo/api/types/appwrite";
import type { Locale } from "@repo/i18n/config";
import type { RecruitmentVacancy } from "@repo/shared/types/recruitment";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { formatDateReadable } from "@repo/ui/lib/utils";
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Calendar,
  GraduationCap,
  Handshake,
  MapPin,
  PiggyBank,
  ShieldAlert,
  Star,
  Users,
} from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { AboutHero } from "@/components/about/about-hero";
import { useCampus } from "@/components/context/campus";
import type { CampusData } from "@/lib/types/campus-data";
import { getEventHref } from "@/lib/types/event";

type BenefitKey =
  | "studentBenefits"
  | "careerAdvantages"
  | "socialNetwork"
  | "safety"
  | "businessBenefits";

interface StudentsPageClientProps {
  campusData: CampusData[];
  departments: ContentTranslations[];
  events: Events[];
  globalBenefits: CampusData | null;
  jobs: Array<Jobs | RecruitmentVacancy>;
  locale: Locale;
}

const getTranslation = (
  translations:
    | Events["translation_refs"]
    | Jobs["translations"]
    | RecruitmentVacancy["translations"]
) =>
  Array.isArray(translations)
    ? (translations.find(
        (
          item
        ): item is
          | ContentTranslations
          | RecruitmentVacancy["translations"][number] =>
          typeof item === "object" && item !== null && "title" in item
      ) ?? null)
    : null;

const HTML_TAG = /<[^>]+>/g;
const WHITESPACE_RUN = /\s+/g;

const stripHtml = (value?: string | null) =>
  value ? value.replace(HTML_TAG, " ").replace(WHITESPACE_RUN, " ").trim() : "";

const benefitKeys: BenefitKey[] = [
  "studentBenefits",
  "careerAdvantages",
  "socialNetwork",
  "safety",
  "businessBenefits",
];

const benefitIconMap: Record<
  BenefitKey,
  React.ComponentType<{ className?: string }>
> = {
  studentBenefits: GraduationCap,
  careerAdvantages: Star,
  socialNetwork: Users,
  safety: ShieldAlert,
  businessBenefits: Handshake,
};

const selectBenefitItems = (
  data: CampusData | null | undefined,
  key: BenefitKey,
  locale: Locale
) => {
  if (!data) {
    return [];
  }
  const suffix = locale === "en" ? "_en" : "_nb";
  const localizedKey = `${key}${suffix}` as keyof CampusData;
  const localized = data[localizedKey];
  const fallback = data[key];
  let list: unknown[] = [];
  if (Array.isArray(localized)) {
    list = localized;
  } else if (Array.isArray(fallback)) {
    list = fallback;
  }
  return list.map((item) => (item ? String(item).trim() : "")).filter(Boolean);
};

const pickCampusData = (
  dataset: CampusData[],
  campusId?: string | null,
  campusName?: string
) => {
  if (!dataset.length) {
    return null;
  }
  if (campusId) {
    const matchById = dataset.find((item) => item.$id === campusId);
    if (matchById) {
      return matchById;
    }
  }
  if (campusName) {
    const normalized = campusName.toLowerCase();
    return dataset.find(
      (item) =>
        item.name?.toLowerCase() === normalized ||
        item.name_nb?.toLowerCase() === normalized
    );
  }
  return null;
};

const SECTION_SHELL = "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8";
const FADE_UP = {
  initial: { opacity: 0, y: 20 },
  transition: { duration: 0.5 },
  viewport: { once: true },
  whileInView: { opacity: 1, y: 0 },
} as const;

/** Section header with an optional right-aligned "see all" action. */
function SectionHeader({
  action,
  label,
  subtitle,
  title,
}: {
  action?: { href: string; label: string };
  label?: string;
  subtitle?: string;
  title: string;
}) {
  return (
    <motion.div
      className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
      {...FADE_UP}
    >
      <div className="max-w-2xl">
        {label ? (
          <div className="mb-3 inline-block rounded-full bg-brand-muted px-4 py-2 font-medium text-brand-dark text-sm">
            {label}
          </div>
        ) : null}
        <h2 className="font-bold text-2xl text-foreground md:text-3xl">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-3 text-muted-foreground leading-relaxed">
            {subtitle}
          </p>
        ) : null}
      </div>
      {action ? (
        <Button asChild className="shrink-0" size="sm" variant="outline">
          <Link href={action.href}>
            {action.label}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      ) : null}
    </motion.div>
  );
}

function EmptyCard({ message }: { message: string }) {
  return (
    <Card className="border-border/50 border-dashed bg-card/50 p-10 text-center text-muted-foreground text-sm">
      {message}
    </Card>
  );
}

function CampusCtaBand({
  campusLabel,
  campusQuery,
  unitsQuery,
}: {
  campusLabel: string;
  campusQuery: string;
  unitsQuery: string;
}) {
  const t = useTranslations("students");

  return (
    <section className="py-16" id="about-content">
      <div className={SECTION_SHELL}>
        <motion.div {...FADE_UP}>
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-border bg-brand-muted px-4 py-2 font-medium text-brand-dark text-sm">
            <MapPin className="h-4 w-4" />
            {t("hero.badge", { campus: campusLabel })}
          </div>
          {/* No lead paragraph here — the hero directly above already renders
              `hero.subtitle`, and repeating it read as a copy bug. */}
          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              asChild
              className="bg-linear-to-r from-brand-gradient-from to-brand-gradient-to text-white shadow-md transition-transform hover:scale-[1.02]"
              size="lg"
            >
              <Link href="/membership">
                {t("hero.ctaPrimary")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={`/units${unitsQuery}`}>{t("hero.ctaSecondary")}</Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <Link href={`/jobs${campusQuery}`}>{t("hero.ctaTertiary")}</Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function BenefitsSection({
  benefitsData,
  campusLabel,
  locale,
}: {
  benefitsData: CampusData | null;
  campusLabel: string;
  locale: Locale;
}) {
  const t = useTranslations("students");

  const cards = benefitKeys
    .map((key) => ({
      icon: benefitIconMap[key],
      items: selectBenefitItems(benefitsData, key, locale).slice(0, 4),
      key,
    }))
    .filter((card) => card.items.length > 0);

  return (
    <section className="bg-section/50 py-16">
      <div className={SECTION_SHELL}>
        <SectionHeader
          action={{ href: "/membership", label: t("benefits.cta") }}
          subtitle={t("benefits.subtitle", { campus: campusLabel })}
          title={t("benefits.title")}
        />

        {cards.length ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card, index) => (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                key={card.key}
                transition={{ delay: index * 0.07, duration: 0.4 }}
                viewport={{ once: true }}
                whileInView={{ opacity: 1, y: 0 }}
              >
                <Card className="h-full border-border/50 bg-card/80 p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand-border hover:shadow-lg">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-brand-gradient-from to-brand-gradient-to shadow-md">
                      <card.icon className="h-5 w-5 text-white" />
                    </span>
                    <div>
                      <Badge
                        className="mb-1 text-[0.65rem] uppercase tracking-wide"
                        variant="secondary"
                      >
                        {t(`benefits.badges.${card.key}`)}
                      </Badge>
                      <h3 className="font-semibold text-base text-foreground">
                        {t(`benefits.labels.${card.key}`)}
                      </h3>
                    </div>
                  </div>
                  <ul className="mt-5 space-y-2.5">
                    {card.items.map((item) => (
                      <li className="flex items-start gap-2.5" key={item}>
                        <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                        <span className="text-muted-foreground text-sm leading-relaxed">
                          {item}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <EmptyCard message={t("benefits.empty", { campus: campusLabel })} />
        )}
      </div>
    </section>
  );
}

function UnitsAndFundingSection({
  campusLabel,
  departments,
  unitsQuery,
}: {
  campusLabel: string;
  departments: ContentTranslations[];
  unitsQuery: string;
}) {
  const t = useTranslations("students");

  return (
    <section className="py-16">
      <div className={SECTION_SHELL}>
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <motion.div {...FADE_UP}>
            <Card className="h-full border-border/50 bg-card/80 p-6 backdrop-blur-sm sm:p-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="flex items-center gap-2 font-bold text-foreground text-xl">
                    <Users className="h-5 w-5 text-brand" />
                    {t("units.title", { campus: campusLabel })}
                  </h2>
                  <p className="mt-2 text-muted-foreground text-sm leading-relaxed">
                    {t("units.subtitle")}
                  </p>
                </div>
                <Button asChild className="shrink-0" size="sm" variant="ghost">
                  <Link href={`/units${unitsQuery}`}>
                    {t("units.cta")}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {departments.map((dept) => (
                  <div
                    className="rounded-xl border border-border/60 bg-section/60 p-4 transition-colors hover:border-brand-border"
                    key={dept.$id}
                  >
                    <h3 className="font-semibold text-base text-foreground">
                      {dept.title}
                    </h3>
                    <p className="mt-2 line-clamp-3 text-muted-foreground text-sm leading-relaxed">
                      {dept.description}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-muted-foreground text-xs">
                      <span>
                        {dept.department_ref?.type || t("units.unknownType")}
                      </span>
                      {dept.department_ref?.users?.length ? (
                        <span>
                          {t("units.members", {
                            count: dept.department_ref.users.length,
                          })}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
                {departments.length ? null : (
                  <p className="text-muted-foreground text-sm">
                    {t("units.empty")}
                  </p>
                )}
              </div>
            </Card>
          </motion.div>

          <motion.div {...FADE_UP} transition={{ delay: 0.1, duration: 0.5 }}>
            <Card className="relative h-full overflow-hidden border-0 bg-linear-to-br from-brand-gradient-from to-brand-gradient-to p-6 shadow-xl sm:p-8">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15">
                <PiggyBank className="h-6 w-6 text-white" />
              </span>
              <h2 className="mt-5 font-bold text-white text-xl">
                {t("funding.title")}
              </h2>
              <p className="mt-2 text-sm text-white/80 leading-relaxed">
                {t("funding.subtitle")}
              </p>
              <p className="mt-4 text-sm text-white/80 leading-relaxed">
                {t("funding.body")}
              </p>
              <Button
                asChild
                className="mt-6 w-full bg-white text-brand-dark hover:bg-white/90"
              >
                <Link href="/okonomisk-stotte">
                  {t("funding.cta")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function EventsSection({
  campusLabel,
  campusQuery,
  events,
}: {
  campusLabel: string;
  campusQuery: string;
  events: Events[];
}) {
  const t = useTranslations("students");

  return (
    <section className="bg-section/50 py-16">
      <div className={SECTION_SHELL}>
        <SectionHeader
          action={{ href: `/events${campusQuery}`, label: t("events.cta") }}
          subtitle={t("events.subtitle")}
          title={t("events.title", { campus: campusLabel })}
        />

        {events.length ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event, index) => {
              const translation = getTranslation(event.translation_refs);
              // The detail route resolves by slug, not $id; rows without a slug
              // have no reachable page, so the link is dropped instead.
              const detailHref = getEventHref(event);

              return (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  key={event.$id}
                  transition={{ delay: index * 0.07, duration: 0.4 }}
                  viewport={{ once: true }}
                  whileInView={{ opacity: 1, y: 0 }}
                >
                  <Card className="flex h-full flex-col border-border/50 bg-card/80 p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand-border hover:shadow-lg">
                    <div className="flex items-center gap-2 font-medium text-brand text-xs uppercase tracking-wide">
                      <Calendar className="h-4 w-4" />
                      {formatDateReadable(new Date(event.start_date || ""))}
                    </div>
                    <h3 className="mt-3 font-semibold text-foreground text-lg">
                      {translation?.title ?? "Untitled"}
                    </h3>
                    <p className="mt-2 line-clamp-3 grow text-muted-foreground text-sm leading-relaxed">
                      {stripHtml(translation?.description)}
                    </p>
                    <div className="mt-5 flex items-center justify-between border-border/60 border-t pt-4 text-muted-foreground text-xs">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" />
                        {event.location ||
                          event.campus?.name ||
                          event.campus_id}
                      </span>
                      {detailHref && (
                        <Link
                          className="inline-flex items-center gap-1 font-medium text-brand"
                          href={detailHref}
                        >
                          {t("events.more")}
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      )}
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <EmptyCard message={t("events.empty", { campus: campusLabel })} />
        )}
      </div>
    </section>
  );
}

function JobsSection({
  campusQuery,
  jobs,
}: {
  campusQuery: string;
  jobs: Array<Jobs | RecruitmentVacancy>;
}) {
  const t = useTranslations("students");

  return (
    <section className="py-16">
      <div className={SECTION_SHELL}>
        <SectionHeader
          action={{ href: `/jobs${campusQuery}`, label: t("jobs.cta") }}
          subtitle={t("jobs.subtitle")}
          title={t("jobs.title")}
        />

        {jobs.length ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {jobs.map((job, index) => {
              const translation = getTranslation(job.translations);
              const applicationDeadline = job.application_deadline ?? null;

              return (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  key={job.$id}
                  transition={{ delay: index * 0.07, duration: 0.4 }}
                  viewport={{ once: true }}
                  whileInView={{ opacity: 1, y: 0 }}
                >
                  <Link
                    className="block h-full"
                    href={`/jobs/${job.slug || job.$id}`}
                  >
                    <Card className="group flex h-full flex-col border-border/50 bg-card/80 p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand-border hover:shadow-lg">
                      <Badge
                        className="w-fit text-[0.65rem] uppercase tracking-wide"
                        variant="secondary"
                      >
                        {job.department?.Name || t("jobs.unknownDepartment")}
                      </Badge>
                      <h3 className="mt-3 font-semibold text-foreground text-lg transition-colors group-hover:text-brand">
                        {translation?.title ?? "Untitled"}
                      </h3>
                      <p className="mt-2 line-clamp-3 grow text-muted-foreground text-sm leading-relaxed">
                        {stripHtml(translation?.description)}
                      </p>
                      <div className="mt-5 flex items-center justify-between border-border/60 border-t pt-4 text-muted-foreground text-xs">
                        <span className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" />
                          {job.campus?.name || job.campus_id}
                        </span>
                        <span>
                          {applicationDeadline
                            ? formatDateReadable(new Date(applicationDeadline))
                            : t("jobs.rolling")}
                        </span>
                      </div>
                    </Card>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <EmptyCard message={t("jobs.empty")} />
        )}
      </div>
    </section>
  );
}

function QuickLinksSection({ campusQuery }: { campusQuery: string }) {
  const t = useTranslations("students");

  const links = [
    { href: "/membership", icon: BadgeCheck, label: t("resources.membership") },
    {
      href: `/events${campusQuery}`,
      icon: Calendar,
      label: t("resources.events"),
    },
    {
      href: `/jobs${campusQuery}`,
      icon: Briefcase,
      label: t("resources.roles"),
    },
    { href: "/safety", icon: ShieldAlert, label: t("resources.safety") },
  ];

  return (
    <section className="bg-section/50 py-16">
      <div className={SECTION_SHELL}>
        <SectionHeader title={t("resources.title")} />

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {links.map((link, index) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              key={link.href}
              transition={{ delay: index * 0.07, duration: 0.4 }}
              viewport={{ once: true }}
              whileInView={{ opacity: 1, y: 0 }}
            >
              <Link className="block h-full" href={link.href}>
                <Card className="group h-full border-border/50 bg-card/80 p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand-border hover:shadow-lg">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-brand-gradient-from to-brand-gradient-to shadow-md transition-transform duration-300 group-hover:scale-110">
                    <link.icon className="h-6 w-6 text-white" />
                  </span>
                  <h3 className="mt-4 font-semibold text-foreground transition-colors group-hover:text-brand">
                    {link.label}
                  </h3>
                  <span className="mt-3 inline-flex items-center gap-2 font-medium text-brand text-sm">
                    {t("resources.view")}
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </span>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export const StudentsPageClient = ({
  events,
  jobs,
  departments,
  campusData,
  globalBenefits,
  locale,
}: StudentsPageClientProps) => {
  const t = useTranslations("students");
  const { activeCampus, activeCampusId } = useCampus();

  const currentCampusData = useMemo(
    () => pickCampusData(campusData, activeCampusId, activeCampus?.name),
    [campusData, activeCampusId, activeCampus]
  );

  const filteredEvents = useMemo(() => {
    if (!activeCampusId) {
      return events.slice(0, 6);
    }
    return events
      .filter((event) => event.campus_id === activeCampusId)
      .slice(0, 6);
  }, [events, activeCampusId]);

  const filteredJobs = useMemo(() => {
    if (!activeCampusId) {
      return jobs.slice(0, 6);
    }
    return jobs.filter((job) => job.campus_id === activeCampusId).slice(0, 6);
  }, [jobs, activeCampusId]);

  const featuredDepartments = useMemo(() => {
    if (!activeCampusId) {
      return departments.slice(0, 6);
    }
    return departments
      .filter((dept) => dept.department_ref?.campus_id === activeCampusId)
      .slice(0, 6);
  }, [departments, activeCampusId]);

  const campusLabel = activeCampus?.name ?? t("hero.globalCampus");
  const campusQuery = activeCampusId ? `?campus=${activeCampusId}` : "";
  const unitsQuery = activeCampusId ? `?campus_id=${activeCampusId}` : "";

  return (
    <div className="min-h-screen bg-linear-to-b from-section to-background">
      <AboutHero
        breadcrumbs={[
          { label: t("hero.breadcrumbHome"), href: "/" },
          { label: t("hero.breadcrumbCurrent") },
        ]}
        icon={<GraduationCap className="h-8 w-8 text-white" />}
        subtitle={t("hero.subtitle")}
        title={t("hero.title", { campus: campusLabel })}
      />

      <CampusCtaBand
        campusLabel={campusLabel}
        campusQuery={campusQuery}
        unitsQuery={unitsQuery}
      />
      <BenefitsSection
        benefitsData={currentCampusData ?? globalBenefits}
        campusLabel={campusLabel}
        locale={locale}
      />
      <UnitsAndFundingSection
        campusLabel={campusLabel}
        departments={featuredDepartments}
        unitsQuery={unitsQuery}
      />
      <EventsSection
        campusLabel={campusLabel}
        campusQuery={campusQuery}
        events={filteredEvents}
      />
      <JobsSection campusQuery={campusQuery} jobs={filteredJobs} />
      <QuickLinksSection campusQuery={campusQuery} />
    </div>
  );
};
