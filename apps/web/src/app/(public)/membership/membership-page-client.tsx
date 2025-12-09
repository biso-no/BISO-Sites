"use client";

import type { Locale } from "@repo/i18n/config";
import { ImageWithFallback } from "@repo/ui/components/image";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { cn } from "@repo/ui/lib/utils";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle,
  ChevronRight,
  Globe,
  GraduationCap,
  Heart,
  MapPin,
  Shield,
  Sparkles,
  Star,
  Ticket,
  TrendingUp,
  Users,
} from "lucide-react";
import { motion } from "motion/react";
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
  colorScheme: "blue" | "green" | "pink" | "purple" | "orange";
};

type BenefitSection = {
  key: BenefitKey;
  title: string;
  description: string;
  icon: LucideIcon;
  items: string[];
  colorScheme: "blue" | "green" | "pink" | "purple" | "orange";
};

type BenefitLocaleSuffix = "nb" | "en";
type LocalizedBenefitKey = `${BenefitKey}_${BenefitLocaleSuffix}`;

type MembershipPageClientProps = {
  campusData: CampusData[];
  globalBenefits: CampusData | null;
  locale: Locale;
};

const colorSchemes = {
  blue: {
    gradient: "from-blue-50 via-blue-50/50 to-white dark:from-blue-950/30 dark:via-blue-950/10 dark:to-card",
    iconGradient: "from-blue-500 to-blue-700",
    checkColor: "text-blue-600 dark:text-blue-400",
    border: "border-blue-100 dark:border-blue-900/50",
  },
  green: {
    gradient: "from-emerald-50 via-emerald-50/50 to-white dark:from-emerald-950/30 dark:via-emerald-950/10 dark:to-card",
    iconGradient: "from-emerald-500 to-emerald-700",
    checkColor: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-100 dark:border-emerald-900/50",
  },
  pink: {
    gradient: "from-pink-50 via-pink-50/50 to-white dark:from-pink-950/30 dark:via-pink-950/10 dark:to-card",
    iconGradient: "from-pink-500 to-rose-600",
    checkColor: "text-pink-600 dark:text-pink-400",
    border: "border-pink-100 dark:border-pink-900/50",
  },
  purple: {
    gradient: "from-violet-50 via-violet-50/50 to-white dark:from-violet-950/30 dark:via-violet-950/10 dark:to-card",
    iconGradient: "from-violet-500 to-violet-700",
    checkColor: "text-violet-600 dark:text-violet-400",
    border: "border-violet-100 dark:border-violet-900/50",
  },
  orange: {
    gradient: "from-orange-50 via-orange-50/50 to-white dark:from-orange-950/30 dark:via-orange-950/10 dark:to-card",
    iconGradient: "from-orange-500 to-amber-600",
    checkColor: "text-orange-600 dark:text-orange-400",
    border: "border-orange-100 dark:border-orange-900/50",
  },
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
        colorScheme: config.colorScheme,
      };
    })
    .filter((section) => section.items.length > 0);
}

function BenefitCard({
  section,
  index,
}: {
  section: BenefitSection;
  index: number;
}) {
  const colors = colorSchemes[section.colorScheme];
  const Icon = section.icon;

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      initial={{ opacity: 0, y: 20 }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
    >
      <Card
        className={cn(
          "border-0 bg-linear-to-br p-6 shadow-lg transition-shadow hover:shadow-xl sm:p-8",
          colors.gradient,
          colors.border
        )}
      >
        <div className="mb-6 flex items-center gap-4">
          <div
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-linear-to-br shadow-md",
              colors.iconGradient
            )}
          >
            <Icon className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-lg">
              {section.title}
            </h3>
            <p className="text-muted-foreground text-sm">{section.description}</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {section.items.map((item, itemIndex) => (
            <motion.div
              animate={{ opacity: 1, x: 0 }}
              className="flex items-start gap-3 rounded-lg bg-background/80 p-3 backdrop-blur-sm"
              initial={{ opacity: 0, x: -10 }}
              key={item}
              transition={{ delay: index * 0.1 + itemIndex * 0.03 }}
            >
              <CheckCircle
                className={cn("mt-0.5 h-4 w-4 shrink-0", colors.checkColor)}
              />
              <span className="text-muted-foreground text-sm">{item}</span>
            </motion.div>
          ))}
        </div>
      </Card>
    </motion.div>
  );
}

function StatPill({
  icon: Icon,
  label,
}: {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white/90 backdrop-blur-sm">
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </div>
  );
}

export function MembershipPageClient({
  campusData,
  globalBenefits,
  locale,
}: MembershipPageClientProps) {
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
        colorScheme: "blue",
      },
      {
        key: "careerAdvantages",
        title: t("benefits.categories.career.title"),
        globalDescription: t("benefits.categories.career.global"),
        localDescription: t("benefits.categories.career.local"),
        icon: TrendingUp,
        colorScheme: "green",
      },
      {
        key: "socialNetwork",
        title: t("benefits.categories.social.title"),
        globalDescription: t("benefits.categories.social.global"),
        localDescription: t("benefits.categories.social.local"),
        icon: Heart,
        colorScheme: "pink",
      },
      {
        key: "safety",
        title: t("benefits.categories.safety.title"),
        globalDescription: t("benefits.categories.safety.global"),
        localDescription: t("benefits.categories.safety.local"),
        icon: Shield,
        colorScheme: "purple",
      },
      {
        key: "businessBenefits",
        title: t("benefits.categories.business.title"),
        globalDescription: t("benefits.categories.business.global"),
        localDescription: t("benefits.categories.business.local"),
        icon: BriefcaseBusiness,
        colorScheme: "orange",
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
        colorScheme: "pink" as const,
      },
      {
        key: "careerDays",
        title: t("highlights.items.careerDays.title"),
        description: t("highlights.items.careerDays.description"),
        icon: BriefcaseBusiness,
        cta: t("highlights.items.careerDays.cta"),
        colorScheme: "green" as const,
      },
      {
        key: "winterGames",
        title: t("highlights.items.winterGames.title"),
        description: t("highlights.items.winterGames.description"),
        icon: CalendarDays,
        cta: t("highlights.items.winterGames.cta"),
        colorScheme: "blue" as const,
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
  const filteredCampuses = campuses.filter(
    (campus) => campus.name?.toLowerCase() !== "national"
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section - Full bleed with image background */}
      <section className="relative h-[85vh] min-h-[600px] overflow-hidden">
        <ImageWithFallback
          alt="BISO Membership"
          className="h-full w-full object-cover"
          fill
          priority
          src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdHVkZW50cyUyMGNlbGVicmF0aW5nfGVufDF8fHx8MTc2MjE2NTE0NXww&ixlib=rb-4.1.0&q=80&w=1920"
        />
        <div className="absolute inset-0 bg-linear-to-br from-brand-overlay-from via-brand-overlay-via to-brand-overlay-to" />
        <div className="absolute inset-0 bg-linear-to-t from-brand-overlay-from/70 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_50%),radial-gradient(circle_at_bottom_right,rgba(61,169,224,0.15),transparent_60%)]" />

        <div className="absolute inset-0">
          <div className="mx-auto flex h-full max-w-7xl items-center px-4 sm:px-6 lg:px-8">
            <div className="grid w-full gap-8 lg:grid-cols-2 lg:gap-12">
              {/* Left column - Hero content */}
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col justify-center"
                initial={{ opacity: 0, y: 30 }}
                transition={{ duration: 0.8 }}
              >
                <Badge className="mb-6 w-fit border-white/30 bg-white/10 text-white backdrop-blur-sm">
                  <Sparkles className="mr-2 h-3.5 w-3.5" />
                  {t("hero.badge")}
                </Badge>

                <h1 className="mb-6 font-bold text-4xl text-white leading-tight sm:text-5xl lg:text-6xl">
                  {heroTitle}
                </h1>

                <p className="mb-8 max-w-xl text-lg text-white/85 leading-relaxed">
                  {heroSubtitle}
                </p>

                <div className="mb-8 flex flex-wrap gap-3">
                  <Button
                    asChild
                    className="bg-white text-primary-100 shadow-lg hover:bg-white/90"
                    size="lg"
                  >
                    <Link href="/shop/membership/">
                      {t("hero.ctas.join")}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    className="border-white/40 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20"
                    size="lg"
                    variant="outline"
                  >
                    <Link href="/jobs?campus=all">{t("hero.ctas.roles")}</Link>
                  </Button>
                  <Button
                    asChild
                    className="text-white hover:bg-white/10"
                    size="lg"
                    variant="ghost"
                  >
                    <Link href="/partner">{t("hero.ctas.partners")}</Link>
                  </Button>
                </div>

                <div className="flex flex-wrap gap-3">
                  <StatPill icon={Ticket} label={t("hero.stats.card")} />
                  <StatPill icon={Users} label={t("hero.stats.members")} />
                  <StatPill
                    icon={BriefcaseBusiness}
                    label={t("hero.stats.partners")}
                  />
                </div>
              </motion.div>

              {/* Right column - Onboarding steps card */}
              <motion.div
                animate={{ opacity: 1, x: 0 }}
                className="hidden lg:flex lg:items-center lg:justify-end"
                initial={{ opacity: 0, x: 30 }}
                transition={{ delay: 0.3, duration: 0.8 }}
              >
                <Card className="w-full max-w-md border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-md">
                  <div className="mb-6">
                    <h2 className="font-semibold text-white text-xl">
                      {t("onboarding.title")}
                    </h2>
                    <p className="text-sm text-white/70">
                      {t("onboarding.subtitle")}
                    </p>
                  </div>
                  <div className="space-y-4">
                    {onboardingSteps.map((step, index) => (
                      <motion.div
                        animate={{ opacity: 1, x: 0 }}
                        className="flex gap-4 rounded-xl border border-white/10 bg-white/5 p-4"
                        initial={{ opacity: 0, x: 20 }}
                        key={step.number}
                        transition={{ delay: 0.5 + index * 0.1 }}
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 font-semibold text-white">
                          {step.number}
                        </div>
                        <div>
                          <p className="font-medium text-white">{step.title}</p>
                          <p className="mt-1 text-sm text-white/70">
                            {step.description}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </Card>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Main content container */}
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Global Benefits Section */}
        <section className="mb-20">
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="mb-10"
            initial={{ opacity: 0, y: 20 }}
            viewport={{ once: true }}
            whileInView={{ opacity: 1, y: 0 }}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <Badge className="mb-3" variant="secondary">
                  <Globe className="mr-2 h-3 w-3" />
                  {locale === "en" ? "National Benefits" : "Nasjonale fordeler"}
                </Badge>
                <h2 className="font-bold text-2xl text-foreground sm:text-3xl">
                  {t("global.title")}
                </h2>
                <p className="mt-2 max-w-2xl text-muted-foreground">
                  {t("global.subtitle")}
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href="https://biso.no/shop/bli-medlem-i-biso/">
                  {t("global.cta")}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </motion.div>

          {globalSections.length > 0 ? (
            <div className="space-y-6">
              {globalSections.map((section, index) => (
                <BenefitCard index={index} key={section.key} section={section} />
              ))}
            </div>
          ) : (
            <Card className="border-dashed p-12 text-center">
              <Sparkles className="mx-auto mb-4 h-8 w-8 text-muted-foreground/50" />
              <p className="text-muted-foreground">{t("global.empty")}</p>
            </Card>
          )}
        </section>

        {/* Campus-Specific Benefits Section */}
        <section className="mb-20">
          <motion.div
            className="mb-10"
            initial={{ opacity: 0, y: 20 }}
            viewport={{ once: true }}
            whileInView={{ opacity: 1, y: 0 }}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <Badge className="mb-3" variant="secondary">
                  <MapPin className="mr-2 h-3 w-3" />
                  {locale === "en" ? "Campus Benefits" : "Campus-fordeler"}
                </Badge>
                <h2 className="font-bold text-2xl text-foreground sm:text-3xl">
                  {t("local.title", { campus: campusNameLocalized })}
                </h2>
                <p className="mt-2 max-w-2xl text-muted-foreground">
                  {t("local.subtitle")}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Campus Switcher */}
          {filteredCampuses.length > 0 && (
            <motion.div
              className="mb-8"
              initial={{ opacity: 0, y: 10 }}
              viewport={{ once: true }}
              whileInView={{ opacity: 1, y: 0 }}
            >
              <div className="flex flex-wrap gap-2">
                {filteredCampuses.map((campus) => {
                  const isActive = campus.$id === activeCampusId;
                  return (
                    <Button
                      className={cn(
                        "rounded-full transition-all",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-md"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      )}
                      key={campus.$id}
                      onClick={() => selectCampus(campus.$id)}
                      size="sm"
                      variant={isActive ? "default" : "ghost"}
                    >
                      {campus.name}
                    </Button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {hasCampusBenefits ? (
            <div className="space-y-6">
              {campusSections.map((section, index) => (
                <BenefitCard index={index} key={section.key} section={section} />
              ))}
            </div>
          ) : (
            <Card className="border-dashed p-12 text-center">
              <Users className="mx-auto mb-4 h-8 w-8 text-muted-foreground/50" />
              <p className="text-muted-foreground">{t("local.empty")}</p>
            </Card>
          )}
        </section>

        {/* Highlight Events Section */}
        <section className="mb-20">
          <motion.div
            className="mb-10"
            initial={{ opacity: 0, y: 20 }}
            viewport={{ once: true }}
            whileInView={{ opacity: 1, y: 0 }}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <Badge className="mb-3" variant="secondary">
                  <Star className="mr-2 h-3 w-3" />
                  {locale === "en" ? "Featured Events" : "Høydepunkter"}
                </Badge>
                <h2 className="font-bold text-2xl text-foreground sm:text-3xl">
                  {t("highlights.title")}
                </h2>
                <p className="mt-2 max-w-2xl text-muted-foreground">
                  {t("highlights.subtitle")}
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href="/events?campus=all">
                  {t("highlights.ctaAll")}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </motion.div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {highlightEvents.map((event, index) => {
              const Icon = event.icon;
              const colors = colorSchemes[event.colorScheme];
              return (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  key={event.key}
                  transition={{ delay: index * 0.1 }}
                  viewport={{ once: true }}
                  whileInView={{ opacity: 1, y: 0 }}
                >
                  <Card
                    className={cn(
                      "group h-full border-0 bg-linear-to-br p-6 shadow-lg transition-all hover:shadow-xl",
                      colors.gradient,
                      colors.border
                    )}
                  >
                    <div
                      className={cn(
                        "mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br shadow-md",
                        colors.iconGradient
                      )}
                    >
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="mb-2 font-semibold text-foreground text-lg">
                      {event.title}
                    </h3>
                    <p className="mb-4 text-muted-foreground text-sm leading-relaxed">
                      {event.description}
                    </p>
                    <Button
                      className="group-hover:translate-x-1 transition-transform"
                      size="sm"
                      variant="ghost"
                    >
                      {event.cta}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* FAQ and CTA Section */}
        <section className="grid gap-8 lg:grid-cols-5">
          {/* FAQ */}
          <motion.div
            className="lg:col-span-3"
            initial={{ opacity: 0, x: -20 }}
            viewport={{ once: true }}
            whileInView={{ opacity: 1, x: 0 }}
          >
            <Card className="h-full p-6 sm:p-8">
              <h2 className="mb-2 font-bold text-xl text-foreground sm:text-2xl">
                {t("faq.title")}
              </h2>
              <p className="mb-6 text-muted-foreground text-sm">
                {t("faq.subtitle")}
              </p>
              <Accordion className="space-y-2" collapsible type="single">
                {faqs.map((faq) => (
                  <AccordionItem
                    className="rounded-lg border bg-muted/30 px-4"
                    key={faq.key}
                    value={faq.key}
                  >
                    <AccordionTrigger className="py-4 font-medium text-foreground hover:no-underline">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="pb-4 text-muted-foreground">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </Card>
          </motion.div>

          {/* CTA Card */}
          <motion.div
            className="lg:col-span-2"
            initial={{ opacity: 0, x: 20 }}
            viewport={{ once: true }}
            whileInView={{ opacity: 1, x: 0 }}
          >
            <Card className="relative h-full overflow-hidden bg-linear-to-br from-brand-overlay-from via-brand-overlay-via to-brand-overlay-to p-6 text-white sm:p-8">
              <div className="absolute inset-0 bg-linear-to-t from-brand-overlay-from/50 via-transparent to-transparent" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_50%)]" />
              <div className="relative">
                <h2 className="mb-2 font-bold text-xl text-white sm:text-2xl">
                  {t("ctaCard.title")}
                </h2>
                <p className="mb-6 text-sm text-white/80">
                  {t("ctaCard.subtitle")}
                </p>

                <div className="mb-6 flex flex-wrap gap-2">
                  <Badge className="border-white/30 bg-white/10 text-white">
                    {t("ctaCard.badges.annual")}
                  </Badge>
                  <Badge className="border-white/30 bg-white/10 text-white">
                    {t("ctaCard.badges.semester")}
                  </Badge>
                  <Badge className="border-white/30 bg-white/10 text-white">
                    {t("ctaCard.badges.digitalCard")}
                  </Badge>
                </div>

                <div className="space-y-3">
                  <Button
                    asChild
                    className="w-full bg-white text-primary shadow-lg hover:bg-white/90"
                    size="lg"
                  >
                    <Link href="/shop/membership/">
                      {t("ctaCard.primary")}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    className="w-full border-white/30 text-white hover:bg-white/10"
                    size="lg"
                    variant="ghost"
                  >
                    <Link href="/contact">{t("ctaCard.secondary")}</Link>
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        </section>
      </div>
    </div>
  );
}
