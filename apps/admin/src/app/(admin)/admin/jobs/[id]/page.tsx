import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { listCampuses, listDepartments } from "@/app/actions/events";
import { getJob } from "@/app/actions/jobs";
import JobEditor from "../shared/JobEditor";

export default async function EditJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [job, campuses, departments] = await Promise.all([
    getJob(id),
    listCampuses(),
    listDepartments(),
  ]);
  const t = await getTranslations("adminJobs");
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link className="font-medium" href={`/admin/jobs/${id}`}>
          {t("edit")}
        </Link>
        <Link
          className="text-muted-foreground hover:text-foreground"
          href={`/admin/jobs/${id}/applications`}
        >
          {t("applications.title")}
        </Link>
      </div>
      <JobEditor
        campuses={campuses as any}
        departments={departments as any}
        job={job as any}
      />
    </div>
  );
}
