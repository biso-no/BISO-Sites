import { getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
import { PageHeader } from "../../_components/page-header";
import { AppVersionsClient } from "./_components/app-versions-client";
import { getAppVersionsView } from "./actions";

export default async function AppVersionsPage() {
  // portal.settings is restricted to globaladmin.
  await requireNavAccess("portal.settings");
  const t = await getTranslations("adminPortal.appVersions");
  const view = await getAppVersionsView();

  return (
    <div className="pb-12">
      <PageHeader description={t("description")} title={t("title")} />

      <AppVersionsClient
        initialView={view}
        labels={{
          androidNote: t("androidNote"),
          errors: {
            invalidMinimum: t("errors.invalidMinimum"),
            invalidRecommended: t("errors.invalidRecommended"),
            recommendedBelowMinimum: t("errors.recommendedBelowMinimum"),
          },
          liveInStore: t("liveInStore", { version: "{version}" }),
          minimum: t("minimum"),
          minimumHelp: t("minimumHelp"),
          platforms: {
            android: t("platforms.android"),
            ios: t("platforms.ios"),
          },
          recommended: t("recommended"),
          recommendedHelp: t("recommendedHelp"),
          save: t("save"),
          saved: t("saved"),
          saveError: t("saveError"),
          warnAboveStore: t("warnAboveStore"),
        }}
      />
    </div>
  );
}
