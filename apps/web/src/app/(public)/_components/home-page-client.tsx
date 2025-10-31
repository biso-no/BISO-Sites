"use client";

import { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  CalendarDays,
  Compass,
  Handshake,
  HeartHandshake,
  MapPin,
  Newspaper,
  Sparkles,
  Target,
  Ticket,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { SelectCampus } from "../../../components/select-campus";
import { useCampus } from "../../../components/context/campus";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { cn } from '@repo/ui/lib/utils';

import type { EventWithTranslations } from "../../../lib/types/event";
import type { JobWithTranslations } from "../../../lib/types/job";
import type { NewsItemWithTranslations } from "../../../lib/types/news";
import type { ProductWithTranslations } from "../../../lib/types/product";
import { useFormatter, useTranslations } from "next-intl";

type HomePageClientProps = {
  events: EventWithTranslations[];
  news: NewsItemWithTranslations[];
  jobs: JobWithTranslations[];
  products: ProductWithTranslations[];
};

const SectionHeader = ({
  eyebrow,
  title,
  description,
  href,
  linkLabel,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  href?: string;
  linkLabel?: string;
}) => (
  <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
    <div className="space-y-2">
      {eyebrow ? (
        <Badge
          variant="outline"
          className="w-max rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-50"
        >
          {eyebrow}
        </Badge>
      ) : null}
      <div className="space-y-1.5">
        <h2 className="font-heading text-2xl font-semibold text-primary-100 lg:text-4xl">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground lg:text-base">{description}</p> : null}
      </div>
    </div>
    {href && linkLabel ? (
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="group h-10 gap-2 rounded-full border border-primary/10 px-4 text-primary-40 hover:bg-primary/5"
      >
        <Link href={href} className="flex items-center gap-2">
          {linkLabel}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </Button>
    ) : null}
  </div>
);

const StatPill = ({ label, value }: { label: string; value: string | number }) => (
  <div className="flex flex-col gap-1 rounded-2xl border border-white/15 bg-white/15 px-4 py-3 text-left shadow-card-soft backdrop-blur-sm">
    <div className="text-2xl font-semibold text-white drop-shadow">{value}</div>
    <div className="text-[11px] uppercase tracking-[0.16em] text-white/70">{label}</div>
  </div>
);

const ValueCard = ({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) => (
  <Card className="h-full rounded-[24px] border border-primary/10 bg-white shadow-card-soft">
    <CardContent className="flex flex-col gap-4 p-6">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/5 text-primary-40">
        <Icon className="h-5 w-5" />
      </span>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-primary-100">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </CardContent>
  </Card>
);

const HighlightList = ({
  items,
  emptyLabel,
}: {
  items: {
    id: string;
    title: string;
    subtitle: string;
    href: string;
    icon: LucideIcon;
    badge: string;
  }[];
  emptyLabel: string;
}) => (
  <div className="flex flex-col divide-y divide-white/15">
    {items.length ? (
      items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className="group flex items-center justify-between gap-4 py-3 text-white/90 transition hover:text-white"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15">
              <item.icon className="h-5 w-5" />
            </span>
            <div className="space-y-0.5">
              <p className="text-xs uppercase tracking-[0.16em] text-white/70">{item.badge}</p>
              <p className="text-sm font-semibold leading-tight">{item.title}</p>
              <p className="text-xs text-white/70">{item.subtitle}</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 opacity-0 transition group-hover:translate-x-1 group-hover:opacity-100" />
        </Link>
      ))
    ) : (
      <div className="py-4 text-sm text-white/80">{emptyLabel}</div>
    )}
  </div>
);

export const HomePageClient = ({ events, news, jobs, products }: HomePageClientProps) => {
  const { campuses, activeCampus, activeCampusId } = useCampus();
  const t = useTranslations("home");
  const commonT = useTranslations("common");
  const format = useFormatter();

  const campusLookup = useMemo(() => {
    return campuses.reduce<Record<string, string>>((acc, campus) => {
      acc[campus.$id] = campus.name;
      return acc;
    }, {});
  }, [campuses]);

  const eventsForCampus = useMemo(() => {
    if (!activeCampusId) return events;
    return events.filter((event) => event.campus_id === activeCampusId);
  }, [events, activeCampusId]);

  const jobsForCampus = useMemo(() => {
    if (!activeCampusId) return jobs;
    return jobs.filter((job) => job.campus_id === activeCampusId);
  }, [jobs, activeCampusId]);

  const newsForCampus = useMemo(() => {
    if (!activeCampusId) return news;
    return news.filter((newsItem) => newsItem.campus_id === activeCampusId);
  }, [news, activeCampusId]);

  const productsForCampus = useMemo(() => {
    if (!activeCampusId) return products;
    return products.filter((product) => product.campus_id === activeCampusId);
  }, [products, activeCampusId]);

  const heroStats = useMemo(() => {
    return [
      { label: t("hero.stats.campuses"), value: campuses.length || "—" },
      { label: t("hero.stats.events"), value: eventsForCampus.length || "—" },
      { label: t("hero.stats.jobs"), value: jobsForCampus.length || "—" },
    ];
  }, [campuses.length, eventsForCampus.length, jobsForCampus.length, t]);

  const spotlightProducts = useMemo(() => productsForCampus.slice(0, 3), [productsForCampus]);
  const spotlightNews = useMemo(() => newsForCampus.slice(0, 3), [newsForCampus]);
  const spotlightEvents = useMemo(() => eventsForCampus.slice(0, 4), [eventsForCampus]);
  const spotlightJobs = useMemo(() => jobsForCampus.slice(0, 5), [jobsForCampus]);

  const heroHighlights = useMemo(() => {
    const highlights: {
      id: string;
      title: string;
      subtitle: string;
      href: string;
      icon: LucideIcon;
      badge: string;
    }[] = [];

    const featuredEvent = spotlightEvents[0];
    if (featuredEvent) {
      highlights.push({
        id: `event-${featuredEvent.$id}`,
        title: featuredEvent.title,
        subtitle: featuredEvent.start_date
          ? format.dateTime(new Date(featuredEvent.start_date), { dateStyle: "medium" })
          : t("events.pendingDate"),
        href: `/events/${featuredEvent.$id}`,
        icon: CalendarDays,
        badge: t("hero.highlights.events"),
      });
    }

    const featuredJob = spotlightJobs[0];
    if (featuredJob) {
      highlights.push({
        id: `job-${featuredJob.$id}`,
        title: featuredJob.title,
        subtitle:
          featuredJob.campus_id && campusLookup[featuredJob.campus_id]
            ? campusLookup[featuredJob.campus_id]
            : commonT("labels.organisation"),
        href: `/jobs/${featuredJob.slug}`,
        icon: Briefcase,
        badge: t("hero.highlights.jobs"),
      });
    }

    const featuredNews = spotlightNews[0];
    if (featuredNews) {
      highlights.push({
        id: `news-${featuredNews.$id}`,
        title: featuredNews.title,
        subtitle: format.dateTime(new Date(featuredNews.$createdAt), { dateStyle: "medium" }),
        href: `/news/${featuredNews.$id}`,
        icon: Newspaper,
        badge: t("hero.highlights.news"),
      });
    }

    return highlights.slice(0, 3);
  }, [spotlightEvents, spotlightJobs, spotlightNews, format, t, campusLookup, commonT]);

  const additionalEvents = useMemo(() => spotlightEvents.slice(1, 4), [spotlightEvents]);
  const additionalNews = useMemo(() => spotlightNews.slice(1, 3), [spotlightNews]);
  const supportingJobs = useMemo(() => spotlightJobs.slice(1, 5), [spotlightJobs]);

  const benefitsPerks = useMemo(
    () => [
      {
        icon: HeartHandshake,
        title: t("benefits.perks.community.title"),
        description: t("benefits.perks.community.description"),
      },
      {
        icon: Handshake,
        title: t("benefits.perks.partners.title"),
        description: t("benefits.perks.partners.description"),
      },
      {
        icon: Compass,
        title: t("benefits.perks.support.title"),
        description: t("benefits.perks.support.description"),
      },
    ],
    [t]
  );

  const identityHighlights = useMemo(
    () => [
      {
        icon: Target,
        title: t("identity.values.mission.title"),
        description: t("identity.values.mission.description"),
      },
      {
        icon: Users,
        title: t("identity.values.members.title"),
        description: t("identity.values.members.description"),
      },
      {
        icon: Sparkles,
        title: t("identity.values.impact.title"),
        description: t("identity.values.impact.description"),
      },
    ],
    [t]
  );

  const supportLinks = useMemo(
    () => [
      { href: "/volunteer", label: t("opportunities.supportLinks.volunteer") },
      { href: "/contact", label: t("opportunities.supportLinks.contact") },
      { href: "/safety", label: t("opportunities.supportLinks.safety") },
    ],
    [t]
  );

  const finalLinks = useMemo(
    () => [
      { href: "/about", label: t("finalCta.links.about") },
      { href: "/contact", label: t("finalCta.links.contact") },
      { href: "/press", label: t("finalCta.links.press") },
    ],
    [t]
  );

  const heroSubtitle = activeCampus
    ? t("hero.subtitleActive", { campusName: activeCampus.name })
    : t("hero.subtitleDefault");

  const featuredEvent = spotlightEvents[0];
  const featuredProduct = spotlightProducts[0];

  return (
    <div className="space-y-24 text-primary-100">
      <section className="relative overflow-hidden rounded-[40px] bg-brand-hero text-white shadow-glow-blue">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_55%),radial-gradient(circle_at_bottom_right,rgba(61,169,224,0.35),transparent_55%)]" />
        <div className="noise-overlay relative grid gap-10 px-6 py-12 md:px-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] lg:items-center lg:py-16 xl:px-14">
          <div className="space-y-8">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="gradient" className="w-max rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-[0.18em]">
                {t("hero.badge")}
              </Badge>
              <div className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-white/80 backdrop-blur">
                <SelectCampus campuses={campuses} className="h-9 w-[180px] border-none bg-transparent text-xs font-semibold uppercase tracking-[0.14em] text-white" />
              </div>
            </div>
            <div className="space-y-6">
              <h1 className="max-w-2xl font-heading text-3xl font-semibold leading-tight text-white drop-shadow md:text-5xl">
                {activeCampus ? t("hero.titleActive", { campusName: activeCampus.name }) : t("hero.titleDefault")}
              </h1>
              <p className="max-w-2xl text-base text-white/80 md:text-lg">{heroSubtitle}</p>
              <p className="max-w-xl text-sm text-white/70 md:text-base">{t("hero.mission")}</p>
              {activeCampus ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em]">
                  <MapPin className="h-4 w-4" />
                  {activeCampus.name}
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-full bg-white px-6 text-primary-100 hover:bg-white/90">
                <Link href="/membership">{commonT("buttons.becomeMember")}</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="secondary"
                className="rounded-full border border-white/40 bg-transparent px-6 text-white hover:bg-white/15"
              >
                <Link href="/campus">{t("hero.primaryCtaSecondary")}</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="ghost"
                className="rounded-full border border-white/15 bg-white/10 px-6 text-white hover:bg-white/20"
              >
                <Link href="/contact">{t("hero.contactCta")}</Link>
              </Button>
            </div>
            <div className="grid gap-3 pt-2 sm:grid-cols-3">
              {heroStats.map((stat) => (
                <StatPill key={stat.label} label={stat.label} value={stat.value} />
              ))}
            </div>
          </div>

          <div className="relative flex flex-col gap-5 rounded-[30px] border border-white/25 bg-white/10 p-6 shadow-card-soft backdrop-blur">
            <div className="relative h-48 w-full overflow-hidden rounded-2xl border border-white/20 bg-primary-90/60">
              <Image
                src={
                  featuredEvent?.image || spotlightNews[0]?.image || "/images/placeholder.jpg"
                }
                alt={featuredEvent?.title || t("hero.imageAlt")}
                fill
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-linear-to-t from-primary-100/80 via-primary-90/5 to-transparent" />
              <div className="absolute bottom-4 left-4 flex flex-col gap-1">
                <span className="text-xs uppercase tracking-[0.16em] text-white/70">{t("hero.promo.tagline")}</span>
                <p className="text-lg font-semibold text-white">{t("hero.promo.headline")}</p>
              </div>
            </div>
            <HighlightList items={heroHighlights} emptyLabel={t("hero.promo.tagline")} />
          </div>
        </div>
      </section>

      <section className="grid gap-6 rounded-[36px] border border-primary/10 bg-white/90 p-8 shadow-card-soft lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-5">
          <Badge variant="outline" className="w-max rounded-full border-primary/10 bg-primary/5 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-primary-50">
            {t("identity.eyebrow")}
          </Badge>
          <div className="space-y-3">
            <h2 className="font-heading text-3xl font-semibold text-primary-100 lg:text-4xl">{t("identity.title")}</h2>
            <p className="max-w-2xl text-base text-muted-foreground lg:text-lg">{t("identity.description")}</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3 md:gap-5">
          {identityHighlights.map((item) => (
            <ValueCard key={item.title} icon={item.icon} title={item.title} description={item.description} />
          ))}
        </div>
      </section>

      <section className="space-y-10">
        <SectionHeader
          eyebrow={t("spotlight.eyebrow")}
          title={t("spotlight.title")}
          description={t("spotlight.description")}
          href="/events"
          linkLabel={t("spotlight.cta")}
        />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Card className="group overflow-hidden rounded-[32px] border border-primary/10 bg-white shadow-card-soft">
            {featuredEvent ? (
              <>
                <div className="relative h-64 w-full overflow-hidden">
                  <Image
                    src={featuredEvent.image || "/images/placeholder.jpg"}
                    alt={featuredEvent.title}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-primary/80 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-5 flex items-center gap-2 rounded-full bg-white/15 px-4 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white/90 backdrop-blur">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {featuredEvent.start_date
                      ? format.dateTime(new Date(featuredEvent.start_date), { dateStyle: "medium" })
                      : t("events.pendingDate")}
                  </div>
                </div>
                <CardContent className="space-y-4 p-6 lg:p-8">
                  <Badge variant="outline" className="w-max rounded-full border-primary/15 bg-primary/5 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-primary-50">
                    {t("spotlight.featuredEvent")}
                  </Badge>
                  <div className="space-y-3">
                    <CardTitle className="text-2xl font-semibold text-primary-100 lg:text-3xl">
                      <Link href={`/events/${featuredEvent.$id}`} className="hover:underline">
                        {featuredEvent.title}
                      </Link>
                    </CardTitle>
                    {featuredEvent.description ? (
                      <p className="max-w-2xl text-sm text-muted-foreground lg:text-base">{featuredEvent.description}</p>
                    ) : null}
                  </div>
                  <Button
                    asChild
                    variant="secondary"
                    className="w-full justify-between rounded-full border border-primary/15 bg-primary/5 px-5 text-primary-60 hover:bg-primary/10"
                  >
                    <Link href={`/events/${featuredEvent.$id}`}>
                      {t("spotlight.eventCta")}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  {additionalEvents.length ? (
                    <div className="grid gap-3 pt-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-40">
                        {t("spotlight.moreEvents")}
                      </p>
                      <div className="grid gap-3">
                        {additionalEvents.map((event) => (
                          <Link
                            key={event.$id}
                            href={`/events/${event.$id}`}
                            className="flex items-center justify-between gap-3 rounded-2xl border border-primary/10 bg-primary/5 px-4 py-3 text-sm text-primary-60 transition hover:bg-primary/10"
                          >
                            <span className="font-semibold text-primary-100">{event.title}</span>
                            <span className="text-xs uppercase tracking-[0.14em] text-primary-40">
                              {event.start_date
                                ? format.dateTime(new Date(event.start_date), { dateStyle: "medium" })
                                : t("events.pendingDate")}
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </>
            ) : (
              <CardContent className="p-10 text-center text-muted-foreground">{t("events.empty")}</CardContent>
            )}
          </Card>

          <div className="grid gap-5">
            {spotlightNews.length ? (
              spotlightNews.map((item, index) => {
                const summary = item.content?.replace(/<[^>]+>/g, "").slice(0, 140) ?? "";
                return (
                  <Card
                    key={item.$id}
                    className={cn(
                      "group overflow-hidden rounded-[28px] border border-primary/10 bg-white/95 shadow-card-soft transition",
                      index === 0 ? "lg:row-span-2" : ""
                    )}
                  >
                    {item.image ? (
                      <div className="relative h-40 w-full overflow-hidden">
                        <Image
                          src={item.image}
                          alt={item.title}
                          fill
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-linear-to-t from-primary/70 via-transparent to-transparent" />
                      </div>
                    ) : null}
                    <CardContent className="space-y-3 p-6">
                      <div className="flex items-center justify-between text-xs uppercase tracking-[0.14em] text-primary-40">
                        <span>{format.dateTime(new Date(item.$createdAt), { dateStyle: "medium" })}</span>
                        <Badge variant="outline" className="rounded-full border-primary/15 bg-primary/5 px-2 py-0.5">
                          {t("spotlight.newsLabel")}
                        </Badge>
                      </div>
                      <CardTitle className="text-lg font-semibold text-primary-100">
                        <Link href={`/news/${item.$id}`} className="hover:underline">
                          {item.title}
                        </Link>
                      </CardTitle>
                      {summary ? <p className="text-sm text-muted-foreground">{summary}{item.content && item.content.length > 140 ? "…" : ""}</p> : null}
                      <Button asChild variant="link" className="px-0 text-primary-40">
                        <Link href={`/news/${item.$id}`}>
                          {commonT("buttons.readMore")}
                          <ArrowRight className="ml-1 h-4 w-4" />
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <Card className="flex h-full items-center justify-center rounded-[28px] border border-dashed border-primary/20 bg-white/75 p-8 text-center text-muted-foreground">
                {t("news.empty")}
              </Card>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-8">
        <SectionHeader
          eyebrow={t("explore.eyebrow")}
          title={t("explore.title")}
          description={t("explore.description")}
          href="/resources"
          linkLabel={t("explore.cta")}
        />
        <div className="grid gap-5 lg:grid-cols-2">
          {["units", "highlights", "roles", "benefits", "support", "international"].map((key, index) => {
            const iconMap: Record<string, LucideIcon> = {
              units: Users,
              highlights: CalendarDays,
              roles: Briefcase,
              benefits: Ticket,
              support: HeartHandshake,
              international: Compass,
            };

            const icon = iconMap[key] ?? Users;
            const title = t(`explore.cards.${key}.title` as const);
            const description = t(`explore.cards.${key}.description` as const);
            const href = t(`explore.cards.${key}.href` as const);
            const cta = t(`explore.cards.${key}.cta` as const);

            return (
              <Card
                key={key}
                className="group relative flex h-full flex-col justify-between overflow-hidden rounded-[30px] border border-primary/10 bg-white shadow-card-soft transition hover:-translate-y-1.5 hover:shadow-card-hover"
              >
                <div className="pointer-events-none absolute inset-x-6 top-0 h-1 rounded-b-full bg-linear-to-r from-blue-accent via-gold-default to-blue-accent opacity-0 transition group-hover:opacity-100" />
                <CardHeader className="flex flex-row items-center justify-between gap-4 p-6">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/5 text-primary-40">
                    <icon className="h-5 w-5" />
                  </span>
                  <Badge variant="outline" className="rounded-full border-primary/10 bg-primary/5 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-primary-50">
                    {index + 1 < 10 ? `0${index + 1}` : index + 1}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-4 px-6 pb-6">
                  <CardTitle className="text-xl font-semibold text-primary-100">{title}</CardTitle>
                  <p className="text-sm text-muted-foreground">{description}</p>
                  <Button asChild variant="link" className="px-0 text-primary-30">
                    <Link href={href}>
                      {cta}
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="space-y-10">
        <SectionHeader
          eyebrow={t("opportunities.eyebrow")}
          title={t("opportunities.title")}
          description={t("opportunities.description")}
          href="/jobs"
          linkLabel={t("opportunities.cta")}
        />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Card className="flex h-full flex-col overflow-hidden rounded-[32px] border border-primary/10 bg-white shadow-card-soft">
            {spotlightJobs.length ? (
              <>
                <CardContent className="space-y-4 p-6 lg:p-8">
                  <Badge variant="outline" className="w-max rounded-full border-primary/15 bg-primary/5 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-primary-50">
                    {t("opportunities.featured")}
                  </Badge>
                  <div className="space-y-3">
                    <CardTitle className="text-2xl font-semibold text-primary-100 lg:text-3xl">
                      <Link href={`/jobs/${spotlightJobs[0].slug}`} className="hover:underline">
                        {spotlightJobs[0].title}
                      </Link>
                    </CardTitle>
                    <p className="max-w-2xl text-sm text-muted-foreground lg:text-base">
                      {spotlightJobs[0].description?.replace(/<[^>]+>/g, "").slice(0, 220)}
                      {spotlightJobs[0].description && spotlightJobs[0].description.length > 220 ? "…" : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.14em] text-primary-40">
                    <span className="rounded-full bg-primary/5 px-3 py-1 font-semibold">
                      {spotlightJobs[0].application_deadline
                        ? t("jobs.deadline", {
                            date: format.dateTime(new Date(spotlightJobs[0].application_deadline), { dateStyle: "medium" }),
                          })
                        : t("jobs.rolling")}
                    </span>
                    {spotlightJobs[0].campus_id ? (
                      <span className="rounded-full bg-primary/5 px-3 py-1 font-semibold">
                        {campusLookup[spotlightJobs[0].campus_id] ?? commonT("labels.organisation")}
                      </span>
                    ) : null}
                  </div>
                  <Button asChild className="w-full justify-between rounded-full px-5">
                    <Link href={`/jobs/${spotlightJobs[0].slug}`}>
                      {t("opportunities.applyCta")}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
                {supportingJobs.length ? (
                  <div className="border-t border-primary/10 bg-primary/3 px-6 py-5 lg:px-8">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-40">
                      {t("opportunities.more")}
                    </p>
                    <div className="mt-4 grid gap-3">
                      {supportingJobs.map((job) => (
                        <Link
                          key={job.$id}
                          href={`/jobs/${job.slug}`}
                          className="flex items-center justify-between gap-4 rounded-2xl border border-primary/10 bg-white px-4 py-3 text-sm text-primary-60 transition hover:bg-primary/5"
                        >
                          <div className="space-y-1">
                            <p className="font-semibold text-primary-100">{job.title}</p>
                            <p className="text-xs uppercase tracking-[0.14em] text-primary-40">
                              {job.campus_id && campusLookup[job.campus_id]
                                ? campusLookup[job.campus_id]
                                : commonT("labels.organisation")}
                            </p>
                          </div>
                          <ArrowRight className="h-4 w-4 text-primary-30" />
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <CardContent className="p-10 text-center text-muted-foreground">{t("opportunities.empty")}</CardContent>
            )}
          </Card>

          <Card className="h-full rounded-[32px] border border-primary/10 bg-linear-to-br from-primary/5 via-white to-primary/5 p-6 shadow-card-soft">
            <CardContent className="space-y-6 p-0">
              <div className="space-y-2">
                <Badge variant="outline" className="w-max rounded-full border-primary/15 bg-primary/5 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-primary-50">
                  {t("opportunities.supportTitle")}
                </Badge>
                <h3 className="text-xl font-semibold text-primary-100">{t("opportunities.supportHeadline")}</h3>
                <p className="text-sm text-muted-foreground">{t("opportunities.supportDescription")}</p>
              </div>
              <div className="grid gap-3">
                {supportLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-primary/10 bg-white px-4 py-3 text-sm font-semibold text-primary-60 transition hover:bg-primary/10"
                  >
                    {link.label}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-10">
        <SectionHeader
          eyebrow={t("benefits.eyebrow")}
          title={t("benefits.title")}
          description={t("benefits.description")}
          href="/shop"
          linkLabel={t("benefits.cta")}
        />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <Card className="group overflow-hidden rounded-[32px] border border-primary/10 bg-white shadow-card-soft">
            {featuredProduct ? (
              <>
                {featuredProduct.image || featuredProduct.images?.[0] ? (
                  <div className="relative h-56 w-full overflow-hidden">
                    <Image
                      src={featuredProduct.image || featuredProduct.images?.[0] || "/images/placeholder.jpg"}
                      alt={featuredProduct.title || featuredProduct.slug}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-primary/70 via-transparent to-transparent" />
                    <div className="absolute bottom-4 left-5 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white backdrop-blur">
                      <Ticket className="h-3.5 w-3.5" />
                      {t("benefits.shopTag")}
                    </div>
                  </div>
                ) : null}
                <CardContent className="space-y-4 p-6 lg:p-8">
                  <div className="space-y-2">
                    <CardTitle className="text-2xl font-semibold text-primary-100 lg:text-3xl">
                      {featuredProduct.slug ? (
                        <Link href={`/shop/${featuredProduct.slug}`} className="hover:underline">
                          {featuredProduct.title || featuredProduct.slug}
                        </Link>
                      ) : (
                        featuredProduct.title || "Untitled Product"
                      )}
                    </CardTitle>
                    {featuredProduct.description ? (
                      <p className="text-sm text-muted-foreground lg:text-base">{featuredProduct.description}</p>
                    ) : null}
                    {typeof featuredProduct.price === "number" ? (
                      <p className="text-base font-semibold text-primary-40">
                        {t("shop.price", { value: featuredProduct.price.toFixed(2) })}
                      </p>
                    ) : null}
                  </div>
                  <Button asChild className="w-full rounded-full px-5">
                    <Link href={featuredProduct.slug ? `/shop/${featuredProduct.slug}` : "/shop"}>
                      {t("benefits.shopCta")}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </>
            ) : (
              <CardContent className="p-10 text-center text-muted-foreground">{t("shop.empty")}</CardContent>
            )}
          </Card>

          <div className="grid gap-5">
            {benefitsPerks.map((perk) => (
              <ValueCard key={perk.title} icon={perk.icon} title={perk.title} description={perk.description} />
            ))}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[36px] border border-primary/10 bg-linear-to-r from-primary/10 via-white to-primary/5 p-8 shadow-card-soft lg:p-12">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-center">
          <div className="space-y-4">
            <Badge variant="outline" className="w-max rounded-full border-primary/15 bg-primary/5 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-primary-50">
              {t("finalCta.eyebrow")}
            </Badge>
            <h2 className="font-heading text-3xl font-semibold text-primary-100 lg:text-4xl">{t("finalCta.title")}</h2>
            <p className="max-w-2xl text-base text-muted-foreground lg:text-lg">{t("finalCta.description")}</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-full px-6">
                <Link href="/membership">{t("finalCta.primary")}</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full px-6">
                <Link href={t("finalCta.secondaryHref")}>{t("finalCta.secondary")}</Link>
              </Button>
            </div>
          </div>
          <Card className="rounded-[28px] border border-primary/15 bg-white/90 shadow-card-soft">
            <CardContent className="space-y-4 p-6">
              <p className="text-sm text-muted-foreground">{t("finalCta.supportCopy")}</p>
              <div className="grid gap-3">
                {finalLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center justify-between gap-2 rounded-2xl border border-primary/10 bg-primary/3 px-4 py-3 text-sm font-semibold text-primary-60 transition hover:bg-primary/5"
                  >
                    {link.label}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
};
