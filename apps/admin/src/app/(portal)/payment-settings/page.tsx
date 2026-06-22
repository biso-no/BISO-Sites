import { getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
import { PageHeader } from "../_components/page-header";
import { PaymentSettingsClient } from "./_components/payment-settings-client";
import { getPaymentSettingsView } from "./actions";

export default async function PaymentSettingsPage() {
  // portal.settings is restricted to globaladmin; the helper redirects/404s
  // for anyone else, so reaching this line means the user IS a global admin.
  await requireNavAccess("portal.settings");
  const t = await getTranslations("adminPortal.paymentSettings");
  const views = await getPaymentSettingsView();

  return (
    <div className="pb-12">
      <PageHeader description={t("description")} title={t("title")} />

      <PaymentSettingsClient
        initialViews={views}
        labels={{
          activeMode: t("activeMode"),
          activeNote: t("activeNote"),
          complete: t("complete"),
          completeFirst: t("completeFirst"),
          configured: t("configured"),
          incomplete: t("incomplete"),
          live: t("live"),
          notConfigured: t("notConfigured"),
          providers: {
            stripe: t("providers.stripe"),
            vipps: t("providers.vipps"),
          },
          save: t("save"),
          saved: t("saved"),
          saveError: t("saveError"),
          secretPlaceholder: t("secretPlaceholder"),
          setActiveLive: t("setActiveLive"),
          setActiveTest: t("setActiveTest"),
          test: t("test"),
        }}
      />
    </div>
  );
}
