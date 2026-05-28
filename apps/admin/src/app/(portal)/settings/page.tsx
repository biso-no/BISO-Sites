import { getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
import { PageHeader } from "../_components/page-header";
import { SettingsClient } from "./_components/settings-client";

export default async function SettingsPage() {
  // portal.settings is restricted to globaladmin; the helper redirects/404s
  // for anyone else, so reaching this line means the user IS a global admin.
  await requireNavAccess("portal.settings");
  const t = await getTranslations("adminPortal.settings");

  const isGlobalAdmin = true;

  return (
    <div className="pb-12">
      <PageHeader description={t("description")} title={t("title")} />

      <SettingsClient
        isGlobalAdmin={isGlobalAdmin}
        labels={{
          save: t("save"),
          sections: {
            general: t("sections.general"),
            notifications: t("sections.notifications"),
            integrations: t("sections.integrations"),
            security: t("sections.security"),
            team: t("sections.team"),
          },
          general: {
            title: t("general.title"),
            locale: t("general.locale"),
            timezone: t("general.timezone"),
          },
          notifications: {
            title: t("notifications.title"),
            newApplications: t("notifications.newApplications"),
            newDrafts: t("notifications.newDrafts"),
            systemAlerts: t("notifications.systemAlerts"),
          },
          integrations: {
            title: t("integrations.title"),
            appwrite: t("integrations.appwrite"),
            stripe: t("integrations.stripe"),
            slack: t("integrations.slack"),
            connected: t("integrations.connected"),
            notConnected: t("integrations.notConnected"),
            comingSoon: t("integrations.comingSoon"),
          },
          security: {
            title: t("security.title"),
            twoFactor: t("security.twoFactor"),
            sessions: t("security.sessions"),
            restricted: t("security.restricted"),
          },
          saveSuccess: t("saveSuccess"),
        }}
      />
    </div>
  );
}
