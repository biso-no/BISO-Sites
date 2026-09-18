import { getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
import { CAMPUS_ID_TO_NAME } from "@/lib/campus-constants";
import { ROLES } from "@/lib/roles";
import { listScannerGrants } from "../../../_actions/member-pass-scanners";
import { PageHeader } from "../../../_components/page-header";
import { ScannerAccessClient } from "./_components/scanner-access-client";

export default async function ScannerAccessPage() {
  const ctx = await requireNavAccess("portal.members");
  const t = await getTranslations("adminPortal.memberPass.access");
  const grants = await listScannerGrants();
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
      <ScannerAccessClient
        allowAllCampuses={isGlobal}
        campuses={campuses}
        initialGrants={grants.success ? grants.data : []}
        loadFailed={!grants.success}
      />
    </div>
  );
}
