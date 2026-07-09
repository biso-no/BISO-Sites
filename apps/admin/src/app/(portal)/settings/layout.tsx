import { requireNavAccess } from "@/lib/authorization";
import { SettingsSubnav } from "./_components/settings-subnav";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireNavAccess("portal.settings");
  return (
    <div>
      <SettingsSubnav />
      {children}
    </div>
  );
}
