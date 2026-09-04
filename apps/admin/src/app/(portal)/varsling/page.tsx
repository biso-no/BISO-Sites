import { requireNavAccess } from "@/lib/authorization";
import { parseListParams } from "@/lib/list-params";
import { listCampuses } from "../_actions/lookups";
import { listVarslingSettings } from "../_actions/varsling";
import { VarslingSettingsClient } from "./_components/varsling-settings-client";

export default async function VarslingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireNavAccess("varsling");

  const params = parseListParams(await searchParams);
  const [{ rows: settings, total }, campuses] = await Promise.all([
    listVarslingSettings(params),
    listCampuses(),
  ]);

  return (
    <div className="pb-12">
      <VarslingSettingsClient
        campuses={campuses.map((campus) => ({
          id: campus.$id,
          name: campus.name,
        }))}
        page={params.page}
        settings={settings}
        size={params.size}
        total={total}
      />
    </div>
  );
}
