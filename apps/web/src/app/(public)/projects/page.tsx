import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { listLargeEvents } from "@/app/actions/large-events";
import { getLocale } from "@/app/actions/locale";
import type { Locale } from "@/i18n/config";
import type { ParsedLargeEvent } from "@/lib/types/large-event";

const pickEventBySlug = (events: ParsedLargeEvent[], slug: string) =>
  events.find((event) => event.slug === slug);

const deriveAccent = (event?: ParsedLargeEvent, fallback?: string[]) => {
  if (event?.gradient && event.gradient.length >= 2) return event.gradient;
  if (event?.primaryColorHex && event?.secondaryColorHex) {
    return [event.primaryColorHex, event.secondaryColorHex];
  }
  return fallback ?? ["#14355B", "#1E3A8A"];
};

export default async function ProjectsPage() {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("projects");

  const events = await listLargeEvents({ activeOnly: false, limit: 100 });

  const featuredConfig = (t.raw("featured") ?? {}) as Record<
    string,
    { slug: string; title: string; description: string; cta: string; highlight?: string }
  >;

  const featuredProjects = Object.entries(featuredConfig).map(([key, config]) => {
    const event = pickEventBySlug(events, config.slug);
    return {
      key,
      slug: config.slug,
      title: event?.name ?? config.title,
      description: event?.description ?? config.description,
      highlight: config.highlight,
      gradient: deriveAccent(event, key === "winterGames" ? ["#0F172A", "#1E3A8A"] : undefined),
      href: `/projects/${config.slug}`,
      cta: config.cta,
    };
  });

  const otherEvents = events.filter(
    (event) => !featuredProjects.some((item) => item.slug === event.slug),
  );

  return (
    <div className="space-y-16">
      <section className="relative overflow-hidden rounded-3xl border border-primary/10 bg-linear-to-br from-primary-100 via-blue-strong to-blue-accent p-10 text-white shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.25),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(61,169,224,0.35),transparent_55%)]" />
        <div className="relative grid gap-8 lg:grid-cols-[3fr_2fr]">
          <div className="space-y-6">
            <Badge className="bg-white/10 text-xs uppercase tracking-wide text-white">
              {t("hero.badge")}
            </Badge>
            <h1 className="text-4xl font-semibold leading-tight text-white md:text-5xl">
              {t("hero.title")}
            </h1>
            <p className="text-lg text-white/80">{t("hero.subtitle")}</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-white text-primary-100 hover:bg-white/90">
                <Link href="#featured">{t("hero.ctaPrimary")}</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="secondary"
                className="border-white/60 bg-transparent text-white hover:bg-white/10"
              >
                <Link href="#calendar">{t("hero.ctaSecondary")}</Link>
              </Button>
            </div>
          </div>
          <Card className="border-white/20 bg-white/10 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-white">{t("insight.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-white/80">
              <p>{t("insight.item1")}</p>
              <p>{t("insight.item2")}</p>
              <p>{t("insight.item3")}</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="featured" className="space-y-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-3xl font-semibold text-primary-100">{t("featuredTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t("featuredSubtitle")}</p>
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {featuredProjects.map((project) => (
            <Card
              key={project.slug}
              className="overflow-hidden border-primary/10 bg-white shadow-lg transition hover:-translate-y-1 hover:shadow-xl"
            >
              <div
                className="h-2 w-full"
                style={{
                  background: `linear-gradient(90deg, ${project.gradient.join(", ")})`,
                }}
              />
              <CardHeader className="space-y-3">
                <Badge variant="secondary" className="w-fit uppercase">
                  {project.highlight ??
                    t(`featuredLabels.${project.key}`, { default: project.key })}
                </Badge>
                <CardTitle className="text-2xl text-primary-100">{project.title}</CardTitle>
                <p className="text-sm text-muted-foreground">{project.description}</p>
              </CardHeader>
              <CardContent className="flex justify-between">
                <Button asChild variant="ghost" className="px-0 text-primary-40">
                  <Link href={project.href}>{project.cta}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="calendar" className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-primary-100">{t("schedule.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("schedule.subtitle")}</p>
        </div>

        {otherEvents.length === 0 ? (
          <Card className="border-primary/10 bg-white">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              {t("schedule.empty")}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {otherEvents.map((event) => (
              <Card key={event.$id} className="border-primary/10 bg-white">
                <CardHeader className="space-y-2">
                  <Badge variant="outline" className="w-fit text-xs uppercase text-primary-70">
                    {event.showcaseType || t("schedule.defaultTag")}
                  </Badge>
                  <CardTitle className="text-lg text-primary-100">{event.name}</CardTitle>
                  <p className="text-sm text-muted-foreground line-clamp-3">{event.description}</p>
                </CardHeader>
                <CardContent className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {event.startDate
                      ? new Date(event.startDate).toLocaleDateString(
                          locale === "en" ? "en-GB" : "nb-NO",
                        )
                      : "—"}
                  </span>
                  <Link
                    href={`/projects/${event.slug}`}
                    className="underline-offset-2 hover:underline"
                  >
                    {t("schedule.more")}
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
