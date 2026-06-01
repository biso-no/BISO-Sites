import { getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
import { PageHeader } from "../_components/page-header";
import { SettingsClient } from "./_components/settings-client";
import { getAdminPortalSettings } from "./actions";
import { ADMIN_TIMEZONE_OPTIONS } from "./settings-model";

function hasRequiredEnv(keys: string[]): boolean {
  return keys.every((key) => Boolean(process.env[key]?.trim()));
}

export default async function SettingsPage() {
  // portal.settings is restricted to globaladmin; the helper redirects/404s
  // for anyone else, so reaching this line means the user IS a global admin.
  await requireNavAccess("portal.settings");
  const t = await getTranslations("adminPortal.settings");
  const initialSettings = await getAdminPortalSettings();

  const isGlobalAdmin = true;
  const integrations = [
    {
      connected: hasRequiredEnv([
        "NEXT_PUBLIC_APPWRITE_ENDPOINT",
        "NEXT_PUBLIC_APPWRITE_PROJECT",
        "APPWRITE_API_KEY",
      ]),
      id: "appwrite",
      name: t("integrations.appwrite"),
    },
    {
      connected: hasRequiredEnv([
        "AZURE_GRAPH_CLIENT_ID",
        "AZURE_GRAPH_CLIENT_SECRET",
        "AZURE_GRAPH_TENANT_ID",
        "M365_DOMAIN",
      ]),
      id: "microsoft365",
      name: t("integrations.microsoft365"),
    },
    {
      connected: hasRequiredEnv([
        "SHAREPOINT_CLIENT_ID",
        "SHAREPOINT_CLIENT_SECRET",
        "SHAREPOINT_TENANT_ID",
        "SHAREPOINT_SITES",
        "SHAREPOINT_DOCUMENTS_DRIVE_ID",
      ]),
      id: "sharepoint",
      name: t("integrations.sharepoint"),
    },
    {
      connected: hasRequiredEnv([
        "VIPPS_CLIENT_ID",
        "VIPPS_CLIENT_SECRET",
        "VIPPS_MERCHANT_SERIAL_NUMBER",
        "VIPPS_SUBSCRIPTION_KEY",
      ]),
      id: "vipps",
      name: t("integrations.vipps"),
    },
  ];

  return (
    <div className="pb-12">
      <PageHeader description={t("description")} title={t("title")} />

      <SettingsClient
        initialSettings={initialSettings}
        integrations={integrations}
        isGlobalAdmin={isGlobalAdmin}
        labels={{
          save: t("save"),
          saving: t("saving"),
          sections: {
            general: t("sections.general"),
            notifications: t("sections.notifications"),
            integrations: t("sections.integrations"),
            security: t("sections.security"),
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
            connected: t("integrations.connected"),
            notConfigured: t("integrations.notConfigured"),
          },
          security: {
            title: t("security.title"),
            twoFactor: t("security.twoFactor"),
            sessions: t("security.sessions"),
            managedExternally: t("security.managedExternally"),
            sessionsManaged: t("security.sessionsManaged"),
            restricted: t("security.restricted"),
          },
          saveSuccess: t("saveSuccess"),
          saveError: t("saveError"),
        }}
        timezoneOptions={[...ADMIN_TIMEZONE_OPTIONS]}
      />
    </div>
  );
}
