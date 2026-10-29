import { getTranslations } from "next-intl/server";
import { scopeItLookupOptions } from "@/lib/it/tenant-guard";
import {
  getItCampusScope,
  requireItPagePermission,
} from "@/lib/it-permissions";
import { listItLookupOptions } from "../../../_actions/it-users";
import { PageHeader } from "../../../_components/page-header";
import { CreateUserClient } from "../_components/create-user-client";

export default async function NewM365UserPage() {
  const ctx = await requireItPagePermission("it.users.create");
  const campusScope = getItCampusScope(ctx);

  const t = await getTranslations("adminPortal.it.users");
  const lookups = await listItLookupOptions();

  return (
    <div className="pb-12">
      <PageHeader description={t("description")} title={t("create")} />

      {lookups.error ? (
        <div
          className="rounded-2xl p-5 text-sm"
          style={{
            background: "rgba(248,113,113,0.08)",
            border: "1px solid rgba(248,113,113,0.20)",
            color: "#fca5a5",
          }}
        >
          {lookups.error}
        </div>
      ) : (
        <CreateUserClient
          labels={{
            accountEnabled: t("fields.accountEnabled"),
            campus: t("fields.campus"),
            create: t("create"),
            department: t("fields.department"),
            givenName: t("fields.givenName"),
            jobTitle: t("fields.jobTitle"),
            mailNickname: t("fields.mailNickname"),
            surname: t("fields.surname"),
            temporaryPassword: t("temporaryPassword"),
            userPrincipalName: t("fields.userPrincipalName"),
          }}
          options={scopeItLookupOptions(
            lookups.data ?? { campuses: [], departments: [] },
            campusScope
          )}
        />
      )}
    </div>
  );
}
