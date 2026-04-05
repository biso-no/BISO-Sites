import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  getJob,
  listCampuses,
  listDepartmentsForCampus,
} from "../../_actions/jobs";
import { JobEditorClient } from "./_components/job-editor-client";

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
    <JobEditorClient
      campuses={campuses}
      initialDepartments={departments}
      isNew={isNew}
      job={job}
      labels={{
        back: t("title"),
        titlePlaceholder: t("fields.title"),
        company: t("fields.company"),
        employmentType: t("fields.employmentType"),
        descriptionNo: t("fields.descriptionNo"),
        descriptionEn: t("fields.descriptionEn"),
        campus: t("fields.campus"),
        department: t("fields.department"),
        slug: t("fields.slug"),
        status: t("fields.status"),
        discard: "Discard",
        saveDraft: "Save Draft",
        publish: "Publish",
        preview: t("preview"),
        saveSuccess: t("saveSuccess"),
        saveError: t("saveError"),
        publishSuccess: t("publishSuccess"),
        publishError: t("publishError"),
      }}
    />
  );
}
