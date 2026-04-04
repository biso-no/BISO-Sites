import { getTranslations } from "next-intl/server";
import Link from "next/link";
import {
  Briefcase,
  Calendar,
  Newspaper,
  FileStack,
  ArrowRight,
  TrendingUp,
  Activity,
} from "lucide-react";
import { getDashboardStats } from "./_actions/pages";
import { listActivityLog } from "./_actions/activity";
import { getUserAuthContext } from "@/lib/authorization";

export default async function AdminPortalDashboard() {
  const t = await getTranslations("adminPortal.dashboard");

  const [ctx, stats, recentActivity] = await Promise.allSettled([
    getUserAuthContext(),
    getDashboardStats(),
    listActivityLog({ limit: 5 }),
  ]);

  const statsData =
    stats.status === "fulfilled"
      ? stats.value
      : { jobs: 0, events: 0, news: 0, drafts: 0 };
  const activity =
    recentActivity.status === "fulfilled" ? recentActivity.value : [];

  const statCards = [
    { label: t("stats.jobs"), value: statsData.jobs, icon: Briefcase, href: "/admin/jobs", color: "#3DA9E0" },
    { label: t("stats.events"), value: statsData.events, icon: Calendar, href: "/admin/events", color: "#a78bfa" },
    { label: t("stats.news"), value: statsData.news, icon: Newspaper, href: "/admin/news", color: "#4ade80" },
    { label: t("stats.drafts"), value: statsData.drafts, icon: FileStack, href: "/admin/drafts", color: "#fbbf24" },
  ];

  return (
    <div className="pb-12">
      {/* Hero greeting */}
      <div className="mb-10">
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4 text-xs font-mono"
          style={{ background: "rgba(61,169,224,0.10)", border: "1px solid rgba(61,169,224,0.25)", color: "#3DA9E0" }}
        >
          <Activity size={11} />
          BISO OS
        </div>
        <h1 className="text-4xl md:text-5xl font-light tracking-tight mb-2" style={{ color: "#fff" }}>
          {t("greeting")},{" "}
          <span style={{ color: "#3DA9E0" }}>Admin</span>
        </h1>
        <p className="text-base" style={{ color: "rgba(255,255,255,0.40)" }}>
          {t("subtitle")}
        </p>
      </div>

      {/* Quick actions */}
      <div className="flex items-center gap-3 mb-10">
        <Link href="/admin/drafts" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium" style={{ background: "#3DA9E0", color: "#001731", boxShadow: "0 0 20px rgba(61,169,224,0.25)" }}>
          <FileStack size={15} />
          {t("reviewDrafts")}
        </Link>
        <Link href="/admin/pages" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.80)" }}>
          {t("createPage")}
          <ArrowRight size={14} />
        </Link>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {statCards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group flex flex-col gap-4 p-6 rounded-3xl transition-all"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: `${card.color}18`, border: `1px solid ${card.color}30` }}>
                <card.icon size={18} style={{ color: card.color }} />
              </div>
              <TrendingUp size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: card.color }} />
            </div>
            <div>
              <p className="text-3xl font-light tabular-nums" style={{ color: "#fff" }}>{card.value}</p>
              <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.40)" }}>{card.label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent activity */}
      <div className="rounded-3xl p-6 md:p-8" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-medium" style={{ color: "#fff" }}>{t("recentActivity")}</h2>
          <Link href="/admin/activity" className="flex items-center gap-1.5 text-xs" style={{ color: "#3DA9E0" }}>
            {t("viewAllActivity")}
            <ArrowRight size={13} />
          </Link>
        </div>

        {activity.length === 0 ? (
          <p className="text-sm py-8 text-center" style={{ color: "rgba(255,255,255,0.30)" }}>{t("noActivity")}</p>
        ) : (
          <div className="space-y-3">
            {activity.map((log) => (
              <div key={log.$id} className="flex items-start gap-3 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "rgba(61,169,224,0.10)", border: "1px solid rgba(61,169,224,0.20)" }}>
                  <Activity size={12} style={{ color: "#3DA9E0" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>
                    <span className="font-medium" style={{ color: "#fff" }}>{log.actor_email ?? "System"}</span>{" "}
                    {log.action}
                    {log.resource_type && <span style={{ color: "rgba(255,255,255,0.40)" }}> · {log.resource_type}</span>}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.30)" }}>
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
