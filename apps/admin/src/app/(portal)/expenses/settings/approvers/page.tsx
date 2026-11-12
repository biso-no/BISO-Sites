import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type { Departments } from "@repo/api/types/appwrite";
import { getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
import { CAMPUS_ID_TO_NAME } from "@/lib/campus-constants";
import { ROLES } from "@/lib/roles";
import { PageHeader } from "../../../_components/page-header";
import { ExpensesSettingsTabs } from "../_components/expenses-settings-tabs";
import { ApproversClient } from "./_components/approvers-client";
import { listApprovers } from "./approvers-actions";
import { APPROVER_ROLES, DEPARTMENT_ROLES } from "./approvers-model";

const DEPARTMENT_LIMIT = 500;

export default async function ExpenseApproversPage() {
  const ctx = await requireNavAccess("portal.expensesSettings");
  const isGlobalAdmin = ctx.roles.includes(ROLES.GLOBAL_ADMIN);
  const t = await getTranslations("adminPortal.expensesSettings");
  const ta = await getTranslations("adminPortal.expensesSettings.approvers");

  const { db } = await createAdminClient();
  const [initial, departments] = await Promise.all([
    listApprovers({ campusId: null, q: "", role: null }),
    db.listRows<Departments>("app", "departments", [
      Query.select(["$id", "Name", "campus_id"]),
      Query.orderAsc("Name"),
      Query.limit(DEPARTMENT_LIMIT),
    ]),
  ]);

  const campusIds = isGlobalAdmin
    ? Object.keys(CAMPUS_ID_TO_NAME)
    : ctx.managedCampusIds;
  const roles = isGlobalAdmin ? APPROVER_ROLES : DEPARTMENT_ROLES;
  const roleLabels = Object.fromEntries(
    APPROVER_ROLES.map((role) => [role, ta(`roles.${role}`)])
  );

  return (
    <div className="pb-12">
      <PageHeader description={ta("description")} title={t("title")} />
      <ExpensesSettingsTabs
        labels={{
          ai: t("tabAi"),
          approvers: t("tabApprovers"),
          types: t("tabTypes"),
        }}
        showGlobalTabs={isGlobalAdmin}
      />
      <ApproversClient
        allowCampusScope={isGlobalAdmin}
        campuses={campusIds.map((id) => ({
          id,
          name: CAMPUS_ID_TO_NAME[id] ?? id,
        }))}
        departments={departments.rows.map((row) => ({
          campusId: row.campus_id,
          id: row.$id,
          name: row.Name,
        }))}
        initialRows={"data" in initial ? initial.data : []}
        labels={{
          actions: ta("actions"),
          active: ta("active"),
          add: ta("add"),
          allCampuses: ta("allCampuses"),
          allRoles: ta("allRoles"),
          campus: ta("campus"),
          campusScope: ta("campusScope"),
          cancel: ta("cancel"),
          confidence: ta("confidence"),
          department: ta("department"),
          departmentScope: ta("departmentScope"),
          dialogAdd: ta("dialogAdd"),
          dialogEdit: ta("dialogEdit"),
          edit: ta("edit"),
          email: ta("email"),
          emailHint: ta("emailHint"),
          empty: ta("empty"),
          lastConfirmed: ta("lastConfirmed"),
          lastUsed: ta("lastUsed"),
          loadError: ta("loadError"),
          name: ta("name"),
          never: ta("never"),
          role: ta("role"),
          roleLabels,
          save: ta("save"),
          saveError: ta("saveError"),
          saved: ta("saved"),
          scope: ta("scope"),
          search: ta("search"),
          source: ta("source"),
          sources: {
            admin: ta("sources.admin"),
            ai: ta("sources.ai"),
            confirmed: ta("sources.confirmed"),
            seed: ta("sources.seed"),
          },
        }}
        roles={[...roles]}
      />
    </div>
  );
}
