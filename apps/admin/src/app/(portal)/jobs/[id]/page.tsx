import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  getJob,
  listCampuses,
  listDepartmentsForCampus,
} from "../../_actions/jobs";
import { JobStudioEditor } from "./_components/job-studio-editor";

interface JobEditorPageProps {
  params: Promise<{ id: string }>;
}

export default async function JobEditorPage({ params }: JobEditorPageProps) {
  const { id } = await params;
  const t = await getTranslations("adminPortal.jobs");

  const isNew = id === "new";

  const [job, campuses] = await Promise.all([
    isNew ? null : getJob(id),
    listCampuses(),
  ]);

  if (!(isNew || job)) {
    notFound();
  }

  const defaultCampusId = campuses[0]?.$id ?? "";
  const campusIdForDepts = job?.campus_id ?? defaultCampusId;
  const departments = campusIdForDepts
    ? await listDepartmentsForCampus(campusIdForDepts)
    : [];

  return (
    <JobStudioEditor
      campuses={campuses}
      initialDepartments={departments}
      isNew={isNew}
      job={job}
      labels={{
        back: t("title"),
        saveDraft: "Save Draft",
        publish: "Publish",
        saveSuccess: t("saveSuccess"),
        saveError: t("saveError"),
        publishSuccess: t("publishSuccess"),
      }}
    />
  );
}
