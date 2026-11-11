import { getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
import { PageHeader } from "../../_components/page-header";
import { STUDIO } from "../../_components/studio";
import { ExpenseTypesClient } from "./_components/expense-types-client";
import { getExpenseTypesView } from "./actions";

export default async function ExpenseSettingsPage() {
  // Global admins only; the helper 404s for everyone else.
  await requireNavAccess("portal.expensesSettings");
  const t = await getTranslations("adminPortal.expensesSettings");
  const view = await getExpenseTypesView();

  return (
    <div className="pb-12">
      <PageHeader description={t("description")} title={t("title")} />
      <div
        className="mt-6 flex gap-4"
        style={{ borderBottom: `0.5px solid ${STUDIO.rule}` }}
      >
        <span
          aria-current="page"
          className="pb-2 font-medium text-[14px]"
          style={{
            borderBottom: `2px solid ${STUDIO.ink}`,
            color: STUDIO.ink,
          }}
        >
          {t("tabTypes")}
        </span>
      </div>
      <ExpenseTypesClient
        initialView={view}
        labels={{
          account: t("account"),
          active: t("active"),
          addType: t("addType"),
          aiNote: t("aiNote"),
          askOccasion: t("askOccasion"),
          chooseAccount: t("chooseAccount"),
          loadStarting: t("loadStarting"),
          name: t("name"),
          nameNo: t("nameNo"),
          noAccountFound: t("noAccountFound"),
          noTypes: t("noTypes"),
          save: t("save"),
          saveError: t("saveError"),
          saved: t("saved"),
          searchAccount: t("searchAccount"),
          seeded: t("seeded"),
          sortOrder: t("sortOrder"),
          syncAccounts: t("syncAccounts"),
          syncDone: t("syncDone"),
          syncError: t("syncError"),
          syncPartial: t("syncPartial"),
          typesHint: t("typesHint"),
        }}
      />
    </div>
  );
}
