import { getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
import { PageHeader } from "../../_components/page-header";
import { FeatureFlagsClient } from "./_components/feature-flags-client";
import { getCatalogFlagStates } from "./actions";

export default async function FeatureFlagsPage() {
  // portal.settings is restricted to globaladmin; the helper redirects/404s
  // for anyone else, so reaching this line means the user IS a global admin.
  await requireNavAccess("portal.settings");
  const t = await getTranslations("adminPortal.featureFlags");
  const groups = await getCatalogFlagStates();

  return (
    <div className="pb-12">
      <PageHeader description={t("description")} title={t("title")} />

      <FeatureFlagsClient
        initialGroups={groups}
        labels={{
          disabled: t("disabled"),
          enabled: t("enabled"),
          groups: {
            ai: t("groups.ai"),
            expenses: t("groups.expenses"),
            payments: t("groups.payments"),
          },
          toggleError: t("toggleError"),
          toggleSuccess: t("toggleSuccess"),
        }}
      />
    </div>
  );
}
