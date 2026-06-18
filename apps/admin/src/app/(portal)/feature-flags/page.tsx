import { getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
import { PageHeader } from "../_components/page-header";
import { FeatureFlagsClient } from "./_components/feature-flags-client";
import { listFeatureFlags } from "./actions";

export default async function FeatureFlagsPage() {
  // portal.settings is restricted to globaladmin; the helper redirects/404s
  // for anyone else, so reaching this line means the user IS a global admin.
  await requireNavAccess("portal.settings");
  const t = await getTranslations("adminPortal.featureFlags");
  const flags = await listFeatureFlags();

  return (
    <div className="pb-12">
      <PageHeader description={t("description")} title={t("title")} />

      <FeatureFlagsClient
        initialFlags={flags}
        labels={{
          columnFlag: t("columnFlag"),
          columnState: t("columnState"),
          create: {
            creating: t("create.creating"),
            descriptionLabel: t("create.descriptionLabel"),
            key: t("create.key"),
            keyHint: t("create.keyHint"),
            name: t("create.name"),
            submit: t("create.submit"),
            title: t("create.title"),
          },
          createError: t("createError"),
          createSuccess: t("createSuccess"),
          disabled: t("disabled"),
          empty: t("empty"),
          emptyDescription: t("emptyDescription"),
          enabled: t("enabled"),
          toggleError: t("toggleError"),
          toggleSuccess: t("toggleSuccess"),
        }}
      />
    </div>
  );
}
