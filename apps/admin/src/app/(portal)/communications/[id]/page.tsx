import { notFound } from "next/navigation";
import { requireNavAccess } from "@/lib/authorization";
import { getAnnouncement } from "../../_actions/announcements";
import { listCampuses } from "../../_actions/lookups";
import { AnnouncementStudioEditor } from "../_components/announcement-studio-editor";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AnnouncementEditorPage({ params }: Props) {
  const ctx = await requireNavAccess("portal.communications");
  const { id } = await params;
  const isNew = id === "new";

  const [announcement, campuses] = await Promise.all([
    isNew ? null : getAnnouncement(id),
    listCampuses(),
  ]);

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
      allowGlobalCampus={isGlobalAdmin}
      announcement={announcement}
      campuses={filteredCampuses.map((campus) => ({
        id: campus.$id,
        name: campus.name,
      }))}
      defaultCampusId={defaultCampusId}
      isNew={isNew}
      lockDepartment={Boolean(pinnedDepartmentId)}
      pinnedDepartmentId={pinnedDepartmentId}
    />
  );
}
