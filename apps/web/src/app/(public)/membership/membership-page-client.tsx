"use client";

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
import { cn } from "@repo/ui/lib/utils";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Compass,
  GraduationCap,
  ShieldCheck,
  Sparkles,
  Ticket,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { useCampus } from "@/components/context/campus";
import type { CampusData } from "@/lib/types/campus-data";

type BenefitKey = keyof Pick<
  CampusData,
  | "studentBenefits"
  | "careerAdvantages"
  | "socialNetwork"
  | "safety"
  | "businessBenefits"
>;

type BenefitConfig = {
  key: BenefitKey;
  title: string;
  globalDescription: string;
  localDescription: string;
  icon: LucideIcon;
};

type BenefitSection = {
  key: BenefitKey;
  title: string;
  description: string;
  icon: LucideIcon;
  items: string[];
};

type BenefitLocaleSuffix = "nb" | "en";
type LocalizedBenefitKey = `${BenefitKey}_${BenefitLocaleSuffix}`;

type MembershipPageClientProps = {
  campusData: CampusData[];
  globalBenefits: CampusData | null;
  locale: Locale;
};

function selectBenefitItems(
  data: CampusData | null | undefined,
  key: BenefitKey,
  locale: Locale
): string[] {
  if (!data) {
    return [];
  }
  const suffix: BenefitLocaleSuffix = locale === "en" ? "en" : "nb";
  const localizedKey = `${key}_${suffix}` as LocalizedBenefitKey;
  const localized = data[localizedKey as keyof CampusData] as unknown;
  const fallback = data[key] as unknown;

  let raw: string[] = [];
  if (Array.isArray(localized)) {
    raw = localized as string[];
  } else if (Array.isArray(fallback)) {
    raw = fallback as string[];
  }

  return raw
    .map((item) => item?.trim())
    .filter((item): item is string => Boolean(item));
}

function buildBenefitSections(
  configs: BenefitConfig[],
  data: CampusData | null | undefined,
  locale: Locale,
  descriptionSelector: (config: BenefitConfig) => string
): BenefitSection[] {
  if (!data) {
    return [];
  }
  return configs
    .map((config) => {
      const items = selectBenefitItems(data, config.key, locale);
      return {
        key: config.key,
        title: config.title,
        description: descriptionSelector(config),
        icon: config.icon,
        items,
      };
    })
    .filter((section) => section.items.length > 0);
}

export const MembershipPageClient = ({
  campusData,
  globalBenefits,
  locale,
}: MembershipPageClientProps) => {
  const t = useTranslations("membership");
  const { campuses, activeCampusId, activeCampus, selectCampus } = useCampus();

  const benefitConfigs = useMemo<BenefitConfig[]>(
    () => [
      {
        key: "studentBenefits",
        title: t("benefits.categories.student.title"),
        globalDescription: t("benefits.categories.student.global"),
        localDescription: t("benefits.categories.student.local"),
        icon: GraduationCap,
      },
      {
        key: "careerAdvantages",
        title: t("benefits.categories.career.title"),
        globalDescription: t("benefits.categories.career.global"),
        localDescription: t("benefits.categories.career.local"),
        icon: BriefcaseBusiness,
      },
      {
        key: "socialNetwork",
        title: t("benefits.categories.social.title"),
        globalDescription: t("benefits.categories.social.global"),
        localDescription: t("benefits.categories.social.local"),
        icon: Users,
      },
      {
        key: "safety",
        title: t("benefits.categories.safety.title"),
        globalDescription: t("benefits.categories.safety.global"),
        localDescription: t("benefits.categories.safety.local"),
        icon: ShieldCheck,
      },
      {
        key: "businessBenefits",
        title: t("benefits.categories.business.title"),
        globalDescription: t("benefits.categories.business.global"),
        localDescription: t("benefits.categories.business.local"),
        icon: Compass,
      },
    ],
    [t]
  );

  const onboardingSteps = useMemo(
    () => [
      {
        number: "1",
        title: t("onboarding.steps.1.title"),
        description: t("onboarding.steps.1.description"),
      },
      {
        number: "2",
        title: t("onboarding.steps.2.title"),
        description: t("onboarding.steps.2.description"),
      },
      {
        number: "3",
        title: t("onboarding.steps.3.title"),
        description: t("onboarding.steps.3.description"),
      },
      {
        number: "4",
        title: t("onboarding.steps.4.title"),
        description: t("onboarding.steps.4.description"),
      },
    ],
    [t]
  );

  const highlightEvents = useMemo(
    () => [
      {
        key: "fadderullan",
        title: t("highlights.items.fadderullan.title"),
        description: t("highlights.items.fadderullan.description"),
        icon: Sparkles,
        cta: t("highlights.items.fadderullan.cta"),
      },
      {
        key: "careerDays",
        title: t("highlights.items.careerDays.title"),
        description: t("highlights.items.careerDays.description"),
        icon: BriefcaseBusiness,
        cta: t("highlights.items.careerDays.cta"),
      },
      {
        key: "winterGames",
        title: t("highlights.items.winterGames.title"),
        description: t("highlights.items.winterGames.description"),
        icon: CalendarDays,
        cta: t("highlights.items.winterGames.cta"),
      },
    ],
    [t]
  );

  const faqs = useMemo(
    () => [
      {
        key: "cost",
        question: t("faq.items.cost.question"),
        answer: t("faq.items.cost.answer"),
      },
      {
        key: "discounts",
        question: t("faq.items.discounts.question"),
        answer: t("faq.items.discounts.answer"),
      },
      {
        key: "switchCampus",
        question: t("faq.items.switchCampus.question"),
        answer: t("faq.items.switchCampus.answer"),
      },
      {
        key: "engagement",
        question: t("faq.items.engagement.question"),
        answer: t("faq.items.engagement.answer"),
      },
    ],
    [t]
  );

  const campusDataById = useMemo(
    () =>
      campusData.reduce<Record<string, CampusData>>((acc, item) => {
        if (item?.$id) {
          acc[item.$id] = item;
        }
        return acc;
      }, {}),
    [campusData]
  );

  const campusDataByName = useMemo(
    () =>
      campusData.reduce<Record<string, CampusData>>((acc, item) => {
        const key = (item?.name ?? "").toLowerCase().trim();
        if (key) {
          acc[key] = item;
        }
        return acc;
      }, {}),
    [campusData]
  );

  const activeCampusData = useMemo(() => {
    if (activeCampusId && campusDataById[activeCampusId]) {
      return campusDataById[activeCampusId];
    }
    if (activeCampus?.name) {
      const key = activeCampus.name.toLowerCase();
      return campusDataByName[key] ?? null;
    }
    return null;
  }, [activeCampusId, campusDataById, activeCampus, campusDataByName]);

  const globalSections = useMemo(
    () =>
      buildBenefitSections(
        benefitConfigs,
        globalBenefits,
        locale,
        (config) => config.globalDescription
      ),
    [benefitConfigs, globalBenefits, locale]
  );

  const campusSections = useMemo(() => {
    if (!activeCampusData || activeCampusData.$id === "5") {
      return [];
    }
    return buildBenefitSections(
      benefitConfigs,
      activeCampusData,
      locale,
      (config) => config.localDescription
    );
  }, [activeCampusData, benefitConfigs, locale]);

  const campusDescription =
    locale === "en"
      ? (activeCampusData?.description_en ??
        activeCampusData?.description ??
        activeCampusData?.description_nb)
      : (activeCampusData?.description_nb ??
        activeCampusData?.description ??
        activeCampusData?.description_en);

  const heroSubtitle = campusDescription ?? t("hero.subtitleFallback");

  const campusNameLocalized =
    (locale === "en" ? activeCampusData?.name_en : activeCampusData?.name_nb) ??
    activeCampusData?.name ??
    activeCampus?.name ??
    t("hero.campusFallback");

  const heroTitle = (() => {
    if (activeCampusData?.$id === "5") {
      return t("hero.titleNational");
    }
    if (activeCampusData || activeCampus) {
      return t("hero.title", { campus: campusNameLocalized });
    }
    return t("hero.titleFallback");
  })();

  const hasCampusBenefits = campusSections.length > 0;

  return (
    <div className="space-y-16 pb-12">
      <section className="relative overflow-hidden rounded-[40px] border border-primary/10 bg-linear-to-br from-primary-100 via-blue-strong to-blue-accent text-white shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(61,169,224,0.28),transparent_55%)]" />
        <div className="relative grid gap-10 px-6 py-12 md:px-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:py-16">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-background/10 px-4 py-1 text-white/80 text-xs uppercase tracking-wide">
              <Sparkles className="h-3.5 w-3.5" />
              {t("hero.badge")}
            </div>
            <h1 className="font-semibold text-3xl text-white leading-tight md:text-5xl">
              {heroTitle}
            </h1>
            <p className="max-w-2xl text-base text-white/80 md:text-lg">
              {heroSubtitle}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                asChild
                className="bg-background text-primary-100 hover:bg-background/90"
                size="lg"
              >
                <Link href="https://biso.no/shop/bli-medlem-i-biso/">
                  {t("hero.ctas.join")}
                </Link>
              </Button>
              <Button
                asChild
                className="border-white/40 bg-background/10 text-white hover:bg-background/20"
                size="lg"
                variant="glass"
              >
                <Link href="/jobs?campus=all">{t("hero.ctas.roles")}</Link>
              </Button>
              <Button
                asChild
                className="text-white hover:bg-background/10"
                size="lg"
                variant="ghost"
              >
                <Link href="/partner">{t("hero.ctas.partners")}</Link>
              </Button>
            </div>
            <div className="flex flex-wrap gap-3 pt-4 text-sm text-white/80">
              <div className="flex items-center gap-2 rounded-full border border-white/20 px-4 py-2">
                <Ticket className="h-4 w-4" />
                {t("hero.stats.card")}
              </div>
              <div className="flex items-center gap-2 rounded-full border border-white/20 px-4 py-2">
                <Users className="h-4 w-4" />
                {t("hero.stats.members")}
              </div>
              <div className="flex items-center gap-2 rounded-full border border-white/20 px-4 py-2">
                <BriefcaseBusiness className="h-4 w-4" />
                {t("hero.stats.partners")}
              </div>
            </div>
          </div>
          <Card className="border-white/20 /10 text-white shadow-glow backdrop-blur">
            <CardHeader>
              <CardTitle className="text-white/90">
                {t("onboarding.title")}
              </CardTitle>
              <p className="text-sm text-white/70">
                {t("onboarding.subtitle")}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {onboardingSteps.map((step) => (
                <div
                  className="flex gap-4 rounded-2xl border border-white/10 bg-background/5 p-4"
                  key={step.number}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-background/10 font-semibold text-base">
                    {step.number}
                  </div>
                  <div>
                    <p className="font-medium text-white">{step.title}</p>
                    <p className="mt-1 text-sm text-white/70">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-semibold text-2xl text-primary-100">
              {t("global.title")}
            </h2>
            <p className="text-muted-foreground">{t("global.subtitle")}</p>
          </div>
          <Button
            asChild
            className="border-primary/20 text-primary-80 hover:border-primary/30 hover:text-primary-40"
            size="sm"
            variant="outline"
          >
            <Link href="https://biso.no/shop/bli-medlem-i-biso/">
              {t("global.cta")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
        {globalSections.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {globalSections.map((section) => {
              const Icon = section.icon;
              return (
                <Card
                  className="h-full border-primary/10 /90 shadow-card"
                  key={section.key}
                >
                  <CardHeader className="space-y-3">
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-primary/10 bg-primary-20/60 text-primary-60">
                      <Icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="font-semibold text-base text-primary-100">
                      {section.title}
                    </CardTitle>
                    <p className="text-muted-foreground text-sm">
                      {section.description}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-muted-foreground text-sm">
                      {section.items.map((item) => (
                        <li className="flex items-start gap-2" key={item}>
                          <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary-50" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="border-primary/20 border-dashed /70">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-10 text-center text-muted-foreground text-sm">
              <Sparkles className="h-5 w-5 text-primary-50" />
              {t("global.empty")}
            </CardContent>
          </Card>
        )}
      </section>

      <section className="space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-semibold text-2xl text-primary-100">
              {t("local.title", { campus: campusNameLocalized })}
            </h2>
            <p className="text-muted-foreground">{t("local.subtitle")}</p>
          </div>
          {campuses.length > 0 ? (
            <ScrollArea
              aria-label={t("local.switcherLabel")}
              className="max-w-full whitespace-nowrap rounded-full border border-primary/10 bg-background"
            >
              <div className="flex gap-2 px-3 py-2">
                {campuses
                  .filter((campus) => campus.name?.toLowerCase() !== "national")
                  .map((campus) => {
                    const isActive = campus.$id === activeCampusId;
                    return (
                      <Button
                        className={cn(
                          "rounded-full px-4 py-2 font-medium text-sm transition",
                          isActive
                            ? "bg-primary-100 text-white shadow-sm"
                            : "bg-background text-primary-80 hover:bg-primary-10"
                        )}
                        key={campus.$id}
                        onClick={() => selectCampus(campus.$id)}
                      >
                        {campus.name}
                      </Button>
                    );
                  })}
              </div>
              <ScrollBar className="invisible h-2" orientation="horizontal" />
            </ScrollArea>
          ) : null}
        </div>

        {hasCampusBenefits ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {campusSections.map((section) => {
              const Icon = section.icon;
              return (
                <Card
                  className="h-full border-primary/10 /90 shadow-card"
                  key={section.key}
                >
                  <CardHeader className="space-y-3">
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-primary/10 bg-primary-20/60 text-primary-60">
                      <Icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="font-semibold text-base text-primary-100">
                      {section.title}
                    </CardTitle>
                    <p className="text-muted-foreground text-sm">
                      {section.description}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-muted-foreground text-sm">
                      {section.items.map((item) => (
                        <li className="flex items-start gap-2" key={item}>
                          <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary-50" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="border-primary/20 border-dashed /70">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-10 text-center text-muted-foreground text-sm">
              <Users className="h-5 w-5 text-primary-50" />
              {t("local.empty")}
            </CardContent>
          </Card>
        )}
      </section>

      <section className="space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-semibold text-2xl text-primary-100">
              {t("highlights.title")}
            </h2>
            <p className="text-muted-foreground">{t("highlights.subtitle")}</p>
          </div>
          <Button
            asChild
            className="border-primary/20 text-primary-80 hover:border-primary/30 hover:text-primary-40"
            size="sm"
            variant="outline"
          >
            <Link href="/events?campus=all">
              {t("highlights.ctaAll")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {highlightEvents.map((event) => {
            const Icon = event.icon;
            return (
              <Card
                className="h-full border-primary/10 /90 shadow-card"
                key={event.key}
              >
                <CardHeader className="space-y-3">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-primary/10 bg-primary-20/60 text-primary-60">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="font-semibold text-base text-primary-100">
                    {event.title}
                  </CardTitle>
                  <p className="text-muted-foreground text-sm">
                    {event.description}
                  </p>
                </CardHeader>
                <CardContent>
                  <Button
                    className="px-0 text-primary-70 hover:text-primary-40"
                    variant="ghost"
                  >
                    {event.cta}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Card className="border-primary/10 /90 shadow-card">
          <CardHeader>
            <CardTitle className="font-semibold text-primary-100 text-xl">
              {t("faq.title")}
            </CardTitle>
            <p className="text-muted-foreground text-sm">{t("faq.subtitle")}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {faqs.map((faq) => (
              <div
                className="rounded-2xl border border-primary/10 bg-background/80 p-4"
                key={faq.key}
              >
                <p className="font-medium text-primary-90">{faq.question}</p>
                <p className="mt-2 text-muted-foreground text-sm">
                  {faq.answer}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="flex flex-col justify-between border-primary/10 bg-linear-to-br from-primary-10 via-white to-white shadow-card">
          <CardHeader>
            <CardTitle className="font-semibold text-primary-100 text-xl">
              {t("ctaCard.title")}
            </CardTitle>
            <p className="text-muted-foreground text-sm">
              {t("ctaCard.subtitle")}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge
                className="border-primary/20 text-primary-70"
                variant="outline"
              >
                {t("ctaCard.badges.annual")}
              </Badge>
              <Badge
                className="border-primary/20 text-primary-70"
                variant="outline"
              >
                {t("ctaCard.badges.semester")}
              </Badge>
              <Badge
                className="border-primary/20 text-primary-70"
                variant="outline"
              >
                {t("ctaCard.badges.digitalCard")}
              </Badge>
            </div>
            <Button
              asChild
              className="w-full bg-primary-100 text-white hover:bg-primary-90"
              size="lg"
            >
              <Link href="https://biso.no/shop/bli-medlem-i-biso/">
                {t("ctaCard.primary")}
              </Link>
            </Button>
            <Button
              asChild
              className="w-full text-primary-80 hover:text-primary-40"
              size="lg"
              variant="ghost"
            >
              <Link href="/contact">{t("ctaCard.secondary")}</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};
