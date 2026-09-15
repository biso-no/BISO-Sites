import { getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
import { PageHeader } from "../../_components/page-header";
import { AccountingClient } from "./_components/accounting-client";
import { getAccountingView } from "./actions";

export default async function ShopAccountingPage() {
  // Global and campus admins only; the helper 404s for everyone else.
  await requireNavAccess("portal.shopAccounting");
  const t = await getTranslations("adminPortal.shopAccounting");
  const view = await getAccountingView();

  return (
    <div className="pb-12">
      <PageHeader description={t("description")} title={t("title")} />
      <AccountingClient
        initialView={view}
        labels={{
          account: t("account"),
          active: t("active"),
          addSalesType: t("addSalesType"),
          chooseAccount: t("chooseAccount"),
          createDefaults: t("createDefaults"),
          labelEn: t("labelEn"),
          labelNo: t("labelNo"),
          neverSynced: t("neverSynced"),
          noSalesTypes: t("noSalesTypes"),
          notSaved: t("notSaved"),
          postingHint: t("postingHint"),
          postingOff: t("postingOff"),
          postingOn: t("postingOn"),
          postingTitle: t("postingTitle"),
          salesTypesHint: t("salesTypesHint"),
          salesTypesTitle: t("salesTypesTitle"),
          save: t("save"),
          saved: t("saved"),
          saveError: t("saveError"),
          clearingChangeHint: t("clearingChangeHint"),
          settingsHint: t("settingsHint"),
          settingsTitle: t("settingsTitle"),
          sortOrder: t("sortOrder"),
          stripeClearing: t("stripeClearing"),
          switchOff: t("switchOff"),
          switchOn: t("switchOn"),
          syncButton: t("syncButton"),
          syncDone: t("syncDone"),
          syncTitle: t("syncTitle"),
          vat: t("vat"),
          vatExempt: t("vatExempt"),
          vatNone: t("vatNone"),
          vatOther: t.raw("vatOther") as string,
          vatStandard: t("vatStandard"),
          vatUnknown: t("vatUnknown"),
          vippsClearing: t("vippsClearing"),
          voucherType: t("voucherType"),
          lastSynced: t.raw("lastSynced") as string,
        }}
      />
    </div>
  );
}
