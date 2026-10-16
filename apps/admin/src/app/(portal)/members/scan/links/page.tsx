import { getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
import { CAMPUS_ID_TO_NAME } from "@/lib/campus-constants";
import { ROLES } from "@/lib/roles";
import { listScannerLinks } from "../../../_actions/member-pass";
import { PageHeader } from "../../../_components/page-header";
import { ScannerLinksClient } from "./_components/scanner-links-client";

export default async function ScannerLinksPage() {
  const ctx = await requireNavAccess("portal.members");
  const t = await getTranslations("adminPortal.memberPass.links");
  const links = await listScannerLinks();
  const isGlobal = ctx.roles.includes(ROLES.GLOBAL_ADMIN);
  const campusIds = isGlobal
    ? Object.keys(CAMPUS_ID_TO_NAME)
    : ctx.managedCampusIds;
  const campuses = campusIds.map((id) => ({
    id,
    name: CAMPUS_ID_TO_NAME[id] ?? id,
  }));

  return (
    <div className="pb-12">
      <PageHeader description={t("description")} title={t("title")} />
      <ScannerLinksClient
        allowAllCampuses={isGlobal}
        campuses={campuses}
        initialLinks={links.success ? links.data : []}
      />
    </div>
  );
}
