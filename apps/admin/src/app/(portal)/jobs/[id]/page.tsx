import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
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
  const ctx = await requireNavAccess("portal.jobs");
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

  const isGlobalAdmin = ctx.roles.includes("globaladmin");
  const isCampusAdmin = ctx.roles.includes("campusadmin");

  const effectiveCampusId = (() => {
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
          ? ctx.managedCampusIds
          : ctx.resolvedCampusIds;
        return allowed.includes(c.$id);
      });

  const campusIdForDepts = job?.campus_id ?? effectiveCampusId;
  const departments = campusIdForDepts
    ? await listDepartmentsForCampus(campusIdForDepts)
    : [];

  const isDepartmentUser = !(isGlobalAdmin || isCampusAdmin);
  const allowedDepartmentIds =
    isDepartmentUser && ctx.resolvedDepartmentIds.length
      ? departments
          .filter((d) => ctx.resolvedDepartmentIds.includes(d.$id))
          .map((d) => d.$id)
      : undefined;

  const initialDepartments = allowedDepartmentIds
    ? departments.filter((d) => allowedDepartmentIds.includes(d.$id))
    : departments;

  return (
    <JobStudioEditor
      allowedDepartmentIds={allowedDepartmentIds}
      campuses={filteredCampuses}
      canChangeCampus={canChangeCampus}
      defaultCampusId={effectiveCampusId}
      initialDepartments={initialDepartments}
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
