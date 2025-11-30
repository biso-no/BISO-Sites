"use client";

import type {
  ContentTranslations,
  Departments,
} from "@repo/api/types/appwrite";
import type { Locale } from "@repo/i18n/config";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { ScrollArea, ScrollBar } from "@repo/ui/components/ui/scroll-area";
import { formatDateReadable } from "@repo/ui/lib/utils";
import { GraduationCap, Handshake, Star, Users } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { useCampus } from "@/components/context/campus";
import type { CampusData } from "@/lib/types/campus-data";

type BenefitKey =
  | "studentBenefits"
  | "careerAdvantages"
  | "socialNetwork"
  | "safety"
  | "businessBenefits";

type StudentsPageClientProps = {
  events: ContentTranslations[];
  jobs: ContentTranslations[];
  departments: Departments[];
  campusData: CampusData[];
  globalBenefits: CampusData | null;
  locale: Locale;
};

const stripHtml = (value?: string | null) =>
  value
    ? value
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    : "";

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
  safety: Handshake,
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

export const StudentsPageClient = ({
  events,
  jobs,
  departments,
  campusData,
  globalBenefits,
  locale,
}: StudentsPageClientProps) => {
  const t = useTranslations("students");
  const { campuses, activeCampus, activeCampusId } = useCampus();

  const currentCampusData = useMemo(
    () => pickCampusData(campusData, activeCampusId, activeCampus?.name),
    [campusData, activeCampusId, activeCampus]
  );

  const filteredEvents = useMemo(() => {
    if (!activeCampusId) {
      return events.slice(0, 6);
    }
    return events
      .filter((event) => event.event_ref?.campus_id === activeCampusId)
      .slice(0, 6);
  }, [events, activeCampusId]);

  const filteredJobs = useMemo(() => {
    if (!activeCampusId) {
      return jobs.slice(0, 6);
    }
    return jobs
      .filter((job) => job.job_ref?.campus_id === activeCampusId)
      .slice(0, 6);
  }, [jobs, activeCampusId]);

  const featuredDepartments = useMemo(() => {
    if (!activeCampusId) {
      return departments.slice(0, 6);
    }
    return departments
      .filter((dept) => dept.campus_id === activeCampusId)
      .slice(0, 6);
  }, [departments, activeCampusId]);

  const campusLabel = activeCampus?.name ?? t("hero.globalCampus");

  return (
    <div className="space-y-16">
      <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-primary-100 via-blue-strong to-blue-accent text-white shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.25),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(61,169,224,0.35),transparent_55%)]" />
        <div className="relative px-6 py-16 sm:px-10 lg:px-14">
          <Badge className="bg-white/10 text-white text-xs uppercase tracking-wide">
            {t("hero.badge", { campus: campusLabel })}
          </Badge>
          <h1 className="mt-6 max-w-2xl font-semibold text-3xl text-white leading-tight sm:text-5xl">
            {t("hero.title", { campus: campusLabel })}
          </h1>
          <p className="mt-4 max-w-2xl text-base text-white/80 sm:text-lg">
            {t("hero.subtitle")}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              asChild
              className="bg-white text-primary-100 hover:bg-white/90"
              size="lg"
            >
              <Link href="/membership">{t("hero.ctaPrimary")}</Link>
            </Button>
            <Button
              asChild
              className="border-white/60 bg-transparent text-white hover:bg-white/10"
              size="lg"
              variant="secondary"
            >
              <Link
                href={`/units${activeCampusId ? `?campus_id=${activeCampusId}` : ""}`}
              >
                {t("hero.ctaSecondary")}
              </Link>
            </Button>
            <Button
              asChild
              className="text-white hover:bg-white/10"
              size="lg"
              variant="ghost"
            >
              <Link
                href={`/jobs${activeCampusId ? `?campus=${activeCampusId}` : ""}`}
              >
                {t("hero.ctaTertiary")}
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="space-y-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-semibold text-2xl text-primary-100">
              {t("benefits.title")}
            </h2>
            <p className="text-muted-foreground text-sm">
              {t("benefits.subtitle", { campus: campusLabel })}
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/membership">{t("benefits.cta")}</Link>
          </Button>
        </div>

        <ScrollArea>
          <div className="flex gap-4 pb-4">
            {benefitKeys.map((key) => {
              const Icon = benefitIconMap[key];
              const items = selectBenefitItems(
                currentCampusData ?? globalBenefits,
                key,
                locale
              ).slice(0, 4);
              if (!items.length) {
                return null;
              }
              return (
                <Card
                  className="min-w-[280px] max-w-xs border-primary/10 bg-white"
                  key={key}
                >
                  <CardHeader className="space-y-2">
                    <Badge
                      className="w-fit text-xs uppercase"
                      variant="secondary"
                    >
                      {t(`benefits.badges.${key}`)}
                    </Badge>
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5 text-primary-60" />
                      <CardTitle className="text-lg text-primary-100">
                        {t(`benefits.labels.${key}`)}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-muted-foreground text-sm">
                      {items.map((item) => (
                        <li className="flex items-start gap-2" key={item}>
                          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary-40" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card className="border-primary/10 bg-white">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-primary-100">
                <Users className="h-5 w-5 text-primary-40" />
                {t("units.title", { campus: campusLabel })}
              </CardTitle>
              <p className="text-muted-foreground text-sm">
                {t("units.subtitle")}
              </p>
            </div>
            <Button asChild size="sm" variant="ghost">
              <Link
                href={`/units${activeCampusId ? `?campus_id=${activeCampusId}` : ""}`}
              >
                {t("units.cta")}
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {featuredDepartments.map((dept) => (
                <div
                  className="rounded-lg border border-primary/10 bg-muted/40 p-4"
                  key={dept.$id}
                >
                  <h3 className="font-semibold text-base text-primary-100">
                    {dept.Name}
                  </h3>
                  <p className="mt-2 line-clamp-3 text-muted-foreground text-sm">
                    {dept.description}
                  </p>
                  <div className="mt-3 flex items-center justify-between text-muted-foreground text-xs">
                    <span>{dept.type || t("units.unknownType")}</span>
                    {dept.users?.length ? (
                      <span>
                        {t("units.members", { count: dept.users?.length })}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
              {!featuredDepartments.length && (
                <p className="text-muted-foreground text-sm">
                  {t("units.empty")}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/10 bg-white">
          <CardHeader>
            <CardTitle className="text-primary-100">
              {t("funding.title")}
            </CardTitle>
            <p className="text-muted-foreground text-sm">
              {t("funding.subtitle")}
            </p>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground text-sm">
            <p>{t("funding.body")}</p>
            <Button asChild className="w-full" size="sm">
              <Link href="/bi-fondet">{t("funding.cta")}</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-semibold text-2xl text-primary-100">
              {t("events.title", { campus: campusLabel })}
            </h2>
            <p className="text-muted-foreground text-sm">
              {t("events.subtitle")}
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link
              href={`/events${activeCampusId ? `?campus=${activeCampusId}` : ""}`}
            >
              {t("events.cta")}
            </Link>
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredEvents.map((event) => (
            <Card className="border-primary/10 bg-white" key={event.$id}>
              <CardHeader>
                <Badge className="w-fit text-xs uppercase" variant="secondary">
                  {formatDateReadable(
                    new Date(event.event_ref?.start_date || "")
                  )}
                </Badge>
                <CardTitle className="text-lg text-primary-100">
                  {event.title}
                </CardTitle>
                <p className="line-clamp-3 text-muted-foreground text-sm">
                  {stripHtml(event.description)}
                </p>
              </CardHeader>
              <CardContent className="flex justify-between text-muted-foreground text-xs">
                <span>
                  {event.event_ref?.location ||
                    event.event_ref?.campus?.name ||
                    event.event_ref?.campus_id}
                </span>
                <Link
                  className="underline-offset-2 hover:underline"
                  href={`/events/${event.$id}`}
                >
                  {t("events.more")}
                </Link>
              </CardContent>
            </Card>
          ))}
          {!filteredEvents.length && (
            <Card className="border-primary/10 bg-white">
              <CardContent className="py-10 text-center text-muted-foreground text-sm">
                {t("events.empty", { campus: campusLabel })}
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      <section className="space-y-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-semibold text-2xl text-primary-100">
              {t("jobs.title")}
            </h2>
            <p className="text-muted-foreground text-sm">
              {t("jobs.subtitle")}
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link
              href={`/jobs${activeCampusId ? `?campus=${activeCampusId}` : ""}`}
            >
              {t("jobs.cta")}
            </Link>
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredJobs.map((job) => (
            <Card className="border-primary/10 bg-white" key={job.$id}>
              <CardHeader className="space-y-2">
                <Badge className="w-fit text-xs uppercase" variant="secondary">
                  {job.job_ref?.department?.Name || t("jobs.unknownDepartment")}
                </Badge>
                <CardTitle className="text-lg text-primary-100">
                  {job.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-muted-foreground text-sm">
                <p className="line-clamp-3">{stripHtml(job.description)}</p>
                <div className="flex items-center justify-between text-xs">
                  <span>
                    {job.job_ref?.campus?.name || job.job_ref?.campus_id}
                  </span>
                  <span>
                    {job.job_ref?.metadata?.application_deadline
                      ? formatDateReadable(
                          new Date(
                            job.job_ref?.metadata?.application_deadline || ""
                          )
                        )
                      : t("jobs.rolling")}
                  </span>
                </div>
                <div className="flex justify-end">
                  <Button
                    asChild
                    className="px-0 text-primary-40"
                    size="sm"
                    variant="ghost"
                  >
                    <Link href={`/jobs/${job.job_ref?.slug}`}>
                      {t("jobs.more")}
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {!filteredJobs.length && (
            <Card className="border-primary/10 bg-white">
              <CardContent className="py-10 text-center text-muted-foreground text-sm">
                {t("jobs.empty")}
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold text-2xl text-primary-100">
          {t("resources.title")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: "/membership", label: t("resources.membership") },
            {
              href: `/events${activeCampusId ? `?campus=${activeCampusId}` : ""}`,
              label: t("resources.events"),
            },
            {
              href: `/jobs${activeCampusId ? `?campus=${activeCampusId}` : ""}`,
              label: t("resources.roles"),
            },
            { href: "/safety", label: t("resources.safety") },
          ].map((link) => (
            <Card className="border-primary/10 bg-white" key={link.href}>
              <CardContent className="flex h-full flex-col justify-between gap-4 py-6">
                <p className="font-semibold text-primary-100 text-sm">
                  {link.label}
                </p>
                <Button
                  asChild
                  className="justify-start px-0 text-primary-40"
                  variant="ghost"
                >
                  <Link href={link.href}>{t("resources.view")}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
};
