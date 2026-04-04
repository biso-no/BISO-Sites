import {
  Activity,
  ArrowRight,
  Briefcase,
  Calendar,
  FileStack,
  Newspaper,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getUserAuthContext } from "@/lib/authorization";
import { listActivityLog } from "./_actions/activity";
import { getDashboardStats } from "./_actions/pages";
import { ContentActivityChart } from "./_components/content-chart";

export default async function AdminPortalDashboard() {
  const t = await getTranslations("adminPortal.dashboard");

  const [ctx, stats, recentActivity, chartActivity] = await Promise.allSettled([
    getUserAuthContext(),
    getDashboardStats(),
    listActivityLog({ limit: 5 }),
    listActivityLog({ limit: 200 }),
  ]);

  const statsData =
    stats.status === "fulfilled"
      ? stats.value
      : { jobs: 0, events: 0, news: 0, drafts: 0 };
  const activity =
    recentActivity.status === "fulfilled" ? recentActivity.value : [];
  const allActivity =
    chartActivity.status === "fulfilled" ? chartActivity.value : [];

  const statCards = [
    {
      label: t("stats.jobs"),
      value: statsData.jobs,
      icon: Briefcase,
      href: "/admin/jobs",
      color: "#3DA9E0",
    },
    {
      label: t("stats.events"),
      value: statsData.events,
      icon: Calendar,
      href: "/admin/events",
      color: "#a78bfa",
    },
    {
      label: t("stats.news"),
      value: statsData.news,
      icon: Newspaper,
      href: "/admin/news",
      color: "#4ade80",
    },
    {
      label: t("stats.drafts"),
      value: statsData.drafts,
      icon: FileStack,
      href: "/admin/drafts",
      color: "#fbbf24",
    },
  ];

  return (
    <div className="pb-12">
      {/* Hero greeting */}
      <div className="mb-10">
        <div
          className="mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-mono text-xs"
          style={{
            background: "rgba(61,169,224,0.10)",
            border: "1px solid rgba(61,169,224,0.25)",
            color: "#3DA9E0",
          }}
        >
          <Activity size={11} />
          BISO
        </div>
        <h1
          className="mb-2 font-light text-4xl tracking-tight md:text-5xl"
          style={{ color: "#fff" }}
        >
          {t("greeting")}, <span style={{ color: "#3DA9E0" }}>Admin</span>
        </h1>
        <p className="text-base" style={{ color: "rgba(255,255,255,0.40)" }}>
          {t("subtitle")}
        </p>
      </div>

      {/* Quick actions */}
      <div className="mb-10 flex items-center gap-3">
        <Link
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-medium text-sm"
          href="/admin/drafts"
          style={{
            background: "#3DA9E0",
            color: "#001731",
            boxShadow: "0 0 20px rgba(61,169,224,0.25)",
          }}
        >
          <FileStack size={15} />
          {t("reviewDrafts")}
        </Link>
        <Link
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-medium text-sm"
          href="/admin/pages"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.10)",
            color: "rgba(255,255,255,0.80)",
          }}
        >
          {t("createPage")}
          <ArrowRight size={14} />
        </Link>
      </div>

      {/* Stats grid */}
      <div className="mb-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((card) => (
          <Link
            className="group flex flex-col gap-4 rounded-3xl p-6 transition-all"
            href={card.href}
            key={card.href}
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <div className="flex items-center justify-between">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-2xl"
                style={{
                  background: `${card.color}18`,
                  border: `1px solid ${card.color}30`,
                }}
              >
                <card.icon size={18} style={{ color: card.color }} />
              </div>
              <TrendingUp
                className="opacity-0 transition-opacity group-hover:opacity-100"
                size={14}
                style={{ color: card.color }}
              />
            </div>
            <div>
              <p
                className="font-light text-3xl tabular-nums"
                style={{ color: "#fff" }}
              >
                {card.value}
              </p>
              <p
                className="mt-1 text-xs"
                style={{ color: "rgba(255,255,255,0.40)" }}
              >
                {card.label}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* Activity chart */}
      <div className="mb-10">
        <ContentActivityChart activity={allActivity} days={14} />
      </div>

      {/* Recent activity */}
      <div
        className="rounded-3xl p-6 md:p-8"
        style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-medium text-base" style={{ color: "#fff" }}>
            {t("recentActivity")}
          </h2>
          <Link
            className="flex items-center gap-1.5 text-xs"
            href="/admin/activity"
            style={{ color: "#3DA9E0" }}
          >
            {t("viewAllActivity")}
            <ArrowRight size={13} />
          </Link>
        </div>

        {activity.length === 0 ? (
          <p
            className="py-8 text-center text-sm"
            style={{ color: "rgba(255,255,255,0.30)" }}
          >
            {t("noActivity")}
          </p>
        ) : (
          <div className="space-y-3">
            {activity.map((log) => (
              <div
                className="flex items-start gap-3 py-3"
                key={log.$id}
                style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
              >
                <div
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: "rgba(61,169,224,0.10)",
                    border: "1px solid rgba(61,169,224,0.20)",
                  }}
                >
                  <Activity size={12} style={{ color: "#3DA9E0" }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="text-sm"
                    style={{ color: "rgba(255,255,255,0.75)" }}
                  >
                    <span className="font-medium" style={{ color: "#fff" }}>
                      {log.actor_email ?? "System"}
                    </span>{" "}
                    {log.action}
                    {log.resource_type && (
                      <span style={{ color: "rgba(255,255,255,0.40)" }}>
                        {" "}
                        · {log.resource_type}
                      </span>
                    )}
                  </p>
                  <p
                    className="mt-0.5 text-xs"
                    style={{ color: "rgba(255,255,255,0.30)" }}
                  >
                    {new Date(log.$createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
