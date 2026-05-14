import type { EventRecord } from "@repo/shared/types/events";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
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

  const [event, campuses] = await Promise.all([
    isNew ? null : getEvent(id),
    listCampuses(),
  ]);

  if (!(isNew || event)) {
    notFound();
  }

  const defaultCampusId = campuses[0]?.$id ?? "";
  const campusIdForDepts = event?.campus_id ?? defaultCampusId;
  const departments = campusIdForDepts
    ? await listDepartmentsForCampus(campusIdForDepts)
    : [];

  return (
    <EventStudioEditor
      campuses={campuses}
      event={event as unknown as EventRecord | null}
      initialDepartments={departments}
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
