import { requireNavAccess } from "@/lib/authorization";
import { listCampuses } from "../_actions/lookups";
import { listVarslingSettings } from "../_actions/varsling";
import { VarslingSettingsClient } from "./_components/varsling-settings-client";

export default async function VarslingPage() {
  await requireNavAccess("varsling");

  const [settings, campuses] = await Promise.all([
    listVarslingSettings(),
    listCampuses(),
  ]);

  return (
    <div className="pb-12">
      <VarslingSettingsClient
        campuses={campuses.map((campus) => ({
          id: campus.$id,
          name: campus.name,
        }))}
        settings={settings}
      />
    </div>
  );
}
