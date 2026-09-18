import { getTranslations } from "next-intl/server";
import { ScannerScreen } from "@/components/member-pass-scanner/scanner-screen";
import { requireNavAccess } from "@/lib/authorization";
import { getScannerDayColor, scanMemberPass } from "../../_actions/member-pass";

export default async function MemberPassScanPage() {
  await requireNavAccess("portal.members");
  const t = await getTranslations("adminPortal.memberPass");
  const color = await getScannerDayColor();
  if (!color.success) {
    return (
      <p className="p-6 text-center text-muted-foreground">
        {t("notConfigured")}
      </p>
    );
  }
  return (
    <ScannerScreen
      dayColor={color.data}
      onScan={scanMemberPass}
      subtitle={t("scanDescription")}
      title={t("scanTitle")}
    />
  );
}
