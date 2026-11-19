import { redirect, unstable_rethrow } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
import { ROLES } from "@/lib/roles";
import { PageHeader } from "../../../_components/page-header";
import { ExpensesSettingsTabs } from "../_components/expenses-settings-tabs";
import { ProjectsClient } from "./_components/projects-client";
import { getProjectsView } from "./actions";

export default async function ExpenseProjectsSettingsPage() {
  const ctx = await requireNavAccess("portal.expensesSettings");
  // Global admins only, like the Types tab.
  if (!ctx.roles.includes(ROLES.GLOBAL_ADMIN)) {
    redirect("/expenses/settings/approvers");
  }
  const [t, tp, te, locale] = await Promise.all([
    getTranslations("adminPortal.expensesSettings"),
    getTranslations("adminPortal.expensesSettings.projects"),
    getTranslations("adminPortal.expenses.errors"),
    getLocale(),
  ]);

  let view: Awaited<ReturnType<typeof getProjectsView>> | null = null;
  try {
    view = await getProjectsView();
  } catch (error) {
    unstable_rethrow(error);
    console.error("[finago-projects] Projects tab load failed:", error);
  }

  return (
    <div className="pb-12">
      <PageHeader description={tp("description")} title={t("title")} />
      <ExpensesSettingsTabs
        labels={{
          ai: t("tabAi"),
          approvers: t("tabApprovers"),
          projects: t("tabProjects"),
          types: t("tabTypes"),
        }}
        showGlobalTabs
      />
      {view ? (
        <ProjectsClient
          initialView={view}
          labels={{
            allDepartments: tp("allDepartments"),
            clear: tp("clear"),
            cleared: tp("cleared"),
            department: tp("department"),
            errors: {
              failed: te("failed"),
              forbidden: te("forbidden"),
              invalid_date: tp("invalidDate"),
            },
            eventDate: tp("eventDate"),
            firstBooking: tp("firstBooking"),
            lastBooking: tp("lastBooking"),
            lastSynced: tp.raw("lastSynced") as string,
            neverSynced: tp("neverSynced"),
            noMatch: tp("noMatch"),
            none: tp("none"),
            noUsers: tp("noUsers"),
            notSet: tp("notSet"),
            peak: tp("peak"),
            save: tp("save"),
            saved: tp("saved"),
            saveError: tp("saveError"),
            sync: tp("sync"),
            syncDone: tp.raw("syncDone") as string,
            syncError: tp("syncError"),
            syncing: tp("syncing"),
            syncPartial: tp.raw("syncPartial") as string,
            usedBy: tp("usedBy"),
            year: tp("year"),
          }}
          locale={locale}
        />
      ) : (
        <p className="text-sm">{tp("loadError")}</p>
      )}
    </div>
  );
}
