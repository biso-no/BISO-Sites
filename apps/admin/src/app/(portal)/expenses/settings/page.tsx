import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
import { ROLES } from "@/lib/roles";
import { PageHeader } from "../../_components/page-header";
import { ExpenseTypesClient } from "./_components/expense-types-client";
import { ExpensesSettingsTabs } from "./_components/expenses-settings-tabs";
import { getExpenseTypesView } from "./actions";
import { newTypePrefill } from "./types-model";

export default async function ExpenseSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ newType?: string | string[] }>;
}) {
  const ctx = await requireNavAccess("portal.expensesSettings");
  // Types is global-admin only; campus admins manage approvers.
  if (!ctx.roles.includes(ROLES.GLOBAL_ADMIN)) {
    redirect("/expenses/settings/approvers");
  }
  const t = await getTranslations("adminPortal.expensesSettings");
  const view = await getExpenseTypesView();
  const newTypeLabel = newTypePrefill((await searchParams).newType);

  return (
    <div className="pb-12">
      <PageHeader description={t("description")} title={t("title")} />
      <ExpensesSettingsTabs
        labels={{
          ai: t("tabAi"),
          approvers: t("tabApprovers"),
          types: t("tabTypes"),
        }}
        showGlobalTabs
      />
      <ExpenseTypesClient
        initialView={view}
        labels={{
          account: t("account"),
          active: t("active"),
          addType: t("addType"),
          aiNote: t("aiNote"),
          askOccasion: t("askOccasion"),
          chooseAccount: t("chooseAccount"),
          // Strings with {placeholders} are filled in by the client.
          loadMissing: t.raw("loadMissing") as string,
          name: t("name"),
          nameNo: t("nameNo"),
          noAccountFound: t("noAccountFound"),
          noTypes: t("noTypes"),
          save: t("save"),
          saveError: t("saveError"),
          saved: t("saved"),
          searchAccount: t("searchAccount"),
          seeded: t.raw("seeded") as string,
          sortOrder: t("sortOrder"),
          syncAccounts: t("syncAccounts"),
          syncDone: t.raw("syncDone") as string,
          syncError: t("syncError"),
          syncPartial: t.raw("syncPartial") as string,
          taxCode: t("taxCode"),
          typesHint: t("typesHint"),
        }}
        newTypeLabel={newTypeLabel}
      />
    </div>
  );
}
