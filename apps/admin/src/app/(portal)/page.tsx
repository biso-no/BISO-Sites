import {
  Activity,
  ArrowRight,
  Briefcase,
  Calendar,
  FileStack,
  Newspaper,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { forbidden, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireAdminAccess } from "@/lib/authorization";
import { getDefaultNavPath } from "@/lib/nav-tree";
import { hasNavAccess } from "@/lib/roles";
import { listRecentActivity } from "./_actions/activity";
import { getDashboardStats } from "./_actions/pages";
import { ContentActivityChart } from "./_components/content-chart-lazy";
import {
  SERIF_STACK,
  STUDIO,
  StudioIconBox,
  StudioKpi,
  StudioKpiStrip,
  StudioLinkButton,
  StudioPageHeader,
  StudioPanel,
} from "./_components/studio";

export default async function AdminPortalDashboard() {
  const ctx = await requireAdminAccess();
  const hasDepartmentMembership = ctx.departmentTeamIds.length > 0;
  if (!hasNavAccess("portal.dashboard", ctx.roles, hasDepartmentMembership)) {
    const defaultPath = getDefaultNavPath({
      hasDepartmentMembership,
      roles: ctx.roles,
    });
    if (defaultPath && defaultPath !== "/") {
      redirect(defaultPath);
    }
    forbidden();
  }
  const t = await getTranslations("adminPortal.dashboard");

  const [stats, recentActivity, chartActivity] = await Promise.allSettled([
    getDashboardStats(),
    listRecentActivity(5),
    listRecentActivity(200),
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
      color: STUDIO.sky,
      href: "/jobs",
      icon: Briefcase,
      label: t("stats.jobs"),
      value: statsData.jobs,
    },
    {
      color: STUDIO.claret,
      href: "/events",
      icon: Calendar,
      label: t("stats.events"),
      value: statsData.events,
    },
    {
      color: STUDIO.leaf,
      href: "/news",
      icon: Newspaper,
      label: t("stats.news"),
      value: statsData.news,
    },
    {
      color: STUDIO.gold,
      href: "/drafts",
      icon: FileStack,
      label: t("stats.drafts"),
      value: statsData.drafts,
    },
  ];

  return (
    <div className="pb-12">
      <StudioPageHeader
        description={t("subtitle")}
        eyebrow={
          <>
            <Activity size={12} />
            BISO
          </>
        }
        title={
          <>
            {t("greeting")}, <em style={{ color: STUDIO.claret }}>Admin</em>
          </>
        }
      >
        <StudioLinkButton href="/drafts" variant="primary">
          <FileStack size={15} />
          {t("reviewDrafts")}
        </StudioLinkButton>
        <StudioLinkButton href="/pages">
          {t("createPage")}
          <ArrowRight size={14} />
        </StudioLinkButton>
      </StudioPageHeader>

      <div className="mb-7">
        <StudioKpiStrip>
          {statCards.map((card) => (
            <StudioKpi
              helper={t("openWorkspace")}
              icon={<card.icon size={13} />}
              key={card.href}
              label={card.label}
              value={
                <Link
                  className="group inline-flex items-end gap-2"
                  href={card.href}
                >
                  {card.value}
                  <TrendingUp
                    className="mb-1 opacity-0 transition group-hover:opacity-100"
                    size={14}
                    style={{ color: card.color }}
                  />
                </Link>
              }
            />
          ))}
        </StudioKpiStrip>
      </div>

      <div className="mb-7">
        <ContentActivityChart activity={allActivity} days={14} />
      </div>

      <StudioPanel className="p-6 md:p-7">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p
              className="flex items-center gap-2 font-medium text-[11px] uppercase tracking-[0.08em]"
              style={{ color: STUDIO.claret }}
            >
              <Sparkles size={12} />
              {t("studioLog")}
            </p>
            <h2
              className="mt-1 text-3xl"
              style={{ color: STUDIO.ink, fontFamily: SERIF_STACK }}
            >
              {t("recentActivity")}
            </h2>
          </div>
          <Link
            className="flex items-center gap-1.5 text-sm"
            href="/activity"
            style={{ color: STUDIO.claret }}
          >
            {t("viewAllActivity")}
            <ArrowRight size={13} />
          </Link>
        </div>

        {activity.length === 0 ? (
          <p
            className="py-8 text-center text-sm"
            style={{ color: STUDIO.ink4 }}
          >
            {t("noActivity")}
          </p>
        ) : (
          <div className="divide-y" style={{ borderColor: STUDIO.rule }}>
            {activity.map((log) => (
              <div className="flex items-start gap-3 py-4" key={log.$id}>
                <StudioIconBox color={STUDIO.claret}>
                  <Activity size={14} />
                </StudioIconBox>
                <div className="min-w-0 flex-1">
                  <p className="text-sm" style={{ color: STUDIO.ink2 }}>
                    <span className="font-medium" style={{ color: STUDIO.ink }}>
                      {log.actor_email ?? "System"}
                    </span>{" "}
                    {log.action}
                    {log.resource_type && (
                      <span style={{ color: STUDIO.ink4 }}>
                        {" "}
                        · {log.resource_type}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs" style={{ color: STUDIO.ink4 }}>
                    {new Date(log.$createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </StudioPanel>
    </div>
  );
}
