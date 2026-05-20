import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getJob, listJobApplications } from "../../../_actions/jobs";
import { PageHeader } from "../../../_components/page-header";
import { StudioLinkButton } from "../../../_components/studio";
import { JobApplicationsViewSwitcher } from "../../_components/job-applications-view-switcher";

interface VacancyApplicationsPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    page?: string;
    search?: string;
    status?: string;
    view?: string;
  }>;
}

export default async function VacancyApplicationsPage({
  params,
  searchParams,
}: VacancyApplicationsPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [job, applications] = await Promise.all([
    getJob(id),
    listJobApplications({
      jobId: id,
      page: Math.max(1, Number(query.page) || 1),
      search: query.search,
      status: query.status,
    }),
  ]);

  if (!job) {
    notFound();
  }

  const title =
    job.translation_refs.find((translation) => translation.locale === "no")
      ?.title ??
    job.translation_refs[0]?.title ??
    "Vacancy";

  const initialView: "list" | "kanban" =
    query.view === "kanban" ? "kanban" : "list";

  return (
    <div className="pb-12">
      <PageHeader
        description="Review applicants for this vacancy, update statuses, and download submitted CVs."
        title={`${title} Applications`}
      >
        <StudioLinkButton href="/jobs/applications">
          <ArrowLeft size={14} />
          All applications
        </StudioLinkButton>
      </PageHeader>

      <JobApplicationsViewSwitcher
        detailRouteBase={`/jobs/${id}/applications`}
        initialApplications={applications.rows}
        initialView={initialView}
        jobId={id}
        page={Math.max(1, Number(query.page) || 1)}
        title={title}
        total={applications.total}
      />
    </div>
  );
}
