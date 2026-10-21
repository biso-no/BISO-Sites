import { notFound } from "next/navigation";
import { requireNavAccess } from "@/lib/authorization";
import { getAnnouncement } from "../../_actions/announcements";
import { getGroupById } from "../../_actions/composer";
import { listCampuses } from "../../_actions/lookups";
import { AnnouncementStudioEditor } from "../_components/announcement-studio-editor";
import {
  groupIdFromParam,
  initialComposerStep,
  MESSAGE_STEP,
} from "../_components/composer/composer-state";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    group?: string | string[];
    step?: string | string[];
  }>;
}

export default async function AnnouncementEditorPage({
  params,
  searchParams,
}: Props) {
  const ctx = await requireNavAccess("portal.communications");
  const { id } = await params;
  const { group: groupParam, step } = await searchParams;
  const isNew = id === "new";

  // The event page's group "Message" link opens a new composer for that group.
  // A group outside the caller's scope resolves to null: the normal composer.
  const groupId = isNew ? groupIdFromParam(groupParam) : null;

  const [announcement, campuses, groupDetails] = await Promise.all([
    isNew ? null : getAnnouncement(id),
    listCampuses(),
    groupId ? getGroupById(groupId) : null,
  ]);
  const group = groupDetails
    ? {
        campusId: groupDetails.campusId,
        eventCampusId: groupDetails.eventCampusId,
        eventId: groupDetails.eventId,
        groupId: groupDetails.groupId,
      }
    : null;

  if (!(isNew || announcement)) {
    notFound();
  }

  const isGlobalAdmin = ctx.roles.includes("globaladmin");
  const isCampusAdmin = ctx.roles.includes("campusadmin");

  const filteredCampuses = isGlobalAdmin
    ? campuses
    : campuses.filter((campus) => {
        const allowed = isCampusAdmin
          ? ctx.managedCampusIds
          : ctx.resolvedCampusIds;
        return allowed.includes(campus.$id);
      });

  let defaultCampusId = "";
  if (isGlobalAdmin) {
    defaultCampusId = ctx.activeCampusId ?? "";
  } else if (isCampusAdmin) {
    defaultCampusId = ctx.managedCampusIds[0] ?? "";
  } else {
    defaultCampusId = ctx.resolvedCampusIds[0] ?? "";
  }

  // Department authors are pinned to their own department; campus/global
  // admins may pick any department in the campus or keep it campus-wide.
  const isAdmin = isGlobalAdmin || isCampusAdmin;
  const pinnedDepartmentId =
    !isAdmin && ctx.resolvedDepartmentIds.length === 1
      ? ctx.resolvedDepartmentIds[0]
      : null;

  return (
    <AnnouncementStudioEditor
      announcement={announcement}
      campuses={filteredCampuses.map((campus) => ({
        id: campus.$id,
        name: campus.name,
      }))}
      defaultCampusId={defaultCampusId}
      group={group}
      initialStep={group ? MESSAGE_STEP : initialComposerStep(step)}
      isGlobalAdmin={isGlobalAdmin}
      isNew={isNew}
      lockDepartment={Boolean(pinnedDepartmentId)}
      managedCampusIds={ctx.managedCampusIds}
      pinnedDepartmentId={pinnedDepartmentId}
    />
  );
}
