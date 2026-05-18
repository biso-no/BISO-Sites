import type { EventRecord } from "@repo/shared/types/events";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getUserAuthContext } from "@/lib/authorization";
import { getEvent, listDepartmentsForCampus } from "../../_actions/events";
import { listCampuses } from "../../_actions/lookups";
import { EventStudioEditor } from "./_components/event-studio-editor";

interface EventEditorPageProps {
  params: Promise<{ id: string }>;
}

export default async function EventEditorPage({
  params,
}: EventEditorPageProps) {
  const { id } = await params;
  const t = await getTranslations("adminPortal.events");

  const isNew = id === "new";

  const [event, campuses, ctx] = await Promise.all([
    isNew ? null : getEvent(id),
    listCampuses(),
    getUserAuthContext(),
  ]);

  if (!(isNew || event)) {
    notFound();
  }

  const isGlobalAdmin = ctx?.roles.includes("globaladmin") ?? false;
  const isCampusAdmin = ctx?.roles.includes("campusadmin") ?? false;

  const effectiveCampusId = (() => {
    if (!ctx) {
      return campuses[0]?.$id ?? "";
    }
    if (isGlobalAdmin) {
      return ctx.activeCampusId ?? campuses[0]?.$id ?? "";
    }
    if (isCampusAdmin) {
      return ctx.managedCampusIds[0] ?? campuses[0]?.$id ?? "";
    }
    return ctx.resolvedCampusIds[0] ?? campuses[0]?.$id ?? "";
  })();

  const canChangeCampus = isGlobalAdmin;
  const filteredCampuses = isGlobalAdmin
    ? campuses
    : campuses.filter((c) => {
        const allowed = isCampusAdmin
          ? (ctx?.managedCampusIds ?? [])
          : (ctx?.resolvedCampusIds ?? []);
        return allowed.includes(c.$id);
      });

  const campusIdForDepts = event?.campus_id ?? effectiveCampusId;
  const departments = campusIdForDepts
    ? await listDepartmentsForCampus(campusIdForDepts)
    : [];

  const isDepartmentUser = !(isGlobalAdmin || isCampusAdmin);
  const allowedDepartmentIds =
    isDepartmentUser && ctx?.departmentNames.length
      ? departments
          .filter((d) => ctx.departmentNames.includes(d.Name))
          .map((d) => d.$id)
      : undefined;

  const initialDepartments = allowedDepartmentIds
    ? departments.filter((d) => allowedDepartmentIds.includes(d.$id))
    : departments;

  return (
    <EventStudioEditor
      allowedDepartmentIds={allowedDepartmentIds}
      campuses={filteredCampuses}
      canChangeCampus={canChangeCampus}
      defaultCampusId={effectiveCampusId}
      event={event as unknown as EventRecord | null}
      initialDepartments={initialDepartments}
      isNew={isNew}
      labels={{
        back: t("title"),
        publish: t("actions.publish"),
        publishSuccess: t("publishSuccess"),
        saveDraft: t("actions.saveDraft"),
        saveError: t("saveError"),
        saveSuccess: t("saveSuccess"),
      }}
    />
  );
}
