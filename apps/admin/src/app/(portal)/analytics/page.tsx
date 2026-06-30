import {
  BarChart3,
  Clock,
  Eye,
  LineChart,
  MousePointerClick,
  TrendingDown,
  Users,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
import {
  avgVisitSeconds,
  bounceRatePct,
  EMPTY_STATS,
  fetchEventsTotal,
  fetchPageviewsSeries,
  fetchStats,
  fetchTopMetrics,
  formatDelta,
  formatDuration,
  type UmamiMetricItem,
  type UmamiPageviewsSeries,
  type UmamiRange,
  type UmamiStats,
} from "@/lib/umami/client";
import { fetchMembersPanel, type MemberPanelRow } from "@/lib/umami/members";
import {
  STUDIO,
  StudioKpi,
  StudioKpiStrip,
  StudioPageHeader,
} from "../_components/studio";
import {
  MembersList,
  MetricList,
  SectionCard,
} from "./_components/analytics-sections";
import {
  type AnalyticsRange,
  RangeSelector,
} from "./_components/range-selector";
import type { TrafficPoint } from "./_components/traffic-chart";
import { TrafficChart } from "./_components/traffic-chart-lazy";

const DAY_MS = 24 * 60 * 60 * 1000;
// Quantize the range end so request URLs stay stable between loads and the
// cached Umami reads (revalidate) actually hit instead of refetching each time.
const RANGE_BUCKET_MS = 5 * 60 * 1000;
const RANGE_DAYS: Record<AnalyticsRange, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

function parseRange(raw: string | string[] | undefined): AnalyticsRange {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === "7d" || value === "90d") {
    return value;
  }
  return "30d";
}

function formatDay(x: string): string {
  const date = new Date(x);
  if (Number.isNaN(date.getTime())) {
    return x;
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function buildTrafficData(series: UmamiPageviewsSeries): TrafficPoint[] {
  const map = new Map<string, { pageviews: number; sessions: number }>();
  for (const point of series.pageviews) {
    map.set(point.x, { pageviews: point.y, sessions: 0 });
  }
  for (const point of series.sessions) {
    const existing = map.get(point.x);
    if (existing) {
      existing.sessions = point.y;
    } else {
      map.set(point.x, { pageviews: 0, sessions: point.y });
    }
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([x, counts]) => ({ date: formatDay(x), ...counts }));
}

function settled<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === "fulfilled" ? result.value : fallback;
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string | string[] }>;
}) {
  // portal.analytics is restricted to globaladmin; the helper redirects/404s
  // for anyone else, so reaching this line means the user IS a global admin.
  await requireNavAccess("portal.analytics");
  const t = await getTranslations("adminPortal.analytics");

  const range = parseRange((await searchParams).range);
  const endAt = Math.floor(Date.now() / RANGE_BUCKET_MS) * RANGE_BUCKET_MS;
  const startAt = endAt - RANGE_DAYS[range] * DAY_MS;
  const umamiRange: UmamiRange = { startAt, endAt };

  const [
    statsResult,
    seriesResult,
    topPagesResult,
    topReferrersResult,
    topEventsResult,
    eventsTotalResult,
    membersResult,
  ] = await Promise.allSettled([
    fetchStats(umamiRange),
    fetchPageviewsSeries(umamiRange),
    fetchTopMetrics(umamiRange, "path"),
    fetchTopMetrics(umamiRange, "referrer"),
    fetchTopMetrics(umamiRange, "event"),
    fetchEventsTotal(umamiRange),
    fetchMembersPanel(umamiRange),
  ]);

  const stats: UmamiStats =
    settled<UmamiStats | null>(statsResult, null) ?? EMPTY_STATS;
  const traffic = buildTrafficData(
    settled<UmamiPageviewsSeries>(seriesResult, { pageviews: [], sessions: [] })
  );
  const topPages = settled<UmamiMetricItem[]>(topPagesResult, []);
  const topReferrers = settled<UmamiMetricItem[]>(topReferrersResult, []);
  const topEvents = settled<UmamiMetricItem[]>(topEventsResult, []);
  const eventsTotal = settled<number>(eventsTotalResult, 0);
  const members = settled<MemberPanelRow[]>(membersResult, []);

  const pageviewsDelta = formatDelta(
    stats.pageviews.value,
    stats.pageviews.prev
  );
  const visitorsDelta = formatDelta(stats.visitors.value, stats.visitors.prev);
  const visitsDelta = formatDelta(stats.visits.value, stats.visits.prev);
  const bounce = bounceRatePct(stats);

  return (
    <div className="pb-12">
      <StudioPageHeader
        description={t("subtitle")}
        eyebrow={
          <>
            <BarChart3 size={12} />
            {t("eyebrow")}
          </>
        }
        title={t("title")}
      >
        <RangeSelector
          current={range}
          labels={{
            "7d": t("range.7d"),
            "30d": t("range.30d"),
            "90d": t("range.90d"),
          }}
        />
      </StudioPageHeader>

      <div className="mb-7">
        <StudioKpiStrip>
          <StudioKpi
            helper={pageviewsDelta ?? undefined}
            icon={<Eye size={13} />}
            label={t("kpis.pageviews")}
            value={stats.pageviews.value.toLocaleString()}
          />
          <StudioKpi
            helper={visitorsDelta ?? undefined}
            icon={<Users size={13} />}
            label={t("kpis.visitors")}
            value={stats.visitors.value.toLocaleString()}
          />
          <StudioKpi
            helper={visitsDelta ?? undefined}
            icon={<MousePointerClick size={13} />}
            label={t("kpis.visits")}
            value={stats.visits.value.toLocaleString()}
          />
          <StudioKpi
            alert={bounce >= 70}
            icon={<TrendingDown size={13} />}
            label={t("kpis.bounceRate")}
            value={`${bounce}%`}
          />
          <StudioKpi
            icon={<Clock size={13} />}
            label={t("kpis.avgVisitTime")}
            value={formatDuration(avgVisitSeconds(stats))}
          />
        </StudioKpiStrip>
      </div>

      <div className="mb-7">
        <TrafficChart
          data={traffic}
          emptyLabel={t("empty.chart")}
          legend={{
            pageviews: t("legend.pageviews"),
            sessions: t("legend.sessions"),
          }}
          subtitle={t("sections.trafficSubtitle")}
          title={t("sections.traffic")}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard title={t("sections.topPages")}>
          <MetricList emptyLabel={t("empty.pages")} items={topPages} />
        </SectionCard>
        <SectionCard title={t("sections.topReferrers")}>
          <MetricList emptyLabel={t("empty.referrers")} items={topReferrers} />
        </SectionCard>
        <SectionCard
          subtitle={t("eventsTracked", { count: eventsTotal })}
          title={t("sections.topEvents")}
        >
          <MetricList emptyLabel={t("empty.events")} items={topEvents} />
        </SectionCard>
        <SectionCard
          subtitle={t("members.subtitle")}
          title={
            <span className="flex items-center gap-2">
              <LineChart size={14} style={{ color: STUDIO.claret }} />
              {t("sections.members")}
            </span>
          }
        >
          <MembersList
            emptyLabel={t("empty.members")}
            members={members}
            viewsLabel={t("members.viewsLabel")}
            visitsLabel={t("members.visitsLabel")}
          />
        </SectionCard>
      </div>
    </div>
  );
}
