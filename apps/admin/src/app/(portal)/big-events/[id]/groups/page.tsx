import { notFound } from "next/navigation";
import { requireNavAccess } from "@/lib/authorization";
import { canManageGroup } from "@/lib/big-events/access";
import { listGroups } from "../../../_actions/big-event-groups";
import { getBigEvent } from "../../../_actions/big-events";
import { GroupsTab } from "./_components/groups-view";

interface BigEventGroupsPageProps {
  params: Promise<{ id: string }>;
}

export default async function BigEventGroupsPage({
  params,
}: BigEventGroupsPageProps) {
  await requireNavAccess("portal.bigEvents");
  const { id } = await params;
  const found = await getBigEvent(id);
  if (!found) {
    notFound();
  }
  const view = await listGroups(id);

  return (
    <GroupsTab
      allowsNoCampus={canManageGroup(found.access, { campus_id: null })}
      bigEventId={found.event.$id}
      eventCampusId={found.event.campus_id}
      view={view}
    />
  );
}
