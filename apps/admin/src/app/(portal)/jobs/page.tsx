import { getTranslations } from "next-intl/server";
import { listJobs } from "../_actions/jobs";
import { JobStudioDashboard } from "./_components/job-studio-dashboard";

interface JobsPageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const t = await getTranslations("adminPortal.jobs");
  const tc = await getTranslations("adminPortal.common");
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const jobs = await listJobs({ page });

  return (
    <div>
      <JobStudioDashboard
        initialJobs={jobs.rows}
        labels={{
          empty: t("empty"),
          emptyDescription: t("emptyDescription"),
          searchPlaceholder: tc("search"),
          applications: t("fields.applications"),
          edit: t("actions.edit"),
          delete: t("actions.delete"),
          deleteConfirm: tc("confirmDelete"),
        }}
        page={page}
        total={jobs.total}
      />
    </div>
  );
}
