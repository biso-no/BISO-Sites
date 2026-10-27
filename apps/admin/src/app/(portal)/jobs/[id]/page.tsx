import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
import { describeJobReuse } from "@/lib/job-reuse";
import { getContentNotificationState } from "../../_actions/content-notifications";
import { getJob, getJobApplicationCount } from "../../_actions/jobs";
import {
  listCampuses,
  listJobDepartmentsForCampus,
} from "../../_actions/lookups";
import { JobStudioEditor } from "./_components/job-studio-editor";

interface JobEditorPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ duplicated?: string }>;
}

export default async function JobEditorPage({
  params,
  searchParams,
}: JobEditorPageProps) {
  const ctx = await requireNavAccess("portal.jobs");
  const { id } = await params;
  const { duplicated } = await searchParams;
  const t = await getTranslations("adminPortal.jobs");

  const isNew = id === "new";

  const [job, campuses, applicationCount] = await Promise.all([
    isNew ? null : getJob(id),
    listCampuses(),
    // Only feeds the "duplicate instead" nudge; never block the editor on it.
    isNew
      ? 0
      : getJobApplicationCount(id).catch((error: unknown) => {
          console.error("[JobEditorPage] application count failed", error);
          return 0;
        }),
  ]);

  if (!(isNew || job)) {
    notFound();
  }

  const isGlobalAdmin = ctx.roles.includes("globaladmin");
  const isHRAdmin = ctx.roles.includes("hradmin");
  const isHR = ctx.roles.includes("hr");
  const notificationState = isNew
    ? ({ kind: "none" } as const)
    : await getContentNotificationState("job", id);
  const isCampusAdmin = ctx.roles.includes("campusadmin");

  const effectiveCampusId = (() => {
    if (isGlobalAdmin || isHRAdmin) {
      return ctx.activeCampusId ?? campuses[0]?.$id ?? "";
    }
    if (isCampusAdmin) {
      return ctx.managedCampusIds[0] ?? campuses[0]?.$id ?? "";
    }
    return ctx.resolvedCampusIds[0] ?? campuses[0]?.$id ?? "";
  })();

  const canChangeCampus = isGlobalAdmin || isHRAdmin;
  const filteredCampuses =
    isGlobalAdmin || isHRAdmin
      ? campuses
      : campuses.filter((c) => {
          const allowed = isCampusAdmin
            ? ctx.managedCampusIds
            : ctx.resolvedCampusIds;
          return allowed.includes(c.$id);
        });

  const campusIdForDepts = job?.campus_id ?? effectiveCampusId;
  const departments = campusIdForDepts
    ? await listJobDepartmentsForCampus(campusIdForDepts)
    : [];

  const isDepartmentUser = !(
    isGlobalAdmin ||
    isCampusAdmin ||
    isHRAdmin ||
    isHR
  );
  const allowedDepartmentIds =
    isDepartmentUser && ctx.resolvedDepartmentIds.length
      ? departments
          .filter((d) => ctx.resolvedDepartmentIds.includes(d.$id))
          .map((d) => d.$id)
      : undefined;

  const initialDepartments = allowedDepartmentIds
    ? departments.filter((d) => allowedDepartmentIds.includes(d.$id))
    : departments;

  const reuse = job
    ? describeJobReuse({
        applicationCount,
        applicationDeadline: job.application_deadline,
        jobId: job.$id,
        status: job.status,
      })
    : null;

  return (
    <JobStudioEditor
      allowedDepartmentIds={allowedDepartmentIds}
      campuses={filteredCampuses}
      canChangeCampus={canChangeCampus}
      canNotifyNational={isGlobalAdmin || isHRAdmin}
      defaultCampusId={effectiveCampusId}
      initialDepartments={initialDepartments}
      isFreshDuplicate={Boolean(duplicated) && !isNew}
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
      notificationState={notificationState}
      reuse={reuse}
    />
  );
}
